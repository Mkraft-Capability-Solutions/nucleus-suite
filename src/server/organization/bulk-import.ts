import "server-only";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { createPerson, createPersonSchema } from "@/server/organization/service";
import { ingestPunches, ingestPunchesSchema } from "@/server/attendance/service";
import { createCandidate, createCandidateSchema } from "@/server/talent/service";
import { recordAccrualCredit, accrualCreditSchema } from "@/server/leave/service";

/**
 * Bulk import. Every row goes through the same validated, permission-checked, audited service a single
 * record would; nothing is defaulted or invented. The response reports each row's outcome so the user can
 * fix and re-upload only what was rejected. `dryRun` validates without writing.
 */

export const MAX_IMPORT_ROWS = 500;

export const bulkImportSchema = z.object({
  importType: z.enum(["employee", "attendance", "biometric", "leave", "candidates", "ats"]),
  records: z.array(z.record(z.string(), z.unknown())).min(1, "The file has no rows.").max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} rows at a time.`),
  fileName: z.string().trim().max(200).optional(),
  dryRun: z.boolean().default(false),
});
export type BulkImportInput = z.infer<typeof bulkImportSchema>;

export type RowOutcome = { row: number; key: string | null; outcome: "created" | "valid" | "rejected"; reason: string | null; id?: string };
export type BulkImportResult = { importType: string; rows: number; accepted: number; rejected: number; dryRun: boolean; details: RowOutcome[] };

/** First non-empty value among header aliases a spreadsheet may use. */
function pick(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return undefined;
}

const employeeRow = z.object({
  employeeCode: z.string().trim().min(1, "Employee code is required.").max(40),
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  workEmail: z.string().trim().email("Work email is not a valid address."),
  designation: z.string().trim().min(1, "Designation is required.").max(120),
  department: z.string().trim().min(1, "Department is required.").max(80),
  location: z.string().trim().min(1, "Location is required.").max(80),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be YYYY-MM-DD.").optional(),
});

function normaliseEmployee(row: Record<string, unknown>) {
  const fullName = pick(row, "name", "fullName", "FullName", "Staff_Name");
  const [first, ...rest] = fullName ? fullName.split(/\s+/) : [];
  return {
    employeeCode: pick(row, "employeeCode", "empId", "EmployeeCode", "StaffCode", "id"),
    firstName: pick(row, "firstName", "FirstName") ?? first,
    lastName: pick(row, "lastName", "LastName") ?? (rest.join(" ") || undefined),
    workEmail: pick(row, "workEmail", "email", "officialEmail", "WorkEmail"),
    designation: pick(row, "designation", "role", "Role", "Designation"),
    department: pick(row, "department", "dept", "Department"),
    location: pick(row, "location", "Location"),
    joiningDate: pick(row, "joiningDate", "DateOfJoining"),
  };
}

const message = (error: unknown) => (error instanceof HttpError ? error.message : error instanceof z.ZodError ? (error.issues[0]?.message ?? "Invalid row.") : "The row could not be saved.");

async function employeeIdsByCode(access: Access, codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_code from employees where tenant_id = ${access.tenantId} and employee_code = any(${codes})`,
  ]);
  return new Map((rows as Array<{ id: string; employee_code: string }>).map((r) => [r.employee_code, r.id]));
}

export async function runBulkImport(access: Access, input: BulkImportInput, requestId: string): Promise<BulkImportResult> {
  const details: RowOutcome[] = [];
  const kind = input.importType === "biometric" ? "attendance" : input.importType === "ats" ? "candidates" : input.importType;

  if (kind === "employee") enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (kind === "attendance") enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  if (kind === "leave") enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  if (kind === "candidates") enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const codes = kind === "employee" || kind === "candidates" ? [] : [...new Set(input.records.map((r) => pick(r, "employeeCode", "empId", "EmployeeCode")).filter((c): c is string => Boolean(c)))];
  const ids = await employeeIdsByCode(access, codes);
  const existingCodes = kind === "employee"
    ? await employeeIdsByCode(access, input.records.map((r) => normaliseEmployee(r).employeeCode).filter((c): c is string => Boolean(c)))
    : new Map<string, string>();
  const seen = new Set<string>();

  for (const [index, row] of input.records.entries()) {
    const rowNumber = index + 1;
    try {
      if (kind === "employee") {
        const parsed = employeeRow.parse(normaliseEmployee(row));
        if (seen.has(parsed.employeeCode)) throw new HttpError({ status: 409, code: "CONFLICT", message: "Employee code repeated in this file." });
        seen.add(parsed.employeeCode);
        if (existingCodes.has(parsed.employeeCode)) throw new HttpError({ status: 409, code: "CONFLICT", message: "Employee code already exists." });
        if (input.dryRun) { details.push({ row: rowNumber, key: parsed.employeeCode, outcome: "valid", reason: null }); continue; }
        const created = await createPerson(access, createPersonSchema.parse(parsed), requestId);
        details.push({ row: rowNumber, key: parsed.employeeCode, outcome: "created", reason: null, id: created.id });
      } else if (kind === "attendance") {
        const code = pick(row, "employeeCode", "empId", "EmployeeCode");
        const employeeId = pick(row, "employeeId") ?? (code ? ids.get(code) : undefined);
        if (!employeeId) throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "Unknown employee code." });
        const inAt = pick(row, "punchIn", "in", "InTime");
        const outAt = pick(row, "punchOut", "out", "OutTime");
        const parsed = ingestPunchesSchema.parse({
          employeeId,
          workDate: pick(row, "workDate", "date", "Date"),
          punches: [{ at: inAt, type: "in", source: "biometric" }, { at: outAt, type: "out", source: "biometric" }],
        });
        if (input.dryRun) { details.push({ row: rowNumber, key: code ?? employeeId, outcome: "valid", reason: null }); continue; }
        await ingestPunches(access, parsed, requestId);
        details.push({ row: rowNumber, key: code ?? employeeId, outcome: "created", reason: null });
      } else if (kind === "leave") {
        const code = pick(row, "employeeCode", "empId", "EmployeeCode");
        const employeeId = code ? ids.get(code) : undefined;
        if (!employeeId) throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: "Unknown employee code." });
        const parsed = accrualCreditSchema.parse({ employeeId, leaveType: pick(row, "leaveType", "type"), days: Number(pick(row, "days", "balance")), note: pick(row, "note") ?? input.fileName });
        if (input.dryRun) { details.push({ row: rowNumber, key: code ?? null, outcome: "valid", reason: null }); continue; }
        await recordAccrualCredit(access, parsed, requestId);
        details.push({ row: rowNumber, key: code ?? null, outcome: "created", reason: null });
      } else {
        const parsed = createCandidateSchema.parse({
          name: pick(row, "name", "candidateName", "fullName"),
          email: pick(row, "email", "candidateEmail"),
          phone: pick(row, "phone", "mobile"),
          source: pick(row, "source") ?? "import",
        });
        if (input.dryRun) { details.push({ row: rowNumber, key: parsed.email ?? parsed.name, outcome: "valid", reason: null }); continue; }
        const created = await createCandidate(access, parsed);
        details.push({ row: rowNumber, key: parsed.email ?? parsed.name, outcome: "created", reason: null, id: created.id });
      }
    } catch (error) {
      details.push({ row: rowNumber, key: null, outcome: "rejected", reason: message(error) });
    }
  }

  const accepted = details.filter((d) => d.outcome !== "rejected").length;
  return { importType: input.importType, rows: input.records.length, accepted, rejected: details.length - accepted, dryRun: input.dryRun, details };
}
