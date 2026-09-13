
import { readData } from './workspace-data.mjs';
/**
 * NUCLEUS HRMS · PAYROLL ADJACENCIES & LOCATION SCOPING SERVICE
 * Ruleset Version: v3.0.0-PAYROLL-2026.09
 * 
 * Implements MultipliersKraft Blueprint Addendum A:
 * - Demo Point 8 (G9): HO-Generated Salary with Plant User Location Scoping (Salary Masking)
 * - Demo Point 9 (G4): Company Loan Policy (4x Basic ceiling, 2 Guarantors, Guarantor Lock, 1 active loan limit)
 * - Demo Point 10 (G4): Off-Cycle Payroll Runs (Regular, Off-Cycle OT, Arrears, FNF)
 * - Demo Point 16 (G4): Same-Day F&F Settlement & 4-Department No-Dues Clearance Checklist
 */

export const PAYROLL_RULESET_VERSION = 'v3.0.0-PAYROLL-2026.09';

export const PAYROLL_RUN_TYPES = readData("services.payrollAdjacenciesService", "PAYROLL_RUN_TYPES_1");

export const NO_DUES_DEPARTMENTS = readData("services.payrollAdjacenciesService", "NO_DUES_DEPARTMENTS_2");

// ============================================================================
// 1. DEMO POINT 8: LOCATION SCOPING & SALARY MASKING (Gap G9)
// ============================================================================

/**
 * Checks if a user has permission to view compensation figures.
 * Plant supervisors and plant-scoped users can manage operational data
 * (attendance, shifts, punches, OT hours) but CANNOT view salary/rates.
 */
export function canViewCompensation(user, targetEmployee = null) {
    if (!user) return false;
    const role = (user.role || '').toUpperCase();
    const scope = (user.scope || '').toUpperCase();

    // Privileged roles with corporate payroll authority
    const HO_ROLES = readData("services.payrollAdjacenciesService", "HO_ROLES_3");

    if (HO_ROLES.some(r => role.includes(r))) {
        return true;
    }

    // Plant-level roles are strictly restricted from seeing compensation
    if (scope === 'PLANT' || role.includes('PLANT_SUPERVISOR') || role.includes('TIME_OFFICE_INCHARGE')) {
        return false;
    }

    // Default fallback: allow only if user is viewing their own record
    if (targetEmployee && user.id === targetEmployee.id) {
        return true;
    }

    return false;
}

/**
 * Applies location scoping to employee record or payroll breakdown.
 * If user lacks compensation permission, masks monetary values with '••••••'.
 */
export function applyLocationScoping(user, record) {
    const isAllowed = canViewCompensation(user, record);
    if (isAllowed) {
        return {
            ...record,
            ...readData("services.payrollAdjacenciesService", "content_fields_4")
        };
    }

    // Mask compensation attributes
    return {
        ...record,
        ...readData("services.payrollAdjacenciesService", "content_fields_5"),
        // Operational metrics remain fully visible
        otHours: record.otHours !== undefined ? record.otHours : 0,
        workingDays: record.workingDays !== undefined ? record.workingDays : 0,
        shiftCode: record.shiftCode || 'GENERAL'
    };
}

// ============================================================================
// 2. DEMO POINT 9: COMPANY LOAN POLICY & DUAL-GUARANTOR LOCK (Gap G4)
// ============================================================================

/**
 * Computes which employees are currently locked from applying for loans
 * because they are serving as guarantors for an active loan with outstanding balance.
 */
export function computeGuarantorLockStatus(activeLoans = []) {
    const lockedMap = new Map();

    activeLoans.forEach(loan => {
        if (loan.status === 'ACTIVE' && loan.remainingBalance > 0) {
            (loan.guarantors || []).forEach(gId => {
                lockedMap.set(gId, {
                    ...readData("services.payrollAdjacenciesService", "content_fields_6"),
                    loanId: loan.id,
                    borrowerId: loan.borrowerId,
                    borrowerName: loan.borrowerName,
                    outstandingBalance: loan.remainingBalance
                });
            });
        }
    });

    return lockedMap;
}

/**
 * Calculates maximum loan ceiling for an employee.
 * Policy: 4x Monthly Basic Salary (or 6x with board approval).
 */
export function calculateMaxLoanEligibility(basicSalary, multiplier = 4) {
    const numericBasic = typeof basicSalary === 'number'
        ? basicSalary
        : parseFloat(String(basicSalary || '0').replace(/[^\d.]/g, '')) || 0;
    return numericBasic * multiplier;
}

/**
 * Validates a company loan application against all 4 policy constraints:
 * 1. Max loan amount <= 4x Basic (unless management override).
 * 2. Exactly 2 distinct employee guarantors.
 * 3. Neither guarantor is currently locked by another active loan.
 * 4. Applicant has NO active loans (limit 1 active loan).
 */
export function validateLoanApplication({
    applicantId,
    amount,
    tenureMonths = 12,
    guarantorIds = [],
    activeLoans = [],
    employeeDirectory = [],
    isManagementOverride = false,
    overrideReason = ''
}) {
    const errors = [];
    const warnings = [];

    const applicant = employeeDirectory.find(e => e.id === applicantId);
    if (!applicant) {
        errors.push(`Applicant ${applicantId} not found in employee directory.`);
        return { ...readData("services.payrollAdjacenciesService", "content_fields_7"), errors, warnings };
    }

    const requestedAmount = Number(amount) || 0;
    if (requestedAmount <= 0) {
        errors.push('Loan amount must be greater than zero.');
    }

    // 1. Single Active Loan Check
    const existingActiveLoan = activeLoans.find(
        l => l.borrowerId === applicantId && l.status === 'ACTIVE' && l.remainingBalance > 0
    );
    if (existingActiveLoan && !isManagementOverride) {
        errors.push(`Applicant already has an active loan (${existingActiveLoan.id}) with outstanding balance ₹${existingActiveLoan.remainingBalance.toLocaleString()}. Limit 1 active loan per employee.`);
    }

    // 2. Ceiling Check: 4x Basic Salary
    const applicantBasic = applicant.basicSalaryNumeric || (applicant.basicSalary ? parseFloat(String(applicant.basicSalary).replace(/[^\d.]/g, '')) : 40000);
    const maxPermitted = calculateMaxLoanEligibility(applicantBasic, 4);

    if (requestedAmount > maxPermitted && !isManagementOverride) {
        errors.push(`Requested amount (₹${requestedAmount.toLocaleString()}) exceeds the 4x Basic ceiling of ₹${maxPermitted.toLocaleString()} (Basic: ₹${applicantBasic.toLocaleString()}).`);
    } else if (requestedAmount > maxPermitted && isManagementOverride) {
        warnings.push(`Loan exceeds 4x Basic ceiling (₹${maxPermitted.toLocaleString()}) but is permitted via Management Exception Override.`);
    }

    // 3. Dual Guarantor Check
    const uniqueGuarantors = [...new Set(guarantorIds.filter(Boolean))];
    if (uniqueGuarantors.length < 2) {
        errors.push(`Company loan policy strictly requires at least 2 distinct employee guarantors. Only ${uniqueGuarantors.length} provided.`);
    }

    if (uniqueGuarantors.includes(applicantId)) {
        errors.push('Applicant cannot be their own guarantor.');
    }

    // 4. Guarantor Lock Check
    const lockedMap = computeGuarantorLockStatus(activeLoans);
    uniqueGuarantors.forEach(gId => {
        if (lockedMap.has(gId) && !isManagementOverride) {
            const lockInfo = lockedMap.get(gId);
            const guarantorEmp = employeeDirectory.find(e => e.id === gId);
            const gName = guarantorEmp ? guarantorEmp.name : gId;
            errors.push(`Guarantor ${gName} (${gId}) is currently LOCKED. They already guarantee loan ${lockInfo.loanId} for ${lockInfo.borrowerName} (Outstanding: ₹${lockInfo.outstandingBalance.toLocaleString()}). A guarantor cannot guarantee or take another loan until the active loan is cleared.`);
        }
    });

    // 5. Override Audit Validation
    if (isManagementOverride && (!overrideReason || overrideReason.trim().length < 10)) {
        errors.push('Management override requires a documented business reason of at least 10 characters for audit compliance.');
    }

    // Calculate EMI (0% interest for internal welfare loans, or configurable)
    const emi = tenureMonths > 0 ? Math.round(requestedAmount / tenureMonths) : requestedAmount;

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        computed: {
            applicantId,
            applicantName: applicant.name,
            requestedAmount,
            maxPermitted,
            tenureMonths,
            monthlyEMI: emi,
            guarantors: uniqueGuarantors,
            isManagementOverride,
            overrideReason: isManagementOverride ? overrideReason : null
        }
    };
}

// ============================================================================
// 3. DEMO POINT 10: OFF-CYCLE PAYROLL RUNS (Gap G4)
// ============================================================================

/**
 * Generates an off-cycle Overtime payroll run from approved OT ledger records.
 */
export function generateOffCycleOTRun({
    cyclePeriod = 'Feb 2026',
    otRecords = [],
    employees = []
}) {
    let totalOTHours = 0;
    let totalOTPayout = 0;
    const lineItems = [];

    otRecords.forEach((rec, idx) => {
        const emp = employees.find(e => e.id === rec.employeeId) || {
            id: rec.employeeId,
            name: rec.employeeName || 'Staff Member',
            ...readData("services.payrollAdjacenciesService", "emp_fields_8")
        };

        const hours = Number(rec.otHours || rec.ot_hours || 0);
        if (hours <= 0) return;

        // Standard hourly OT rate = (Basic / 26 / 8) * 2.0 (Double rate as per Factories Act)
        const hourlyRate = ((emp.basicSalaryNumeric || 40000) / 208) * 2.0;
        const payout = Math.round(hours * hourlyRate);

        totalOTHours += hours;
        totalOTPayout += payout;

        lineItems.push({
            id: `OT-LI-${idx + 101}`,
            employeeId: emp.id,
            employeeName: emp.name,
            otHours: hours,
            hourlyRate: Math.round(hourlyRate),
            payoutAmount: payout,
            bankAccount: `HDFC-xxxx-${emp.id.slice(-3)}`,
            ...readData("services.payrollAdjacenciesService", "content_fields_9")
        });
    });

    const runId = `RUN-OT-${Date.now().toString().slice(-6)}`;
    return {
        id: runId,
        type: PAYROLL_RUN_TYPES.OFF_CYCLE_OT.id,
        label: `Off-Cycle Overtime Batch · ${cyclePeriod}`,
        cyclePeriod,
        batchDate: new Date().toISOString().split('T')[0],
        ...readData("services.payrollAdjacenciesService", "content_fields_10"),
        employeeCount: lineItems.length,
        totalHours: totalOTHours,
        totalDisbursement: totalOTPayout,
        ...readData("services.payrollAdjacenciesService", "content_fields_11"),
        lineItems,
        bankFileRef: `NEFT_OT_DISBURSE_${runId}.txt`
    };
}

/**
 * Generates a retro-arrears payroll run for increments or salary corrections.
 */
export function generateArrearsRun({
    cyclePeriod = 'Feb 2026',
    arrearsItems = []
}) {
    let totalArrears = 0;
    const processedItems = arrearsItems.map((item, idx) => {
        totalArrears += item.arrearsAmount;
        return {
            id: `ARR-LI-${idx + 101}`,
            ...item,
            ...readData("services.payrollAdjacenciesService", "processedItems_fields_12")
        };
    });

    const runId = `RUN-ARR-${Date.now().toString().slice(-6)}`;
    return {
        id: runId,
        type: PAYROLL_RUN_TYPES.ARREARS.id,
        label: `Retro Salary Arrears Batch · ${cyclePeriod}`,
        cyclePeriod,
        batchDate: new Date().toISOString().split('T')[0],
        ...readData("services.payrollAdjacenciesService", "content_fields_13"),
        employeeCount: processedItems.length,
        totalDisbursement: totalArrears,
        ...readData("services.payrollAdjacenciesService", "content_fields_14"),
        lineItems: processedItems,
        bankFileRef: `NEFT_ARREARS_${runId}.txt`
    };
}

// ============================================================================
// 4. DEMO POINT 16: SAME-DAY F&F SETTLEMENT & 4-DEPARTMENT NO-DUES (Gap G4)
// ============================================================================

/**
 * Evaluates the 4-department no-dues clearance status for an exiting employee.
 */
export function evaluateNoDuesClearance(departmentClearances = {}) {
    const departments = readData("services.payrollAdjacenciesService", "departments_15");
    const results = {};
    let allCleared = true;
    const pendingDepartments = [];

    departments.forEach(deptKey => {
        const item = departmentClearances[deptKey] || readData("services.payrollAdjacenciesService", "item_16");
        const isDeptCleared = item.status === 'CLEARED';
        results[deptKey] = {
            ...item,
            isCleared: isDeptCleared
        };
        if (!isDeptCleared) {
            allCleared = false;
            pendingDepartments.push(deptKey);
        }
    });

    return {
        allCleared,
        isBlocked: !allCleared,
        clearanceProgress: Math.round(((4 - pendingDepartments.length) / 4) * 100),
        pendingDepartments,
        departments: results
    };
}

/**
 * Calculates Statutory Gratuity under the Payment of Gratuity Act, 1972:
 * Formula: (15 * Last Drawn Basic * Completed Years of Service) / 26
 * Qualifying criteria: Minimum 5 years of continuous service (or 4.5+ rounded).
 */
export function calculateGratuity(lastDrawnBasic, tenureYears) {
    if (tenureYears < 4.8) {
        return {
            ...readData("services.payrollAdjacenciesService", "content_fields_17"),
            reason: `Tenure (${tenureYears} yrs) is less than the statutory 5-year threshold.`
        };
    }
    const roundedYears = Math.round(tenureYears);
    const amount = Math.round((15 * lastDrawnBasic * roundedYears) / 26);
    return {
        ...readData("services.payrollAdjacenciesService", "content_fields_18"),
        amount,
        formula: `(15 * ₹${lastDrawnBasic.toLocaleString()} * ${roundedYears}) / 26`,
        yearsConsidered: roundedYears
    };
}

/**
 * Calculates Leave Encashment for Earned Leave balance.
 * Formula: (Earned Leave Days) * (Basic Salary / 30)
 */
export function calculateLeaveEncashment(basicSalary, elBalance) {
    if (elBalance <= 0) return 0;
    const perDayBasic = basicSalary / 30;
    return Math.round(elBalance * perDayBasic);
}

/**
 * Calculates Full & Final (F&F) Settlement DAG.
 * Enforces strict disbursement blocker if any of the 4 departments have not signed off.
 */
export function calculateFnFSettlement({
    employee,
    exitDate = '2026-02-28',
    unpaidDays = 24,
    elBalance = 16,
    tenureYears = 5.2,
    activeLoans = [],
    noticeShortfallDays = 0,
    travelAdvanceDeduction = 0,
    departmentClearances = {}
}) {
    const basic = employee.basicSalaryNumeric || 50000;
    const gross = employee.grossSalaryNumeric || (basic * 1.8);

    // 1. Evaluate 4-Department No-Dues
    const clearanceEval = evaluateNoDuesClearance(departmentClearances);

    // 2. Earnings DAG
    // Unpaid working days salary: (Gross / 30) * unpaidDays
    const unpaidDaysSalary = Math.round((gross / 30) * unpaidDays);

    // Leave Encashment: EL * (Basic / 30)
    const leaveEncashmentAmount = calculateLeaveEncashment(basic, elBalance);

    // Statutory Gratuity
    const gratuityResult = calculateGratuity(basic, tenureYears);

    const totalEarnings = unpaidDaysSalary + leaveEncashmentAmount + gratuityResult.amount;

    // 3. Deductions DAG
    // Outstanding loan balance deduction
    const empLoan = activeLoans.find(
        l => l.borrowerId === employee.id && l.status === 'ACTIVE' && l.remainingBalance > 0
    );
    const loanDeduction = empLoan ? empLoan.remainingBalance : 0;

    // Notice Period Shortfall Recovery: Shortfall Days * (Gross / 30)
    const noticeRecovery = Math.round((gross / 30) * noticeShortfallDays);

    const totalDeductions = loanDeduction + noticeRecovery + travelAdvanceDeduction;

    // 4. Net Settlement Amount
    const netPayable = totalEarnings - totalDeductions;

    return {
        settlementId: `FNF-${employee.id}-${exitDate.replace(/-/g, '')}`,
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.dept || 'Engineering',
        exitDate,
        tenureYears,
        clearanceStatus: clearanceEval,
        isDisbursementAllowed: clearanceEval.allCleared,
        disbursementBlockedReason: clearanceEval.allCleared
            ? null
            : `F&F Disbursement physically BLOCKED: Pending clearances in [${clearanceEval.pendingDepartments.join(', ')}]`,
        earnings: {
            unpaidDays,
            unpaidDaysSalary,
            elBalance,
            leaveEncashmentAmount,
            gratuity: gratuityResult,
            totalEarnings
        },
        deductions: {
            loanDeduction,
            loanRef: empLoan ? empLoan.id : null,
            noticeShortfallDays,
            noticeRecovery,
            travelAdvanceDeduction,
            totalDeductions
        },
        netPayable,
        settlementStatus: clearanceEval.allCleared ? 'CLEARED_FOR_DISBURSEMENT' : 'CLEARANCE_IN_PROGRESS',
        timestamp: new Date().toISOString()
    };
}
