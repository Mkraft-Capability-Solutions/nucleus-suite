"use client";
import { readData } from '../services/workspace-data.mjs';

import { workbookLeaveReferences, workbookCompOffCredits } from '@/services/leave-reference';
import { createLeavePreviewService, adjustLeaveBalance, createLeave, decideLeave, returnFromLeave } from '@/services/leave-workflow';
import { useAuth } from './AuthContext';
import { useAppearance } from './AppearanceContext';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WORKER_CATEGORIES, WORK_CALENDARS, resolveDayType, isOTEligible } from '@/services/workCalendarService';
import {
    SHIFT_RULES, RULESET_VERSION, computeAttendanceDay, pairPunches,
    inferShift, validateGatePassQuota, formatMinutes, isGraceExempt
} from '@/services/timeOfficeEngine';
import {
    evaluateCompOffValidity, LEAVE_TYPES, LEAVE_RULESET_VERSION
} from '@/services/leaveEngine';
import {
    PAYROLL_RULESET_VERSION, PAYROLL_RUN_TYPES, NO_DUES_DEPARTMENTS,
    canViewCompensation, applyLocationScoping, calculateMaxLoanEligibility,
    computeGuarantorLockStatus, validateLoanApplication, generateOffCycleOTRun,
    generateArrearsRun, evaluateNoDuesClearance, calculateGratuity,
    calculateLeaveEncashment, calculateFnFSettlement
} from '@/services/payrollAdjacenciesService';
import {
    ESTABLISHMENT_RULESET_VERSION, DEFAULT_SANCTIONED_QUOTAS,
    calculateDepartmentCapacity, validateRequisitionCreation,
    INITIAL_ASSET_REGISTER, getEmployeeAssignedAssets,
    LETTER_TEMPLATES, renderLetterTemplate,
    INITIAL_RECOGNITIONS, INITIAL_REFERRALS,
    ASSET_TYPES, RECOGNITION_AWARD_TYPES
} from '@/services/establishmentService';
import {
    COMPLIANCE_RULESET_VERSION, ERP_FIELD_OWNERSHIP_POLICY,
    INITIAL_ERP_SYNC_LOGS, executeErpEmployeeSync,
    INITIAL_ERP_POSTING_QUEUE, validateGLBatchBalance,
    generateSapIdocXml, generateNetSuiteCsv, generateTallyPrimeXml,
    generateForm28MusterRoll, INITIAL_STATUTORY_ACCIDENTS_FORM18,
    INITIAL_INSPECTION_BOOK_FORM36, validateFormFNominees,
    generateFormFDeclaration, SAMPLE_FORM_F_TEMPLATES
} from '@/services/erpAndComplianceService';
import {
    computeAutoLeaveAllocation, evaluateCOFFLapse, isSeniorManagement, validateLeaveRestrictions
} from '@/services/autoLeaveCreditEngine';

const HRMSContext = createContext();

export const useHRMS = () => useContext(HRMSContext);

export const HRMSProvider = ({ children }) => {
    const { user: authenticatedUser } = useAuth();
    // Appearance belongs to the root provider, so auth and route changes cannot reset it.
    const { appearance, setAppearance } = useAppearance();
    const theme = appearance.mode;
    const setTheme = setAppearance;
    const toggleTheme = () => setAppearance(theme === 'dark' ? 'light' : 'dark');

    // --- TOAST NOTIFICATIONS ---
    const [toasts, setToasts] = useState([]);
    const showToast = (title, message, type = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }].slice(-3));
    };
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- 1. USER PROFILE ---
    const { user: authUser } = useAuth();
    const [user, setUser] = useState(() => authUser || authenticatedUser || { name: 'System User', role: 'EMPLOYEE', email: '', dept: 'General', location: 'HQ' });
    useEffect(() => {
        if (authUser) {
            setUser(authUser);
        }
    }, [authUser]);

    useEffect(() => {
        if (authenticatedUser?.name) {
            setUser(prev => ({ ...prev, ...authenticatedUser }));
        }
    }, [authenticatedUser]);

    useEffect(() => {
        const handleProfileUpdated = (e) => {
            if (e.detail) {
                setUser(prev => ({
                    ...prev,
                    ...e.detail,
                    name: e.detail.name || prev.name,
                    avatar: e.detail.photoUrl || prev.avatar,
                    image: e.detail.photoUrl || prev.image,
                    photo: e.detail.photoUrl || prev.photo
                }));
            }
        };
        window.addEventListener('nucleus:profile-updated', handleProfileUpdated);
        return () => window.removeEventListener('nucleus:profile-updated', handleProfileUpdated);
    }, []);

    // --- 2. ATTENDANCE & SHIFTS (Module 6) ---
    const [attendance, setAttendance] = useState({ status: 'absent', punchInTime: null, punchOutTime: null, totalHours: '0h 00m', history: [] });

    const [attendanceAnomalies] = useState([]);

    const punchIn = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAttendance(prev => ({
            ...prev,
            status: 'present',
            punchInTime: timeStr,
            history: [{ date: 'Today', in: timeStr, status: 'Present', source: 'Web Portal', log }, ...prev.history]
        }));
        showToast('Punched In', `Attendance recorded at ${timeStr}`, 'success');
    };

    const punchOut = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setAttendance(prev => ({
            ...prev,
            status: 'punched_out',
            punchOutTime: timeStr,
            history: prev.history.map((h, i) => i === 0 ? { ...h, out: timeStr, log: log || h.log } : h)
        }));
        showToast('Punched Out', `Session ended at ${timeStr}`, 'info');
    };

    // --- 2B. TIME-OFFICE & GATE PASS SUBSYSTEM (Blueprint Addendum G1 & G2) ---
    const [gatePasses, setGatePasses] = useState([
        {
            id: 'GP-2026-0141',
            employee_id: 'EMP-101',
            employee_name: 'Amit Verma',
            date: '2026-09-04',
            from: '12:00',
            to: '14:00',
            minutes: 120,
            type: 'PERSONAL',
            reason: 'Bank work & Document verification',
            status: 'APPROVED',
            approved_by: 'Policy Engine Auto-Rule',
            applied_at: '2026-09-04T10:00:00.000Z'
        },
        {
            id: 'GP-2026-0155',
            employee_id: 'EMP-101',
            employee_name: 'Amit Verma',
            date: '2026-09-11',
            from: '11:30',
            to: '13:30',
            minutes: 120,
            type: 'PERSONAL',
            reason: 'School admission counselling',
            status: 'APPROVED',
            approved_by: 'Policy Engine Auto-Rule',
            applied_at: '2026-09-11T09:30:00.000Z'
        },
        {
            id: 'GP-2026-0163',
            employee_id: 'E1023',
            employee_name: 'Kavya Venkatesh',
            date: '2026-09-15',
            from: '15:00',
            to: '17:00',
            minutes: 120,
            type: 'PERSONAL',
            reason: 'Medical checkup',
            status: 'APPROVED',
            approved_by: 'E1024',
            applied_at: '2026-09-15T14:15:00.000Z'
        },
        {
            id: 'GP-2026-0172',
            employee_id: 'E1005',
            employee_name: 'Siddharth Rao',
            date: '2026-09-16',
            from: '13:00',
            to: '15:00',
            minutes: 120,
            type: 'OFFICIAL',
            reason: 'Client plant audit site visit',
            status: 'APPROVED',
            approved_by: 'Operations Head',
            applied_at: '2026-09-16T11:00:00.000Z'
        },
        {
            id: 'GP-2026-0189',
            employee_id: 'E1012',
            employee_name: 'Pooja Sharma',
            date: '2026-09-18',
            from: '16:00',
            to: '18:00',
            minutes: 120,
            type: 'PERSONAL',
            reason: 'Personal emergency',
            status: 'PENDING',
            approved_by: 'Pending Supervisor',
            applied_at: '2026-09-18T08:30:00.000Z'
        }
    ]);

    const requestGatePass = ({ employeeId = (user?.id || 'EMP-101'), employeeName = (user?.name || 'Employee'), date = new Date().toISOString().split('T')[0], type = 'PERSONAL', minutes = 60, reason = '' }) => {
        const approvedAndPending = gatePasses.filter(gp => gp.employee_id === employeeId && gp.status !== 'REJECTED');
        const quotaCheck = validateGatePassQuota(approvedAndPending, minutes);

        if (!quotaCheck.allowed) {
            showToast('Gate Pass Rejected', quotaCheck.reason, 'error');
            return { success: false, reason: quotaCheck.reason };
        }

        const newPass = {
            id: `GP-2026-${String(gatePasses.length + 1).padStart(3, '0')}`,
            employee_id: employeeId,
            employee_name: employeeName,
            date,
            type,
            minutes,
            reason,
            status: 'APPROVED', approved_by: 'Policy Engine Auto-Rule',
            applied_at: new Date().toISOString()
        };

        setGatePasses(prev => [newPass, ...prev]);
        showToast('Gate Pass Approved', `${minutes} mins approved. ${quotaCheck.remaining_minutes} mins remaining in monthly quota.`, 'success');
        return { success: true, gatePass: newPass };
    };

    const approveGatePass = (gatePassId) => {
        setGatePasses(prev => prev.map(gp => gp.id === gatePassId ? { ...gp, status: 'APPROVED' } : gp));
        showToast('Gate Pass Approved', 'Pass updated and minutes added to attendance net span.', 'success');
    };

    // --- 2C. ATTENDANCE REGULARIZATION MULTI-STAGE WORKFLOW ---
    const [attendanceRegularizations, setAttendanceRegularizations] = useState([
        {
            id: 'REG-2026-001',
            employee_id: 'EMP-101',
            employee_name: 'Arjun Sharma',
            date: '2026-09-08',
            kind: 'missing-punch',
            reason: 'Turnstile scanner unresponsive at Gate 2',
            claimedIn: '09:02 AM',
            claimedOut: '06:35 PM',
            status: 'submitted',
            supervisor_status: 'pending',
            time_office_status: 'pending',
            created_at: '2026-09-08T18:45:00Z'
        },
        {
            id: 'REG-2026-002',
            employee_id: 'EMP-102',
            employee_name: 'Priya Nair',
            date: '2026-09-05',
            kind: 'official-duty',
            reason: 'Client site audit at Peenya Industrial Area',
            claimedIn: '09:30 AM',
            claimedOut: '07:00 PM',
            status: 'supervisor_approved',
            supervisor_status: 'approved',
            time_office_status: 'pending',
            created_at: '2026-09-05T19:10:00Z'
        }
    ]);

    const requestRegularization = async ({ employeeId = 'EMP-101', employeeName = 'Arjun Sharma', date, kind = 'missing-punch', reason = '', claimedIn = '09:00 AM', claimedOut = '06:00 PM' }) => {
        const newReg = {
            id: `REG-2026-${String(attendanceRegularizations.length + 1).padStart(3, '0')}`,
            employee_id: employeeId,
            employee_name: employeeName,
            date,
            kind,
            reason,
            claimedIn,
            claimedOut,
            status: 'submitted',
            supervisor_status: 'pending',
            time_office_status: 'pending',
            created_at: new Date().toISOString()
        };
        setAttendanceRegularizations(prev => [newReg, ...prev]);
        try {
            const targetEmpId = employeeId || 'E1001';
            const res = await fetch('/api/v1/regularizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: targetEmpId,
                    date,
                    kind,
                    reason: reason && reason.length >= 3 ? reason : 'Attendance discrepancy regularization',
                    claimedIn,
                    claimedOut
                })
            });
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json?.data?.id) {
                    newReg.dbId = json.data.id;
                }
            }
        } catch (e) {
            console.warn('Regularization DB sync notice:', e);
        }
        showToast('Regularization Submitted', `Request for ${date} queued for Shift Supervisor approval.`, 'success');
        return { success: true, regularization: newReg };
    };

    const decideRegularization = async (id, stage, approve, remarks = '') => {
        setAttendanceRegularizations(prev => prev.map(reg => {
            if (reg.id !== id) return reg;
            let newStatus = reg.status;
            let supStatus = reg.supervisor_status;
            let toStatus = reg.time_office_status;
            if (stage === 'supervisor') {
                supStatus = approve ? 'approved' : 'rejected';
                newStatus = approve ? 'supervisor_approved' : 'rejected';
            } else if (stage === 'time_office') {
                toStatus = approve ? 'approved' : 'rejected';
                newStatus = approve ? 'approved' : 'rejected';
            }
            return { ...reg, status: newStatus, supervisor_status: supStatus, time_office_status: toStatus, remarks };
        }));

        try {
            fetch(`/api/v1/regularizations/${id}/decide`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approve })
            }).catch(e => console.warn('Regularization decision DB sync notice:', e));
        } catch {}

        showToast(
            approve ? 'Regularization Approved' : 'Regularization Rejected',
            `Stage [${stage.toUpperCase()}] decision recorded.${approve && stage === 'time_office' ? ' Attendance recalculation applied.' : ''}`,
            approve ? 'success' : 'info'
        );
    };

    // Precomputed initial ledger covering all 7 Sprint 1 HR Demo points
    const [timeOfficeLedger, setTimeOfficeLedger] = useState([
        {
            id: 'TOL-0001',
            employee_id: 'E1001',
            employee_name: 'Rajesh Kumar',
            designation: 'Senior Production Engineer',
            worker_category_code: 'PERM',
            attendance_date: '2026-09-02',
            shift_id_inferred: 'SHIFT-8H (09:00 - 17:30)',
            shift_inferred: false,
            gross_minutes: 1160,
            break_minutes: 60,
            gate_pass_minutes: 0,
            net_minutes: 1100,
            formatted_net: '18h 20m',
            ot_minutes: 440,
            formatted_ot: '7h 20m',
            status: 'present',
            status_reason: 'Cross-midnight shift completed with verified dinner break and 7h20m OT credit'
        },
        {
            id: 'TOL-0002',
            employee_id: 'E1018',
            employee_name: 'Sunil Jadhav',
            designation: 'Contractual Machine Operator',
            worker_category_code: 'CONTRACT',
            attendance_date: '2026-09-06',
            shift_id_inferred: 'SHIFT-8H (08:00 - 16:30)',
            shift_inferred: false,
            gross_minutes: 510,
            break_minutes: 30,
            gate_pass_minutes: 0,
            net_minutes: 480,
            formatted_net: '8h 00m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'present',
            status_reason: 'Daily wage contractor (no rest day restriction) - standard shift validated'
        },
        {
            id: 'TOL-0003',
            employee_id: 'E1029',
            employee_name: 'Mahesh Patil',
            designation: 'Third-Party Loading Helper',
            worker_category_code: 'THIRD_PARTY_HELPER',
            attendance_date: '2026-09-07',
            shift_id_inferred: 'SHIFT-ROT (14:00 - 22:30)',
            shift_inferred: true,
            gross_minutes: 540,
            break_minutes: 45,
            gate_pass_minutes: 0,
            net_minutes: 495,
            formatted_net: '8h 15m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'present',
            status_reason: 'Third-party group helper auto-assigned rotational shift without rest day wage credit'
        },
        {
            id: 'TOL-0004',
            employee_id: 'EMP-101',
            employee_name: 'Amit Verma',
            designation: 'Assembly Specialist',
            worker_category_code: 'PERM',
            attendance_date: '2026-09-11',
            shift_id_inferred: 'SHIFT-8H (09:00 - 17:30)',
            shift_inferred: false,
            gross_minutes: 480,
            break_minutes: 45,
            gate_pass_minutes: 120,
            net_minutes: 480,
            formatted_net: '8h 00m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'present',
            status_reason: 'Approved 2h Personal Gate Pass (GP-2026-0155) credited back to net duration'
        },
        {
            id: 'TOL-0005',
            employee_id: 'E1023',
            employee_name: 'Kavya Venkatesh',
            designation: 'Operations Coordinator',
            worker_category_code: 'PERM',
            attendance_date: '2026-09-14',
            shift_id_inferred: 'SHIFT-8H (09:00 - 17:30)',
            shift_inferred: false,
            gross_minutes: 360,
            break_minutes: 30,
            gate_pass_minutes: 0,
            net_minutes: 330,
            formatted_net: '5h 30m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'half_day',
            status_reason: '4th monthly late clock-in (10:18 AM vs 09:00 AM) — Converted to Half-Day'
        },
        {
            id: 'TOL-0006',
            employee_id: 'E1005',
            employee_name: 'Siddharth Rao',
            designation: 'Plant Assistant Manager',
            worker_category_code: 'PERM',
            attendance_date: '2026-09-15',
            shift_id_inferred: 'SHIFT-8H (09:00 - 17:30)',
            shift_inferred: false,
            gross_minutes: 500,
            break_minutes: 30,
            gate_pass_minutes: 0,
            net_minutes: 470,
            formatted_net: '7h 50m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'present',
            status_reason: 'Grace exempt role (Assistant Manager) — late deduction waived per ruleset'
        },
        {
            id: 'TOL-0007',
            employee_id: 'E1012',
            employee_name: 'Pooja Sharma',
            designation: 'Warehouse Supervisor',
            worker_category_code: 'PERM',
            attendance_date: '2026-09-16',
            shift_id_inferred: 'SHIFT-8H (09:00 - 17:30)',
            shift_inferred: false,
            gross_minutes: 490,
            break_minutes: 35,
            gate_pass_minutes: 0,
            net_minutes: 455,
            formatted_net: '7h 35m',
            ot_minutes: 0,
            formatted_ot: '0m',
            status: 'present',
            status_reason: 'Long-Night Relief applied (Prior night shift ended past 03:00 AM)'
        }
    ]);

    const recomputeAttendanceRecord = ({ employee, dateStr, rawPunches, shiftId = 'SHIFT-8H', priorDay = null, monthlyLateCount = 0 }) => {
        const approvedPasses = gatePasses.filter(gp => gp.employee_id === employee.id && gp.date === dateStr && gp.status === 'APPROVED');
        const computed = computeAttendanceDay({
            employee,
            attendanceDate: dateStr,
            rawPunches,
            assignedShiftId: shiftId,
            priorAttendanceDay: priorDay,
            approvedGatePasses: approvedPasses,
            monthlyLateCount
        });

        // Upsert into timeOfficeLedger
        setTimeOfficeLedger(prev => {
            const exists = prev.findIndex(r => r.employee_id === employee.id && r.attendance_date === dateStr);
            const entry = {
                id: exists >= 0 ? prev[exists].id : `TOL-${Date.now().toString().slice(-4)}`,
                employee_id: employee.id,
                employee_name: employee.name,
                designation: employee.role || employee.designation,
                worker_category_code: employee.worker_category_code || 'PERM',
                wage_type: (WORKER_CATEGORIES[employee.worker_category_code] || WORKER_CATEGORIES.PERM).wage_type,
                location_id: employee.location_id || 'LOC-BLR-01',
                ...computed
            };
            if (exists >= 0) {
                const copy = [...prev];
                copy[exists] = entry;
                return copy;
            }
            return [entry, ...prev];
        });

        showToast('Deterministic Recalculation', `Engine ruleset ${RULESET_VERSION} recomputed ${employee.name}'s attendance.`, 'info');
        return computed;
    };

    // --- 3. LEAVES & ENTERPRISE ACCRUAL SUBSYSTEM (Blueprint Addendum G3) ---
    const leaveActor = authenticatedUser ?? {id: '', employeeId: null, role: '', name: ''};
    const [leaveService] = useState(() => createLeavePreviewService({
        requests: [...[].map(app => ({...app, version:1, contact:app.contact??'',reference_only:true})),...workbookLeaveReferences()],
        balances: readData('leave.workflow', 'accounts'),
        credits: [...[],...workbookCompOffCredits()],
        events: [],
    }));
    const [leaveState, setLeaveState] = useState(() => leaveService.snapshot());
    const leaveApplications = leaveState.requests.filter(app => ['HR_MANAGER','SUPER_ADMIN'].includes(leaveActor.role) || app.employee_id===leaveActor.employeeId || (leaveActor.role==='MANAGER' && readData('leave.workflow','reportingManagers')[app.employee_id]===leaveActor.employeeId));
    const compOffCredits = evaluateCompOffValidity(leaveState.credits.filter(credit=>credit.employee_id===leaveActor.employeeId)).credits;
    const emptyBalances = Object.fromEntries(Object.keys({ casual: { available: 0, total: 0 }, sick: { available: 0, total: 0 }, privilege: { available: 0, total: 0 } }).filter(key=>key!=='history').map(key=>[key,{available:0,total:0}]));
    const leaves = {...emptyBalances, ...leaveState.balances[leaveActor.employeeId], history:leaveApplications.filter(app=>app.employee_id===leaveActor.employeeId).map(app=>({id:app.id,type:app.leave_type_label,date:`${app.start_date} – ${app.end_date}`,duration:app.chargeable_days,status:app.status,reason:app.reason}))};
    const runLeave = async operation => {
        try {
            const next=await leaveService.execute(operation);
            setLeaveState(next);
            showToast(readData('leave.workflow','messages').saved,readData('leave.workflow','messages').preview,'success');
            return {success:true};
        } catch(error) {
            showToast(readData('leave.workflow','messages').failed,error.message,'error');
            return {success:false,reason:error.message};
        }
    };
    const adjustLeaveAllocation = ({employeeId,code,days,reason}) => runLeave(state=>adjustLeaveBalance(state,leaveActor,employeeId,code,days,reason));
    const applyLeaveWithWorkflow = async (input) => {
        const result = await runLeave(state => createLeave(state, leaveActor, input));
        if (result && result.success) {
            try {
                const empId = input.employee?.id || leaveActor.employeeId || 'E1001';
                const leaveType = ['EL', 'CL', 'SL', 'COFF', 'BIRTHDAY'].includes(input.leaveTypeCode) ? input.leaveTypeCode : 'CL';
                const startsOn = input.startDateStr || new Date().toISOString().slice(0, 10);
                const endsOn = input.endDateStr || startsOn;
                const days = Number(input.numberOfDays) || 1;
                const safeKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `leave-${Date.now()}`;
                const res = await fetch('/api/v1/leave-requests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': safeKey
                    },
                    body: JSON.stringify({
                        employeeId: empId,
                        leaveType,
                        startsOn,
                        endsOn,
                        days,
                        reason: input.reason || 'Leave application'
                    })
                });
                if (res.ok) {
                    const json = await res.json().catch(() => ({}));
                    if (json?.data?.id) {
                        setLeaveState(prev => ({
                            ...prev,
                            requests: prev.requests.map(r => r.id === result.id ? { ...r, id: json.data.id, dbId: json.data.id } : r)
                        }));
                    }
                }
            } catch (err) {
                console.warn('Backend leave persist:', err);
            }
        }
        return result;
    };
    const advanceLeaveApproval = async ({applicationId,action,remarks='',expectedVersion}) => {
        const result = await runLeave(state => decideLeave(state, leaveActor, applicationId, action, remarks, expectedVersion));
        try {
            const approve = action === 'approve' || action === 'approved';
            await fetch(`/api/v1/leave-requests/${applicationId}/decide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `decide-${Date.now()}`
                },
                body: JSON.stringify({
                    approve,
                    comment: remarks || (approve ? 'Approved' : 'Rejected')
                })
            }).catch(() => null);
        } catch (err) {
            console.warn('Backend leave decide:', err);
        }
        return result;
    };
    const processEarlyReturnApplication = ({applicationId,actualReturnDateStr}) => runLeave(state=>returnFromLeave(state,leaveActor,applicationId,actualReturnDateStr));
    const applyLeave = (type,date,duration,reason) => applyLeaveWithWorkflow({employee:{id:leaveActor.employeeId,name:leaveActor.name},leaveTypeCode:type,startDateStr:date,endDateStr:date,numberOfDays:Number(duration),reason});

    // --- 4. PEOPLE CORE (Module 1) ---
    const [employees, setEmployees] = useState(() => {
        // Initial state is empty array; live records load exclusively from database via syncWithDb
        const initial = [];
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('nucleus_custom_employees');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        // Only load user-created custom employees, never stale mock data
                        const customOnly = parsed.filter(e => e.isCustom || e._isUserCreated);
                        if (customOnly.length > 0) return customOnly;
                    }
                }
            } catch (_) {}
        }
        return initial;
    });

    const addEmployee = async (newEmp) => {
        setEmployees(prev => {
            const map = new Map();
            prev.forEach(e => map.set(e.id, e));
            map.set(newEmp.id, { ...map.get(newEmp.id), ...newEmp });
            return Array.from(map.values());
        });

        try {
            const names = (newEmp.name || '').trim().split(' ');
            const firstName = names[0] || 'Employee';
            const lastName = names.slice(1).join(' ') || 'Team';
            await fetch('/api/v1/people', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID()
                },
                body: JSON.stringify({
                    employeeCode: newEmp.id || `EMP-${Date.now().toString().slice(-4)}`,
                    firstName,
                    lastName,
                    workEmail: newEmp.email || `${firstName.toLowerCase()}@nucleus.ai`,
                    department: newEmp.dept || 'Engineering',
                    designation: newEmp.role || 'Specialist',
                    location: newEmp.location || 'Bangalore Plant',
                    joiningDate: new Date().toISOString().split('T')[0],
                    category: 'regular'
                })
            }).catch(() => null);
        } catch (err) {
            console.warn('Employee DB persistence error:', err);
        }
    };

let globalHrmsSyncPromise = null;
let lastHrmsSyncTimestamp = 0;
const HRMS_SYNC_TTL_MS = 30000;

    // Live Database Sync for Central HRMS Context (People, Leaves, Requisitions, Loans, Announcements, Regularizations, Assets)
    useEffect(() => {
        let active = true;
        async function syncWithDb() {
            const now = Date.now();
            if (globalHrmsSyncPromise) {
                try { await globalHrmsSyncPromise; } catch {}
                return;
            }
            if (now - lastHrmsSyncTimestamp < HRMS_SYNC_TTL_MS) {
                return;
            }
            lastHrmsSyncTimestamp = now;
            globalHrmsSyncPromise = (async () => {
                try {
                    return await Promise.allSettled([
                        fetch('/api/v1/people?pageSize=200'),
                        fetch('/api/v1/leave-requests?pageSize=100'),
                        fetch('/api/v1/requisitions'),
                        fetch('/api/v1/loans?pageSize=100'),
                        fetch('/api/v1/announcements'),
                        fetch('/api/v1/regularizations'),
                        fetch('/api/v1/assets?pageSize=100'),
                        fetch('/api/v1/candidates')
                    ]);
                } finally {
                    setTimeout(() => { globalHrmsSyncPromise = null; }, 5000);
                }
            })();

            try {
                const results = await globalHrmsSyncPromise;
                if (!active || !results) return;
                const [empRes, leaveRes, reqRes, loanRes, annRes, regRes, assetRes, candRes, wfRes, docRes] = results;

                // Sync live workflows from database if available
                if (wfRes && wfRes.status === 'fulfilled' && wfRes.value?.ok) {
                    const wfJson = await wfRes.value.json().catch(() => null);
                    const wfItems = Array.isArray(wfJson?.items) ? wfJson.items : (Array.isArray(wfJson?.data) ? wfJson.data : []);
                    if (wfItems.length > 0 && typeof setWorkflows === 'function') {
                        setWorkflows(wfItems.map(w => ({
                            id: w.id,
                            name: w.name || w.attributes?.name || 'Automated Workflow',
                            category: w.category || w.attributes?.category || 'General',
                            status: w.status || 'Active',
                            version: w.version ? String(w.version) : '1.0',
                            lastUpdated: w.updatedAt ? new Date(w.updatedAt).toLocaleDateString('en-GB') : 'Recent',
                            nodes: w.nodes || w.attributes?.nodes || []
                        })));
                    }
                }

                // Sync live policy documents from database if available
                if (docRes && docRes.status === 'fulfilled' && docRes.value?.ok) {
                    const docJson = await docRes.value.json().catch(() => null);
                    const docItems = Array.isArray(docJson?.items) ? docJson.items : (Array.isArray(docJson?.data) ? docJson.data : []);
                    if (docItems.length > 0 && typeof setPolicyDocuments === 'function') {
                        setPolicyDocuments(docItems.map(d => ({
                            id: d.id,
                            title: d.title || d.attributes?.title || d.name || 'Policy Document',
                            category: d.category || d.attributes?.category || 'Compliance',
                            version: d.version ? `v${d.version}` : 'v1.0',
                            effectiveDate: d.effectiveDate || (d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB') : 'Current'),
                            fileSize: d.fileSize || d.attributes?.fileSize || '1.0 MB',
                            department: d.department || d.attributes?.department || 'All Departments',
                            author: d.author || d.attributes?.author || 'Compliance Team',
                            format: d.format || d.attributes?.format || 'PDF'
                        })));
                    }
                }

                // 1. Employees from Database
                if (empRes.status === 'fulfilled' && empRes.value.ok) {
                    const json = await empRes.value.json().catch(() => null);
                    const empList = Array.isArray(json?.items) ? json.items : (Array.isArray(json?.data) ? json.data : []);
                    if (empList.length > 0) {
                        const dbPeople = empList.map(item => ({
                            id: item.employeeCode || item.id,
                            dbId: item.id,
                            name: `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Employee',
                            role: item.designation || 'Specialist',
                            dept: item.department || 'Operations',
                            manager: item.manager || item.reportingManager || item.managerName || item.metadata?.managerName || 'Unassigned',
                            location: item.location || 'Headquarters',
                            status: item.status || 'Active',
                            band: item.category || 'Regular',
                            details: item
                        }));
                        setEmployees(prev => {
                            const getKeys = (emp) => {
                                const keys = [];
                                if (emp.id) keys.push(`id:${emp.id}`.toLowerCase());
                                if (emp.dbId) keys.push(`dbId:${emp.dbId}`.toLowerCase());
                                if (emp.employeeCode) keys.push(`code:${emp.employeeCode}`.toLowerCase());
                                if (emp.details?.id) keys.push(`dbId:${emp.details.id}`.toLowerCase());
                                if (emp.details?.employeeCode) keys.push(`code:${emp.details.employeeCode}`.toLowerCase());
                                return keys;
                            };

                            const merged = [...dbPeople];
                            for (const p of prev) {
                                const pKeys = getKeys(p);
                                const matchIdx = merged.findIndex(m => {
                                    const mKeys = getKeys(m);
                                    return pKeys.some(k => mKeys.includes(k));
                                });
                                if (matchIdx >= 0) {
                                    merged[matchIdx] = { ...p, ...merged[matchIdx], details: { ...(p.details || {}), ...(merged[matchIdx].details || {}) } };
                                } else {
                                    if (p.isCustom || p._isUserCreated) {
                                        merged.push(p);
                                    }
                                }
                            }

                            const deduped = [];
                            const seen = new Set();
                            for (const emp of merged) {
                                const key = (emp.id || emp.dbId || emp.name).toLowerCase();
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    deduped.push(emp);
                                }
                            }

                            if (typeof window !== 'undefined') {
                                try {
                                    localStorage.setItem('nucleus_custom_employees', JSON.stringify(deduped));
                                } catch (_) {}
                            }
                            return deduped;
                        });
                    }
                }

                // 2. Leaves from Database
                if (leaveRes.status === 'fulfilled' && leaveRes.value.ok) {
                    const leaveJson = await leaveRes.value.json().catch(() => null);
                    const rawLeaves = Array.isArray(leaveJson?.data) ? leaveJson.data : (Array.isArray(leaveJson?.items) ? leaveJson.items : []);
                    if (rawLeaves.length > 0) {
                        const mappedRequests = rawLeaves.map(lr => ({
                            id: lr.id,
                            dbId: lr.id,
                            employee_id: lr.employee_id,
                            employee_name: 'Employee',
                            leave_type_code: lr.leave_type,
                            leave_type_label: lr.leave_type === 'CL' ? 'Casual Leave' : (lr.leave_type === 'EL' ? 'Earned Leave' : lr.leave_type),
                            start_date: lr.starts_on,
                            end_date: lr.ends_on,
                            chargeable_days: lr.requested_days,
                            reason: lr.reason || 'Personal leave',
                            status: lr.status || 'pending_supervisor',
                            version: lr.version || 1
                        }));
                        setLeaveState(prev => {
                            const reqMap = new Map();
                            prev.requests.forEach(r => reqMap.set(r.id, r));
                            mappedRequests.forEach(r => reqMap.set(r.id, { ...reqMap.get(r.id), ...r }));
                            return { ...prev, requests: Array.from(reqMap.values()) };
                        });
                    }
                }

                // 3. Requisitions from Database
                if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
                    const reqJson = await reqRes.value.json().catch(() => null);
                    const rawReqs = Array.isArray(reqJson?.data) ? reqJson.data : (Array.isArray(reqJson?.items) ? reqJson.items : []);
                    if (rawReqs.length > 0) {
                        const dbPositions = rawReqs.map(r => ({
                            id: r.id,
                            dbId: r.id,
                            code: r.code || r.positionCode,
                            title: r.title || 'Open Position',
                            dept: r.departmentName || 'Operations',
                            status: r.status === 'draft' ? 'Open' : r.status,
                            openings: 1,
                            applicants: 0,
                            createdDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
                            requisitionType: 'addition'
                        }));
                        setPositions(prev => {
                            const posMap = new Map();
                            prev.forEach(p => posMap.set(p.id, p));
                            dbPositions.forEach(p => posMap.set(p.id, { ...posMap.get(p.id), ...p }));
                            return Array.from(posMap.values());
                        });
                    }
                }

                // 3B. Loans from Database
                if (loanRes.status === 'fulfilled' && loanRes.value.ok) {
                    const loanJson = await loanRes.value.json().catch(() => null);
                    const rawLoans = Array.isArray(loanJson?.data) ? loanJson.data : (Array.isArray(loanJson?.items) ? loanJson.items : []);
                    if (rawLoans.length > 0) {
                        const dbLoans = rawLoans.map(l => ({
                            id: l.id,
                            dbId: l.id,
                            borrowerId: l.employee_id || 'E1001',
                            borrowerName: 'Employee',
                            borrowerRole: 'Specialist',
                            borrowerDept: 'Operations',
                            principalAmount: l.principal_minor ? l.principal_minor / 100 : 50000,
                            remainingBalance: l.outstanding_minor ? l.outstanding_minor / 100 : 50000,
                            monthlyEMI: 4500,
                            tenureMonths: 12,
                            purpose: l.purpose || 'Personal / Household',
                            status: l.status || 'Active',
                            guarantors: [],
                            guarantorNames: ['Suresh Rao (Guarantor 1)', 'Kavitha M (Guarantor 2)'],
                            paidInstallments: 0
                        }));
                        setCompanyLoans(prev => {
                            const loanMap = new Map();
                            prev.forEach(item => loanMap.set(item.id, item));
                            dbLoans.forEach(item => loanMap.set(item.id, { ...loanMap.get(item.id), ...item }));
                            return Array.from(loanMap.values());
                        });
                    }
                }

                // 4. Announcements from Database
                if (annRes.status === 'fulfilled' && annRes.value.ok) {
                    const annJson = await annRes.value.json().catch(() => null);
                    const rawAnn = Array.isArray(annJson?.data) ? annJson.data : (Array.isArray(annJson?.items) ? annJson.items : []);
                    if (rawAnn.length > 0) {
                        const dbAnn = rawAnn.map(a => ({
                            id: a.id,
                            title: a.attributes?.Title || a.attributes?.title || 'Notice',
                            category: a.attributes?.Type || a.attributes?.category || 'General',
                            content: a.attributes?.Body || a.attributes?.body || a.attributes?.Title || '',
                            date: a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
                            author: a.attributes?.['Created by'] || 'Management',
                            pinned: false
                        }));
                        setAnnouncements(prev => {
                            const annMap = new Map();
                            prev.forEach(item => annMap.set(item.id, item));
                            dbAnn.forEach(item => annMap.set(item.id, { ...annMap.get(item.id), ...item }));
                            return Array.from(annMap.values());
                        });
                    }
                }

                // 5. Attendance Regularizations from Database
                if (regRes.status === 'fulfilled' && regRes.value.ok) {
                    const regJson = await regRes.value.json().catch(() => null);
                    const rawRegs = Array.isArray(regJson?.data) ? regJson.data : (Array.isArray(regJson?.items) ? regJson.items : []);
                    if (rawRegs.length > 0) {
                        const dbRegs = rawRegs.map(r => ({
                            id: r.id,
                            dbId: r.id,
                            employee_id: r.employeeCode || 'EMP-101',
                            employee_name: r.employeeName || 'Employee',
                            date: r.date,
                            kind: r.kind || 'missing-punch',
                            reason: r.reason || 'Punch irregularity',
                            claimedIn: r.claimedIn || '09:00 AM',
                            claimedOut: r.claimedOut || '06:00 PM',
                            status: r.status || 'submitted',
                            supervisor_status: r.status === 'approved' ? 'approved' : 'pending',
                            time_office_status: r.status === 'approved' ? 'approved' : 'pending',
                            created_at: r.createdAt || new Date().toISOString()
                        }));
                        setAttendanceRegularizations(prev => {
                            const regMap = new Map();
                            prev.forEach(item => regMap.set(item.id, item));
                            dbRegs.forEach(item => regMap.set(item.id, { ...regMap.get(item.id), ...item }));
                            return Array.from(regMap.values());
                        });
                    }
                }

                // 6. Assets from Database
                if (assetRes.status === 'fulfilled' && assetRes.value.ok) {
                    const assetJson = await assetRes.value.json().catch(() => null);
                    const rawAssets = Array.isArray(assetJson?.data) ? assetJson.data : (Array.isArray(assetJson?.items) ? assetJson.items : []);
                    if (rawAssets.length > 0) {
                        const dbAssets = rawAssets.map(a => ({
                            id: a.id,
                            dbId: a.id,
                            assetType: a.attributes?.asset_type || a.asset_type || 'Hardware',
                            brand: a.attributes?.brand || a.brand || 'Enterprise',
                            model: a.attributes?.model || a.model || 'Standard Device',
                            serialNumber: a.attributes?.serial_number || a.serial_number || a.id,
                            assetTag: a.attributes?.asset_code || a.asset_code || a.id,
                            assignedToEmployeeId: a.attributes?.assigned_to_id || null,
                            assignedToName: a.attributes?.assigned_to_name || 'Assigned Staff',
                            assignedDate: a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                            status: a.attributes?.status || a.status || 'Allocated',
                            condition: 'Excellent',
                            replacementValue: 50000
                        }));
                        setHardwareAssets(prev => {
                            const assetMap = new Map();
                            prev.forEach(item => assetMap.set(item.id, item));
                            dbAssets.forEach(item => assetMap.set(item.id, { ...assetMap.get(item.id), ...item }));
                            return Array.from(assetMap.values());
                        });
                    }
                }

                // 7. Candidates from Database
                if (candRes?.status === 'fulfilled' && candRes.value.ok) {
                    const candJson = await candRes.value.json().catch(() => null);
                    const rawCands = Array.isArray(candJson?.data) ? candJson.data : (Array.isArray(candJson?.items) ? candJson.items : []);
                    if (rawCands.length > 0 && typeof setCandidates === 'function') {
                        const dbCands = rawCands.map(c => {
                            let skillsArr = ['Operations', 'Specialist', 'Enterprise'];
                            if (Array.isArray(c?.skills) && c.skills.length > 0) {
                                skillsArr = c.skills;
                            } else if (typeof c?.skills === 'string' && c.skills.trim()) {
                                try {
                                    const parsed = JSON.parse(c.skills);
                                    skillsArr = Array.isArray(parsed) ? parsed : c.skills.split(',').map(s => s.trim()).filter(Boolean);
                                } catch {
                                    skillsArr = c.skills.split(',').map(s => s.trim()).filter(Boolean);
                                }
                            } else if (Array.isArray(c?.attributes?.skills) && c.attributes.skills.length > 0) {
                                skillsArr = c.attributes.skills;
                            }

                            return {
                                id: c.id,
                                name: c.name || 'Candidate',
                                role: c.role || c.targetRole || 'Specialist',
                                dept: c.dept || c.department || 'Operations',
                                stage: c.stage || 'sourced',
                                rating: c.rating || 4.5,
                                matchScore: c.matchScore || c.score || 92,
                                exp: c.exp || (c.experience ? `${c.experience} yrs` : '3 yrs'),
                                biasScore: c.biasScore || 'Fair & Neutral',
                                skills: skillsArr,
                                appliedDate: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GB') : 'Recent',
                                source: c.source || 'Referral'
                            };
                        });
                        setCandidates(prev => {
                            const candMap = new Map();
                            (prev || []).forEach(item => candMap.set(item.id, item));
                            dbCands.forEach(item => candMap.set(item.id, { ...candMap.get(item.id), ...item }));
                            return Array.from(candMap.values());
                        });
                    }
                }
            } catch (err) {
                console.warn('Central HRMSContext live sync error:', err);
            }
        }
        syncWithDb();
        return () => { active = false; };
    }, []);

    // --- 4B. MY TEAM PODS (Module 1 / Pod Directory) ---
    const [teamMembers, setTeamMembers] = useState([]);

    // --- 4C. POSITIONS & ESTABLISHMENT CONTROL (Sprint 4: Demo Points 24 & 25) ---
    const [sanctionedQuotas, setSanctionedQuotas] = useState(DEFAULT_SANCTIONED_QUOTAS);
    const [positions, setPositions] = useState([]);

    const createJobRequisition = async (reqData) => {
        const validation = validateRequisitionCreation({
            ...reqData,
            employees,
            openPositions: positions,
            quotas: sanctionedQuotas
        });

        if (!validation.isValid) {
            showToast('Requisition Creation Blocked', validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        const newPos = {
            id: `POS-${Date.now().toString().slice(-4)}`,
            title: reqData.title,
            dept: reqData.dept,
            openSlots: 1, filled: 0,
            budget: reqData.budget || '₹20,00,000 / yr',
            status: 'Hiring Active',
            requisitionType: reqData.requisitionType || 'NEW_ADDITION',
            vacatedPositionCode: reqData.vacatedPositionCode || null,
            previousIncumbentId: reqData.previousIncumbentId || null,
            isExecutiveWaiver: reqData.isExecutiveWaiver || false,
            waiverReason: reqData.waiverReason || null,
            createdDate: new Date().toLocaleDateString('en-GB')
        };

        setPositions(prev => [newPos, ...prev]);

        // Persist to database
        try {
            const res = await fetch('/api/v1/requisitions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `req-${Date.now()}`
                },
                body: JSON.stringify({
                    title: reqData.title,
                    departmentName: reqData.dept || 'Operations',
                    positionCode: reqData.positionCode || 'POS-01',
                    hiringManagerEmployeeId: reqData.hiringManagerId || employees[0]?.id
                })
            });
            if (res.ok) {
                const json = await res.json().catch(() => ({}));
                if (json?.data?.code) {
                    newPos.code = json.data.code;
                    newPos.dbId = json.data.id;
                }
            }
        } catch (err) {
            console.warn('Requisition database persist:', err);
        }

        showToast(
            'Requisition Opened',
            `${newPos.title} created under ${newPos.dept} (${newPos.requisitionType}).`,
            'success'
        );
        return { success: true, position: newPos };
    };

    // --- 4D. HARDWARE ASSET ALLOCATION & SERIAL TRACKING (Sprint 4: Demo Point 23) ---
    const [hardwareAssets, setHardwareAssets] = useState(INITIAL_ASSET_REGISTER);

    const allocateHardwareAsset = async (assetData) => {
        const newAsset = {
            id: `AST-${crypto.randomUUID()}`,
            assetType: assetData.assetType || 'LAPTOP',
            brand: assetData.brand || 'Corporate Hardware',
            model: assetData.model,
            serialNumber: assetData.serialNumber,
            assetTag: assetData.assetTag || `NUC-IT-${crypto.randomUUID().slice(0, 8)}`,
            assignedToEmployeeId: assetData.assignedToEmployeeId,
            assignedToName: employees.find(e => e.id === assetData.assignedToEmployeeId)?.name || 'Employee',
            assignedDate: new Date().toISOString().split('T')[0],
            status: 'ASSIGNED',
            condition: assetData.condition || 'New',
            replacementValue: Number(assetData.replacementValue) || 100000
        };

        setHardwareAssets(prev => [newAsset, ...prev]);

        // Persist to database
        try {
            await fetch('/api/v1/assets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ast-${Date.now()}`
                },
                body: JSON.stringify({
                    assetCode: newAsset.assetTag,
                    assetType: 'laptop',
                    brand: newAsset.brand || 'Generic',
                    model: newAsset.model || 'Model X',
                    serialNumber: newAsset.serialNumber || newAsset.assetTag,
                    attributes: {
                        assignedTo: newAsset.assignedToName,
                        assignedToEmployeeId: newAsset.assignedToEmployeeId
                    }
                })
            }).catch(() => null);
        } catch (err) {
            console.warn('Asset database persist:', err);
        }

        showToast('Asset Allocated', `${newAsset.model} (SN: ${newAsset.serialNumber}) assigned to ${newAsset.assignedToName}.`, 'success');
        return newAsset;
    };

    const markAssetReturned = (assetId, condition = 'Good', remarks = '') => {
        setHardwareAssets(prev => prev.map(a => {
            if (a.id !== assetId) return a;
            return {
                ...a,
                status: 'RETURNED_AVAILABLE',
                returnDate: new Date().toISOString().split('T')[0],
                condition,
                returnRemarks: remarks
            };
        }));
        showToast('Asset Surrendered & Verified', `Hardware returned into inventory. Verified for F&F clearance.`, 'info');
    };

    // --- 4E. EMPLOYEE RECOGNITION, REFERRALS & LETTERS (Sprint 4: Demo Points 18, 19, 20, 21) ---
    const [recognitionAwards, setRecognitionAwards] = useState(INITIAL_RECOGNITIONS);
    const [employeeReferrals, setEmployeeReferrals] = useState(INITIAL_REFERRALS);

    const grantRecognitionAward = (awardData) => {
        const emp = employees.find(e => e.id === awardData.employeeId);
        const newAward = {
            id: `AWD-${Date.now().toString().slice(-4)}`,
            employeeId: awardData.employeeId,
            employeeName: emp ? emp.name : awardData.employeeName || 'Staff Member',
            dept: emp ? emp.dept : 'General',
            awardType: awardData.awardType || 'SPOT_AWARD',
            citation: awardData.citation,
            rewardAmount: Number(awardData.rewardAmount) || 10000,
            awardedBy: user?.name || 'Executive Leadership',
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            status: 'APPROVED_AND_BROADCAST'
        };

        setRecognitionAwards(prev => [newAward, ...prev]);
        showToast('Recognition Broadcasted', `${newAward.employeeName} recognized with ${newAward.awardType} (₹${newAward.rewardAmount.toLocaleString()})!`, 'success');
        return newAward;
    };

    const submitEmployeeReferral = async (refData) => {
        const newRef = {
            id: `REF-${crypto.randomUUID()}`,
            candidateName: refData.candidateName,
            role: refData.role,
            dept: refData.dept || 'Engineering',
            referredByEmployeeId: user?.id || (user?.id || 'EMP-101'),
            referredByName: user?.name || (user?.name || 'Employee'),
            status: 'Under Review'
        };

        setEmployeeReferrals(prev => [newRef, ...prev]);

        // Persist candidate and referral to backend database
        try {
            const candRes = await fetch('/api/v1/candidates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cand-${Date.now()}`
                },
                body: JSON.stringify({
                    name: refData.candidateName,
                    source: 'referral'
                })
            });
            if (candRes.ok) {
                const candData = await candRes.json().catch(() => null);
                if (candData?.id) {
                    newRef.candidateId = candData.id;
                    await fetch('/api/v1/referrals', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ref-${Date.now()}`
                        },
                        body: JSON.stringify({
                            candidateId: candData.id,
                            note: `Referred for ${refData.role} in ${refData.dept || 'Operations'}`
                        })
                    }).catch(() => {});
                }
            }
        } catch (err) {
            console.warn('Referral database persist:', err);
        }

        showToast('Referral Submitted', `Referral submitted for ${newRef.candidateName}. Milestone payout tracking active.`, 'success');
        return newRef;
    };

    const generateHRLetter = (templateId, employeeId, customFields = {}) => {
        const defaultEmp = { id: 'EMP-001', name: 'Staff Member', role: 'Specialist', dept: 'Operations' };
        const emp = (Array.isArray(employees) && employees.length > 0 ? (employees.find(e => e.id === employeeId) || employees[0]) : null) || defaultEmp;
        return renderLetterTemplate(templateId, emp, customFields);
    };

    const [documents] = useState([]);

    const [auditLogs] = useState([]);

    // --- 5. PAYROLL & EARNED WAGE ACCESS (Module 2) ---
    const [payrollSummary] = useState({ grossPay: 0, netPay: 0, deductions: 0, taxes: 0, reimbursements: 0, period: 'Current Month' });

    const [ewaTransactions, setEwaTransactions] = useState([]);

    const requestEWA = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) return;
        setEwaTransactions(prev => [{
            id: `EWA-${crypto.randomUUID()}`,
            date: 'Today',
            amount: `₹ ${num.toLocaleString()}`,
            status: 'Instant Disbursed to Bank', fee: '₹ 0'
        }, ...prev]);
        showToast('EWA Transfer Complete', `₹ ${num.toLocaleString()} instant credited to your salary account.`, 'success');
    };

    // --- 5B. ADVANCED PAYROLL ADJACENCIES & LOCATION SCOPING (Sprint 3: Demo Points 8, 9, 10, 16) ---
    // User Role Context (For Demo Point 8 Location Scoping Simulation)
    const [currentRoleContext, setCurrentRoleContext] = useState({ role: 'HO_HR_ADMIN', scope: 'ENTERPRISE', location: 'Corporate Head Office' });

    const switchUserRole = (newRole, newScope, newLocation) => {
        setCurrentRoleContext({
            role: newRole,
            scope: newScope,
            location: newLocation || (newScope === 'PLANT' ? 'Bengaluru Plant Unit-1' : 'Corporate Head Office')
        });
        showToast(
            'Security Scope Switched',
            `Active context: ${newRole} (${newScope}). Location scoping & salary masking updated.`,
            'info'
        );
    };

    // Demo Point 9: Company Loan Scheme with Dual-Guarantor Lock
    const [companyLoans, setCompanyLoans] = useState([]);

    const applyForCompanyLoan = (loanRequest) => {
        const validation = validateLoanApplication({
            ...loanRequest,
            activeLoans: companyLoans,
            employeeDirectory: employees
        });

        if (!validation.isValid) {
            showToast('Loan Application Rejected', validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        const newLoan = {
            id: `LOAN-${crypto.randomUUID()}`,
            borrowerId: loanRequest.applicantId,
            borrowerName: validation.computed.applicantName,
            borrowerRole: employees.find(e => e.id === loanRequest.applicantId)?.role || 'Employee',
            borrowerDept: employees.find(e => e.id === loanRequest.applicantId)?.dept || 'General',
            principalAmount: validation.computed.requestedAmount,
            remainingBalance: validation.computed.requestedAmount,
            monthlyEMI: validation.computed.monthlyEMI,
            tenureMonths: validation.computed.tenureMonths,
            paidInstallments: 0, disbursedAt: 'Today',
            purpose: loanRequest.purpose || 'Personal Welfare',
            guarantors: validation.computed.guarantors,
            guarantorNames: validation.computed.guarantors.map(gid => {
                const emp = employees.find(e => e.id === gid);
                return `${emp?.name || gid} (${gid})`;
            }),
            status: 'ACTIVE',
            isManagementOverride: validation.computed.isManagementOverride,
            overrideReason: validation.computed.overrideReason
        };

        setCompanyLoans(prev => [newLoan, ...prev]);

        try {
            const applicant = employees.find(e => e.id === loanRequest.applicantId);
            const targetEmpId = applicant?.dbId || applicant?.id || loanRequest.applicantId;
            const safeKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `loan-${Date.now()}`;
            fetch('/api/v1/loans', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': safeKey
                },
                body: JSON.stringify({
                    employeeId: targetEmpId,
                    principalMinor: Math.round(newLoan.principalAmount * 100),
                    tenureMonths: newLoan.tenureMonths || 12,
                    annualRatePct: 8.5,
                    purpose: (newLoan.purpose || 'household').toLowerCase().includes('medical') ? 'medical' : 'marriage',
                    guarantorEmployeeIds: [
                        employees[0]?.dbId || employees[0]?.id || '84f20ef2-2cfe-4642-a6d0-bd42d4d33a35',
                        employees[1]?.dbId || employees[1]?.id || '9ff7882c-26ec-49d2-ba6a-93effd60a6d5'
                    ]
                })
            }).then(r => r.json()).then(data => {
                if (data?.data?.id) newLoan.dbId = data.data.id;
            }).catch(e => console.warn('Loan database sync notice:', e));
        } catch (err) {
            console.warn('Loan database persist:', err);
        }

        showToast(
            'Loan Approved & Disbursed',
            `₹${newLoan.principalAmount.toLocaleString()} loan created. Both guarantors are now LOCKED from raising loans.`,
            'success'
        );
        return { success: true, loan: newLoan };
    };

    const repayLoanEMI = (loanId) => {
        setCompanyLoans(prev => prev.map(loan => {
            if (loan.id !== loanId) return loan;
            const newRemaining = Math.max(0, loan.remainingBalance - loan.monthlyEMI);
            const newPaid = loan.paidInstallments + 1;
            const isSettled = newRemaining === 0;
            return {
                ...loan,
                remainingBalance: newRemaining,
                paidInstallments: newPaid,
                status: isSettled ? 'REPAID' : 'ACTIVE'
            };
        }));
        showToast('EMI Deducted', `Monthly installment deducted from salary account.`, 'info');
    };

    // Demo Point 10: Off-Cycle Payroll Runs
    const [payrollRuns, setPayrollRuns] = useState([]);

    const createOffCycleRun = (type, customParams = {}) => {
        let newRun;
        if (type === 'OFF_CYCLE_OT') {
            const otRecords = [];
            newRun = generateOffCycleOTRun({
                cyclePeriod: customParams.period || 'Feb 2026 OT',
                otRecords,
                employees
            });
        } else if (type === 'ARREARS') {
            newRun = generateArrearsRun({
                cyclePeriod: customParams.period || 'Feb 2026 Arrears',
                arrearsItems: []
            });
        } else {
            newRun = {
                id: `RUN-${type}-${Date.now().toString().slice(-4)}`,
                type,
                label: `${type} Cycle Run`,
                cyclePeriod: customParams.period || 'Current Period',
                batchDate: new Date().toISOString().split('T')[0],
                status: 'Draft', totalDisbursement: 0,
                bankFileRef: `NEFT_${type}_${Date.now().toString().slice(-4)}.txt`
            };
        }

        setPayrollRuns(prev => [newRun, ...prev]);
        showToast('Payroll Run Created', `${newRun.label} (${newRun.type}) created and queued for bank disbursal.`, 'success');
        return newRun;
    };

    // Demo Point 16: Same-Day Full & Final (F&F) Settlement & 4-Department No-Dues
    const [fnfSettlements, setFnfSettlements] = useState([]);

    const updateDepartmentNoDues = (settlementId, deptKey, newStatus, remarks, serialNo) => {
        setFnfSettlements(prev => prev.map(s => {
            if (s.settlementId !== settlementId) return s;
            const updatedClearances = {
                ...s.departmentClearances,
                [deptKey]: {
                    ...s.departmentClearances[deptKey],
                    status: newStatus,
                    remarks: remarks || s.departmentClearances[deptKey]?.remarks,
                    serialNo: serialNo || s.departmentClearances[deptKey]?.serialNo,
                    verifiedAt: new Date().toLocaleDateString('en-GB')
                }
            };
            const evalResult = evaluateNoDuesClearance(updatedClearances);
            return {
                ...s,
                departmentClearances: updatedClearances,
                status: evalResult.allCleared ? 'CLEARED_FOR_DISBURSEMENT' : 'CLEARANCE_IN_PROGRESS'
            };
        }));

        try {
            fetch(`/api/v1/fnf-settlements/${settlementId}/clear-department`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department: deptKey.toLowerCase(),
                    status: newStatus.toLowerCase() === 'cleared' ? 'cleared' : 'pending',
                    remarks: remarks || 'Clearance updated in UI'
                })
            }).catch(e => console.warn('FnF department clearance DB sync notice:', e));
        } catch {}

        showToast(
            'No-Dues Checkpoint Updated',
            `${deptKey} department clearance set to ${newStatus}.`,
            newStatus === 'CLEARED' ? 'success' : 'info'
        );
    };

    const disburseFnFSettlement = (settlementId) => {
        const item = fnfSettlements.find(s => s.settlementId === settlementId);
        if (!item) return;

        const evalResult = evaluateNoDuesClearance(item.departmentClearances);
        if (!evalResult.allCleared) {
            showToast(
                'Disbursement Blocked',
                `Physically blocked: Clearances pending in [${evalResult.pendingDepartments.join(', ')}].`,
                'error'
            );
            return;
        }

        const paymentRef = `IMPS-FNF-${Date.now().toString().slice(-8)}`;

        setFnfSettlements(prev => prev.map(s => s.settlementId === settlementId ? {
            ...s,
            status: 'DISBURSED',
            settlementStatus: 'DISBURSED',
            disbursedAt: new Date().toISOString(),
            disbursedBy: authenticatedUser?.name || 'HR Admin',
            paymentRef,
        } : s));

        try {
            fetch(`/api/v1/fnf-settlements/${settlementId}/disburse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionRef: paymentRef,
                    paidAt: new Date().toISOString().slice(0, 10)
                })
            }).catch(e => console.warn('FnF disbursement DB sync notice:', e));
        } catch {}

        showToast(
            'F&F Disbursed',
            `Full & Final settlement disbursed via IMPS batch file. Net pay transferred to employee account.`,
            'success'
        );
    };
    const [candidates, setCandidates] = useState([]);

    const moveCandidate = async (id, newStage) => {
        setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage: newStage } : c));
        try {
            await fetch(`/api/v1/applications/${id}/advance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `cand-${Date.now()}`
                },
                body: JSON.stringify({ to: newStage })
            }).catch(() => {});
        } catch (err) {
            console.warn('Candidate stage advance:', err);
        }
        showToast('Candidate Stage Updated', `Candidate moved to ${newStage.toUpperCase()}`, 'info');
    };

    // --- 7. ONBOARDING & LIFECYCLE (Module 4) ---
    const [onboardingTasks, setOnboardingTasks] = useState([]);

    const completeOnboardingTask = (id) => {
        setOnboardingTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'Completed' } : t));
        showToast('Onboarding Progress Updated', 'Milestone marked as complete.', 'success');
    };

    // --- 8. PERFORMANCE & OKR CASCADE (Module 5) ---
    const [okrs, setOkrs] = useState([]);

    const [talentMatrix] = useState([]);

    const addGoal = () => {
        const newGoal = {
            id: Date.now(),
            id: 'okr-' + Date.now(), title: 'New Strategic Objective', category: 'Operational Excellence', progress: 0,
            owner: user.name,
            keyResults: []
        };
        setOkrs([...okrs, newGoal]);
    };

    // --- 9. PEOPLE INTELLIGENCE & ANALYTICS (Module 7) ---
    const [analyticsData] = useState({});

    // --- 10. LEARNING & DEVELOPMENT (Module 8) ---
    const [courses, setCourses] = useState([]);

    // --- 11. COMPENSATION & BENEFITS (Module 9) ---
    const [compensationData] = useState({});

    // --- 12. EMPLOYEE EXPERIENCE, MCI & VEDIC WELLBEING (Module 10) ---
    const [mciScore] = useState(85);

    const [vedicFramework, setVedicFramework] = useState({});

    const [socialFeed, setSocialFeed] = useState([]);

    const addKudos = (id) => {
        setSocialFeed(prev => prev.map(p => p.id === id ? { ...p, kudos: p.kudos + 1 } : p));
        showToast('Kudos Sent!', 'You celebrated your teammate’s contribution.', 'success');
    };

    // --- 13. INTEGRATIONS & API PLATFORM (Module 11) ---
    const [connectors, setConnectors] = useState([]);

    const [apiKeys, setApiKeys] = useState([]);

    // --- PROJECTS / TASKS (Kanban) ---
    const [projects, setProjects] = useState([]);

    const [kanbanTasks, setKanbanTasks] = useState({ backlog: [], in_progress: [], review: [], done: [] });

    const moveTask = (taskId, fromCol, toCol) => {
        const task = kanbanTasks[fromCol]?.find(t => t.id === taskId);
        if (!task) return;
        setKanbanTasks(prev => ({
            ...prev,
            [fromCol]: prev[fromCol].filter(t => t.id !== taskId),
            [toCol]: [task, ...prev[toCol]]
        }));
    };

    const addTask = (taskData) => {
        const newTask = {
            id: 't-' + Date.now(),
            title: taskData.title || 'New Task',
            tag: taskData.tag || 'General',
            assignee: taskData.assignee || (user?.name || 'Employee'),
            project: taskData.project || 'General Tasks',
            due: taskData.due || 'In 3 days',
            priority: taskData.priority || 'Medium'
        };
        setKanbanTasks(prev => ({
            ...prev,
            todo: [newTask, ...prev.todo]
        }));

        // Grant visibility: auto-enroll assignee in project members if not present
        setProjects(prev => prev.map(p => {
            if (p.title === newTask.project) {
                const alreadyMember = p.members.some(m =>
                    m.toLowerCase().includes(newTask.assignee.toLowerCase()) ||
                    newTask.assignee.toLowerCase().includes(m.toLowerCase())
                );
                if (!alreadyMember) {
                    return { ...p, members: [...p.members, newTask.assignee] };
                }
            }
            return p;
        }));

        showToast('Task Assigned', `Assigned "${newTask.title}" to ${newTask.assignee}.`, 'success');
        return newTask;
    };

    const addProject = (projectData) => {
        const newProj = {
            id: 'proj-' + Date.now(),
            title: projectData.title || 'New Project',
            desc: projectData.desc || 'Sprint deliverables and milestone tracking.',
            progress: Number(projectData.progress) || 0,
            color: projectData.color || '#2DD4A8',
            due: projectData.due || 'In 30 days',
            members: projectData.members && projectData.members.length > 0 ? projectData.members : [],
            createdBy: user?.name || (user?.name || 'Employee'),
            visibility: projectData.visibility || 'team' // 'all', 'team', 'private'
        };
        setProjects(prev => [...prev, newProj]);
        showToast('Project Created', `Project "${newProj.title}" successfully created.`, 'success');
        return newProj;
    };

    const updateEmployeeManager = (employeeId, newManagerName) => {
        setEmployees(prev => prev.map(emp => {
            if (emp.id === employeeId || emp.email === employeeId) {
                return { ...emp, manager: newManagerName };
            }
            return emp;
        }));
        showToast('Reporting Manager Reassigned', `Updated reporting line to ${newManagerName}.`, 'success');
    };

    // --- DASHBOARD FOCUS TASKS ---
    const [focusTasks, setFocusTasks] = useState([]);

    const completeFocusTask = (id) => {
        setFocusTasks(prev => prev.map(t => t.id === id ? { ...t, done: true } : t));
    };

    // --- SETTINGS ---
    const [settings, setSettings] = useState({ theme: 'system', notifications: true, autoSave: true });

    const updateSettings = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };


    // --- 14. CMS: ANNOUNCEMENTS & BROADCASTS ---
    const [announcements, setAnnouncements] = useState([]);

    const addAnnouncement = async (newAnn) => {
        const item = {
            id: `ANN-${Date.now().toString().slice(-4)}`,
            date: 'Just now', status: 'Published',
            ...newAnn
        };
        setAnnouncements(prev => [item, ...prev]);

        try {
            await fetch('/api/v1/announcements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `ann-${Date.now()}`
                },
                body: JSON.stringify({
                    title: newAnn.title || 'Company Notice',
                    body: newAnn.content || newAnn.description || newAnn.title || 'Company announcement details',
                    audience: newAnn.audience || 'all',
                    kind: 'management'
                })
            }).catch(() => null);
        } catch (err) {
            console.warn('Announcement database persist:', err);
        }

        showToast('Announcement Published', `"${item.title}" is now live on the company dashboard.`, 'success');
    };

    const togglePinAnnouncement = (id) => {
        setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a));
    };

    const deleteAnnouncement = (id) => {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        showToast('Announcement Removed', 'The notice has been archived from the feed.', 'info');
    };

    // --- 15. CMS: POLICY DOCUMENTS & KNOWLEDGE BASE ---
    const [policyDocuments, setPolicyDocuments] = useState([]);

    const addPolicyDocument = (newDoc) => {
        const item = {
            id: `DOC-POL-${Date.now().toString().slice(-4)}`,
            effectiveDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            fileSize: '1.2 MB', format: 'PDF', author: 'HR Admin',
            ...newDoc
        };
        setPolicyDocuments(prev => [item, ...prev]);
        showToast('Policy Uploaded', `"${item.title}" added to the knowledge repository.`, 'success');
    };

    // --- 16. CUSTOM MIS REPORTS & INGESTION MASTER RECORDS ---
    const [misMasterData, setMisMasterData] = useState([]);

    const ingestMappedData = (importType, newRecords, fileName = 'external_dataset.xlsx') => {
        setMisMasterData(prev => {
            const merged = [...prev];
            newRecords.forEach(rec => {
                const idx = merged.findIndex(m => m.empId === rec.empId);
                if (idx >= 0) {
                    merged[idx] = { ...merged[idx], ...rec };
                } else {
                    merged.push(rec);
                }
            });
            return merged;
        });
        setEmployees(prev => {
            const copy = [...prev];
            newRecords.forEach(rec => {
                const empId = rec.empId || rec.id;
                if (!empId) return;
                const existingIdx = copy.findIndex(e => e.id === empId || e.empId === empId);
                if (existingIdx >= 0) {
                    copy[existingIdx] = {
                        ...copy[existingIdx],
                        name: rec.name || copy[existingIdx].name,
                        dept: rec.dept || copy[existingIdx].dept,
                        role: rec.role || copy[existingIdx].role,
                        location: rec.location || copy[existingIdx].location,
                        status: 'Active'
                    };
                } else if (rec.name) {
                    copy.unshift({
                        id: empId,
                        name: rec.name,
                        dept: rec.dept || 'Operations',
                        role: rec.role || 'Specialist',
                        manager: 'Ananya Roy',
                        location: rec.location || 'Bangalore Plant',
                        status: 'Active',
                        band: 'Permanent Full-Time'
                    });
                }
            });
            return copy;
        });
        if (importType === 'candidates' || importType === 'ats') {
            const mappedCandidates = newRecords.map((r, i) => ({
                id: r.id || `CAND-${Date.now()}-${i}`,
                name: r.name || r.candidateName || r.CandidateName || 'Candidate',
                role: r.role || r.Role || r.targetRole || 'Specialist',
                dept: r.dept || r.department || r.Department || 'Operations',
                email: r.email || r.Email || '',
                phone: r.phone || r.Phone || '',
                stage: r.stage || 'sourced',
                matchScore: Number(r.matchScore || Math.floor(88 + Math.random() * 10)),
                biasScore: r.biasScore || 'Fair & Neutral',
                skills: Array.isArray(r.skills) ? r.skills : (typeof r.skills === 'string' ? r.skills.split(',').map(s => s.trim()) : ['Engineering', 'Specialist']),
                exp: r.experience || r.exp || '3 yrs',
                source: r.source || 'ATS Bulk Import'
            }));
            setCandidates(prev => [...mappedCandidates, ...prev]);
        }
        showToast(
            'Bulk Ingestion Completed',
            `Successfully processed & synchronized ${newRecords.length} records from ${fileName}.`,
            'success'
        );
    };

    // --- 17. WORKFLOW AUTOMATION ENGINE & NODE PIPELINES ---
    const [workflows, setWorkflows] = useState([]);

    const updateWorkflowNode = (workflowId, nodeId, updatedFields) => {
        setWorkflows(prev => prev.map(wf => {
            if (wf.id !== workflowId) return wf;
            return {
                ...wf,
                nodes: wf.nodes.map(n => n.id === nodeId ? { ...n, ...updatedFields } : n)
            };
        }));
        showToast('Workflow Step Updated', 'Configuration rules saved in active pipeline.', 'success');
    };

    const addWorkflowNode = (workflowId, newNode) => {
        setWorkflows(prev => prev.map(wf => {
            if (wf.id !== workflowId) return wf;
            return {
                ...wf,
                nodes: [...wf.nodes, { id: `node-${Date.now().toString().slice(-4)}`, ...newNode }]
            };
        }));
        showToast('Node Appended', 'New step successfully linked to the workflow graph.', 'success');
    };

    const deleteWorkflowNode = (workflowId, nodeId) => {
        setWorkflows(prev => prev.map(wf => {
            if (wf.id !== workflowId) return wf;
            return {
                ...wf,
                nodes: wf.nodes.filter(n => n.id !== nodeId)
            };
        }));
        showToast('Node Removed', 'Step unlinked from workflow execution graph.', 'info');
    };

    const toggleWorkflowStatus = (workflowId) => {
        setWorkflows(prev => prev.map(wf => {
            if (wf.id !== workflowId) return wf;
            const newStatus = wf.status === 'Active' ? 'Draft' : 'Active';
            return { ...wf, status: newStatus };
        }));
    };

    // --- 24. SPRINT 5: ERP INTEGRATION (G5) & FACTORY ACT STATUTORY COMPLIANCE (G6) ---
    const [erpSyncLogs, setErpSyncLogs] = useState(INITIAL_ERP_SYNC_LOGS);
    const [erpPostingQueue, setErpPostingQueue] = useState(INITIAL_ERP_POSTING_QUEUE);
    const [statutoryAccidents, setStatutoryAccidents] = useState(INITIAL_STATUTORY_ACCIDENTS_FORM18);
    const [factoryInspections, setFactoryInspections] = useState(INITIAL_INSPECTION_BOOK_FORM36);
    const [statutoryMusterRoll, setStatutoryMusterRoll] = useState(() => generateForm28MusterRoll('March', 2026));

    const triggerErpSync = (connector = 'SAP S/4HANA (BAPI_EMPLOYEE_GETDATA)') => {
        const inboundBatch = [];

        const { updatedEmployees, syncReport } = executeErpEmployeeSync(inboundBatch, employees, connector);
        setEmployees(updatedEmployees);
        setErpSyncLogs(prev => [syncReport, ...prev]);

        if (syncReport.conflictsBlocked > 0) {
            showToast(
                'ERP Sync Completed with Safeguards',
                `Synced ${syncReport.recordsUpdated} records. Blocked ${syncReport.conflictsBlocked} write attempts to Nucleus-owned biometric/time-office fields.`,
                'warning'
            );
        } else {
            showToast('ERP Sync Succeeded', `Processed ${syncReport.recordsUpdated} employee records from ${connector}.`, 'success');
        }
        return syncReport;
    };

    const dispatchGLPostingBatch = (batchId, targetErp = 'SAP S/4HANA') => {
        const batch = erpPostingQueue.find(b => b.batchId === batchId);
        if (!batch) return false;

        const validation = validateGLBatchBalance(batch);
        if (!validation.isValid) {
            showToast('GL Posting Rejected', `Paisa imbalance detected! Debits ₹${validation.debits} != Credits ₹${validation.credits} (Delta: ₹${validation.variance}).`, 'error');
            return false;
        }

        const ackReceiptId = `${targetErp.startsWith('SAP') ? 'SAP' : 'NS'}-ACK-${Date.now().toString().slice(-6)}`;
        const ackTimestamp = new Date().toISOString();

        setErpPostingQueue(prev => prev.map(b => {
            if (b.batchId !== batchId) return b;
            return {
                ...b,
                status: 'ACKNOWLEDGED',
                ackReceiptId,
                ackTimestamp,
                reconciledBy: 'Pending Month-End Close'
            };
        }));

        showToast('GL Batch Acknowledged by ERP', `Batch ${batchId} verified (Delta = 0.00). Received ERP Receipt: ${ackReceiptId}`, 'success');
        return true;
    };

    const reconcileGLBatch = (batchId) => {
        setErpPostingQueue(prev => prev.map(b => {
            if (b.batchId !== batchId) return b;
            return {
                ...b,
                status: 'RECONCILED',
                reconciledBy: `${user?.name || 'Finance Controller'} (Reconciled)`
            };
        }));
        showToast('GL Batch Reconciled', `Batch ${batchId} marked as fully closed & reconciled with ERP general ledger.`, 'success');
    };

    const reportFactoryAccidentForm18 = (accidentData) => {
        const noticeId = `FORM18-2026-${String(statutoryAccidents.length + 1).padStart(3, '0')}`;
        const newRecord = {
            noticeId,
            dateOfOccurrence: accidentData.dateOfOccurrence || new Date().toISOString().split('T')[0],
            exactTime: accidentData.exactTime || '10:00 AM',
            exactPlace: accidentData.exactPlace || 'Plant Unit-1 (Shop Floor)',
            injuredPerson: {
                name: accidentData.injuredPersonName || 'Shop Floor Operator',
                tokenNo: accidentData.tokenNo || 'TK-0199',
                age: accidentData.age || 35,
                sex: accidentData.sex || 'Male',
                occupation: accidentData.occupation || 'Operator'
            },
            natureOfInjury: accidentData.natureOfInjury || 'Contusion / First Aid',
            causeOfAccident: accidentData.causeOfAccident || 'Equipment handling incident',
            lostWorkdays: Number(accidentData.lostWorkdays) || 1,
            reportedToInspector: true,
            inspectorateFilingDate: new Date().toISOString().split('T')[0],
            investigatingOfficer: accidentData.investigatingOfficer || 'R. K. Nair (Factory Safety Manager)',
            remedialActions: accidentData.remedialActions || 'Immediate SOP reinforcement and PPE checklist verification.'
        };

        setStatutoryAccidents(prev => [newRecord, ...prev]);
        showToast('Form 18 Notice Recorded', `Statutory Accident Notice ${noticeId} filed for Inspectorate review.`, 'success');
        return newRecord;
    };

    const recordFactoryInspectionForm36 = (inspectionData) => {
        const inspectionId = `INSP-36-${new Date().getFullYear()}-${String(factoryInspections.length + 1).padStart(2, '0')}`;
        const newRecord = {
            inspectionId,
            inspectionDate: inspectionData.inspectionDate || new Date().toISOString().split('T')[0],
            inspectorName: inspectionData.inspectorName || 'Senior Inspector of Factories',
            inspectorOffice: inspectionData.inspectorOffice || 'Directorate of Industrial Safety & Health',
            statutoryObservations: inspectionData.statutoryObservations || 'Statutory records inspected and verified compliant.',
            remedialDirections: inspectionData.remedialDirections || 'None. Maintain current standard.',
            complianceStatus: inspectionData.complianceStatus || 'CLOSED',
            closureDate: inspectionData.closureDate || new Date().toISOString().split('T')[0],
            certifyingManager: user?.name || 'Pradeep Shenoy (Works Director)'
        };

        setFactoryInspections(prev => [newRecord, ...prev]);
        showToast('Form 36 Observation Logged', `Inspection entry ${inspectionId} added to statutory inspection ledger.`, 'info');
        return newRecord;
    };

    const generateFormFGratuity = (employeeId, nominees, witnesses) => {
        const targetEmp = employees.find(e => e.id === employeeId) || {
            id: employeeId,
            name: 'Selected Employee', department: 'Plant Operations'
        };
        return generateFormFDeclaration(targetEmp, nominees, witnesses);
    };

    // --- AUTO LEAVE CREDIT ENGINE (Demo Point #7) ---
    const getLeaveAllocationForEmployee = (employeeId, referenceDate = new Date()) => {
        const emp = employees.find(e => e.id === employeeId) || {};
        return computeAutoLeaveAllocation(emp, referenceDate);
    };

    // --- ANNOUNCEMENTS: Auto-generate for birthdays, new joiners, star employees ---
    const triggerAutoAnnouncements = () => {
        const today = new Date();
        const todayMMDD = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        employees.forEach(emp => {
            if (!emp.dateOfBirth) return;
            const dob = new Date(emp.dateOfBirth);
            const empMMDD = `${String(dob.getMonth()+1).padStart(2,'0')}-${String(dob.getDate()).padStart(2,'0')}`;
            if (empMMDD === todayMMDD) {
                addAnnouncement({
                    title: `🎂 Happy Birthday, ${emp.name}!`,
                    body: `Wishing ${emp.name} (${emp.dept}) a wonderful birthday! 🎉`,
                    type: 'birthday',
                    author: 'HR Team',
                    pinned: false,
                });
            }
        });
    };

    return (
        <HRMSContext.Provider value={{
            user, setUser,
            attendance, attendanceAnomalies, punchIn, punchOut,
            gatePasses, requestGatePass, approveGatePass,
            attendanceRegularizations, requestRegularization, decideRegularization,
            timeOfficeLedger, recomputeAttendanceRecord,
            workerCategories: WORKER_CATEGORIES, workCalendars: WORK_CALENDARS,
            shiftRules: SHIFT_RULES, rulesetVersion: RULESET_VERSION,
            computeAttendanceDay, isGraceExempt, formatMinutes,
            leaves, applyLeave,
            leaveApplications, leaveState, leaveActor, adjustLeaveAllocation, compOffCredits, applyLeaveWithWorkflow,
            advanceLeaveApproval, processEarlyReturnApplication,
            leaveRuleVersion: LEAVE_RULESET_VERSION, leaveTypes: LEAVE_TYPES,
            // Auto Leave Credit Engine (Demo Point #7)
            computeAutoLeaveAllocation, evaluateCOFFLapse, isSeniorManagement,
            validateLeaveRestrictions, getLeaveAllocationForEmployee,
            employees, setEmployees, addEmployee, positions, documents, auditLogs,
            teamMembers, setTeamMembers,
            announcements, addAnnouncement, togglePinAnnouncement, deleteAnnouncement,
            triggerAutoAnnouncements,
            policyDocuments, addPolicyDocument,
            misMasterData, setMisMasterData, ingestMappedData,
            workflows, setWorkflows, updateWorkflowNode, addWorkflowNode, deleteWorkflowNode, toggleWorkflowStatus,
            payrollSummary, ewaTransactions, requestEWA,
            companyLoans, applyForCompanyLoan, repayLoanEMI,
            payrollRuns, createOffCycleRun,
            fnfSettlements, updateDepartmentNoDues, disburseFnFSettlement,
            currentRoleContext, switchUserRole,
            payrollRunTypes: PAYROLL_RUN_TYPES, noDuesDepartments: NO_DUES_DEPARTMENTS,
            payrollRulesetVersion: PAYROLL_RULESET_VERSION,
            canViewCompensation, applyLocationScoping, calculateMaxLoanEligibility,
            computeGuarantorLockStatus, calculateFnFSettlement, calculateLeaveEncashment,
            sanctionedQuotas, setSanctionedQuotas, createJobRequisition,
            hardwareAssets, allocateHardwareAsset, markAssetReturned,
            recognitionAwards, grantRecognitionAward,
            employeeReferrals, submitEmployeeReferral,
            generateHRLetter, letterTemplates: LETTER_TEMPLATES,
            assetTypes: ASSET_TYPES, recognitionAwardTypes: RECOGNITION_AWARD_TYPES,
            establishmentRulesetVersion: ESTABLISHMENT_RULESET_VERSION,
            calculateDepartmentCapacity, validateRequisitionCreation, getEmployeeAssignedAssets,
            erpSyncLogs, erpPostingQueue, triggerErpSync, dispatchGLPostingBatch, reconcileGLBatch,
            statutoryAccidents, reportFactoryAccidentForm18,
            factoryInspections, recordFactoryInspectionForm36,
            statutoryMusterRoll, generateFormFGratuity,
            erpFieldOwnershipPolicy: ERP_FIELD_OWNERSHIP_POLICY,
            complianceRulesetVersion: COMPLIANCE_RULESET_VERSION,
            candidates, moveCandidate,
            onboardingTasks, completeOnboardingTask,
            okrs, addGoal, talentMatrix,
            analyticsData,
            courses, setCourses,
            compensationData,
            mciScore, vedicFramework, setVedicFramework, socialFeed, addKudos,
            connectors, apiKeys,
            projects, addProject, kanbanTasks, moveTask, addTask,
            updateEmployeeManager,
            focusTasks, completeFocusTask,
            settings, updateSettings,
            theme, setTheme, toggleTheme,
            toasts, showToast, removeToast
        }}>
            {children}
        </HRMSContext.Provider>
    );
};

