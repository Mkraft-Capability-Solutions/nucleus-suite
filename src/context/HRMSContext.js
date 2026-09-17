import { getHrmsDefault } from './hrms-defaults';
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
    const showToast = (title, message, type = getHrmsDefault("defaultValue_1")) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }].slice(-3));
    };
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- 1. USER PROFILE ---
    const { user: authUser } = useAuth();
    const [user, setUser] = useState(() => authUser || authenticatedUser || getHrmsDefault("user_1"));
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
    const [attendance, setAttendance] = useState(getHrmsDefault("attendance_2"));

    const [attendanceAnomalies] = useState(getHrmsDefault("attendanceAnomalies_3"));

    const punchIn = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], getHrmsDefault("timeStr_4"));
        setAttendance(prev => ({
            ...prev,
            ...getHrmsDefault("punchIn_fields_5"),
            punchInTime: timeStr,
            history: [{ ...getHrmsDefault("history_fields_6"), in: timeStr, ...getHrmsDefault("history_fields_7"), log }, ...prev.history]
        }));
        showToast('Punched In', `Attendance recorded at ${timeStr}`, 'success');
    };

    const punchOut = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], getHrmsDefault("timeStr_8"));
        setAttendance(prev => ({
            ...prev,
            ...getHrmsDefault("punchOut_fields_9"),
            punchOutTime: timeStr,
            history: prev.history.map((h, i) => i === 0 ? { ...h, out: timeStr, log: log || h.log } : h)
        }));
        showToast('Punched Out', `Session ended at ${timeStr}`, 'info');
    };

    // --- 2B. TIME-OFFICE & GATE PASS SUBSYSTEM (Blueprint Addendum G1 & G2) ---
    const [gatePasses, setGatePasses] = useState(getHrmsDefault("gatePasses_10"));

    const requestGatePass = ({ employeeId = getHrmsDefault("defaultValue_2"), employeeName = getHrmsDefault("defaultValue_3"), date = getHrmsDefault("defaultValue_4"), type = getHrmsDefault("defaultValue_5"), minutes = getHrmsDefault("defaultValue_6"), reason = '' }) => {
        const approvedAndPending = gatePasses.filter(gp => gp.employee_id === employeeId && gp.status !== 'REJECTED');
        const quotaCheck = validateGatePassQuota(approvedAndPending, minutes);

        if (!quotaCheck.allowed) {
            showToast('Gate Pass Rejected', quotaCheck.reason, 'error');
            return { ...getHrmsDefault("requestGatePass_fields_11"), reason: quotaCheck.reason };
        }

        const newPass = {
            id: `GP-2026-${String(gatePasses.length + 1).padStart(3, '0')}`,
            employee_id: employeeId,
            employee_name: employeeName,
            date,
            type,
            minutes,
            reason,
            ...getHrmsDefault("newPass_fields_12"),
            applied_at: new Date().toISOString()
        };

        setGatePasses(prev => [newPass, ...prev]);
        showToast('Gate Pass Approved', `${minutes} mins approved. ${quotaCheck.remaining_minutes} mins remaining in monthly quota.`, 'success');
        return { ...getHrmsDefault("requestGatePass_fields_13"), gatePass: newPass };
    };

    const approveGatePass = (gatePassId) => {
        setGatePasses(prev => prev.map(gp => gp.id === gatePassId ? { ...gp, ...getHrmsDefault("approveGatePass_fields_14") } : gp));
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
    const [timeOfficeLedger, setTimeOfficeLedger] = useState(getHrmsDefault("timeOfficeLedger_15"));

    const recomputeAttendanceRecord = ({ employee, dateStr, rawPunches, shiftId = getHrmsDefault("defaultValue_7"), priorDay = null, monthlyLateCount = getHrmsDefault("defaultValue_8") }) => {
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
                worker_category_code: employee.worker_category_code || getHrmsDefault("fallback_1"),
                wage_type: (WORKER_CATEGORIES[employee.worker_category_code] || WORKER_CATEGORIES.PERM).wage_type,
                location_id: employee.location_id || getHrmsDefault("fallback_2"),
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
        requests: [...getHrmsDefault("leaveApplications_18").map(app => ({...app, version:1, contact:app.contact??'',reference_only:true})),...workbookLeaveReferences()],
        balances: readData('leave.workflow', 'accounts'),
        credits: [...getHrmsDefault("compOffCredits_17"),...workbookCompOffCredits()],
        events: [],
    }));
    const [leaveState, setLeaveState] = useState(() => leaveService.snapshot());
    const leaveApplications = leaveState.requests.filter(app => ['HR_MANAGER','SUPER_ADMIN'].includes(leaveActor.role) || app.employee_id===leaveActor.employeeId || (leaveActor.role==='MANAGER' && readData('leave.workflow','reportingManagers')[app.employee_id]===leaveActor.employeeId));
    const compOffCredits = evaluateCompOffValidity(leaveState.credits.filter(credit=>credit.employee_id===leaveActor.employeeId)).credits;
    const emptyBalances = Object.fromEntries(Object.keys(getHrmsDefault("leaves_16")).filter(key=>key!=='history').map(key=>[key,{available:0,total:0}]));
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
    const [teamMembers, setTeamMembers] = useState(getHrmsDefault("teamMembers_29"));

    // --- 4C. POSITIONS & ESTABLISHMENT CONTROL (Sprint 4: Demo Points 24 & 25) ---
    const [sanctionedQuotas, setSanctionedQuotas] = useState(DEFAULT_SANCTIONED_QUOTAS);
    const [positions, setPositions] = useState(getHrmsDefault("positions_30"));

    const createJobRequisition = async (reqData) => {
        const validation = validateRequisitionCreation({
            ...reqData,
            employees,
            openPositions: positions,
            quotas: sanctionedQuotas
        });

        if (!validation.isValid) {
            showToast('Requisition Creation Blocked', validation.errors[0], 'error');
            return { ...getHrmsDefault("createJobRequisition_fields_31"), errors: validation.errors };
        }

        const newPos = {
            id: `POS-${Date.now().toString().slice(-4)}`,
            title: reqData.title,
            dept: reqData.dept,
            ...getHrmsDefault("newPos_fields_32"),
            budget: reqData.budget || getHrmsDefault("fallback_6"),
            ...getHrmsDefault("newPos_fields_33"),
            requisitionType: reqData.requisitionType || getHrmsDefault("fallback_7"),
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
        return { ...getHrmsDefault("createJobRequisition_fields_34"), position: newPos };
    };

    // --- 4D. HARDWARE ASSET ALLOCATION & SERIAL TRACKING (Sprint 4: Demo Point 23) ---
    const [hardwareAssets, setHardwareAssets] = useState(INITIAL_ASSET_REGISTER);

    const allocateHardwareAsset = async (assetData) => {
        const newAsset = {
            id: `AST-${crypto.randomUUID()}`,
            assetType: assetData.assetType || getHrmsDefault("fallback_8"),
            brand: assetData.brand || getHrmsDefault("fallback_9"),
            model: assetData.model,
            serialNumber: assetData.serialNumber,
            assetTag: assetData.assetTag || `NUC-IT-${crypto.randomUUID().slice(0, 8)}`,
            assignedToEmployeeId: assetData.assignedToEmployeeId,
            assignedToName: employees.find(e => e.id === assetData.assignedToEmployeeId)?.name || getHrmsDefault("fallback_10"),
            assignedDate: new Date().toISOString().split('T')[0],
            ...getHrmsDefault("newAsset_fields_35"),
            condition: assetData.condition || getHrmsDefault("fallback_11"),
            replacementValue: Number(assetData.replacementValue) || getHrmsDefault("fallback_12")
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

    const markAssetReturned = (assetId, condition = getHrmsDefault("defaultValue_10"), remarks = '') => {
        setHardwareAssets(prev => prev.map(a => {
            if (a.id !== assetId) return a;
            return {
                ...a,
                ...getHrmsDefault("markAssetReturned_fields_36"),
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
            employeeName: emp ? emp.name : awardData.employeeName || getHrmsDefault("fallback_13"),
            dept: emp ? emp.dept : 'General',
            awardType: awardData.awardType || getHrmsDefault("fallback_14"),
            citation: awardData.citation,
            rewardAmount: Number(awardData.rewardAmount) || getHrmsDefault("fallback_15"),
            awardedBy: user?.name || getHrmsDefault("fallback_16"),
            date: new Date().toLocaleDateString('en-GB', getHrmsDefault("date_38")),
            ...getHrmsDefault("newAward_fields_37")
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
            dept: refData.dept || getHrmsDefault("fallback_17"),
            referredByEmployeeId: user?.id || getHrmsDefault("fallback_18"),
            referredByName: user?.name || getHrmsDefault("fallback_19"),
            ...getHrmsDefault("newRef_fields_39")
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
        const emp = employees.find(e => e.id === employeeId) || employees[0];
        return renderLetterTemplate(templateId, emp, customFields);
    };

    const [documents] = useState(getHrmsDefault("documents_40"));

    const [auditLogs] = useState(getHrmsDefault("auditLogs_41"));

    // --- 5. PAYROLL & EARNED WAGE ACCESS (Module 2) ---
    const [payrollSummary] = useState(getHrmsDefault("payrollSummary_42"));

    const [ewaTransactions, setEwaTransactions] = useState(getHrmsDefault("ewaTransactions_43"));

    const requestEWA = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) return;
        setEwaTransactions(prev => [{
            id: `EWA-${crypto.randomUUID()}`,
            ...getHrmsDefault("requestEWA_fields_44"),
            amount: `₹ ${num.toLocaleString()}`,
            ...getHrmsDefault("requestEWA_fields_45")
        }, ...prev]);
        showToast('EWA Transfer Complete', `₹ ${num.toLocaleString()} instant credited to your salary account.`, 'success');
    };

    // --- 5B. ADVANCED PAYROLL ADJACENCIES & LOCATION SCOPING (Sprint 3: Demo Points 8, 9, 10, 16) ---
    // User Role Context (For Demo Point 8 Location Scoping Simulation)
    const [currentRoleContext, setCurrentRoleContext] = useState(getHrmsDefault("currentRoleContext_46"));

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
    const [companyLoans, setCompanyLoans] = useState(getHrmsDefault("companyLoans_47"));

    const applyForCompanyLoan = (loanRequest) => {
        const validation = validateLoanApplication({
            ...loanRequest,
            activeLoans: companyLoans,
            employeeDirectory: employees
        });

        if (!validation.isValid) {
            showToast('Loan Application Rejected', validation.errors[0], 'error');
            return { ...getHrmsDefault("applyForCompanyLoan_fields_48"), errors: validation.errors };
        }

        const newLoan = {
            id: `LOAN-${crypto.randomUUID()}`,
            borrowerId: loanRequest.applicantId,
            borrowerName: validation.computed.applicantName,
            borrowerRole: employees.find(e => e.id === loanRequest.applicantId)?.role || getHrmsDefault("fallback_20"),
            borrowerDept: employees.find(e => e.id === loanRequest.applicantId)?.dept || getHrmsDefault("fallback_21"),
            principalAmount: validation.computed.requestedAmount,
            remainingBalance: validation.computed.requestedAmount,
            monthlyEMI: validation.computed.monthlyEMI,
            tenureMonths: validation.computed.tenureMonths,
            ...getHrmsDefault("newLoan_fields_49"),
            purpose: loanRequest.purpose || getHrmsDefault("fallback_22"),
            guarantors: validation.computed.guarantors,
            guarantorNames: validation.computed.guarantors.map(gid => {
                const emp = employees.find(e => e.id === gid);
                return `${emp?.name || gid} (${gid})`;
            }),
            ...getHrmsDefault("newLoan_fields_50"),
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
        return { ...getHrmsDefault("applyForCompanyLoan_fields_51"), loan: newLoan };
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
    const [payrollRuns, setPayrollRuns] = useState(getHrmsDefault("payrollRuns_52"));

    const createOffCycleRun = (type, customParams = {}) => {
        let newRun;
        if (type === 'OFF_CYCLE_OT') {
            const otRecords = getHrmsDefault("otRecords_53");
            newRun = generateOffCycleOTRun({
                cyclePeriod: customParams.period || getHrmsDefault("fallback_23"),
                otRecords,
                employees
            });
        } else if (type === 'ARREARS') {
            newRun = generateArrearsRun({
                cyclePeriod: customParams.period || getHrmsDefault("fallback_24"),
                ...getHrmsDefault("createOffCycleRun_fields_54")
            });
        } else {
            newRun = {
                id: `RUN-${type}-${Date.now().toString().slice(-4)}`,
                type,
                label: `${type} Cycle Run`,
                cyclePeriod: customParams.period || getHrmsDefault("fallback_25"),
                batchDate: new Date().toISOString().split('T')[0],
                ...getHrmsDefault("createOffCycleRun_fields_56"),
                bankFileRef: `NEFT_${type}_${Date.now().toString().slice(-4)}.txt`
            };
        }

        setPayrollRuns(prev => [newRun, ...prev]);
        showToast('Payroll Run Created', `${newRun.label} (${newRun.type}) created and queued for bank disbursal.`, 'success');
        return newRun;
    };

    // Demo Point 16: Same-Day Full & Final (F&F) Settlement & 4-Department No-Dues
    const [fnfSettlements, setFnfSettlements] = useState(getHrmsDefault("fnfSettlements_57"));

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
    const [candidates, setCandidates] = useState(getHrmsDefault("candidates_59"));

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
    const [onboardingTasks, setOnboardingTasks] = useState(getHrmsDefault("onboardingTasks_60"));

    const completeOnboardingTask = (id) => {
        setOnboardingTasks(prev => prev.map(t => t.id === id ? { ...t, ...getHrmsDefault("completeOnboardingTask_fields_61") } : t));
        showToast('Onboarding Progress Updated', 'Milestone marked as complete.', 'success');
    };

    // --- 8. PERFORMANCE & OKR CASCADE (Module 5) ---
    const [okrs, setOkrs] = useState(getHrmsDefault("okrs_62"));

    const [talentMatrix] = useState(getHrmsDefault("talentMatrix_63"));

    const addGoal = () => {
        const newGoal = {
            id: Date.now(),
            ...getHrmsDefault("newGoal_fields_64"),
            owner: user.name,
            ...getHrmsDefault("newGoal_fields_65")
        };
        setOkrs([...okrs, newGoal]);
    };

    // --- 9. PEOPLE INTELLIGENCE & ANALYTICS (Module 7) ---
    const [analyticsData] = useState(getHrmsDefault("analyticsData_67"));

    // --- 10. LEARNING & DEVELOPMENT (Module 8) ---
    const [courses, setCourses] = useState(getHrmsDefault("courses_68"));

    // --- 11. COMPENSATION & BENEFITS (Module 9) ---
    const [compensationData] = useState(getHrmsDefault("compensationData_69"));

    // --- 12. EMPLOYEE EXPERIENCE, MCI & VEDIC WELLBEING (Module 10) ---
    const [mciScore] = useState(getHrmsDefault("mciScore_70"));

    const [vedicFramework, setVedicFramework] = useState(getHrmsDefault("vedicFramework_71"));

    const [socialFeed, setSocialFeed] = useState(getHrmsDefault("socialFeed_72"));

    const addKudos = (id) => {
        setSocialFeed(prev => prev.map(p => p.id === id ? { ...p, kudos: p.kudos + 1 } : p));
        showToast('Kudos Sent!', 'You celebrated your teammate’s contribution.', 'success');
    };

    // --- 13. INTEGRATIONS & API PLATFORM (Module 11) ---
    const [connectors, setConnectors] = useState(getHrmsDefault("connectors_73"));

    const [apiKeys, setApiKeys] = useState(getHrmsDefault("apiKeys_74"));

    // --- PROJECTS / TASKS (Kanban) ---
    const [projects, setProjects] = useState(getHrmsDefault("projects_75"));

    const [kanbanTasks, setKanbanTasks] = useState(getHrmsDefault("kanbanTasks_76"));

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
            title: taskData.title || getHrmsDefault("fallback_26"),
            tag: taskData.tag || getHrmsDefault("fallback_27"),
            assignee: taskData.assignee || getHrmsDefault("fallback_28"),
            project: taskData.project || getHrmsDefault("fallback_29"),
            due: taskData.due || getHrmsDefault("fallback_30"),
            priority: taskData.priority || getHrmsDefault("fallback_31")
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
            title: projectData.title || getHrmsDefault("fallback_32"),
            desc: projectData.desc || getHrmsDefault("fallback_33"),
            progress: Number(projectData.progress) || 0,
            color: projectData.color || getHrmsDefault("fallback_34"),
            due: projectData.due || getHrmsDefault("fallback_35"),
            members: projectData.members && projectData.members.length > 0 ? projectData.members : getHrmsDefault("members_77"),
            createdBy: user?.name || getHrmsDefault("fallback_36"),
            visibility: projectData.visibility || getHrmsDefault("fallback_37") // 'all', 'team', 'private'
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
    const [focusTasks, setFocusTasks] = useState(getHrmsDefault("focusTasks_78"));

    const completeFocusTask = (id) => {
        setFocusTasks(prev => prev.map(t => t.id === id ? { ...t, ...getHrmsDefault("completeFocusTask_fields_79") } : t));
    };

    // --- SETTINGS ---
    const [settings, setSettings] = useState(getHrmsDefault("settings_80"));

    const updateSettings = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };


    // --- 14. CMS: ANNOUNCEMENTS & BROADCASTS ---
    const [announcements, setAnnouncements] = useState(getHrmsDefault("announcements_81"));

    const addAnnouncement = async (newAnn) => {
        const item = {
            id: `ANN-${Date.now().toString().slice(-4)}`,
            ...getHrmsDefault("item_fields_82"),
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
    const [policyDocuments, setPolicyDocuments] = useState(getHrmsDefault("policyDocuments_83"));

    const addPolicyDocument = (newDoc) => {
        const item = {
            id: `DOC-POL-${Date.now().toString().slice(-4)}`,
            effectiveDate: new Date().toLocaleDateString('en-GB', getHrmsDefault("effectiveDate_85")),
            ...getHrmsDefault("item_fields_84"),
            ...newDoc
        };
        setPolicyDocuments(prev => [item, ...prev]);
        showToast('Policy Uploaded', `"${item.title}" added to the knowledge repository.`, 'success');
    };

    // --- 16. CUSTOM MIS REPORTS & INGESTION MASTER RECORDS ---
    const [misMasterData, setMisMasterData] = useState(getHrmsDefault("misMasterData_86"));

    const ingestMappedData = (importType, newRecords, fileName = getHrmsDefault("defaultValue_11")) => {
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
        showToast(
            'Bulk Ingestion Completed',
            `Successfully processed & synchronized ${newRecords.length} records from ${fileName}.`,
            'success'
        );
    };

    // --- 17. WORKFLOW AUTOMATION ENGINE & NODE PIPELINES ---
    const [workflows, setWorkflows] = useState(getHrmsDefault("workflows_87"));

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

    const triggerErpSync = (connector = getHrmsDefault("defaultValue_12")) => {
        const inboundBatch = getHrmsDefault("inboundBatch_88");

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

    const dispatchGLPostingBatch = (batchId, targetErp = getHrmsDefault("defaultValue_13")) => {
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
                ...getHrmsDefault("dispatchGLPostingBatch_fields_89"),
                ackReceiptId,
                ackTimestamp,
                ...getHrmsDefault("dispatchGLPostingBatch_fields_90")
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
                ...getHrmsDefault("reconcileGLBatch_fields_91"),
                reconciledBy: `${user?.name || getHrmsDefault("fallback_38")} (Reconciled)`
            };
        }));
        showToast('GL Batch Reconciled', `Batch ${batchId} marked as fully closed & reconciled with ERP general ledger.`, 'success');
    };

    const reportFactoryAccidentForm18 = (accidentData) => {
        const noticeId = `FORM18-2026-${String(statutoryAccidents.length + 1).padStart(3, '0')}`;
        const newRecord = {
            noticeId,
            dateOfOccurrence: accidentData.dateOfOccurrence || new Date().toISOString().split('T')[0],
            exactTime: accidentData.exactTime || getHrmsDefault("fallback_39"),
            exactPlace: accidentData.exactPlace || getHrmsDefault("fallback_40"),
            injuredPerson: {
                name: accidentData.injuredPersonName || getHrmsDefault("fallback_41"),
                tokenNo: accidentData.tokenNo || getHrmsDefault("fallback_42"),
                age: accidentData.age || getHrmsDefault("fallback_43"),
                sex: accidentData.sex || getHrmsDefault("fallback_44"),
                occupation: accidentData.occupation || getHrmsDefault("fallback_45")
            },
            natureOfInjury: accidentData.natureOfInjury || getHrmsDefault("fallback_46"),
            causeOfAccident: accidentData.causeOfAccident || getHrmsDefault("fallback_47"),
            lostWorkdays: Number(accidentData.lostWorkdays) || getHrmsDefault("fallback_48"),
            ...getHrmsDefault("newRecord_fields_92"),
            inspectorateFilingDate: new Date().toISOString().split('T')[0],
            investigatingOfficer: accidentData.investigatingOfficer || getHrmsDefault("fallback_49"),
            remedialActions: accidentData.remedialActions || getHrmsDefault("fallback_50")
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
            inspectorName: inspectionData.inspectorName || getHrmsDefault("fallback_51"),
            inspectorOffice: inspectionData.inspectorOffice || getHrmsDefault("fallback_52"),
            statutoryObservations: inspectionData.statutoryObservations || getHrmsDefault("fallback_53"),
            remedialDirections: inspectionData.remedialDirections || getHrmsDefault("fallback_54"),
            complianceStatus: inspectionData.complianceStatus || getHrmsDefault("fallback_55"),
            closureDate: inspectionData.closureDate || new Date().toISOString().split('T')[0],
            certifyingManager: user?.name || getHrmsDefault("fallback_56")
        };

        setFactoryInspections(prev => [newRecord, ...prev]);
        showToast('Form 36 Observation Logged', `Inspection entry ${inspectionId} added to statutory inspection ledger.`, 'info');
        return newRecord;
    };

    const generateFormFGratuity = (employeeId, nominees, witnesses) => {
        const targetEmp = employees.find(e => e.id === employeeId) || {
            id: employeeId,
            ...getHrmsDefault("targetEmp_fields_93")
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

