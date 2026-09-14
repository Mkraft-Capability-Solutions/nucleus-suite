"use client";
import { readData } from '../services/workspace-data.mjs';

import { workbookLeaveReferences, workbookCompOffCredits } from '@/services/leave-reference';
import { createLeavePreviewService, adjustLeaveBalance, createLeave, decideLeave, returnFromLeave } from '@/services/leave-workflow';
import { useAuth } from './AuthContext';
import { useAppearance } from './AppearanceContext';
import React, { createContext, useContext, useState, useCallback } from 'react';
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
    const showToast = (title, message, type = readData("context.HRMSContext", "defaultValue_1")) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }].slice(-3));
    };
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // --- 1. USER PROFILE ---
    const [user, setUser] = useState(() => ({ ...readData("context.HRMSContext", "user_1"), ...authenticatedUser }));

    // --- 2. ATTENDANCE & SHIFTS (Module 6) ---
    const [attendance, setAttendance] = useState(readData("context.HRMSContext", "attendance_2"));

    const [attendanceAnomalies] = useState(readData("context.HRMSContext", "attendanceAnomalies_3"));

    const punchIn = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], readData("context.HRMSContext", "timeStr_4"));
        setAttendance(prev => ({
            ...prev,
            ...readData("context.HRMSContext", "punchIn_fields_5"),
            punchInTime: timeStr,
            history: [{ ...readData("context.HRMSContext", "history_fields_6"), in: timeStr, ...readData("context.HRMSContext", "history_fields_7"), log }, ...prev.history]
        }));
        showToast('Punched In', `Attendance recorded at ${timeStr}`, 'success');
    };

    const punchOut = (log = '') => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], readData("context.HRMSContext", "timeStr_8"));
        setAttendance(prev => ({
            ...prev,
            ...readData("context.HRMSContext", "punchOut_fields_9"),
            punchOutTime: timeStr,
            history: prev.history.map((h, i) => i === 0 ? { ...h, out: timeStr, log: log || h.log } : h)
        }));
        showToast('Punched Out', `Session ended at ${timeStr}`, 'info');
    };

    // --- 2B. TIME-OFFICE & GATE PASS SUBSYSTEM (Blueprint Addendum G1 & G2) ---
    const [gatePasses, setGatePasses] = useState(readData("context.HRMSContext", "gatePasses_10"));

    const requestGatePass = ({ employeeId = readData("context.HRMSContext", "defaultValue_2"), employeeName = readData("context.HRMSContext", "defaultValue_3"), date = readData("context.HRMSContext", "defaultValue_4"), type = readData("context.HRMSContext", "defaultValue_5"), minutes = readData("context.HRMSContext", "defaultValue_6"), reason = '' }) => {
        const approvedAndPending = gatePasses.filter(gp => gp.employee_id === employeeId && gp.status !== 'REJECTED');
        const quotaCheck = validateGatePassQuota(approvedAndPending, minutes);

        if (!quotaCheck.allowed) {
            showToast('Gate Pass Rejected', quotaCheck.reason, 'error');
            return { ...readData("context.HRMSContext", "requestGatePass_fields_11"), reason: quotaCheck.reason };
        }

        const newPass = {
            id: `GP-2026-${String(gatePasses.length + 1).padStart(3, '0')}`,
            employee_id: employeeId,
            employee_name: employeeName,
            date,
            type,
            minutes,
            reason,
            ...readData("context.HRMSContext", "newPass_fields_12"),
            applied_at: new Date().toISOString()
        };

        setGatePasses(prev => [newPass, ...prev]);
        showToast('Gate Pass Approved', `${minutes} mins approved. ${quotaCheck.remaining_minutes} mins remaining in monthly quota.`, 'success');
        return { ...readData("context.HRMSContext", "requestGatePass_fields_13"), gatePass: newPass };
    };

    const approveGatePass = (gatePassId) => {
        setGatePasses(prev => prev.map(gp => gp.id === gatePassId ? { ...gp, ...readData("context.HRMSContext", "approveGatePass_fields_14") } : gp));
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
            fetch('/api/v1/regularizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employeeId: 'c668678c-ed74-4dbb-a98b-0287afc8f286',
                    date,
                    kind,
                    reason: reason.length < 3 ? 'Attendance discrepancy regularization' : reason,
                    claimedIn,
                    claimedOut
                })
            }).catch(e => console.warn('Regularization DB sync notice:', e));
        } catch {}
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
    const [timeOfficeLedger, setTimeOfficeLedger] = useState(readData("context.HRMSContext", "timeOfficeLedger_15"));

    const recomputeAttendanceRecord = ({ employee, dateStr, rawPunches, shiftId = readData("context.HRMSContext", "defaultValue_7"), priorDay = null, monthlyLateCount = readData("context.HRMSContext", "defaultValue_8") }) => {
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
                worker_category_code: employee.worker_category_code || readData("context.HRMSContext", "fallback_1"),
                wage_type: (WORKER_CATEGORIES[employee.worker_category_code] || WORKER_CATEGORIES.PERM).wage_type,
                location_id: employee.location_id || readData("context.HRMSContext", "fallback_2"),
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
        requests: [...readData('context.HRMSContext', 'leaveApplications_18').map(app => ({...app, version:1, contact:app.contact??'',reference_only:true})),...workbookLeaveReferences()],
        balances: readData('leave.workflow', 'accounts'),
        credits: [...readData('context.HRMSContext', 'compOffCredits_17'),...workbookCompOffCredits()],
        events: [],
    }));
    const [leaveState, setLeaveState] = useState(() => leaveService.snapshot());
    const leaveApplications = leaveState.requests.filter(app => ['HR_MANAGER','SUPER_ADMIN'].includes(leaveActor.role) || app.employee_id===leaveActor.employeeId || (leaveActor.role==='MANAGER' && readData('leave.workflow','reportingManagers')[app.employee_id]===leaveActor.employeeId));
    const compOffCredits = evaluateCompOffValidity(leaveState.credits.filter(credit=>credit.employee_id===leaveActor.employeeId)).credits;
    const emptyBalances = Object.fromEntries(Object.keys(readData('context.HRMSContext','leaves_16')).filter(key=>key!=='history').map(key=>[key,{available:0,total:0}]));
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
    const applyLeaveWithWorkflow = input => runLeave(state=>createLeave(state,leaveActor,input));
    const advanceLeaveApproval = ({applicationId,action,remarks='',expectedVersion}) => runLeave(state=>decideLeave(state,leaveActor,applicationId,action,remarks,expectedVersion));
    const processEarlyReturnApplication = ({applicationId,actualReturnDateStr}) => runLeave(state=>returnFromLeave(state,leaveActor,applicationId,actualReturnDateStr));
    const applyLeave = (type,date,duration,reason) => applyLeaveWithWorkflow({employee:{id:leaveActor.employeeId,name:leaveActor.name},leaveTypeCode:type,startDateStr:date,endDateStr:date,numberOfDays:Number(duration),reason});

    // --- 4. PEOPLE CORE (Module 1) ---
    const [employees, setEmployees] = useState(readData("context.HRMSContext", "employees_28"));

    // --- 4B. MY TEAM PODS (Module 1 / Pod Directory) ---
    const [teamMembers, setTeamMembers] = useState(readData("context.HRMSContext", "teamMembers_29"));

    // --- 4C. POSITIONS & ESTABLISHMENT CONTROL (Sprint 4: Demo Points 24 & 25) ---
    const [sanctionedQuotas, setSanctionedQuotas] = useState(DEFAULT_SANCTIONED_QUOTAS);
    const [positions, setPositions] = useState(readData("context.HRMSContext", "positions_30"));

    const createJobRequisition = (reqData) => {
        const validation = validateRequisitionCreation({
            ...reqData,
            employees,
            openPositions: positions,
            quotas: sanctionedQuotas
        });

        if (!validation.isValid) {
            showToast('Requisition Creation Blocked', validation.errors[0], 'error');
            return { ...readData("context.HRMSContext", "createJobRequisition_fields_31"), errors: validation.errors };
        }

        const newPos = {
            id: `POS-${Date.now().toString().slice(-4)}`,
            title: reqData.title,
            dept: reqData.dept,
            ...readData("context.HRMSContext", "newPos_fields_32"),
            budget: reqData.budget || readData("context.HRMSContext", "fallback_6"),
            ...readData("context.HRMSContext", "newPos_fields_33"),
            requisitionType: reqData.requisitionType || readData("context.HRMSContext", "fallback_7"),
            vacatedPositionCode: reqData.vacatedPositionCode || null,
            previousIncumbentId: reqData.previousIncumbentId || null,
            isExecutiveWaiver: reqData.isExecutiveWaiver || false,
            waiverReason: reqData.waiverReason || null,
            createdDate: new Date().toLocaleDateString('en-GB')
        };

        setPositions(prev => [newPos, ...prev]);
        showToast(
            'Requisition Opened',
            `${newPos.title} created under ${newPos.dept} (${newPos.requisitionType}).`,
            'success'
        );
        return { ...readData("context.HRMSContext", "createJobRequisition_fields_34"), position: newPos };
    };

    // --- 4D. HARDWARE ASSET ALLOCATION & SERIAL TRACKING (Sprint 4: Demo Point 23) ---
    const [hardwareAssets, setHardwareAssets] = useState(INITIAL_ASSET_REGISTER);

    const allocateHardwareAsset = (assetData) => {
        const newAsset = {
            id: `AST-${crypto.randomUUID()}`,
            assetType: assetData.assetType || readData("context.HRMSContext", "fallback_8"),
            brand: assetData.brand || readData("context.HRMSContext", "fallback_9"),
            model: assetData.model,
            serialNumber: assetData.serialNumber,
            assetTag: assetData.assetTag || `NUC-IT-${crypto.randomUUID()}`,
            assignedToEmployeeId: assetData.assignedToEmployeeId,
            assignedToName: employees.find(e => e.id === assetData.assignedToEmployeeId)?.name || readData("context.HRMSContext", "fallback_10"),
            assignedDate: new Date().toISOString().split('T')[0],
            ...readData("context.HRMSContext", "newAsset_fields_35"),
            condition: assetData.condition || readData("context.HRMSContext", "fallback_11"),
            replacementValue: Number(assetData.replacementValue) || readData("context.HRMSContext", "fallback_12")
        };

        setHardwareAssets(prev => [newAsset, ...prev]);
        showToast('Asset Allocated', `${newAsset.model} (SN: ${newAsset.serialNumber}) assigned to ${newAsset.assignedToName}.`, 'success');
        return newAsset;
    };

    const markAssetReturned = (assetId, condition = readData("context.HRMSContext", "defaultValue_10"), remarks = '') => {
        setHardwareAssets(prev => prev.map(a => {
            if (a.id !== assetId) return a;
            return {
                ...a,
                ...readData("context.HRMSContext", "markAssetReturned_fields_36"),
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
            employeeName: emp ? emp.name : awardData.employeeName || readData("context.HRMSContext", "fallback_13"),
            dept: emp ? emp.dept : 'General',
            awardType: awardData.awardType || readData("context.HRMSContext", "fallback_14"),
            citation: awardData.citation,
            rewardAmount: Number(awardData.rewardAmount) || readData("context.HRMSContext", "fallback_15"),
            awardedBy: user?.name || readData("context.HRMSContext", "fallback_16"),
            date: new Date().toLocaleDateString('en-GB', readData("context.HRMSContext", "date_38")),
            ...readData("context.HRMSContext", "newAward_fields_37")
        };

        setRecognitionAwards(prev => [newAward, ...prev]);
        showToast('Recognition Broadcasted', `${newAward.employeeName} recognized with ${newAward.awardType} (₹${newAward.rewardAmount.toLocaleString()})!`, 'success');
        return newAward;
    };

    const submitEmployeeReferral = (refData) => {
        const newRef = {
            id: `REF-${crypto.randomUUID()}`,
            candidateName: refData.candidateName,
            role: refData.role,
            dept: refData.dept || readData("context.HRMSContext", "fallback_17"),
            referredByEmployeeId: user?.id || readData("context.HRMSContext", "fallback_18"),
            referredByName: user?.name || readData("context.HRMSContext", "fallback_19"),
            ...readData("context.HRMSContext", "newRef_fields_39")
        };

        setEmployeeReferrals(prev => [newRef, ...prev]);
        showToast('Referral Submitted', `Referral submitted for ${newRef.candidateName}. Milestone payout tracking active.`, 'success');
        return newRef;
    };

    const generateHRLetter = (templateId, employeeId, customFields = {}) => {
        const emp = employees.find(e => e.id === employeeId) || employees[0];
        return renderLetterTemplate(templateId, emp, customFields);
    };

    const [documents] = useState(readData("context.HRMSContext", "documents_40"));

    const [auditLogs] = useState(readData("context.HRMSContext", "auditLogs_41"));

    // --- 5. PAYROLL & EARNED WAGE ACCESS (Module 2) ---
    const [payrollSummary] = useState(readData("context.HRMSContext", "payrollSummary_42"));

    const [ewaTransactions, setEwaTransactions] = useState(readData("context.HRMSContext", "ewaTransactions_43"));

    const requestEWA = (amount) => {
        const num = parseFloat(amount);
        if (isNaN(num) || num <= 0) return;
        setEwaTransactions(prev => [{
            id: `EWA-${crypto.randomUUID()}`,
            ...readData("context.HRMSContext", "requestEWA_fields_44"),
            amount: `₹ ${num.toLocaleString()}`,
            ...readData("context.HRMSContext", "requestEWA_fields_45")
        }, ...prev]);
        showToast('EWA Transfer Complete', `₹ ${num.toLocaleString()} instant credited to your salary account.`, 'success');
    };

    // --- 5B. ADVANCED PAYROLL ADJACENCIES & LOCATION SCOPING (Sprint 3: Demo Points 8, 9, 10, 16) ---
    // User Role Context (For Demo Point 8 Location Scoping Simulation)
    const [currentRoleContext, setCurrentRoleContext] = useState(readData("context.HRMSContext", "currentRoleContext_46"));

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
    const [companyLoans, setCompanyLoans] = useState(readData("context.HRMSContext", "companyLoans_47"));

    const applyForCompanyLoan = (loanRequest) => {
        const validation = validateLoanApplication({
            ...loanRequest,
            activeLoans: companyLoans,
            employeeDirectory: employees
        });

        if (!validation.isValid) {
            showToast('Loan Application Rejected', validation.errors[0], 'error');
            return { ...readData("context.HRMSContext", "applyForCompanyLoan_fields_48"), errors: validation.errors };
        }

        const newLoan = {
            id: `LOAN-${crypto.randomUUID()}`,
            borrowerId: loanRequest.applicantId,
            borrowerName: validation.computed.applicantName,
            borrowerRole: employees.find(e => e.id === loanRequest.applicantId)?.role || readData("context.HRMSContext", "fallback_20"),
            borrowerDept: employees.find(e => e.id === loanRequest.applicantId)?.dept || readData("context.HRMSContext", "fallback_21"),
            principalAmount: validation.computed.requestedAmount,
            remainingBalance: validation.computed.requestedAmount,
            monthlyEMI: validation.computed.monthlyEMI,
            tenureMonths: validation.computed.tenureMonths,
            ...readData("context.HRMSContext", "newLoan_fields_49"),
            purpose: loanRequest.purpose || readData("context.HRMSContext", "fallback_22"),
            guarantors: validation.computed.guarantors,
            guarantorNames: validation.computed.guarantors.map(gid => {
                const emp = employees.find(e => e.id === gid);
                return `${emp?.name || gid} (${gid})`;
            }),
            ...readData("context.HRMSContext", "newLoan_fields_50"),
            isManagementOverride: validation.computed.isManagementOverride,
            overrideReason: validation.computed.overrideReason
        };

        setCompanyLoans(prev => [newLoan, ...prev]);
        showToast(
            'Loan Approved & Disbursed',
            `₹${newLoan.principalAmount.toLocaleString()} loan created. Both guarantors are now LOCKED from raising loans.`,
            'success'
        );
        return { ...readData("context.HRMSContext", "applyForCompanyLoan_fields_51"), loan: newLoan };
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
    const [payrollRuns, setPayrollRuns] = useState(readData("context.HRMSContext", "payrollRuns_52"));

    const createOffCycleRun = (type, customParams = {}) => {
        let newRun;
        if (type === 'OFF_CYCLE_OT') {
            const otRecords = readData("context.HRMSContext", "otRecords_53");
            newRun = generateOffCycleOTRun({
                cyclePeriod: customParams.period || readData("context.HRMSContext", "fallback_23"),
                otRecords,
                employees
            });
        } else if (type === 'ARREARS') {
            newRun = generateArrearsRun({
                cyclePeriod: customParams.period || readData("context.HRMSContext", "fallback_24"),
                ...readData("context.HRMSContext", "createOffCycleRun_fields_54")
            });
        } else {
            newRun = {
                id: `RUN-${type}-${Date.now().toString().slice(-4)}`,
                type,
                label: `${type} Cycle Run`,
                cyclePeriod: customParams.period || readData("context.HRMSContext", "fallback_25"),
                batchDate: new Date().toISOString().split('T')[0],
                ...readData("context.HRMSContext", "createOffCycleRun_fields_56"),
                bankFileRef: `NEFT_${type}_${Date.now().toString().slice(-4)}.txt`
            };
        }

        setPayrollRuns(prev => [newRun, ...prev]);
        showToast('Payroll Run Created', `${newRun.label} (${newRun.type}) created and queued for bank disbursal.`, 'success');
        return newRun;
    };

    // Demo Point 16: Same-Day Full & Final (F&F) Settlement & 4-Department No-Dues
    const [fnfSettlements, setFnfSettlements] = useState(readData("context.HRMSContext", "fnfSettlements_57"));

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
    const [candidates, setCandidates] = useState(readData("context.HRMSContext", "candidates_59"));

    const moveCandidate = (id, newStage) => {
        setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage: newStage } : c));
        showToast('Candidate Stage Updated', `Candidate moved to ${newStage.toUpperCase()}`, 'info');
    };

    // --- 7. ONBOARDING & LIFECYCLE (Module 4) ---
    const [onboardingTasks, setOnboardingTasks] = useState(readData("context.HRMSContext", "onboardingTasks_60"));

    const completeOnboardingTask = (id) => {
        setOnboardingTasks(prev => prev.map(t => t.id === id ? { ...t, ...readData("context.HRMSContext", "completeOnboardingTask_fields_61") } : t));
        showToast('Onboarding Progress Updated', 'Milestone marked as complete.', 'success');
    };

    // --- 8. PERFORMANCE & OKR CASCADE (Module 5) ---
    const [okrs, setOkrs] = useState(readData("context.HRMSContext", "okrs_62"));

    const [talentMatrix] = useState(readData("context.HRMSContext", "talentMatrix_63"));

    const addGoal = () => {
        const newGoal = {
            id: Date.now(),
            ...readData("context.HRMSContext", "newGoal_fields_64"),
            owner: user.name,
            ...readData("context.HRMSContext", "newGoal_fields_65")
        };
        setOkrs([...okrs, newGoal]);
    };

    // --- 9. PEOPLE INTELLIGENCE & ANALYTICS (Module 7) ---
    const [analyticsData] = useState(readData("context.HRMSContext", "analyticsData_67"));

    // --- 10. LEARNING & DEVELOPMENT (Module 8) ---
    const [courses, setCourses] = useState(readData("context.HRMSContext", "courses_68"));

    // --- 11. COMPENSATION & BENEFITS (Module 9) ---
    const [compensationData] = useState(readData("context.HRMSContext", "compensationData_69"));

    // --- 12. EMPLOYEE EXPERIENCE, MCI & VEDIC WELLBEING (Module 10) ---
    const [mciScore] = useState(readData("context.HRMSContext", "mciScore_70"));

    const [vedicFramework, setVedicFramework] = useState(readData("context.HRMSContext", "vedicFramework_71"));

    const [socialFeed, setSocialFeed] = useState(readData("context.HRMSContext", "socialFeed_72"));

    const addKudos = (id) => {
        setSocialFeed(prev => prev.map(p => p.id === id ? { ...p, kudos: p.kudos + 1 } : p));
        showToast('Kudos Sent!', 'You celebrated your teammate’s contribution.', 'success');
    };

    // --- 13. INTEGRATIONS & API PLATFORM (Module 11) ---
    const [connectors, setConnectors] = useState(readData("context.HRMSContext", "connectors_73"));

    const [apiKeys, setApiKeys] = useState(readData("context.HRMSContext", "apiKeys_74"));

    // --- PROJECTS / TASKS (Kanban) ---
    const [projects, setProjects] = useState(readData("context.HRMSContext", "projects_75"));

    const [kanbanTasks, setKanbanTasks] = useState(readData("context.HRMSContext", "kanbanTasks_76"));

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
            title: taskData.title || readData("context.HRMSContext", "fallback_26"),
            tag: taskData.tag || readData("context.HRMSContext", "fallback_27"),
            assignee: taskData.assignee || readData("context.HRMSContext", "fallback_28"),
            project: taskData.project || readData("context.HRMSContext", "fallback_29"),
            due: taskData.due || readData("context.HRMSContext", "fallback_30"),
            priority: taskData.priority || readData("context.HRMSContext", "fallback_31")
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
            title: projectData.title || readData("context.HRMSContext", "fallback_32"),
            desc: projectData.desc || readData("context.HRMSContext", "fallback_33"),
            progress: Number(projectData.progress) || 0,
            color: projectData.color || readData("context.HRMSContext", "fallback_34"),
            due: projectData.due || readData("context.HRMSContext", "fallback_35"),
            members: projectData.members && projectData.members.length > 0 ? projectData.members : readData("context.HRMSContext", "members_77"),
            createdBy: user?.name || readData("context.HRMSContext", "fallback_36"),
            visibility: projectData.visibility || readData("context.HRMSContext", "fallback_37") // 'all', 'team', 'private'
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
    const [focusTasks, setFocusTasks] = useState(readData("context.HRMSContext", "focusTasks_78"));

    const completeFocusTask = (id) => {
        setFocusTasks(prev => prev.map(t => t.id === id ? { ...t, ...readData("context.HRMSContext", "completeFocusTask_fields_79") } : t));
    };

    // --- SETTINGS ---
    const [settings, setSettings] = useState(readData("context.HRMSContext", "settings_80"));

    const updateSettings = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };


    // --- 14. CMS: ANNOUNCEMENTS & BROADCASTS ---
    const [announcements, setAnnouncements] = useState(readData("context.HRMSContext", "announcements_81"));

    const addAnnouncement = (newAnn) => {
        const item = {
            id: `ANN-${Date.now().toString().slice(-4)}`,
            ...readData("context.HRMSContext", "item_fields_82"),
            ...newAnn
        };
        setAnnouncements(prev => [item, ...prev]);
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
    const [policyDocuments, setPolicyDocuments] = useState(readData("context.HRMSContext", "policyDocuments_83"));

    const addPolicyDocument = (newDoc) => {
        const item = {
            id: `DOC-POL-${Date.now().toString().slice(-4)}`,
            effectiveDate: new Date().toLocaleDateString('en-GB', readData("context.HRMSContext", "effectiveDate_85")),
            ...readData("context.HRMSContext", "item_fields_84"),
            ...newDoc
        };
        setPolicyDocuments(prev => [item, ...prev]);
        showToast('Policy Uploaded', `"${item.title}" added to the knowledge repository.`, 'success');
    };

    // --- 16. CUSTOM MIS REPORTS & INGESTION MASTER RECORDS ---
    const [misMasterData, setMisMasterData] = useState(readData("context.HRMSContext", "misMasterData_86"));

    const ingestMappedData = (importType, newRecords, fileName = readData("context.HRMSContext", "defaultValue_11")) => {
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
    const [workflows, setWorkflows] = useState(readData("context.HRMSContext", "workflows_87"));

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

    const triggerErpSync = (connector = readData("context.HRMSContext", "defaultValue_12")) => {
        const inboundBatch = readData("context.HRMSContext", "inboundBatch_88");

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

    const dispatchGLPostingBatch = (batchId, targetErp = readData("context.HRMSContext", "defaultValue_13")) => {
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
                ...readData("context.HRMSContext", "dispatchGLPostingBatch_fields_89"),
                ackReceiptId,
                ackTimestamp,
                ...readData("context.HRMSContext", "dispatchGLPostingBatch_fields_90")
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
                ...readData("context.HRMSContext", "reconcileGLBatch_fields_91"),
                reconciledBy: `${user?.name || readData("context.HRMSContext", "fallback_38")} (Reconciled)`
            };
        }));
        showToast('GL Batch Reconciled', `Batch ${batchId} marked as fully closed & reconciled with ERP general ledger.`, 'success');
    };

    const reportFactoryAccidentForm18 = (accidentData) => {
        const noticeId = `FORM18-2026-${String(statutoryAccidents.length + 1).padStart(3, '0')}`;
        const newRecord = {
            noticeId,
            dateOfOccurrence: accidentData.dateOfOccurrence || new Date().toISOString().split('T')[0],
            exactTime: accidentData.exactTime || readData("context.HRMSContext", "fallback_39"),
            exactPlace: accidentData.exactPlace || readData("context.HRMSContext", "fallback_40"),
            injuredPerson: {
                name: accidentData.injuredPersonName || readData("context.HRMSContext", "fallback_41"),
                tokenNo: accidentData.tokenNo || readData("context.HRMSContext", "fallback_42"),
                age: accidentData.age || readData("context.HRMSContext", "fallback_43"),
                sex: accidentData.sex || readData("context.HRMSContext", "fallback_44"),
                occupation: accidentData.occupation || readData("context.HRMSContext", "fallback_45")
            },
            natureOfInjury: accidentData.natureOfInjury || readData("context.HRMSContext", "fallback_46"),
            causeOfAccident: accidentData.causeOfAccident || readData("context.HRMSContext", "fallback_47"),
            lostWorkdays: Number(accidentData.lostWorkdays) || readData("context.HRMSContext", "fallback_48"),
            ...readData("context.HRMSContext", "newRecord_fields_92"),
            inspectorateFilingDate: new Date().toISOString().split('T')[0],
            investigatingOfficer: accidentData.investigatingOfficer || readData("context.HRMSContext", "fallback_49"),
            remedialActions: accidentData.remedialActions || readData("context.HRMSContext", "fallback_50")
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
            inspectorName: inspectionData.inspectorName || readData("context.HRMSContext", "fallback_51"),
            inspectorOffice: inspectionData.inspectorOffice || readData("context.HRMSContext", "fallback_52"),
            statutoryObservations: inspectionData.statutoryObservations || readData("context.HRMSContext", "fallback_53"),
            remedialDirections: inspectionData.remedialDirections || readData("context.HRMSContext", "fallback_54"),
            complianceStatus: inspectionData.complianceStatus || readData("context.HRMSContext", "fallback_55"),
            closureDate: inspectionData.closureDate || new Date().toISOString().split('T')[0],
            certifyingManager: user?.name || readData("context.HRMSContext", "fallback_56")
        };

        setFactoryInspections(prev => [newRecord, ...prev]);
        showToast('Form 36 Observation Logged', `Inspection entry ${inspectionId} added to statutory inspection ledger.`, 'info');
        return newRecord;
    };

    const generateFormFGratuity = (employeeId, nominees, witnesses) => {
        const targetEmp = employees.find(e => e.id === employeeId) || {
            id: employeeId,
            ...readData("context.HRMSContext", "targetEmp_fields_93")
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
            employees, positions, documents, auditLogs,
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
            computeGuarantorLockStatus, calculateFnFSettlement,
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

