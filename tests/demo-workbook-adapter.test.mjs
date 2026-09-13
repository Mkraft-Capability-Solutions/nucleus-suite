import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkbookFieldOptions, getWorkbookRowsForModule, recordCellValue } from '../src/lib/demo-workbook-adapter.mjs';

test('employee record queue uses workbook employee names and assignments instead of record IDs', () => {
  const people = getWorkbookRowsForModule('person_record');
  assert.equal(people.length, 68);
  assert.equal(recordCellValue(people[0], 'Employee'), 'E1001 · Arvind Raghunathan');
  assert.equal(recordCellValue(people[0], 'Department'), 'Executive Office');
  assert.equal(recordCellValue(people[0], 'Assignment'), 'Managing Director · Bengaluru Corporate Office');
  assert.equal(recordCellValue(people[0], 'Status'), 'Active');
});

test('operational modules draw the right workbook source rows', () => {
  assert.equal(getWorkbookRowsForModule('attendance_detail').length, 210);
  assert.equal(getWorkbookRowsForModule('overtime_register').length, 7);
  assert.equal(getWorkbookRowsForModule('payroll_runs').length, 6);
  assert.equal(getWorkbookRowsForModule('gl_mapping').length, 23);
  assert.equal(getWorkbookRowsForModule('sync_monitor').length, 8);
});

test('operational workspaces prefer the workbook source and its display-field adapter', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync('src/components/Clerio/OperationalModuleView.js', 'utf8');
  assert.match(source, /getWorkbookRowsForModule/);
  assert.match(source, /workbookRecordCellValue/);
});

test('the People Core directory uses the workbook employee source', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync('src/components/Clerio/PeopleCoreView.js', 'utf8');
  assert.match(source, /getWorkbookRowsForModule\('person_record'\)/);
  assert.match(source, /directoryEmployees/);
});

test('workbook reference lists provide human-readable choices for operational forms', () => {
  assert.deepEqual(getWorkbookFieldOptions('employee').slice(0, 2), [
    { value: 'E1001', label: 'E1001 · Arvind Raghunathan' },
    { value: 'E1002', label: 'E1002 · Meenakshi Sundaram' },
  ]);
  assert.deepEqual(getWorkbookFieldOptions('location')[0], { value: 'LOC-BLR', label: 'LOC-BLR · Bengaluru Corporate Office' });
  assert.deepEqual(getWorkbookFieldOptions('orgUnit')[0], { value: 'OU-100', label: 'OU-100 · Executive Office' });
  assert.deepEqual(getWorkbookFieldOptions('employeeCode'), []);
});
