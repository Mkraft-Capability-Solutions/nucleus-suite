import type { EmployeeOption } from "../onboarding/EmployeePicker";
import { ALL_FIELDS, ROW_GROUPS, emptyRow, initialRows, initialValues, rowIsBlank, type FormValues, type Row, type RowGroupId, type Rows } from "./fields";

/**
 * Builds the POST /api/v1/people (create) and PATCH /api/v1/people/{id} (edit) bodies from
 * the wizard state, and maps a stored record back into the wizard for editing. Only what
 * the user entered is sent: empty values are omitted, confirmation fields never leave the
 * browser, and the server derives the full name and the employee code when blank.
 */

const TRAINEE_TYPES: Record<string, string> = { TRAINEE_DET: "DET", TRAINEE_GET: "GET" };

function rowsPayload(group: RowGroupId, rows: Row[]): Array<Record<string, unknown>> {
  const kept = rows.filter((row) => !rowIsBlank(row));
  const mapped = kept.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "boolean") { out[key] = value; continue; }
      const text = value.trim();
      if (!text) continue;
      out[key] = (key === "sharePercent" || key === "passingYear") ? Number(text) : text;
    }
    return out;
  });
  if (group === "education" && mapped.length > 0 && !mapped.some((row) => row.isHighest === true)) mapped[0].isHighest = true;
  return mapped;
}

export function buildPersonPayload(values: FormValues, rows: Rows, manager: EmployeeOption | null, mode: "create" | "edit"): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    if (field.clientOnly || field.type === "employee") continue;
    if (field.visibleWhen && !field.visibleWhen(values)) continue;
    if (mode === "edit" && field.lockedOnEdit) continue;
    const value = values[field.key];
    if (typeof value === "boolean") { body[field.key] = value; continue; }
    const text = (value ?? "").trim();
    if (!text) continue;
    body[field.key] = field.type === "number" ? Number(text) : text;
  }
  if (typeof body.officialEmail === "string") body.workEmail = body.officialEmail;
  const category = typeof body.workerCategory === "string" ? body.workerCategory : "";
  body.isTrainee = category in TRAINEE_TYPES;
  if (TRAINEE_TYPES[category]) body.traineeType = TRAINEE_TYPES[category];
  if (manager) {
    body.managerEmployeeId = manager.id;
    body.managerEmployeeCode = manager.employeeCode;
    body.manager = manager.name;
  }
  for (const group of ROW_GROUPS) body[group.id] = rowsPayload(group.id, rows[group.id]);
  return body;
}

/** The record shape GET /api/v1/people/{id} returns (data). */
export type PersonRecord = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  designation: string;
  department: string;
  location: string;
  status: string;
  joiningDate: string | null;
  metadata: Record<string, unknown> | null;
};

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

export function fromRecord(record: PersonRecord, today: string): { values: FormValues; rows: Rows; manager: EmployeeOption | null } {
  const meta = record.metadata ?? {};
  const values = initialValues(today);
  for (const field of ALL_FIELDS) {
    const stored = meta[field.key];
    if (field.type === "bool") { if (typeof stored === "boolean") values[field.key] = stored; continue; }
    const text = asText(stored);
    if (text) values[field.key] = text;
  }
  values.employeeCode = record.employeeCode;
  values.firstName = record.firstName;
  values.lastName = record.lastName;
  values.designation = record.designation;
  values.department = record.department;
  values.location = record.location;
  values.status = record.status ? record.status.toLowerCase() : values.status;
  if (record.joiningDate) values.joiningDate = record.joiningDate.slice(0, 10);
  if (record.workEmail && !values.officialEmail && record.workEmail !== values.personalEmail) values.officialEmail = record.workEmail;
  // The confirmation is not stored; an existing account number counts as confirmed.
  values.accountConfirm = values.accountToken;

  const rows = initialRows();
  for (const group of ROW_GROUPS) {
    const stored = meta[group.id];
    if (!Array.isArray(stored)) continue;
    rows[group.id] = stored.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const source = item as Record<string, unknown>;
      const row = emptyRow(group);
      for (const field of group.fields) {
        const value = field.key === "passingYear" ? (source.passingYear ?? source.yearOfPassing) : field.key === "prevUan" ? (source.prevUan ?? source.previousUan) : source[field.key];
        if (field.type === "bool") row[field.key] = value === true;
        else row[field.key] = asText(value);
      }
      return [row];
    });
  }

  const managerId = asText(meta.managerEmployeeId);
  const manager: EmployeeOption | null = managerId
    ? { id: managerId, employeeCode: asText(meta.managerEmployeeCode), name: asText(meta.manager) || asText(meta.managerEmployeeCode), designation: null, department: null, status: null }
    : null;
  return { values, rows, manager };
}
