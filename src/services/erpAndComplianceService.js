
import { readData } from './workspace-data.mjs';
/**
 * ERP Integration (G5) & Statutory Factory Act Engine (G6)
 * Blueprint Addendum A: Demo Points 14, 15, 17, and 26.
 * 
 * Ruleset Version: v5.0.0-COMPLIANCE-2026.09
 * Jurisdiction: Factories Act 1948 / State Factory Rules / Payment of Gratuity Act 1972 / ERP GL Standards
 */

export const COMPLIANCE_RULESET_VERSION = 'v5.0.0-COMPLIANCE-2026.09';

// ============================================================================
// 1. DEMO POINT 14: BI-DIRECTIONAL ERP MASTER SYNC & FIELD OWNERSHIP POLICY
// ============================================================================

export const ERP_FIELD_OWNERSHIP_POLICY = readData("services.erpAndComplianceService", "ERP_FIELD_OWNERSHIP_POLICY_1");

export const INITIAL_ERP_SYNC_LOGS = readData("services.erpAndComplianceService", "INITIAL_ERP_SYNC_LOGS_2");

/**
 * Execute inbound ERP employee master sync respecting field ownership policy
 */
export const executeErpEmployeeSync = (inboundRecords, currentEmployees, connector = 'SAP S/4HANA') => {
    const timestamp = new Date().toISOString();
    const batchId = `SYNC-IN-${Date.now().toString(36).toUpperCase()}`;

    const erpOwnedKeys = new Set(ERP_FIELD_OWNERSHIP_POLICY.ERP_OWNED.map(f => f.field));
    const nucleusOwnedKeys = new Set(ERP_FIELD_OWNERSHIP_POLICY.NUCLEUS_OWNED.map(f => f.field));
    const sharedKeys = new Set(ERP_FIELD_OWNERSHIP_POLICY.SHARED_BIDIRECTIONAL.map(f => f.field));

    let updatedCount = 0;
    let conflictsCount = 0;
    const details = [];

    const employeeMap = new Map(currentEmployees.map(e => [e.id, { ...e }]));

    inboundRecords.forEach(inbound => {
        const existing = employeeMap.get(inbound.id);
        if (!existing) {
            return; // In this scope we process updates to existing roster
        }

        const fieldsUpdated = [];
        const conflictsBlocked = [];

        Object.keys(inbound).forEach(key => {
            if (key === 'id') return;

            if (nucleusOwnedKeys.has(key)) {
                // Reject unauthorized mutation of Nucleus-owned field!
                conflictsBlocked.push(key);
                conflictsCount++;
            } else if (erpOwnedKeys.has(key) || sharedKeys.has(key)) {
                if (existing[key] !== inbound[key]) {
                    existing[key] = inbound[key];
                    fieldsUpdated.push(key);
                }
            }
        });

        if (fieldsUpdated.length > 0 || conflictsBlocked.length > 0) {
            if (fieldsUpdated.length > 0) updatedCount++;
            details.push({
                empId: inbound.id,
                empName: existing.name || inbound.name,
                fieldsUpdated,
                conflictsBlocked,
                message: conflictsBlocked.length > 0
                    ? `Updated [${fieldsUpdated.join(', ')}]. Blocked ERP write to Nucleus-owned [${conflictsBlocked.join(', ')}].`
                    : `Successfully synced [${fieldsUpdated.join(', ')}] from ${connector}.`
            });
            employeeMap.set(inbound.id, existing);
        }
    });

    const syncReport = {
        batchId,
        connector,
        timestamp,
        ...readData("services.erpAndComplianceService", "syncReport_fields_3"),
        recordsReceived: inboundRecords.length,
        recordsUpdated: updatedCount,
        conflictsBlocked: conflictsCount,
        status: conflictsCount > 0 ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS',
        details
    };

    return {
        updatedEmployees: Array.from(employeeMap.values()),
        syncReport
    };
};

// ============================================================================
// 2. DEMO POINT 15: FINANCE-GRADE ERP GL POSTING QUEUE WITH ACK TRACKING
// ============================================================================

export const INITIAL_ERP_POSTING_QUEUE = readData("services.erpAndComplianceService", "INITIAL_ERP_POSTING_QUEUE_4");

/**
 * Validates that total debits strictly equal total credits to the exact paisa (0.00 variance)
 */
export const validateGLBatchBalance = (batch) => {
    let debits = 0;
    let credits = 0;

    batch.lineItems.forEach(item => {
        if (item.type === 'DEBIT') debits += Number(item.amount);
        else if (item.type === 'CREDIT') credits += Number(item.amount);
    });

    const variance = Math.round((debits - credits) * 100) / 100;
    return {
        isValid: Math.abs(variance) < 0.01,
        debits: Math.round(debits * 100) / 100,
        credits: Math.round(credits * 100) / 100,
        variance
    };
};

/**
 * Generate SAP S/4HANA IDoc XML payload for financial accounting journal
 */
export const generateSapIdocXml = (batch) => {
    const docNum = `DOC${batch.batchId.replace(/[^0-9]/g, '').slice(-10) || '2026031101'}`;
    const headerDate = batch.postingDate.replace(/-/g, '');

    const linesXml = batch.lineItems.map((item, idx) => `
    <E1FIBP SEGMENT="1">
      <ITEMNO_ACC>${String(idx + 1).padStart(10, '0')}</ITEMNO_ACC>
      <HKONT>${item.accountCode}</HKONT>
      <SHKZG>${item.type === 'DEBIT' ? 'S' : 'H'}</SHKZG>
      <WRBTR>${item.amount.toFixed(2)}</WRBTR>
      <KOSTL>${item.costCenter}</KOSTL>
      <SGTXT>${item.accountName}</SGTXT>
    </E1FIBP>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<FIDCCP02>
  <IDOC BEGIN="1">
    <EDI_DC40 SEGMENT="1">
      <DOCNUM>${docNum}</DOCNUM>
      <IDOCTYP>FIDCCP02</IDOCTYP>
      <MESTYP>FIDCC2</MESTYP>
      <SNDPRT>LS</SNDPRT>
      <SNDPRN>NUCLEUS_HRMS</SNDPRN>
      <RCVPRT>LS</RCVPRT>
      <RCVPRN>SAP_ERP_PRD</RCVPRN>
      <CREDAT>${headerDate}</CREDAT>
    </EDI_DC40>
    <E1FIKPF SEGMENT="1">
      <BUKRS>1000</BUKRS>
      <GJAHR>2026</GJAHR>
      <BLART>SA</BLART>
      <BLDAT>${headerDate}</BLDAT>
      <BUDAT>${headerDate}</BUDAT>
      <BKTXT>NUCLEUS PAYROLL ${batch.period}</BKTXT>
      <WAERS>INR</WAERS>
    </E1FIKPF>${linesXml}
  </IDOC>
</FIDCCP02>`;
};

/**
 * Generate NetSuite SuiteTalk Journal Entry CSV payload
 */
export const generateNetSuiteCsv = (batch) => {
    const headers = 'Transaction Date,Reference No,Account Number,Account Name,Debit Amount,Credit Amount,Department/Cost Center,Memo';
    const rows = batch.lineItems.map(item => {
        const debit = item.type === 'DEBIT' ? item.amount.toFixed(2) : '';
        const credit = item.type === 'CREDIT' ? item.amount.toFixed(2) : '';
        return `${batch.postingDate},${batch.batchId},${item.accountCode},"${item.accountName}",${debit},${credit},${item.costCenter},"Payroll posting for ${batch.period}"`;
    });
    return [headers, ...rows].join('\n');
};

/**
 * Generate Tally Prime Journal XML format
 */
export const generateTallyPrimeXml = (batch) => {
    const linesXml = batch.lineItems.map(item => `
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${item.accountName}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${item.type === 'DEBIT' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
          <AMOUNT>${item.type === 'DEBIT' ? `-${item.amount.toFixed(2)}` : `${item.amount.toFixed(2)}`}</AMOUNT>
          <COSTCENTRENAME>${item.costCenter}</COSTCENTRENAME>
        </ALLLEDGERENTRIES.LIST>`).join('');

    return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Journal" ACTION="Create">
            <DATE>${batch.postingDate.replace(/-/g, '')}</DATE>
            <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${batch.batchId}</VOUCHERNUMBER>
            <NARRATION>Payroll Journal: ${batch.period} | Reconciled delta 0.00</NARRATION>${linesXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
};

// ============================================================================
// 3. DEMO POINT 17: FACTORY ACT STATUTORY REGISTERS (FORM 28, 18, 36)
// ============================================================================

/**
 * Form 28 — Statutory Muster Roll / Adult Worker Register
 * Under Rule 88 Karnataka / Central Factories Rules (Factories Act 1948 Section 62 & 83)
 */
export const generateForm28MusterRoll = (month = 'March', year = 2026, factoryLocation = 'Plant Unit-1 (Peenya, Bangalore)') => {
    const workers = readData("services.erpAndComplianceService", "workers_5");

    const rosterDays = Array.from(readData("services.erpAndComplianceService", "rosterDays_6"), (_, i) => i + 1);

    const detailedWorkers = workers.map(w => {
        const attendanceDays = rosterDays.map(day => {
            const isSunday = day % 7 === 1; // Simulated weekly off
            if (isSunday) return { day, ...readData("services.erpAndComplianceService", "attendanceDays_fields_7") };
            if (day === 12 && w.sex === 'F') return { day, ...readData("services.erpAndComplianceService", "attendanceDays_fields_8") };
            if (day === 18 && w.name.includes('Suresh')) return { day, ...readData("services.erpAndComplianceService", "attendanceDays_fields_9") };
            const ot = (day % 4 === 0) ? (w.group === 'C' ? 4 : 2) : 0;
            return { day, ...readData("services.erpAndComplianceService", "attendanceDays_fields_10"), ot };
        });

        return {
            ...w,
            attendanceDays
        };
    });

    return {
        ...readData("services.erpAndComplianceService", "generateForm28MusterRoll_fields_11"),
        factoryLocation,
        month,
        year,
        totalAdultWorkers: workers.length,
        totalNormalHoursWorked: workers.reduce((acc, w) => acc + w.normalHours, 0),
        totalOvertimeHoursWorked: workers.reduce((acc, w) => acc + w.otHours, 0),
        workers: detailedWorkers
    };
};

export const INITIAL_STATUTORY_ACCIDENTS_FORM18 = readData("services.erpAndComplianceService", "INITIAL_STATUTORY_ACCIDENTS_FORM18_12");

export const INITIAL_INSPECTION_BOOK_FORM36 = readData("services.erpAndComplianceService", "INITIAL_INSPECTION_BOOK_FORM36_13");

// ============================================================================
// 4. DEMO POINT 26: FACTORY ACT FORM F — GRATUITY NOMINATION & DECLARATION
// ============================================================================

/**
 * Validate that nominee shares add up strictly to 100%
 */
export const validateFormFNominees = (nominees) => {
    if (!Array.isArray(nominees) || nominees.length === 0) {
        return readData("services.erpAndComplianceService", "validateFormFNominees_14");
    }

    const totalPercentage = nominees.reduce((sum, n) => sum + (Number(n.sharePercent) || 0), 0);
    const isValid = Math.abs(totalPercentage - 100) < 0.01;

    return {
        isValid,
        totalPercentage,
        error: isValid ? null : `Total nominee allocation must equal exactly 100% (currently ${totalPercentage}%).`
    };
};

/**
 * Generate statutory Form F Gratuity Nomination document under Rule 6 of Payment of Gratuity Rules 1972
 */
export const generateFormFDeclaration = (employee, nominees, witnesses = null) => {
    const validation = validateFormFNominees(nominees);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    const defaultWitnesses = witnesses || readData("services.erpAndComplianceService", "defaultWitnesses_15");

    const serialNumber = `GRAT-NOM-${employee.id}-${new Date().getFullYear()}`;

    return {
        formId: serialNumber,
        ...readData("services.erpAndComplianceService", "generateFormFDeclaration_fields_16"),
        employee: {
            id: employee.id,
            name: employee.name,
            fatherOrSpouseName: employee.fatherOrSpouseName || 'Shri M. K. ' + employee.name.split(' ').pop(),
            sex: employee.gender || 'Male',
            religion: employee.religion || 'Hindu',
            maritalStatus: employee.maritalStatus || 'Married',
            department: employee.department || 'Plant Operations',
            ticketOrTokenNo: employee.tokenNo || `TK-${employee.id.replace(/[^0-9]/g, '').padStart(4, '0')}`,
            dateOfAppointment: employee.doj || '2022-04-01',
            permanentAddress: employee.address || 'H.No 124, 4th Main, Rajajinagar 2nd Block, Bangalore - 560010'
        },
        nominees: nominees.map((n, idx) => ({
            serialNo: idx + 1,
            name: n.name,
            relationship: n.relationship,
            age: n.age,
            sharePercent: Number(n.sharePercent),
            address: n.address,
            contingencyInvalidation: n.contingency || 'Demise of nominee prior to disbursement, whereupon gratuity reverts to estate'
        })),
        witnesses: defaultWitnesses,
        employerAcknowledgement: {
            dateReceived: new Date().toISOString().split('T')[0],
            registrationBookSerial: `REG-GRAT-VOL-II/${employee.id}`,
            ...readData("services.erpAndComplianceService", "employerAcknowledgement_fields_18")
        }
    };
};

export const SAMPLE_FORM_F_TEMPLATES = readData("services.erpAndComplianceService", "SAMPLE_FORM_F_TEMPLATES_19");
