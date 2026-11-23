import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, recordAudit, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { isoOrNull, textOrNull } from "./route-support";

/**
 * Payment of Gratuity Act, 1972 — Form F nomination (Rule 6(1)).
 *
 * The particulars come from the employee master (`employees` + `employees.metadata`) and the
 * establishment from the tenant's legal entity. Nominees on record are the employee's `dependants`
 * rows that name the gratuity scheme. A registration stores the declared nominees and witnesses as a
 * versioned `vp_feature_records` row; the previous registration is marked superseded in the same
 * transaction. Shares must add up to exactly 100 %. No gratuity amount is computed here — that belongs
 * to payroll / F&F.
 */

export const FORM_F_KIND = "gratuity_nomination_form_f";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

/** Shares are compared in hundredths so 33.33 + 33.33 + 33.34 is exactly 100. */
export function shareTotalHundredths(shares: readonly number[]): number {
  return shares.reduce((sum, share) => sum + Math.round(share * 100), 0);
}

export const nomineeSchema = z.object({
  name: z.string().trim().min(2, "Enter the nominee's name.").max(160),
  relationship: z.string().trim().min(1, "Enter the relationship.").max(60),
  age: z.number().int().min(0, "Age cannot be negative.").max(120),
  address: z.string().trim().max(500).optional(),
  sharePercent: z.number().gt(0, "Each share must be more than 0%.").max(100, "A share cannot exceed 100%."),
  contingency: z.string().trim().max(300).optional(),
});

export const registerFormFSchema = z
  .object({
    employeeId: z.string().uuid("Choose an employee."),
    nominees: z.array(nomineeSchema).min(1, "Add at least one nominee.").max(10),
    witnesses: z
      .array(z.object({ name: z.string().trim().min(2, "Enter the witness's name.").max(160) }))
      .length(2, "Form F needs two witnesses."),
    declarationDate: isoDate.refine((value) => value <= new Date().toISOString().slice(0, 10), "The declaration date cannot be in the future."),
  })
  .refine((value) => shareTotalHundredths(value.nominees.map((n) => n.sharePercent)) === 10000, {
    path: ["nominees"],
    message: "Nominee shares must add up to exactly 100%.",
  });

export type RegisterFormF = z.infer<typeof registerFormFSchema>;

export type FormFView = {
  employee: {
    id: string; employeeCode: string; name: string; department: string; designation: string; joiningDate: string | null;
    sex: string | null; maritalStatus: string | null; fatherOrSpouseName: string | null; permanentAddress: string | null;
  };
  establishment: { name: string | null; registeredAddress: string | null; registrationNumber: string | null };
  nomineesOnRecord: Array<{ name: string; relationship: string; age: number | null; address: string | null; sharePercent: number | null }>;
  registration: null | {
    id: string; serial: string; version: number; registeredAt: string | null; declarationDate: string | null;
    nominees: Array<z.infer<typeof nomineeSchema>>; witnesses: Array<{ name: string }>;
  };
};

function ageFrom(birthDate: unknown, today = new Date()): number | null {
  const text = textOrNull(birthDate);
  if (!text || !/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const born = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  let age = today.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 ? age : null;
}

type EmployeeRow = { id: string; employee_code: string; first_name: string; last_name: string; department: string; designation: string; joining_date: unknown; metadata: Record<string, unknown> | null };

export async function loadFormF(access: Access, employeeId: string): Promise<FormFView> {
  enforce(access.context, "compliance.filing.read", { tenantId: access.tenantId });
  const [employeeRows, entityRows, dependantRows, registrationRows] = await tenantTx(access, [
    sqlClient`select id, employee_code, first_name, last_name, department, designation, joining_date::text as joining_date, metadata
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
    sqlClient`select legal_name, attributes from legal_entities where tenant_id = ${access.tenantId} and status = 'active' order by created_at limit 1`,
    sqlClient`select attributes from dependants where tenant_id = ${access.tenantId} and employee_id = ${employeeId} order by created_at limit 50`,
    sqlClient`select id, data, created_at from vp_feature_records
      where tenant_id = ${access.tenantId} and kind = ${FORM_F_KIND} and employee_id = ${employeeId} and status = 'registered'
      order by created_at desc limit 1`,
  ]);
  const employee = (employeeRows as EmployeeRow[])[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That employee was not found." });
  const meta = employee.metadata ?? {};
  const entity = (entityRows as Array<{ legal_name: string; attributes: Record<string, unknown> | null }>)[0];
  const entityAttributes = entity?.attributes ?? {};

  const nomineesOnRecord = (dependantRows as Array<{ attributes: Record<string, unknown> | null }>)
    .map((row) => row.attributes ?? {})
    .filter((a) => Array.isArray(a.nominationSchemes) && (a.nominationSchemes as unknown[]).includes("gratuity"))
    .map((a) => ({
      name: textOrNull(a.name) ?? "",
      relationship: textOrNull(a.relationship) ?? "",
      age: ageFrom(a.birthDate),
      address: textOrNull(a.nomineeAddress),
      sharePercent: typeof a.nominationPercent === "number" ? a.nominationPercent : null,
    }))
    .filter((n) => n.name.length > 0);

  const registered = (registrationRows as Array<{ id: string; data: Record<string, unknown>; created_at: unknown }>)[0];
  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employee_code,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
      department: employee.department,
      designation: employee.designation,
      joiningDate: textOrNull(employee.joining_date),
      sex: textOrNull(meta.gender),
      maritalStatus: textOrNull(meta.maritalStatus),
      fatherOrSpouseName: textOrNull(meta.spouseName) ?? textOrNull(meta.fatherName),
      permanentAddress: textOrNull(meta.permanentAddress),
    },
    establishment: {
      name: entity?.legal_name ?? null,
      registeredAddress: textOrNull(entityAttributes.registeredAddress),
      registrationNumber: textOrNull(entityAttributes.establishmentLicence) ?? textOrNull(entityAttributes.pfCode),
    },
    nomineesOnRecord,
    registration: registered
      ? {
          id: registered.id,
          serial: textOrNull(registered.data.serial) ?? registered.id,
          version: typeof registered.data.version === "number" ? registered.data.version : 1,
          registeredAt: isoOrNull(registered.created_at),
          declarationDate: textOrNull(registered.data.declarationDate),
          nominees: Array.isArray(registered.data.nominees) ? (registered.data.nominees as Array<z.infer<typeof nomineeSchema>>) : [],
          witnesses: Array.isArray(registered.data.witnesses) ? (registered.data.witnesses as Array<{ name: string }>) : [],
        }
      : null,
  };
}

export async function registerFormF(access: Access, input: RegisterFormF, requestId: string): Promise<{ id: string; serial: string; version: number; status: string }> {
  enforce(access.context, "compliance.filing.write", { tenantId: access.tenantId });
  const [employeeRows, versionRows] = await tenantTx(access, [
    sqlClient`select id, employee_code from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
    sqlClient`select count(*)::int as n from vp_feature_records where tenant_id = ${access.tenantId} and kind = ${FORM_F_KIND} and employee_id = ${input.employeeId}`,
  ]);
  const employee = (employeeRows as Array<{ id: string; employee_code: string }>)[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That employee was not found.", details: [{ field: "employeeId", issue: "unknown" }] });
  const version = Number((versionRows as Array<{ n: number }>)[0]?.n ?? 0) + 1;
  const serial = `FORM-F/${employee.employee_code}/${version}`;
  const id = randomUUID();
  const data = { ...input, serial, version };
  await tenantTx(access, [
    sqlClient`update vp_feature_records set status = 'superseded', updated_at = now()
      where tenant_id = ${access.tenantId} and kind = ${FORM_F_KIND} and employee_id = ${input.employeeId} and status = 'registered'`,
    sqlClient`insert into vp_feature_records (id, tenant_id, kind, employee_id, external_key, status, effective_on, data, created_by_membership_id)
      values (${id}, ${access.tenantId}, ${FORM_F_KIND}, ${input.employeeId}, ${serial}, 'registered', ${input.declarationDate}::date,
        ${JSON.stringify(data)}::jsonb, ${access.context.membershipId})`,
  ]);
  await recordAudit(access, { action: "compliance.form_f_registered", entityType: FORM_F_KIND, entityId: id, reason: `Form F nomination registered (${serial})`, after: { employeeId: input.employeeId, nominees: input.nominees.length, version }, requestId });
  return { id, serial, version, status: "registered" };
}
