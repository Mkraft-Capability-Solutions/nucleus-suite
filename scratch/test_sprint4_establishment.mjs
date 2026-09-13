/**
 * Automated Verification Runner for Sprint 4: Establishment Control (G7) & Documents, Assets & Recognition (G8)
 * Tests Demo Points 21, 23, 24, 25, 18, 19, 20 from MultipliersKraft Blueprint Addendum A.
 */

import {
    ESTABLISHMENT_RULESET_VERSION,
    DEFAULT_SANCTIONED_QUOTAS,
    calculateDepartmentCapacity,
    validateRequisitionCreation,
    INITIAL_ASSET_REGISTER,
    getEmployeeAssignedAssets,
    LETTER_TEMPLATES,
    renderLetterTemplate,
    INITIAL_RECOGNITIONS,
    INITIAL_REFERRALS
} from '../src/services/establishmentService.js';

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
console.log(`NUCLEUS HRMS · SPRINT 4 AUTOMATED TEST SUITE (${ESTABLISHMENT_RULESET_VERSION})`);
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// TEST SUITE 1: DEMO POINT 25 - SANCTIONED MANPOWER & ESTABLISHMENT CEILINGS (Gap G7)
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: Demo Point 25 - Approved Manpower Quotas (Gap G7) ---');

const mockEmployees = [
    { id: 'EMP-101', name: 'Trisha Khanna', dept: 'Engineering', status: 'Active', grossSalaryNumeric: 144000 },
    { id: 'EMP-102', name: 'Amit Verma', dept: 'Engineering', status: 'Active', grossSalaryNumeric: 252000 },
    { id: 'EMP-105', name: 'Priya Nair', dept: 'Engineering', status: 'Active', grossSalaryNumeric: 81000 },
    { id: 'EMP-103', name: 'Sarah Chen', dept: 'Product', status: 'Active', grossSalaryNumeric: 198000 },
    { id: 'EMP-104', name: 'Rahul Saxena', dept: 'Design', status: 'Active', grossSalaryNumeric: 108000 },
    { id: 'EMP-107', name: 'Anika Roy', dept: 'Design', status: 'Active', grossSalaryNumeric: 95000 },
];

const mockOpenPositions = [
    { id: 'POS-201', title: 'Senior Backend Engineer', dept: 'Engineering', status: 'Open' },
    { id: 'POS-202', title: 'Full Stack Engineer', dept: 'Engineering', status: 'Open' },
    { id: 'POS-301', title: 'UI Designer', dept: 'Design', status: 'Open' } // Design now has 2 employees + 1 open = 3 (Quota = 2)
];

// Design capacity check: Sanctioned = 2, Current = 2, Open = 1 -> Total Committed = 3 (At Capacity!)
const designCap = calculateDepartmentCapacity('Design', mockEmployees, mockOpenPositions, DEFAULT_SANCTIONED_QUOTAS);
assert(designCap.sanctioned === 2, 'Design department sanctioned ceiling is 2');
assert(designCap.currentHeadcount === 2, 'Current active headcount in Design is 2');
assert(designCap.activeOpenReqs === 1, 'Active open requisitions in Design is 1');
assert(designCap.totalCommitted === 3, 'Total committed headcount is 3 (2 filled + 1 open)');
assert(designCap.isAtCapacity === true, 'Design department correctly identified as AT CAPACITY (isAtCapacity = true)');
assert(designCap.availableVacancies === 0, 'Available vacancies in Design is 0');

// Engineering capacity check: Sanctioned = 10, Current = 3, Open = 2 -> Available = 5
const engCap = calculateDepartmentCapacity('Engineering', mockEmployees, mockOpenPositions, DEFAULT_SANCTIONED_QUOTAS);
assert(engCap.sanctioned === 10, 'Engineering sanctioned ceiling is 10');
assert(engCap.totalCommitted === 5, 'Engineering total committed is 5 (3 active + 2 open)');
assert(engCap.availableVacancies === 5, 'Engineering available vacancies = 5');
assert(engCap.isAtCapacity === false, 'Engineering is not at capacity');

// ----------------------------------------------------------------------------
// TEST SUITE 2: DEMO POINT 24 & 25 - REQUISITION VALIDATION & HARD BLOCKER (Gap G7)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Demo Point 24 & 25 - Requisition Validation & Quota Enforcement ---');

// 2.1 NEW_ADDITION blocked when department at capacity
const blockedReq = validateRequisitionCreation({
    dept: 'Design',
    requisitionType: 'NEW_ADDITION',
    title: 'Lead Motion Designer',
    employees: mockEmployees,
    openPositions: mockOpenPositions,
    quotas: DEFAULT_SANCTIONED_QUOTAS
});
assert(blockedReq.isValid === false, 'New addition requisition strictly BLOCKED when department reaches quota');
assert(blockedReq.errors.some(e => e.includes('at 100% sanctioned capacity')), 'Error message explicitly cites 100% capacity and requires Board Waiver');

// 2.2 Executive Expansion Waiver permits expanding beyond capacity
const waivedReq = validateRequisitionCreation({
    dept: 'Design',
    requisitionType: 'NEW_ADDITION',
    title: 'Lead Motion Designer',
    employees: mockEmployees,
    openPositions: mockOpenPositions,
    quotas: DEFAULT_SANCTIONED_QUOTAS,
    isExecutiveWaiver: true,
    waiverReason: 'Board approved Q3 Enterprise Design System Expansion Strategic Initiative'
});
assert(waivedReq.isValid === true, 'Requisition with Executive Waiver successfully approved');
assert(waivedReq.warnings.some(w => w.includes('Executive Headcount Expansion Waiver applied')), 'Warning logged in audit trail');

// 2.3 REPLACEMENT requisition against vacated position code
const missingCodeReplacement = validateRequisitionCreation({
    dept: 'Design',
    requisitionType: 'REPLACEMENT',
    title: 'Senior UX Designer',
    vacatedPositionCode: '', // Missing!
    employees: mockEmployees,
    openPositions: mockOpenPositions
});
assert(missingCodeReplacement.isValid === false, 'Replacement requisition without vacated position code is REJECTED');

const validReplacement = validateRequisitionCreation({
    dept: 'Design',
    requisitionType: 'REPLACEMENT',
    title: 'Senior UX Designer (Backfill)',
    vacatedPositionCode: 'POS-DES-104',
    previousIncumbentId: 'EMP-104',
    employees: mockEmployees,
    openPositions: mockOpenPositions
});
assert(validReplacement.isValid === true, 'Replacement requisition with valid vacated position code is APPROVED');
assert(validReplacement.computed.vacatedPositionCode === 'POS-DES-104', 'Vacated position code tracked on requisition');
assert(validReplacement.computed.capacityAfterRequisition === 3, 'Replacement does NOT consume additional sanctioned quota');

// ----------------------------------------------------------------------------
// TEST SUITE 3: DEMO POINT 23 - HARDWARE ASSET ALLOCATION & SERIAL NUMBERS (Gap G8)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Demo Point 23 - Hardware Asset Allocation Register (Gap G8) ---');

const rahulAssets = getEmployeeAssignedAssets('EMP-104', INITIAL_ASSET_REGISTER);
assert(rahulAssets.length === 2, 'Rahul Saxena (EMP-104) has 2 assigned company assets');
assert(rahulAssets.some(a => a.serialNumber === 'C02G8726X981' && a.assetType === 'LAPTOP'), 'MacBook Pro M2 serial #C02G8726X981 tracked');
assert(rahulAssets.some(a => a.serialNumber === 'CN-0T3452-71618' && a.assetType === 'MONITOR'), 'Dell UltraSharp monitor serial #CN-0T3452-71618 tracked');

const trishaAssets = getEmployeeAssignedAssets('EMP-101', INITIAL_ASSET_REGISTER);
assert(trishaAssets.length === 1, 'Trisha Khanna has 1 assigned laptop');
assert(trishaAssets[0].assetTag === 'NUC-IT-0089', 'Asset tag NUC-IT-0089 verified');

// ----------------------------------------------------------------------------
// TEST SUITE 4: DEMO POINT 21 - HR LETTER TEMPLATE MERGE ENGINE (Gap G8)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Demo Point 21 - HR Letter Template Merge Engine (Gap G8) ---');

// 4.1 Offer & Appointment Letter
const apptLetter = renderLetterTemplate('APPOINTMENT', mockEmployees[0], {
    join_date: '01 April 2026',
    reporting_manager: 'Amit Verma'
});
assert(apptLetter.renderedText.includes('Trisha Khanna'), 'Appointment letter rendered with employee name');
assert(apptLetter.renderedText.includes('Engineering'), 'Appointment letter rendered with department');
assert(apptLetter.renderedText.includes('Amit Verma'), 'Appointment letter rendered with reporting manager');
assert(apptLetter.renderedText.includes('01 April 2026'), 'Appointment letter rendered with joining date');

// 4.2 Increment & Appraisal Letter
const incLetter = renderLetterTemplate('INCREMENT', mockEmployees[0], {
    effective_date: '01 April 2026',
    current_ctc: '17,28,000',
    revised_ctc: '20,00,000',
    hike_percentage: '15.7',
    performance_band: 'Outstanding (A+)'
});
assert(incLetter.renderedText.includes('15.7%'), 'Increment letter rendered with hike percentage (15.7%)');
assert(incLetter.renderedText.includes('INR 20,00,000'), 'Increment letter rendered with revised CTC');
assert(incLetter.renderedText.includes('Outstanding (A+)'), 'Increment letter rendered with performance rating');

// 4.3 Relieving & Experience Certificate
const relLetter = renderLetterTemplate('RELIEVING', { id: 'EMP-104', name: 'Rahul Saxena', role: 'Senior UX Designer', dept: 'Design', joinDate: '10 Nov 2023' }, {
    relieving_date: '28 Feb 2026'
});
assert(relLetter.renderedText.includes('Rahul Saxena'), 'Relieving letter rendered with employee name');
assert(relLetter.renderedText.includes('EMP-104'), 'Relieving letter rendered with employee ID');
assert(relLetter.renderedText.includes('10 Nov 2023 to 28 Feb 2026'), 'Relieving letter rendered with service span');
assert(relLetter.renderedText.includes('Senior UX Designer'), 'Relieving letter rendered with last designation');

// ----------------------------------------------------------------------------
// TEST SUITE 5: DEMO POINTS 18, 19, 20 - RECOGNITION & REFERRAL MILESTONES (Gap G8)
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Demo Points 18, 19, 20 - Recognition & Referral Program (Gap G8) ---');

assert(INITIAL_RECOGNITIONS.length >= 2, 'Initial recognition awards catalog seeded');
assert(INITIAL_RECOGNITIONS[0].awardType === 'STAR_OF_MONTH', 'Star of the Month award seeded for Trisha Khanna');
assert(INITIAL_RECOGNITIONS[0].rewardAmount === 20000, 'Reward bonus amount = ₹20,000');

assert(INITIAL_REFERRALS.length >= 2, 'Initial employee referrals seeded');
const kunalRef = INITIAL_REFERRALS.find(r => r.id === 'REF-801');
assert(kunalRef.status === 'JOINED', 'Referred candidate status is JOINED');
assert(kunalRef.disbursedAmount === 10000, 'First installment (₹10,000) disbursed upon joining');
assert(kunalRef.pendingAmount === 15000, 'Second installment (₹15,000) pending 90-day confirmation');
assert(kunalRef.nextPayoutMilestone.includes('90-Day Probation'), 'Next milestone tracks probation confirmation');

console.log('\n================================================================');
console.log(`SPRINT 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
    process.exit(1);
}
