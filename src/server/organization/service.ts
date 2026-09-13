import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, recordAudit, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  designation: string;
  department: string;
  location: string;
  category: string;
  status: string;
  joining_date: string;
  basic_salary_minor: number | null;
  currency: string;
  version: number;
};

export type EmployeeView = Omit<EmployeeRow, "basic_salary_minor"> & { basic_salary_minor: number | null; salaryMasked: boolean };

/** Field projection: salary is visible only with the independent rate permission. */
export function projectEmployee(row: EmployeeRow, canSeeCompensation: boolean): EmployeeView {
  if (canSeeCompensation) return { ...row, salaryMasked: false };
  const { basic_salary_minor: _hidden, ...rest } = row;
  void _hidden;
  return { ...rest, basic_salary_minor: null, salaryMasked: true };
}

export function canSeeCompensation(access: Access): boolean {
  return authorize(access.context, {
    action: "employee.read",
    resource: { tenantId: access.tenantId },
    requestedFields: ["compensation"],
  }).allowed;
}

export async function listEmployees(
  access: Access,
  args: { search: string; page: number; pageSize: number },
): Promise<{ items: EmployeeView[]; total: number }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const compensated = canSeeCompensation(access);
  const like = `%${args.search.replace(/[%_]/g, "")}%`;
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from employees
      where tenant_id = ${access.tenantId}
        and (${args.search} = '' or (first_name || ' ' || last_name || ' ' || employee_code || ' ' || coalesce(work_email, '')) ilike ${like})
    `,
    sqlClient`
      select id, employee_code, first_name, last_name, work_email, designation, department, location,
             category, status, joining_date::text, basic_salary_minor, currency, version
      from employees
      where tenant_id = ${access.tenantId}
        and (${args.search} = '' or (first_name || ' ' || last_name || ' ' || employee_code || ' ' || coalesce(work_email, '')) ilike ${like})
      order by employee_code asc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: (rows as EmployeeRow[]).map((row) => projectEmployee(row, compensated)), total };
}

export async function getEmployee(access: Access, id: string): Promise<EmployeeView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const compensated = canSeeCompensation(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, work_email, designation, department, location,
             category, status, joining_date::text, basic_salary_minor, currency, version
      from employees where tenant_id = ${access.tenantId} and id = ${id} limit 1
    `,
  ]);
  const row = (rows as EmployeeRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (compensated) {
    await tenantTx(access, [
      sqlClient`
        insert into access_events (tenant_id, membership_id, subject_type, subject_id, field_domain, purpose, decision, reason_code, request_id)
        values (${access.tenantId}, ${access.context.membershipId}, 'employee', ${id}, 'compensation', 'profile-view', 'allow', 'ALLOWED', gen_random_uuid())
      `,
    ]);
  }
  return projectEmployee(row, compensated);
}

export async function getOrganizationTree(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [entities, departments, positions, headcount] = await tenantTx(access, [
    sqlClient`select id, code, legal_name, currency_code, status from legal_entities where tenant_id = ${access.tenantId} order by code asc`,
    sqlClient`select id, business_unit_id, parent_department_id, hod_position_id, record_status, attributes from departments where tenant_id = ${access.tenantId} order by created_at asc`,
    sqlClient`select id, department_id, grade_id, job_profile_id, location_id, reports_to_position_id, record_status, attributes from positions where tenant_id = ${access.tenantId} order by created_at asc`,
    sqlClient`select department as name, count(*)::int as headcount from employees where tenant_id = ${access.tenantId} group by department order by 1`,
  ]);
  return { entities, departments, positions, headcount };
}

/** Lightweight command-centre projection; avoids loading full employee and position records. */
export async function getWorkforceOverview(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [totalRows, joinerCounts, headcount, positionRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from employees where tenant_id = ${access.tenantId}`,
    sqlClient`
      select to_char(joining_date, 'YYYY-MM') as month, count(*)::int as count
      from employees
      where tenant_id = ${access.tenantId} and joining_date is not null
      group by to_char(joining_date, 'YYYY-MM')
      order by month
    `,
    sqlClient`
      select department as name, count(*)::int as headcount
      from employees where tenant_id = ${access.tenantId}
      group by department order by department
    `,
    sqlClient`
      select count(*)::int as open_positions from positions
      where tenant_id = ${access.tenantId}
        and record_status not in ('filled', 'archived', 'inactive')
    `,
  ]);
  return {
    total: (totalRows as Array<{ total: number }>)[0]?.total ?? 0,
    joinerCounts: joinerCounts as Array<{ month: string; count: number }>,
    headcount: headcount as Array<{ name: string | null; headcount: number }>,
    openPositions: (positionRows as Array<{ open_positions: number }>)[0]?.open_positions ?? 0,
  };
}

export const createDocumentSchema = z.object({
  documentTypeId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  contentBase64: z.string().min(1),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function createDocument(access: Access, input: z.infer<typeof createDocumentSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: `Documents are bounded to ${MAX_DOCUMENT_BYTES} bytes.` });
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const documentId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into documents (id, tenant_id, document_type_id, employee_id, candidate_id, attributes)
      values (${documentId}, ${access.tenantId}, ${input.documentTypeId}, ${input.employeeId ?? null}, ${input.candidateId ?? null},
        ${JSON.stringify({ title: input.title, current_version: 1 })}::jsonb)
    `,
    sqlClient`
      insert into document_versions (tenant_id, document_id, attributes)
      values (${access.tenantId}, ${documentId},
        ${JSON.stringify({ version: 1, title: input.title, mime: input.mimeType, size_bytes: bytes.length, sha256, scan: "pending_scan", content_base64: input.contentBase64, expires_at: input.expiresAt ?? null })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'document.upload', 'document', ${documentId}, 'Secure document upload', ${JSON.stringify({ title: input.title, sha256, size_bytes: bytes.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: documentId, version: 1, sha256, sizeBytes: bytes.length, scan: "pending_scan" as const };
}

export async function markDocumentScan(access: Access, id: string, clean: boolean, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from document_versions where tenant_id = ${access.tenantId} and document_id = ${id} order by created_at desc limit 1`,
  ]);
  const latest = (rows as Array<{ id: string; attributes: { scan: string } }>)[0];
  if (!latest) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (latest.attributes.scan !== "pending_scan") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The document version was already reviewed." });
  }
  const scan = clean ? "available" : "quarantined";
  await tenantTx(access, [
    sqlClient`update document_versions set attributes = attributes || ${JSON.stringify({ scan })}::jsonb where id = ${latest.id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'document.scan', 'document', ${id}, ${clean ? "Scan clean" : "Threat quarantined"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, scan };
}

export async function downloadDocument(access: Access, id: string) {
  enforce(access.context, "document.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from document_versions where tenant_id = ${access.tenantId} and document_id = ${id} order by created_at desc limit 1`,
  ]);
  const latest = (rows as Array<{ attributes: { title: string; mime: string; content_base64: string; sha256: string; scan: string; expires_at: string | null } }>)[0];
  if (!latest) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (latest.attributes.scan !== "available") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The document is not yet available for download." });
  }
  if (latest.attributes.expires_at && latest.attributes.expires_at < new Date().toISOString().slice(0, 10)) {
    throw new HttpError({ status: 410, code: "GONE", message: "The document version has expired." });
  }
  await recordAudit(access, { action: "document.download", entityType: "document", entityId: id, reason: "Secure download" });
  return latest.attributes;
}

export const importPreviewSchema = z.object({
  rows: z.array(z.object({
    employeeCode: z.string().trim().min(1).max(40),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    workEmail: z.string().email().optional(),
    department: z.string().trim().min(1).max(80),
  })).min(1).max(500),
});

export async function previewImport(access: Access, input: z.infer<typeof importPreviewSchema>) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const codes = [...new Set(input.rows.map((row) => row.employeeCode))];
  const [existing] = await tenantTx(access, [
    sqlClient`select employee_code, work_email from employees where tenant_id = ${access.tenantId} and employee_code = any(${codes})`,
  ]);
  const known = new Set((existing as Array<{ employee_code: string }>).map((row) => row.employee_code));
  const seen = new Set<string>();
  let created = 0, duplicates = 0, conflicts = 0;
  const details = input.rows.map((row) => {
    if (seen.has(row.employeeCode)) {
      conflicts += 1;
      return { employeeCode: row.employeeCode, outcome: "conflict" as const, reason: "Repeated in the same file." };
    }
    seen.add(row.employeeCode);
    if (known.has(row.employeeCode)) {
      duplicates += 1;
      return { employeeCode: row.employeeCode, outcome: "duplicate" as const, reason: "Employee code already exists." };
    }
    created += 1;
    return { employeeCode: row.employeeCode, outcome: "new" as const, reason: null as string | null };
  });
  return { rows: input.rows.length, created, duplicates, conflicts, applied: false, details };
}

export const createPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  employeeCode: z.string().trim().min(1).max(40).optional(),
  workEmail: z.string().email().optional(),
  designation: z.string().trim().min(1).max(120).default("Associate"),
  department: z.string().trim().min(1).max(80).default("General"),
  location: z.string().trim().min(1).max(80).default("Head Office"),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  basicSalaryMinor: z.number().int().min(0).max(1000000000).optional(),
});

/** Single-person creation (the Add Person form). Enforced by employee.write, audited. */
export async function createPerson(access: Access, input: z.infer<typeof createPersonSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const code = input.employeeCode ?? `MK-${Date.now().toString(36).toUpperCase()}`;
  const [existing] = await tenantTx(access, [
    sqlClient`select 1 from employees where tenant_id = ${access.tenantId} and employee_code = ${code} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An employee with this code already exists." });
  }
  const personId = randomUUID();
  const employeeId = randomUUID();
  const joining = input.joiningDate ?? new Date().toISOString().slice(0, 10);
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${access.tenantId}, ${personId}, ${code}, ${input.firstName}, ${input.lastName}, ${input.workEmail ?? null}, ${input.designation}, ${input.department}, ${input.location}, ${joining}, ${input.basicSalaryMinor ?? null})`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id) values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'people.create', 'employee', ${employeeId}, 'Employee record created', ${JSON.stringify({ employeeCode: code })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id: employeeId, personId, employeeCode: code };
}

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  businessUnitId: z.string().uuid().optional(),
  parentDepartmentId: z.string().uuid().nullable().optional(),
});

/** Department creation; reuses the tenant's first business unit when unspecified. */
export async function createDepartment(access: Access, input: z.infer<typeof createDepartmentSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const code = input.code ?? input.name.toUpperCase().replace(/[^A-Z]+/g, "-");
  const [units] = await tenantTx(access, [
    input.businessUnitId
      ? sqlClient`select id from business_units where tenant_id = ${access.tenantId} and id = ${input.businessUnitId} limit 1`
      : sqlClient`select id from business_units where tenant_id = ${access.tenantId} order by created_at limit 1`,
  ]);
  const unit = (units as Array<{ id: string }>)[0];
  if (!unit) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No business unit exists for this tenant yet." });
  const id = randomUUID();
  await tenantTx(access, [
    sqlClient`insert into departments (id, tenant_id, business_unit_id, parent_department_id, attributes) values (${id}, ${access.tenantId}, ${unit.id}, ${input.parentDepartmentId ?? null}, ${JSON.stringify({ name: input.name, code })}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id) values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.department_create', 'department', ${id}, 'Department created', ${JSON.stringify({ name: input.name, code })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, name: input.name, code };
}

export const createPositionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  departmentId: z.string().uuid(),
  gradeId: z.string().uuid().optional(),
  jobProfileId: z.string().uuid().optional(),
  reportsToPositionId: z.string().uuid().nullable().optional(),
});

/** Position creation; reuses the tenant's first grade/profile when unspecified. */
export async function createPosition(access: Access, input: z.infer<typeof createPositionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const code = input.code ?? input.name.toUpperCase().replace(/[^A-Z]+/g, "-");
  const [deptRows, gradeRows, profileRows] = await tenantTx(access, [
    sqlClient`select id from departments where tenant_id = ${access.tenantId} and id = ${input.departmentId} limit 1`,
    input.gradeId
      ? sqlClient`select id from grades where tenant_id = ${access.tenantId} and id = ${input.gradeId} limit 1`
      : sqlClient`select id from grades where tenant_id = ${access.tenantId} order by created_at limit 1`,
    input.jobProfileId
      ? sqlClient`select id from job_profiles where tenant_id = ${access.tenantId} and id = ${input.jobProfileId} limit 1`
      : sqlClient`select id from job_profiles where tenant_id = ${access.tenantId} order by created_at limit 1`,
  ]);
  const department = (deptRows as Array<{ id: string }>)[0];
  const grade = (gradeRows as Array<{ id: string }>)[0];
  const profile = (profileRows as Array<{ id: string }>)[0];
  if (!department) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The department was not found." });
  if (!grade) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No grade exists for this tenant yet." });
  if (!profile) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No job profile exists for this tenant yet." });
  const id = randomUUID();
  await tenantTx(access, [
    sqlClient`insert into positions (id, tenant_id, department_id, grade_id, job_profile_id, reports_to_position_id, attributes) values (${id}, ${access.tenantId}, ${department.id}, ${grade.id}, ${profile.id}, ${input.reportsToPositionId ?? null}, ${JSON.stringify({ name: input.name, code })}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id) values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.position_create', 'position', ${id}, 'Position created', ${JSON.stringify({ name: input.name, code })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, name: input.name, code };
}
