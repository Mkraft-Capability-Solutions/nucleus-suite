/**
 * Automated Verification Runner for Sprint 3: Payroll Adjacencies (G4) & Location Scoping (G9)
 * Tests Demo Points 8, 9, 10, and 16 from MultipliersKraft Blueprint Addendum A.
 */

import {
    PAYROLL_RULESET_VERSION,
    PAYROLL_RUN_TYPES,
    canViewCompensation,
    applyLocationScoping,
    calculateMaxLoanEligibility,
    computeGuarantorLockStatus,
    validateLoanApplication,
    generateOffCycleOTRun,
    generateArrearsRun,
    evaluateNoDuesClearance,
    calculateGratuity,
    calculateLeaveEncashment,
    calculateFnFSettlement
} from '../src/services/payrollAdjacenciesService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✓ ${message}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${message}`);
    }
}

console.log('================================================================');
console.log(`NUCLEUS HRMS · SPRINT 3 AUTOMATED TEST SUITE (${PAYROLL_RULESET_VERSION})`);
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// TEST SUITE 1: DEMO POINT 8 - LOCATION SCOPING & SALARY MASKING (Gap G9)
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: Demo Point 8 - Location Scoping & Masking (Gap G9) ---');

const hoAdmin = { id: 'EMP-ADM-01', role: 'HO_HR_ADMIN', scope: 'ENTERPRISE' };
const plantSupervisor = { id: 'EMP-SUP-01', role: 'PLANT_SUPERVISOR', scope: 'PLANT', location_id: 'LOC-BLR-01' };
const workerRecord = {
    id: 'EMP-009',
    name: 'Ramesh Kumar',
    basicSalary: '₹ 28,000',
    grossSalary: '₹ 42,000',
    netPayable: '₹ 37,500',
    hourlyRate: '₹ 200',
    otHours: 14,
    workingDays: 26,
    shiftCode: 'SHIFT-A'
};

// 1.1 HO Admin should view unrestricted compensation
const hoView = applyLocationScoping(hoAdmin, workerRecord);
assert(hoView._isMasked === false, 'HO HR Admin receives unmasked record');
assert(hoView.basicSalary === '₹ 28,000', 'HO HR Admin views full Basic Salary');
assert(hoView.netPayable === '₹ 37,500', 'HO HR Admin views full Net Payable');

// 1.2 Plant Supervisor must have compensation masked
const plantView = applyLocationScoping(plantSupervisor, workerRecord);
assert(plantView._isMasked === true, 'Plant Supervisor receives masked record (_isMasked = true)');
assert(plantView._scopeBadge === 'RESTRICTED_PLANT_SCOPE', 'Plant Supervisor tagged with RESTRICTED_PLANT_SCOPE badge');
assert(plantView.basicSalary === '••••••', 'Plant Supervisor sees masked Basic Salary (••••••)');
assert(plantView.grossSalary === '••••••', 'Plant Supervisor sees masked Gross Salary (••••••)');
assert(plantView.netPayable === '••••••', 'Plant Supervisor sees masked Net Payable (••••••)');

// 1.3 Operational data must remain intact for plant operations
assert(plantView.otHours === 14, 'Plant Supervisor retains full visibility of OT Hours (14 hrs)');
assert(plantView.workingDays === 26, 'Plant Supervisor retains full visibility of Working Days (26 days)');
assert(plantView.shiftCode === 'SHIFT-A', 'Plant Supervisor retains full visibility of Shift Code (SHIFT-A)');

// ----------------------------------------------------------------------------
// TEST SUITE 2: DEMO POINT 9 - COMPANY LOAN POLICY & GUARANTOR LOCK (Gap G4)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Demo Point 9 - Loan Policy & Dual-Guarantor Lock (Gap G4) ---');

const employees = [
    { id: 'EMP-101', name: 'Trisha Khanna', basicSalaryNumeric: 80000 },
    { id: 'EMP-102', name: 'Amit Verma', basicSalaryNumeric: 140000 },
    { id: 'EMP-104', name: 'Rahul Saxena', basicSalaryNumeric: 60000 },
    { id: 'EMP-105', name: 'Priya Nair', basicSalaryNumeric: 45000 },
    { id: 'EMP-001', name: 'Vikram Seth', basicSalaryNumeric: 50000 }
];

const initialActiveLoans = [
    {
        id: 'LOAN-1001',
        borrowerId: 'EMP-104', // Rahul has active loan
        borrowerName: 'Rahul Saxena',
        principalAmount: 180000,
        remainingBalance: 90000,
        guarantors: ['EMP-101', 'EMP-105'], // Trisha and Priya are guarantors!
        status: 'ACTIVE'
    }
];

// 2.1 Max Loan Ceiling Calculation (4x Basic)
const maxRahul = calculateMaxLoanEligibility(60000, 4);
assert(maxRahul === 240000, '4x Basic of ₹60,000 is correctly calculated as ₹2,40,000');

// 2.2 Guarantor Lock Detection
const lockMap = computeGuarantorLockStatus(initialActiveLoans);
assert(lockMap.has('EMP-101') === true, 'Trisha Khanna (EMP-101) identified as GUARANTOR LOCKED');
assert(lockMap.has('EMP-105') === true, 'Priya Nair (EMP-105) identified as GUARANTOR LOCKED');
assert(lockMap.has('EMP-102') === false, 'Amit Verma (EMP-102) is NOT locked');

// 2.3 Policy Rejection: Single Active Loan Limit
const secondLoanAttempt = validateLoanApplication({
    applicantId: 'EMP-104', // Rahul already has LOAN-1001
    amount: 50000,
    guarantorIds: ['EMP-102', 'EMP-001'],
    activeLoans: initialActiveLoans,
    employeeDirectory: employees
});
assert(secondLoanAttempt.isValid === false, 'Rejected applicant who already has an active loan');
assert(secondLoanAttempt.errors.some(e => e.includes('already has an active loan')), 'Error message cites active loan limit');

// 2.4 Policy Rejection: Exceeding 4x Basic Ceiling
const excessiveLoanAttempt = validateLoanApplication({
    applicantId: 'EMP-001', // Vikram Seth: Basic ₹50,000 -> Max ₹2,00,000
    amount: 250000, // Requesting ₹2,50,000
    guarantorIds: ['EMP-102', 'EMP-101'],
    activeLoans: initialActiveLoans,
    employeeDirectory: employees
});
assert(excessiveLoanAttempt.isValid === false, 'Rejected loan exceeding 4x Basic ceiling');
assert(excessiveLoanAttempt.errors.some(e => e.includes('exceeds the 4x Basic ceiling')), 'Error cites 4x Basic cap violation');

// 2.5 Policy Rejection: Insufficient Guarantors (< 2)
const singleGuarantorAttempt = validateLoanApplication({
    applicantId: 'EMP-001',
    amount: 100000,
    guarantorIds: ['EMP-102'], // Only 1 guarantor!
    activeLoans: initialActiveLoans,
    employeeDirectory: employees
});
assert(singleGuarantorAttempt.isValid === false, 'Rejected application with only 1 guarantor (requires 2)');

// 2.6 Policy Rejection: Locked Guarantor attempted
const lockedGuarantorAttempt = validateLoanApplication({
    applicantId: 'EMP-001',
    amount: 100000,
    guarantorIds: ['EMP-102', 'EMP-101'], // EMP-101 Trisha is locked!
    activeLoans: initialActiveLoans,
    employeeDirectory: employees
});
assert(lockedGuarantorAttempt.isValid === false, 'Rejected application utilizing locked guarantor (EMP-101)');
assert(lockedGuarantorAttempt.errors.some(e => e.includes('currently LOCKED')), 'Error explicitly reports guarantor lock with loan ref');

// 2.7 Valid Loan Application
const validLoan = validateLoanApplication({
    applicantId: 'EMP-001',
    amount: 150000,
    tenureMonths: 10,
    guarantorIds: ['EMP-102', 'EMP-104'], // Wait, EMP-104 is borrower of another loan, but let's check non-locked: EMP-102 and another
    activeLoans: [], // With clean state
    employeeDirectory: employees
});
assert(validLoan.isValid === true, 'Valid application with 2 clean guarantors under 4x Basic passes');
assert(validLoan.computed.monthlyEMI === 15000, 'Monthly EMI calculated correctly (150,000 / 10 = ₹15,000)');

// 2.8 Management Exception Override
const overrideLoan = validateLoanApplication({
    applicantId: 'EMP-001',
    amount: 300000, // Exceeds 4x (200k)
    tenureMonths: 12,
    guarantorIds: ['EMP-102', 'EMP-101'], // Uses locked guarantor
    activeLoans: initialActiveLoans,
    employeeDirectory: employees,
    isManagementOverride: true,
    overrideReason: 'Managing Director compassionate executive sanction for medical emergency'
});
assert(overrideLoan.isValid === true, 'Management Exception Override successfully approved');
assert(overrideLoan.warnings.length > 0, 'Override generated audit warning record');

// ----------------------------------------------------------------------------
// TEST SUITE 3: DEMO POINT 10 - OFF-CYCLE PAYROLL RUNS (Gap G4)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Demo Point 10 - Off-Cycle Payroll Runs (Gap G4) ---');

const otRecords = [
    { employeeId: 'EMP-101', employeeName: 'Trisha Khanna', otHours: 8 },
    { employeeId: 'EMP-105', employeeName: 'Priya Nair', otHours: 12 }
];

const otRun = generateOffCycleOTRun({
    cyclePeriod: 'Feb 2026',
    otRecords,
    employees
});

assert(otRun.type === PAYROLL_RUN_TYPES.OFF_CYCLE_OT.id, 'Off-Cycle OT run produced with OFF_CYCLE_OT type');
assert(otRun.totalHours === 20, 'Total OT hours summed to 20 hours (8 + 12)');
assert(otRun.employeeCount === 2, '2 employees included in OT batch');
assert(otRun.totalDisbursement > 0, `Total OT disbursement computed: ₹${otRun.totalDisbursement.toLocaleString()}`);
assert(otRun.bankFileRef.startsWith('NEFT_OT_DISBURSE_'), 'Generated dedicated NEFT bank upload file reference');

const arrearsRun = generateArrearsRun({
    cyclePeriod: 'Feb 2026',
    arrearsItems: [
        { employeeId: 'EMP-101', employeeName: 'Trisha Khanna', arrearsAmount: 12000, reason: 'Annual increment retro for Jan 2026' },
        { employeeId: 'EMP-105', employeeName: 'Priya Nair', arrearsAmount: 5000, reason: 'Shift allowance correction' }
    ]
});
assert(arrearsRun.type === PAYROLL_RUN_TYPES.ARREARS.id, 'Retro arrears run produced with ARREARS type');
assert(arrearsRun.totalDisbursement === 17000, 'Arrears total disbursement is ₹17,000 (12k + 5k)');

// ----------------------------------------------------------------------------
// TEST SUITE 4: DEMO POINT 16 - SAME-DAY F&F SETTLEMENT & 4-DEPT NO-DUES (Gap G4)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Demo Point 16 - Same-Day F&F Settlement & No-Dues (Gap G4) ---');

// 4.1 Gratuity Calculation (Statutory formula: 15 * Basic * Years / 26)
const gratEligible = calculateGratuity(50000, 6.0); // 6 years
// 15 * 50000 * 6 / 26 = 4,500,000 / 26 = 173076.92 -> 173077
assert(gratEligible.eligible === true, 'Employee with 6 years tenure is eligible for Gratuity');
assert(gratEligible.amount === 173077, `Gratuity amount correctly computed: ₹${gratEligible.amount} (expected 173,077)`);

const gratIneligible = calculateGratuity(50000, 3.5); // Under 5 years
assert(gratIneligible.eligible === false, 'Employee with 3.5 years tenure is NOT eligible for Gratuity');
assert(gratIneligible.amount === 0, 'Ineligible gratuity returns ₹0');

// 4.2 Leave Encashment Calculation: EL * (Basic / 30)
const encashment = calculateLeaveEncashment(60000, 15); // 15 days * 2000 = 30,000
assert(encashment === 30000, `Leave encashment correctly computed: ₹${encashment} (expected 30,000)`);

// 4.3 F&F Settlement with PENDING clearances (Should be BLOCKED)
const pendingClearances = {
    IT: { status: 'CLEARED', remarks: 'MacBook Pro #C02F... and monitor returned' },
    FINANCE: { status: 'PENDING', remarks: 'Awaiting corporate Amex statement' },
    HOD: { status: 'CLEARED', remarks: 'Knowledge transfer complete to Sarah Chen' },
    HR: { status: 'PENDING', remarks: 'Exit interview scheduled today 4 PM' }
};

const blockedFnF = calculateFnFSettlement({
    employee: { id: 'EMP-101', name: 'Trisha Khanna', basicSalaryNumeric: 80000, grossSalaryNumeric: 144000, dept: 'Engineering' },
    exitDate: '2026-02-28',
    unpaidDays: 20,
    elBalance: 14,
    tenureYears: 5.5,
    activeLoans: initialActiveLoans, // Trisha is guarantor, not borrower, so no loan deduction for herself
    noticeShortfallDays: 0,
    departmentClearances: pendingClearances
});

assert(blockedFnF.clearanceStatus.allCleared === false, '4-Department clearance evaluation returns false when 2 are pending');
assert(blockedFnF.isDisbursementAllowed === false, 'F&F Disbursement is physically BLOCKED when clearances are incomplete');
assert(blockedFnF.settlementStatus === 'CLEARANCE_IN_PROGRESS', 'Settlement status is CLEARANCE_IN_PROGRESS');
assert(blockedFnF.disbursementBlockedReason.includes('FINANCE, HR'), 'Blocked reason identifies pending departments');

// 4.4 F&F Settlement with ALL 4 DEPARTMENTS CLEARED
const allClearedClearances = {
    IT: { status: 'CLEARED', remarks: 'Serial #SN-9821 verified, AD deactivated' },
    FINANCE: { status: 'CLEARED', remarks: 'Amex cancelled, no corporate dues' },
    HOD: { status: 'CLEARED', remarks: 'Handover sign-off completed' },
    HR: { status: 'CLEARED', remarks: 'ID badge returned, PF exit form generated' }
};

const clearedFnF = calculateFnFSettlement({
    employee: { id: 'EMP-104', name: 'Rahul Saxena', basicSalaryNumeric: 60000, grossSalaryNumeric: 108000, dept: 'Design' },
    exitDate: '2026-02-28',
    unpaidDays: 25,
    elBalance: 12,
    tenureYears: 5.0,
    activeLoans: initialActiveLoans, // Rahul has LOAN-1001 with ₹90,000 balance!
    noticeShortfallDays: 5, // 5 days shortfall
    travelAdvanceDeduction: 5000,
    departmentClearances: allClearedClearances
});

assert(clearedFnF.clearanceStatus.allCleared === true, 'All 4 departments verified as CLEARED');
assert(clearedFnF.isDisbursementAllowed === true, 'F&F Disbursement is ALLOWED once all 4 departments sign off');
assert(clearedFnF.settlementStatus === 'CLEARED_FOR_DISBURSEMENT', 'Status changes to CLEARED_FOR_DISBURSEMENT');

// Verify Earnings DAG
// Unpaid Days = (108000 / 30) * 25 = 3600 * 25 = 90,000
assert(clearedFnF.earnings.unpaidDaysSalary === 90000, 'Unpaid days salary = ₹90,000');
// Leave Encashment = 12 * (60000 / 30) = 12 * 2000 = 24,000
assert(clearedFnF.earnings.leaveEncashmentAmount === 24000, 'Leave encashment = ₹24,000');
// Gratuity: 15 * 60000 * 5 / 26 = 4,500,000 / 26 = 173,077
assert(clearedFnF.earnings.gratuity.amount === 173077, 'Gratuity amount = ₹1,73,077');
const totalEarningsExpected = 90000 + 24000 + 173077;
assert(clearedFnF.earnings.totalEarnings === totalEarningsExpected, `Total Earnings = ₹${totalEarningsExpected.toLocaleString()}`);

// Verify Deductions DAG
// Loan balance deduction = ₹90,000 (from LOAN-1001)
assert(clearedFnF.deductions.loanDeduction === 90000, 'Outstanding loan balance (₹90,000) automatically deducted');
// Notice Shortfall = 5 * (108000 / 30) = 5 * 3600 = 18,000
assert(clearedFnF.deductions.noticeRecovery === 18000, 'Notice period shortfall (₹18,000) deducted');
// Travel Advance = ₹5,000
assert(clearedFnF.deductions.travelAdvanceDeduction === 5000, 'Travel advance deduction = ₹5,000');
const totalDeductionsExpected = 90000 + 18000 + 5000; // 113,000
assert(clearedFnF.deductions.totalDeductions === totalDeductionsExpected, `Total Deductions = ₹${totalDeductionsExpected.toLocaleString()}`);

// Verify Net Payable: Earnings - Deductions
const netPayableExpected = totalEarningsExpected - totalDeductionsExpected; // 287,077 - 113,000 = 174,077
assert(clearedFnF.netPayable === netPayableExpected, `Net Settlement Payable = ₹${clearedFnF.netPayable.toLocaleString()} (exactly ₹${netPayableExpected.toLocaleString()})`);

console.log('\n================================================================');
console.log(`SPRINT 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
    process.exit(1);
}
