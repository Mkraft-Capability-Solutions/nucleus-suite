
import { readData } from '../services/workspace-data.mjs';
const workbook = readData('workbook');

const sheets = workbook.sheets;
const rows = (name) => sheets[name] || [];
const sourceRowFilters = {
  '01_Scenario_Map': (row) => /^\d+$/.test(String(row['Demo point'] || '')),
  '02_Legal_Entities': (row) => /^LE-\d+$/.test(String(row['Entity code'] || '')),
  '03_Locations': (row) => /^LOC-/.test(String(row['Location code'] || '')),
  '04_Org_Units': (row) => /^OU-\d+$/.test(String(row['Org unit code'] || '')),
  '05_Designations': (row) => /^DES-\d+$/.test(String(row['Designation code'] || '')),
  '06_Worker_Classes': (row) => /^WC-/.test(String(row['Class code'] || '')),
  '07_Shifts': (row) => /^SH-/.test(String(row['Shift code'] || '')),
  '08_Attendance_Rules': (row) => /^\d+(?:\.\d+)?$/.test(String(row['Shift hours'] || '')),
  '10_Sanctioned_Manpower': (row) => /^SM-/.test(String(row.Record || '')),
  '11_Positions': (row) => /^POS-/.test(String(row['Position code'] || '')),
  '12_Employees': (row) => /^E\d+$/.test(String(row['Employee code'] || '')),
  '13_Salary_Structure': (row) => /^E\d+$/.test(String(row['Employee code'] || '')),
  '14_Leave_Types': (row) => /^[A-Z]{2,6}$/.test(String(row['Leave type'] || '')),
  '15_Leave_Accrual_Policy': (row) => /^LP-/.test(String(row['Policy code'] || '')),
  '17_Leave_Ledger': (row) => /^LL-/.test(String(row['Ledger ID'] || '')),
  '18_Leave_Requests': (row) => /^LV-/.test(String(row['Request ID'] || '')),
  '20_Punch_Events': (row) => /^PE-/.test(String(row['Event ID'] || '')),
  '21_Expected_Attendance': (row) => /^AD-/.test(String(row.Record || '')),
  '22_Gate_Pass': (row) => /^GP-/.test(String(row['Gate pass ID'] || '')),
  '23_Overtime_Register': (row) => /^OT-/.test(String(row['OT record'] || '')),
  '24_Loans': (row) => /^LN-/.test(String(row['Loan / application ID'] || '')),
  '26_Payroll_Runs': (row) => /^PR-/.test(String(row['Run ID'] || '')),
  '27_Exit_Clearance': (row) => /^E\d+$/.test(String(row['Employee code'] || '')),
  '28_Statutory_Calendar': (row) => /^OB-/.test(String(row['Obligation ID'] || '')),
  '29_Statutory_Forms': (row) => /^SF-/.test(String(row['Form instance'] || '')),
  '30_Recognition_Referral': (row) => /^(RC|RF)-/.test(String(row['Record ID'] || '')),
  '31_Announcements': (row) => /^AN-/.test(String(row['Announcement ID'] || '')),
  '32_Letter_Templates': (row) => /^(TPL|LTR)-/.test(String(row['Template / issue ID'] || '')),
  '33_Assets': (row) => /^AST-/.test(String(row['Asset code'] || '')),
  '34_Induction_Learning': (row) => /^IND-/.test(String(row.Record || '')),
  '35_GL_Mapping': (row) => /^GL-/.test(String(row['Mapping ID'] || '')),
  '36_ERP_Inbound_Master': (row) => /^SY-/.test(String(row['Sync row'] || '')),
  '37_Requisitions': (row) => /^REQ-/.test(String(row.Requisition || '')),
};
const validRows = (name) => rows(name).filter(sourceRowFilters[name] || (() => true));
const employeeRows = validRows('12_Employees');
const locations = new Map(validRows('03_Locations').map((row) => [row['Location code'], row['Location name']]));
const orgUnits = new Map(validRows('04_Org_Units').map((row) => [row['Org unit code'], row['Org unit name']]));
const designations = new Map(validRows('05_Designations').map((row) => [row['Designation code'], row.Title]));

const option = (value, label) => ({ value: String(value), label: String(label) });
const uniqueOptions = (values) => Array.from(new Map(values.filter((value) => value?.value && value?.label).map((value) => [value.value, value])).values());
const picklistCatalog = readData('picklists.catalog');

const picklistOptionsMap = new Map(
  (picklistCatalog?.picklists || []).map((pl) => [
    pl.code,
    pl.values.map((v) => ({ value: v, label: v })),
  ])
);

const fieldToPicklistKeyMap = {
  gender: 'PL_GENDER',
  salutation: 'PL_SALUTATION',
  maritalStatus: 'PL_MARITAL_STATUS',
  bloodGroup: 'PL_BLOOD_GROUP',
  religion: 'PL_RELIGION',
  socialCategory: 'PL_SOCIAL_CATEGORY',
  disabilityType: 'PL_DISABILITY_TYPE',
  relation: 'PL_RELATION',
  relationship: 'PL_RELATION',
  educationLevel: 'PL_EDUCATION_LEVEL',
  employmentType: 'PL_EMPLOYMENT_TYPE',
  documentClass: 'PL_DOCUMENT_CLASS',
  accountType: 'PL_ACCOUNT_TYPE',
  taxRegime: 'PL_TAX_REGIME',
  entityType: 'PL_ENTITY_TYPE',
  locationType: 'PL_LOCATION_TYPE',
  estbType: 'PL_ESTB_TYPE',
  registrationStatus: 'PL_REGISTRATION_STATUS',
  attendanceMode: 'PL_ATTENDANCE_MODE',
  attendanceStatus: 'PL_ATTENDANCE_STATUS',
  role: 'PL_ROLE',
  approvalStatus: 'PL_APPROVAL_STATUS',
  ticketCategory: 'PL_TICKET_CATEGORY',
  ticketStatus: 'PL_TICKET_STATUS',
  assetType: 'PL_ASSET_TYPE',
  assetCondition: 'PL_ASSET_CONDITION',
  claimType: 'PL_CLAIM_TYPE',
  candidateStage: 'PL_CANDIDATE_STAGE',
  interviewRound: 'PL_INTERVIEW_ROUND',
  interviewVerdict: 'PL_INTERVIEW_VERDICT',
  letterType: 'PL_LETTER_TYPE',
  exitReason: 'PL_EXIT_REASON',
  exitType: 'PL_EXIT_TYPE',
  paymentMode: 'PL_PAYMENT_MODE',
  bankFormat: 'PL_BANK_FORMAT',
  state: 'PL_STATE',
  country: 'PL_COUNTRY',
};

const employeeOptions = uniqueOptions(employeeRows.map((row) => option(row['Employee code'], `${row['Employee code']} · ${row['Full name']}`)));
const entityOptions = uniqueOptions(validRows('02_Legal_Entities').map((row) => option(row['Entity code'], `${row['Entity code']} · ${row['Registered name']}`)));
const locationOptions = uniqueOptions(validRows('03_Locations').map((row) => option(row['Location code'], `${row['Location code']} · ${row['Location name']}`)));
const orgUnitOptions = uniqueOptions(validRows('04_Org_Units').map((row) => option(row['Org unit code'], `${row['Org unit code']} · ${row['Org unit name']}`)));
const designationOptions = uniqueOptions(validRows('05_Designations').map((row) => option(row['Designation code'], `${row['Designation code']} · ${row.Title}`)));
const positionOptions = uniqueOptions(validRows('11_Positions').map((row) => option(row['Position code'], `${row['Position code']} · ${row.Title}`)));
const workerClassOptions = uniqueOptions(validRows('06_Worker_Classes').map((row) => option(row['Class code'], `${row['Class code']} · ${row.Label}`)));
const shiftOptions = uniqueOptions(validRows('07_Shifts').map((row) => option(row['Shift code'], `${row['Shift code']} · ${row['Shift name']}`)));
const leaveTypeOptions = uniqueOptions(validRows('14_Leave_Types').map((row) => option(row['Leave type'], `${row['Leave type']} · ${row.Name}`)));
const payrollRunOptions = uniqueOptions(validRows('26_Payroll_Runs').map((row) => option(row['Run ID'], `${row['Run ID']} · ${row.Period} · ${row['Run type']}`)));
const payrollGroupOptions = uniqueOptions(validRows('03_Locations').map((row) => option(row['Payroll group'], `${row['Payroll group']} · ${row['Location name']}`)));

const shiftGroupOptions = [
  option('general_shift', 'General Shift (09:00 – 18:00)'),
  option('morning_shift', 'Morning Shift (06:00 – 14:00)'),
  option('afternoon_shift', 'Afternoon Shift (14:00 – 22:00)'),
  option('night_shift', 'Night Shift (22:00 – 06:00)'),
  option('plant_shift', 'General Plant Shift (08:00 – 17:00)'),
  option('rotating_24x7', 'Rotating 24x7 Operations'),
];

const letterTemplateOptions = [
  option('TPL-OFFER-STD', 'Standard Offer Letter'),
  option('TPL-APPT-EXEC', 'Executive Appointment Letter'),
  option('TPL-CONF-REG', 'Probation Confirmation Letter'),
  option('TPL-REL-CERT', 'Relieving and Service Certificate'),
  option('TPL-EXP-CERT', 'Experience Certificate'),
];

const helpdeskQueueOptions = [
  option('Q-HR-OPS', 'HR Operations & People Services'),
  option('Q-PAYROLL', 'Payroll & Statutory Support'),
  option('Q-IT-ASSET', 'IT Assets & Workplace Services'),
  option('Q-FACILITIES', 'Facilities & Plant Admin'),
];

const helpdeskSubCatOptions = [
  option('it_hardware', 'Hardware / Laptop / Peripherals'),
  option('salary_tax', 'Payslip / Tax / Form 16 Query'),
  option('leave_attendance', 'Leave Balance / Biometric Punch Correction'),
  option('access_card', 'ID Card / Building Access'),
  option('statutory_pf', 'PF / UAN / ESI Support'),
  option('policy_query', 'General HR Policy Clarification'),
];

const staffingAgencyOptions = [
  option('AGY-ABC', 'ABC Staffing Pvt Ltd'),
  option('AGY-TEAM', 'TeamLease Services Ltd'),
  option('AGY-ADECCO', 'Adecco India'),
  option('AGY-RAND', 'Randstad India'),
];

const recoveryPeriodOptions = [
  option('current_month', 'Current Month Payroll'),
  option('next_month', 'Next Month Payroll'),
  option('spread_2_months', 'Spread across 2 Months'),
  option('spread_3_months', 'Spread across 3 Months'),
];

const glAccountDebitOptions = [
  option('710001', '710001 · Basic & Allowances Expense'),
  option('710002', '710002 · Employer PF Contribution Expense'),
  option('710003', '710003 · Employer ESI Contribution Expense'),
  option('710004', '710004 · Bonus & Incentive Expense'),
  option('710005', '710005 · Medical Reimbursement Expense'),
];

const glAccountCreditOptions = [
  option('210001', '210001 · Salaries & Wages Payable'),
  option('210002', '210002 · Provident Fund Payable'),
  option('210003', '210003 · ESI Contribution Payable'),
  option('210004', '210004 · TDS on Salaries Payable'),
  option('210005', '210005 · Professional Tax Payable'),
];

const glDimensionOptions = [
  option('COST_CENTER', 'Cost Center'),
  option('LEGAL_ENTITY', 'Legal Entity'),
  option('DEPARTMENT', 'Department / Function'),
  option('LOCATION', 'Work Site / Plant Location'),
  option('PROJECT', 'Client Project Code'),
];

const slabTableOptions = [
  option('SLAB-IT-2026', 'Income Tax Slabs FY 2026-27 (New Regime)'),
  option('SLAB-IT-OLD', 'Income Tax Slabs FY 2026-27 (Old Regime)'),
  option('SLAB-PT-KA', 'Karnataka Professional Tax Table'),
  option('SLAB-PT-MH', 'Maharashtra Professional Tax Table'),
  option('SLAB-PT-TN', 'Tamil Nadu Professional Tax Table'),
];

const percentComponentOptions = [
  option('basic_salary', 'Basic Salary'),
  option('gross_salary', 'Monthly Gross Salary'),
  option('ctc', 'Annual Cost to Company (CTC)'),
];

const recommendedBandOptions = [
  option('Band 1', 'Band 1 · Trainee / Junior Associate'),
  option('Band 2', 'Band 2 · Associate / Officer'),
  option('Band 3', 'Band 3 · Senior / Lead Specialist'),
  option('Band 4', 'Band 4 · Manager / Principal'),
  option('Band 5', 'Band 5 · Associate Director / VP'),
];

const fieldOptionSets = {
  // Employees & Person references
  employee: employeeOptions, employeeScope: employeeOptions, member: employeeOptions,
  referrer: employeeOptions, nominee: employeeOptions, manager: employeeOptions,
  personId: employeeOptions, employeeId: employeeOptions,
  referrerPersonId: employeeOptions, panel: employeeOptions, assigneeId: employeeOptions,

  // Locations & Work sites
  location: locationOptions, locationId: locationOptions, locationCode: locationOptions,
  site: locationOptions, workSite: locationOptions, workLocation: locationOptions,

  // Legal Entities
  entity: entityOptions, entityId: entityOptions, entityCode: entityOptions,
  legalEntity: entityOptions, company: entityOptions,

  // Shifts & Shift groups
  appliedShift: shiftOptions, shiftCode: shiftOptions, shift: shiftOptions,
  shiftId: shiftOptions, defaultShift: shiftOptions,
  shiftGroup: shiftGroupOptions,

  // Org Units & Departments
  orgUnit: orgUnitOptions, orgUnitId: orgUnitOptions, department: orgUnitOptions,
  departmentId: orgUnitOptions, section: orgUnitOptions,

  // Designations, Positions & Roles
  designation: designationOptions, designationCode: designationOptions,
  designationId: designationOptions, role: designationOptions, jobTitle: designationOptions,
  designationCodeBandLocationId: designationOptions,
  position: positionOptions, positionCode: positionOptions, positionId: positionOptions,
  requisitionId: positionOptions,

  // Worker Classes & Bands
  workerClass: workerClassOptions, workerClassCode: workerClassOptions,
  workerClassEmploymentType: workerClassOptions, recommendedBand: recommendedBandOptions,

  // Leaves & Payroll
  leaveType: leaveTypeOptions, leaveTypeId: leaveTypeOptions,
  payrollRun: payrollRunOptions, payRun: payrollRunOptions, payrollGroup: payrollGroupOptions,
  taggedRunId: payrollRunOptions, disbursementRunIdRecoveryRunId: payrollRunOptions,
  recoveryPeriod: recoveryPeriodOptions,

  // Templates, Helpdesk, Staffing & Accounting
  letterTemplateId: letterTemplateOptions,
  queueIdAssigneeId: helpdeskQueueOptions,
  subCategory: helpdeskSubCatOptions,
  agencyId: staffingAgencyOptions,
  percentOfComponent: percentComponentOptions,
  slabTableRef: slabTableOptions,
  glDebitAccount: glAccountDebitOptions,
  glCreditAccount: glAccountCreditOptions,
  glDimensions: glDimensionOptions,
};

const moduleSources = readData("lib.demo-workbook-adapter", "moduleSources_1");

function asText(value) {
  return value === null || value === undefined ? '—' : String(value);
}

function employeeCells(row) {
  const code = row['Employee code'];
  const location = locations.get(row.Location) || row.Location;
  const organisation = orgUnits.get(row['Org unit']) || row['Org unit'];
  const designation = designations.get(row.Designation) || row.Designation;
  return {
    Employee: `${code} · ${row['Full name']}`,
    Department: organisation,
    Assignment: `${designation} · ${location}`,
    Position: designation,
    Location: location,
    'Effective from': row['Date of joining'],
    Status: row.Status,
    Reference: code,
    Owner: row['Manager name'] || 'Executive office',
  };
}

function attendanceCells(row) {
  return {
    Employee: `${row['Employee code']} · ${row.Name}`,
    'Team member': `${row['Employee code']} · ${row.Name}`,
    Date: row.Date || row['Attendance date'],
    'Net hours': row['Net (h:mm)'],
    Overtime: row['OT (h:mm)'] || row['OT hours'],
    Attendance: row['Expected status'],
    Status: row['Expected status'] || row.Outcome || 'Computed',
    Reference: row.Record || row['Event ID'],
    Owner: row.Name,
    Delta: row['Overtime minutes'] ? `${row['Overtime minutes']} min OT` : 'No calculation delta',
    Scope: `${row['Employee code']} · ${row.Name}`,
  };
}

function sourceCells(moduleId, row) {
  if (moduleId === 'person_record' || moduleId === 'assignment_admin' || moduleId === 'employee_home') return employeeCells(row);
  if (readData("lib.demo-workbook-adapter", "content_2").includes(moduleId)) return attendanceCells(row);
  if (moduleId === 'position_register') return { Position: `${row['Position code']} · ${row.Title}`, Incumbent: row['Current incumbent'] || 'Vacant', Vacancy: row.Status, Status: row.Status, Reference: row['Position code'], Owner: orgUnits.get(row['Org unit']) || row['Org unit'], Location: locations.get(row.Location) || row.Location };
  if (moduleId === 'sanctioned_strength') return { Organisation: orgUnits.get(row['Org unit']) || row['Org unit'], Sanctioned: row.Sanctioned, Filled: row.Filled, Open: row['Open requisitions'], Status: Number(row.Filled) >= Number(row.Sanctioned) ? 'At limit' : 'Within headroom', Reference: row.Record, Owner: row['Approved by'] };
  if (moduleId === 'overtime_register') return { Employee: `${row['Employee code']} · ${row.Name}`, Date: row.Date, Overtime: row['OT hours'], Run: row['Pay in run'] || 'Not tagged', Status: row['Approved by'] === 'Not raised' ? 'Pending approval' : row['Pay in run'] ? 'Tagged to run' : 'Approved', Reference: row['OT record'], Owner: row['Approved by'] };
  if (moduleId === 'gate_passes') return { Employee: `${row['Employee code']} · ${row.Name}`, Date: row.Date, Minutes: row.Minutes, Status: row.Status, Reference: row['Gate pass ID'], Owner: row.Approver };
  if (moduleId === 'leave_requests') return { Employee: `${row['Employee code']} · ${row.Name}`, 'Leave type': row['Leave type'], Dates: `${row.From} to ${row.To}`, Status: row.Status, Reference: row['Request ID'], Owner: row['Step 1 — Supervisor'] || 'Not routed' };
  if (moduleId === 'leave_ledger') return { 'Leave type': row['Leave type'], Credit: row.Transaction === 'Credit' ? row.Days : '—', Debit: row.Transaction === 'Debit' ? row.Days : '—', Balance: row.Days, Status: row.Transaction, Reference: row['Ledger ID'], Owner: row.Name };
  if (moduleId === 'payroll_runs' || moduleId === 'pre_payroll_audit' || moduleId === 'payslips' || moduleId === 'bank_disbursement' || moduleId === 'reconciliation') return { Period: row.Period, 'Run type': row['Run type'], Population: row.Employees, Status: row.State, Run: row['Run ID'], Expected: row['Gross (INR)'], Actual: row['Net (INR)'], Variance: row['Statutory (INR)'], Reference: row['Run ID'], Owner: row.Entity };
  if (moduleId === 'salary_simulator' || moduleId === 'tax_declarations') return { Employee: `${row['Employee code']} · ${row.Name}`, Gross: row['Monthly gross (INR)'], 'Take home': row['Monthly gross (INR)'], Status: row['50% floor add-back (INR)'] === '0' ? 'Simulated' : 'Needs review', Reference: row['Employee code'], Owner: row['Worker class'] };
  if (moduleId === 'loans_advances') return { Employee: `${row['Employee code']} · ${row.Name}`, Principal: row['Principal (INR)'], Outstanding: row['Outstanding (INR)'], Status: row.Status, Reference: row['Loan / application ID'], Owner: row['Sanctioned by'] };
  if (moduleId === 'clearance_board' || moduleId === 'full_and_final') return { Leaver: `${row['Employee code']} · ${row.Name}`, Owner: row.Owner, Blocking: row['Checklist item'], Status: row.Status, Reference: row['Employee code'], 'Net settlement': row['F&F state'] || 'Pending clearance' };
  if (moduleId === 'asset_register') return { Asset: row['Asset code'], Holder: `${row['Allocated to']} · ${row.Name}`, Condition: row.Condition, Status: row.Status, Reference: row['Asset code'], Owner: row.Type };
  if (moduleId === 'recognition_register' || moduleId === 'referrals') return { Nominee: `${row['Employee / referrer']} · ${row.Name}`, Programme: row['Programme / requisition'], Award: row['Award (INR)'], Candidate: row['Citation / candidate'], Referrer: row.Name, Stage: row['Award status'], Status: row['Award status'], Reference: row['Record ID'], Owner: row.Type };
  if (moduleId === 'letters_register' || moduleId === 'document_vault') return { Letter: row.Template, Document: row.Template, Employee: row.Name || row['Issued to'] || 'Template library', Version: row.Version, Expiry: row['Issued on'] || '—', Verification: row['Approval required'] === 'Y' ? 'Approval required' : 'Ready', Status: row['Retained version'] || 'Template active', Reference: row['Template / issue ID'], Owner: row['Issued by'] || 'HR Operations' };
  if (moduleId === 'policy_acknowledgements' || moduleId === 'learning_paths' || moduleId === 'joining_chain') return { Joiner: `${row['Employee code']} · ${row.Name}`, 'Learning path': row.Item, 'Due date': row['Due on'], Progress: row.Status, Readiness: row.Status, Status: row.Status, Reference: row.Record, Owner: row.Trigger };
  if (moduleId === 'obligation_calendar') return { Obligation: row.Obligation, 'Due date': row['Due date'], Owner: row.Owner, Status: row.Status, Reference: row['Obligation ID'] };
  if (moduleId === 'statutory_register') return { Form: row.Form, Period: row.Period, Jurisdiction: row.State, Status: row.Status, Reference: row['Form instance'], Owner: row.Entity };
  if (moduleId === 'gl_mapping') return { Component: row['Pay component / head'], 'GL account': `${row['GL account code']} · ${row['GL account name']}`, Dimension: row['Dimensioned by'], ...readData("lib.demo-workbook-adapter", "content_fields_3"), Reference: row['Mapping ID'], Owner: row.Entity };
  if (moduleId === 'sync_monitor' || moduleId === 'integration_config' || moduleId === 'contractor_reconciliation') return { Batch: row.Batch, Connection: row['Field owner'] || 'ERP inbound', Rows: row['Sync row'], Agency: row['External employee code'], Invoice: row.Field, Variance: row['ERP value'], Status: row.Outcome, Reference: row['Sync row'], Owner: row['Field owner'] };
  if (moduleId === 'requisitions') return { Requisition: row.Requisition, Position: row['Against position'] || 'New position', Headroom: `${row.Filled}/${row.Sanctioned}`, Status: row.Status, Reference: row.Requisition, Owner: row['Hiring manager'] };
  if (moduleId === 'announcement_management') return { Announcement: row.Title, Audience: row['Audience rule'], Channel: row.Channels, Status: row.Status, Reference: row['Announcement ID'], Owner: row['Created by'] };
  if (moduleId === 'rule_pack_manager') return { Pack: `${row['Shift hours']} hour attendance rule`, ...readData("lib.demo-workbook-adapter", "content_fields_4"), Version: row['Stated as'], ...readData("lib.demo-workbook-adapter", "content_fields_5"), Reference: `RULE-${row['Shift hours']}`, ...readData("lib.demo-workbook-adapter", "content_fields_6") };
  if (moduleId === 'golden_case_library' || moduleId === 'assistant_helpdesk' || moduleId === 'agent_ledger') return { Case: row.Requirement || row['Demo point'], Domain: row['Demo point'] || 'HRMS', ...readData("lib.demo-workbook-adapter", "content_fields_7"), Outcome: row['Client status'] || 'Ready', Request: row.Requirement, ...readData("lib.demo-workbook-adapter", "content_fields_8"), Action: row['What the client should see'], Status: row['Client status'] || 'Ready', Reference: row['Demo point'], ...readData("lib.demo-workbook-adapter", "content_fields_9") };
  const first = Object.entries(row).find(([, value]) => value !== null && value !== undefined);
  return { Reference: first ? asText(first[1]) : 'Workbook row', ...readData("lib.demo-workbook-adapter", "content_fields_10") };
}

export function getWorkbookRowsForModule(moduleId) {
  const source = moduleSources[moduleId];
  if (!source) return [];
  const sourceRows = source === '12_Employees' ? employeeRows : validRows(source);
  return sourceRows.map((row, index) => {
    const cells = sourceCells(moduleId, row);
    return {
      id: `${moduleId}-${index + 1}`,
      reference: cells.Reference || `${moduleId}-${index + 1}`,
      owner: cells.Owner || 'Demo tenant',
      status: cells.Status || 'Ready',
      ...readData("lib.demo-workbook-adapter", "content_fields_11"),
      detail: Object.entries(cells).filter(([key]) => !readData("lib.demo-workbook-adapter", "detail_12").includes(key)).slice(0, 4).map(([key, value]) => `${key}: ${asText(value)}`).join(' · '),
      _cells: cells,
      source: row,
    };
  });
}

export function recordCellValue(record, column) {
  return record?._cells?.[column] ?? record?.[column] ?? record?.reference ?? '—';
}

export function getWorkbookFieldOptions(fieldKey) {
  if (fieldOptionSets[fieldKey]) return fieldOptionSets[fieldKey];
  const mappedPicklistKey = fieldToPicklistKeyMap[fieldKey];
  if (mappedPicklistKey && picklistOptionsMap.has(mappedPicklistKey)) {
    return picklistOptionsMap.get(mappedPicklistKey);
  }
  if (picklistOptionsMap.has(fieldKey)) {
    return picklistOptionsMap.get(fieldKey);
  }
  return [];
}

export function workbookNavigationCounts() {
  return Object.fromEntries(Object.entries(moduleSources).map(([moduleId, sheet]) => [moduleId, rows(sheet).length]));
}
