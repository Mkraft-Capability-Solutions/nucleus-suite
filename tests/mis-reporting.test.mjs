import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  parseDelimitedCsv,
  prepareMisImport,
  summarizeMisRecords,
  toReportCsv,
} from '../src/lib/mis-reporting.mjs';

test('prepares the supplied MTD column layout as a governed MIS import', () => {
  const parsed = parseDelimitedCsv([
    'Emp ID,Employee Name,Department,Designation,Attendance %,Overtime (Hrs),Gross CTC,Performance Rating,Flight Risk',
    '"EMP-101","Trisha Khanna","Engineering","Senior Architect","95.4","14.5","₹ 28,00,000","4.8 / 5.0 (Top Exceeds)","Low (4%)"',
  ].join('\n'));

  const result = prepareMisImport(parsed, {
    periodStart: '2026-09-01',
    periodEnd: '2026-09-13',
    legalEntity: 'Nucleus India',
  });

  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].grossCtcCurrency, 'INR');
  assert.equal(result.accepted[0].flightRiskBand, 'Low');
  assert.equal(result.context.periodStart, '2026-09-01');
});

test('rejects duplicate IDs and invalid operational measures before publication', () => {
  const parsed = parseDelimitedCsv([
    'Emp ID,Employee Name,Department,Designation,Attendance %,Overtime (Hrs),Gross CTC,Performance Rating,Flight Risk',
    '"EMP-101","Trisha Khanna","Engineering","Senior Architect","105","14.5","₹ 28,00,000","4.8 / 5.0 (Top Exceeds)","Low (4%)"',
    '"EMP-101","Amit Verma","Engineering","Director","98.2","-1","₹ 45,00,000","4.9 / 5.0 (Role Model)","Low (2%)"',
  ].join('\n'));

  const result = prepareMisImport(parsed);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 2);
  assert.match(result.rejected[0].issues.join(' '), /Attendance/);
  assert.match(result.rejected[1].issues.join(' '), /Duplicate|Overtime/);
});

test('calculates report KPIs from the scoped records and preserves mixed currencies', () => {
  const records = [
    { empId: 'EMP-1', attendancePct: 95, overtimeHrs: 10, flightRiskBand: 'Low', grossCtcCurrency: 'INR' },
    { empId: 'EMP-2', attendancePct: 85, overtimeHrs: 5, flightRiskBand: 'High', grossCtcCurrency: 'USD' },
  ];

  const summary = summarizeMisRecords(records);

  assert.equal(summary.averageAttendance, 90);
  assert.equal(summary.totalOvertime, 15);
  assert.equal(summary.highRiskCount, 1);
  assert.equal(summary.currencyCount, 2);
});

test('exports values as a CSV with escaped text values', () => {
  const output = toReportCsv([{ empId: 'EMP-1', name: 'Ava, Smith', attendancePct: 95 }], ['empId', 'name', 'attendancePct']);
  assert.match(output, /Emp ID,Employee Name,Attendance %/);
  assert.match(output, /"Ava, Smith"/);
});

test('people intelligence mounts the governed MIS reporting workspace', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/components/Clerio/AnalyticsView.js'), 'utf8');
  assert.match(source, /MisReportingHub/);
});

test('the operational reports submodule opens the governed reporting workspace', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/components/Clerio/MainWorkspace.js'), 'utf8');
  assert.match(source, /activeTab === 'operational_reports'/);
});

test('neutralizes formulas in exported cells including leading whitespace', () => {
  for (const name of ['=1+1', '+cmd', '-1+1', '@SUM(A1)', ' \t=HYPERLINK("bad")']) {
    const csv = toReportCsv([{ name }], ['name']);
    assert.ok(csv.split('\n')[1].startsWith('"\''));
  }
});

test('redacts compensation and risk fields consistently before CSV and XLSX serialization', async () => {
  const { redactMisExport } = await import('../src/lib/mis-reporting.mjs');
  const source = [{ name: 'Test', grossCtc: 90000, grossCtcCurrency: 'USD', flightRisk: 'High', flightRiskBand: 'High', attritionRisk: 'High' }];
  const restricted = redactMisExport(source, { canViewCompensation: false, canViewRisk: false });
  assert.equal(restricted[0].grossCtc, 'Restricted');
  assert.equal(restricted[0].flightRisk, 'Restricted');
  assert.equal(restricted[0].attritionRisk, 'Restricted');
  assert.equal(source[0].flightRisk, 'High');
  assert.deepEqual(redactMisExport(source, { canViewCompensation: true, canViewRisk: true }), source);
});
