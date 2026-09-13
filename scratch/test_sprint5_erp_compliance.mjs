import assert from 'node:assert';
import {
    COMPLIANCE_RULESET_VERSION,
    ERP_FIELD_OWNERSHIP_POLICY,
    INITIAL_ERP_SYNC_LOGS,
    executeErpEmployeeSync,
    INITIAL_ERP_POSTING_QUEUE,
    validateGLBatchBalance,
    generateSapIdocXml,
    generateNetSuiteCsv,
    generateTallyPrimeXml,
    generateForm28MusterRoll,
    INITIAL_STATUTORY_ACCIDENTS_FORM18,
    INITIAL_INSPECTION_BOOK_FORM36,
    validateFormFNominees,
    generateFormFDeclaration,
    SAMPLE_FORM_F_TEMPLATES
} from '../src/services/erpAndComplianceService.js';

console.log(`\n🧪 RUNNING AUTOMATED SUITE: SPRINT 5 (ERP G5 + FACTORY ACT COMPLIANCE G6)`);
console.log(`Ruleset Version: ${COMPLIANCE_RULESET_VERSION}\n`);

let passedTests = 0;
const test = (name, fn) => {
    try {
        fn();
        console.log(`  ✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
};

// ============================================================================
// TEST GROUP 1: DEMO POINT 14 — ERP MASTER SYNC & FIELD OWNERSHIP MATRIX
// ============================================================================

test('G5.14.1: Field Ownership Matrix properly distinguishes ERP vs Nucleus owned domains', () => {
    const erpFields = ERP_FIELD_OWNERSHIP_POLICY.ERP_OWNED.map(f => f.field);
    const nucleusFields = ERP_FIELD_OWNERSHIP_POLICY.NUCLEUS_OWNED.map(f => f.field);
    const sharedFields = ERP_FIELD_OWNERSHIP_POLICY.SHARED_BIDIRECTIONAL.map(f => f.field);

    assert(erpFields.includes('legalEntity'), 'legalEntity must be ERP-owned');
    assert(erpFields.includes('costCenterCode'), 'costCenterCode must be ERP-owned');
    assert(erpFields.includes('gradeBand'), 'gradeBand must be ERP-owned');
    assert(erpFields.includes('bankAccountNumber'), 'bankAccountNumber must be ERP-owned');

    assert(nucleusFields.includes('attendanceLogs'), 'attendanceLogs must be Nucleus-owned');
    assert(nucleusFields.includes('biometricPunches'), 'biometricPunches must be Nucleus-owned');
    assert(nucleusFields.includes('shiftRoster'), 'shiftRoster must be Nucleus-owned');
    assert(nucleusFields.includes('overtimeHours'), 'overtimeHours must be Nucleus-owned');
    assert(nucleusFields.includes('leaveBalances'), 'leaveBalances must be Nucleus-owned');

    assert(sharedFields.includes('designation'), 'designation must be shared bidirectional');
    assert(sharedFields.includes('department'), 'department must be shared bidirectional');
});

test('G5.14.2: executeErpEmployeeSync updates ERP-owned fields and BLOCKS Nucleus-owned overrides', () => {
    const mockEmployees = [
        {
            id: 'EMP-T1',
            name: 'Vikram Joshi',
            costCenterCode: 'CC-OLD',
            gradeBand: 'L4',
            biometricPunches: ['09:00', '18:00'],
            overtimeHours: 4.5,
            leaveBalances: { el: 18, cl: 8 }
        }
    ];

    const inboundPayload = [
        {
            id: 'EMP-T1',
            costCenterCode: 'CC-101', // ERP owned -> should update
            gradeBand: 'L5',          // ERP owned -> should update
            overtimeHours: 0,         // Nucleus owned -> MUST BE BLOCKED!
            biometricPunches: ['10:00'] // Nucleus owned -> MUST BE BLOCKED!
        }
    ];

    const { updatedEmployees, syncReport } = executeErpEmployeeSync(inboundPayload, mockEmployees, 'SAP S/4HANA');

    const updated = updatedEmployees.find(e => e.id === 'EMP-T1');
    assert.strictEqual(updated.costCenterCode, 'CC-101', 'Cost center code should be updated from ERP');
    assert.strictEqual(updated.gradeBand, 'L5', 'Grade band should be updated from ERP');
    assert.strictEqual(updated.overtimeHours, 4.5, 'Overtime hours must NOT be overwritten by ERP');
    assert.deepStrictEqual(updated.biometricPunches, ['09:00', '18:00'], 'Biometric punches must NOT be overwritten');

    assert.strictEqual(syncReport.conflictsBlocked, 2, 'Two conflicting field attempts must be blocked');
    assert.strictEqual(syncReport.recordsUpdated, 1, 'One record updated');
    assert.strictEqual(syncReport.status, 'SUCCESS_WITH_WARNINGS');
});

// ============================================================================
// TEST GROUP 2: DEMO POINT 15 — ERP GL POSTING QUEUE & RECONCILIATION
// ============================================================================

test('G5.15.1: validateGLBatchBalance enforces zero delta (Delta = 0.00)', () => {
    const balancedBatch = INITIAL_ERP_POSTING_QUEUE[0];
    const result = validateGLBatchBalance(balancedBatch);
    assert.strictEqual(result.isValid, true, 'Balanced batch should pass');
    assert.strictEqual(result.variance, 0.00, 'Variance must be exactly 0.00');

    const unbalancedBatch = {
        batchId: 'TEST-UNBAL',
        lineItems: [
            { accountCode: '51001', type: 'DEBIT', amount: 1000.00 },
            { accountCode: '21001', type: 'CREDIT', amount: 950.00 }
        ]
    };
    const badResult = validateGLBatchBalance(unbalancedBatch);
    assert.strictEqual(badResult.isValid, false, 'Unbalanced batch should fail');
    assert.strictEqual(badResult.variance, 50.00, 'Variance should be 50.00');
});

test('G5.15.2: generateSapIdocXml creates valid IDoc XML with segment headers and line amounts', () => {
    const batch = INITIAL_ERP_POSTING_QUEUE[0];
    const xml = generateSapIdocXml(batch);
    assert(xml.includes('<FIDCCP02>'), 'Must contain FIDCCP02 root tag');
    assert(xml.includes('<MESTYP>FIDCC2</MESTYP>'), 'Must contain FIDCC2 message type');
    assert(xml.includes('<SNDPRN>NUCLEUS_HRMS</SNDPRN>'), 'Sender must be NUCLEUS_HRMS');
    assert(xml.includes('<E1FIBP SEGMENT="1">'), 'Must contain line item segments');
    assert(xml.includes('<WRBTR>980000.00</WRBTR>'), 'Must contain formatted amount');
});

test('G5.15.3: generateNetSuiteCsv creates standard CSV with debit and credit columns', () => {
    const batch = INITIAL_ERP_POSTING_QUEUE[0];
    const csv = generateNetSuiteCsv(batch);
    const lines = csv.split('\n');
    assert(lines[0].includes('Transaction Date,Reference No'), 'CSV header row present');
    assert(lines.length > 10, 'Should contain multiple line items');
    assert(csv.includes('51001,"Basic Salary Expense"'), 'Account mapped properly');
});

test('G5.15.4: generateTallyPrimeXml creates balanced Journal voucher XML', () => {
    const batch = INITIAL_ERP_POSTING_QUEUE[0];
    const xml = generateTallyPrimeXml(batch);
    assert(xml.includes('<VOUCHER VCHTYPE="Journal" ACTION="Create">'), 'Must be Journal voucher');
    assert(xml.includes('<ALLLEDGERENTRIES.LIST>'), 'Must contain ledger entries');
});

// ============================================================================
// TEST GROUP 3: DEMO POINT 17 — STATUTORY FACTORY ACT REGISTERS (FORM 28, 18, 36)
// ============================================================================

test('G6.17.1: generateForm28MusterRoll calculates adult worker days, shifts, and OT totals', () => {
    const muster = generateForm28MusterRoll('March', 2026, 'Plant Unit-1 (Bangalore)');
    assert.strictEqual(muster.totalAdultWorkers, 6, 'Should report 6 adult workers');
    assert(muster.totalNormalHoursWorked > 1000, 'Normal hours should aggregate across workers');
    assert(muster.totalOvertimeHoursWorked > 50, 'Overtime hours should aggregate across workers');

    const worker1 = muster.workers[0];
    assert.strictEqual(worker1.tokenNo, 'TK-0101', 'Token number should match');
    assert.strictEqual(worker1.attendanceDays.length, 31, 'Should have 31 days attendance breakdown');
    assert(worker1.attendanceDays.some(d => d.mark === 'WO'), 'Should contain weekly offs');
    assert(worker1.attendanceDays.some(d => d.mark === 'P'), 'Should contain present marks');
});

test('G6.17.2: Form 18 Accident register tracks statutory notice, lost workdays, and inspector filing', () => {
    assert(INITIAL_STATUTORY_ACCIDENTS_FORM18.length >= 2, 'Should have initial Form 18 records');
    const accident = INITIAL_STATUTORY_ACCIDENTS_FORM18[0];
    assert(accident.noticeId.startsWith('FORM18'), 'Notice ID must follow format');
    assert.strictEqual(accident.reportedToInspector, true, 'Statutory notice must be recorded');
    assert.strictEqual(accident.lostWorkdays, 3, 'Lost workdays must be tracked');
    assert(accident.remedialActions.length > 10, 'Remedial actions must be documented');
});

test('G6.17.3: Form 36 Inspection Book logs safety observations and compliance closure', () => {
    assert(INITIAL_INSPECTION_BOOK_FORM36.length >= 2, 'Should have Form 36 entries');
    const inspection = INITIAL_INSPECTION_BOOK_FORM36[0];
    assert(inspection.inspectionId.startsWith('INSP-36'), 'Inspection ID format');
    assert.strictEqual(inspection.complianceStatus, 'CLOSED', 'Status check');
    assert(inspection.statutoryObservations.includes('guarding'), 'Safety observations recorded');
});

// ============================================================================
// TEST GROUP 4: DEMO POINT 26 — FACTORY ACT FORM F (GRATUITY NOMINATION)
// ============================================================================

test('G6.26.1: validateFormFNominees strictly enforces 100% total allocation', () => {
    const validNominees = [
        { name: 'Pooja Patil', sharePercent: 60 },
        { name: 'Aditya Patil', sharePercent: 40 }
    ];
    const validRes = validateFormFNominees(validNominees);
    assert.strictEqual(validRes.isValid, true, '60 + 40 = 100 must be valid');

    const invalidNominees = [
        { name: 'Pooja Patil', sharePercent: 60 },
        { name: 'Aditya Patil', sharePercent: 30 }
    ];
    const invalidRes = validateFormFNominees(invalidNominees);
    assert.strictEqual(invalidRes.isValid, false, '60 + 30 = 90 must be invalid');
    assert(invalidRes.error.includes('100%'), 'Error message mentions 100% requirement');
});

test('G6.26.2: generateFormFDeclaration builds complete statutory Form F document', () => {
    const emp = {
        id: 'EMP-0104',
        name: 'Suresh Patil',
        department: 'Plant Press Shop',
        gender: 'Male',
        tokenNo: 'TK-0104',
        doj: '2021-06-15'
    };
    const nominees = SAMPLE_FORM_F_TEMPLATES[0].nominees;

    const formF = generateFormFDeclaration(emp, nominees);
    assert(formF.formId.startsWith('GRAT-NOM-EMP-0104'), 'Form ID matches employee');
    assert(formF.ruleReference.includes('Rule 6(1)'), 'Mentions Rule 6(1)');
    assert.strictEqual(formF.nominees[0].sharePercent, 100, 'Share percent matches');
    assert.strictEqual(formF.witnesses.length, 2, 'Must have 2 statutory witnesses');
    assert(formF.employerAcknowledgement.registrationBookSerial.includes('REG-GRAT'), 'Employer acknowledgement serial present');
});

console.log(`\n======================================================`);
console.log(`🎉 ALL SPRINT 5 TESTS PASSED: ${passedTests} / ${passedTests} ASSERTIONS`);
console.log(`Demo Points 14, 15, 17, and 26 verified successfully!`);
console.log(`======================================================\n`);
