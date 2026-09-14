import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { applyPersonProfileRules, personProfileMetadata, personProfileShape } from "@/server/organization/person-profile";
import { authorize } from "@/server/identity/authorization";
import { enforce, recordAudit, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type EmployeeRow = {
  id: string;
  employee_code: string;
  metadata?: Record<string, unknown>;
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

/** Decision recorded for audited compensation views. Must stay within the access_events CHECK (allowed/denied). */
export const COMPENSATION_VIEW_DECISION = "allowed" as const;

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
             category, status, joining_date::text, basic_salary_minor, currency, version, metadata
      from employees where tenant_id = ${access.tenantId} and id = ${id} limit 1
    `,
  ]);
  const row = (rows as EmployeeRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (compensated) {
    await tenantTx(access, [
      sqlClient`
        insert into access_events (tenant_id, membership_id, subject_type, subject_id, field_domain, purpose, decision, reason_code, request_id)
        values (${access.tenantId}, ${access.context.membershipId}, 'employee', ${id}, 'compensation', 'profile-view', ${COMPENSATION_VIEW_DECISION}, 'ALLOWED', gen_random_uuid())
      `,
    ]);
  }
  return projectEmployee(row, compensated);
}

export async function getOrganizationTree(access: Access) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  // Locations and cost centres are part of the tree payload because the position master
  // (FRM-PPL-03) requires both, and the create form has no other source for them.
  const [entities, departments, positions, headcount, locations, costCentres] = await tenantTx(access, [
    sqlClient`select id, code, legal_name, currency_code, status from legal_entities where tenant_id = ${access.tenantId} order by code asc`,
    sqlClient`select id, business_unit_id, parent_department_id, hod_position_id, record_status, attributes from departments where tenant_id = ${access.tenantId} order by created_at asc`,
    sqlClient`select id, department_id, grade_id, job_profile_id, location_id, cost_center_id, reports_to_position_id, record_status, attributes from positions where tenant_id = ${access.tenantId} order by created_at asc`,
    sqlClient`select department as name, count(*)::int as headcount from employees where tenant_id = ${access.tenantId} group by department order by 1`,
    sqlClient`select id, record_status, attributes from locations where tenant_id = ${access.tenantId} order by created_at asc`,
    sqlClient`select id, legal_entity_id, record_status, attributes from cost_centers where tenant_id = ${access.tenantId} order by created_at asc`,
  ]);
  return { entities, departments, positions, headcount, locations, costCentres };
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

/**
 * Document upload (FRM-PPL-05). `documentNumber` is stored as the document's `code`: the
 * number printed on the document is the identifier the vault board searches and shows,
 * so a separate record code would be the same field under two names.
 */
export const createDocumentSchema = z.object({
  documentTypeId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  candidateId: z.string().uuid().optional(),
  documentClass: z.enum(picklistValues("PL_DOCUMENT_CLASS")).default("other"),
  title: z.string().trim().min(1).max(200),
  documentNumber: z.string().trim().min(1).max(40).optional(),
  issuedOn: z.iso.date().optional(),
  mimeType: z.string().trim().min(1).max(100),
  contentBase64: z.string().min(1),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  replacesDocumentId: z.string().uuid().optional(),
});

export async function createDocument(access: Access, rawInput: z.input<typeof createDocumentSchema>, requestId: string) {
  const input = createDocumentSchema.parse(rawInput);
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError({ status: 413, code: "PAYLOAD_TOO_LARGE", message: `Documents are bounded to ${MAX_DOCUMENT_BYTES} bytes.` });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.issuedOn && input.issuedOn > today) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "A document cannot be issued in the future." });
  }
  if (input.expiresAt && input.expiresAt <= today) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "An expiry date must be in the future." });
  }
  if (input.replacesDocumentId) {
    const [priorRows] = await tenantTx(access, [
      sqlClient`select id, attributes->>'classification' as classification from documents
        where tenant_id = ${access.tenantId} and id = ${input.replacesDocumentId} limit 1`,
    ]);
    const prior = (priorRows as Array<{ id: string; classification: string | null }>)[0];
    if (!prior) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The document being replaced was not found." });
    // The workbook allows a replacement only within the same class; the old version is
    // retained either way, so this guards the class, not the file.
    if (prior.classification !== null && prior.classification !== input.documentClass) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A document can only replace another of the same class." });
    }
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const documentId = crypto.randomUUID();
  const documentAttributes = {
    title: input.title,
    code: input.documentNumber ?? null,
    classification: input.documentClass,
    issued_on: input.issuedOn ?? null,
    expires_at: input.expiresAt ?? null,
    replaces_document_id: input.replacesDocumentId ?? null,
    current_version: 1,
  };
  await tenantTx(access, [
    sqlClient`
      insert into documents (id, tenant_id, document_type_id, employee_id, candidate_id, attributes)
      values (${documentId}, ${access.tenantId}, ${input.documentTypeId}, ${input.employeeId ?? null}, ${input.candidateId ?? null},
        ${JSON.stringify(documentAttributes)}::jsonb)
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

/**
 * Add / edit employee - identity and personal (FRM-PPL-01). The identity, family, medical,
 * site and control fields come from `personProfileShape` and are stored on the row's
 * `metadata` envelope; the contact, address, bank, dependant and statutory-identifier
 * blocks of the same workbook form live on their own dossier resources, which is why they
 * are not repeated here (see `person-profile.ts`).
 */
export const createPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(80).regex(/^[\p{L}][\p{L} .'-]*$/u, "Letters, spaces, dot, apostrophe and hyphen only."),
  lastName: z.string().trim().min(1).max(80),
  employeeCode: z.string().trim().min(1).max(40).optional(),
  workEmail: z.string().email().optional(),
  designation: z.string().trim().min(1).max(120).default("Associate"),
  department: z.string().trim().min(1).max(80).default("General"),
  location: z.string().trim().min(1).max(80).default("Head Office"),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  basicSalaryMinor: z.number().int().min(0).max(1000000000).optional(),
  ...personProfileShape,
}).superRefine(applyPersonProfileRules);

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
  const metadata = personProfileMetadata(input as Record<string, unknown>, { firstName: input.firstName, lastName: input.lastName });
  // A duplicate is a person the tenant already has under the same name, birth date and
  // site - the workbook's own check. It is a conflict, not a silent second record.
  if (input.dateOfBirth) {
    const [duplicates] = await tenantTx(access, [
      sqlClient`select employee_code from employees
        where tenant_id = ${access.tenantId} and location = ${input.location}
          and lower(metadata->>'fullName') = ${String(metadata.fullName).toLowerCase()}
          and metadata->>'dateOfBirth' = ${input.dateOfBirth}
        limit 1`,
    ]);
    const duplicate = (duplicates as Array<{ employee_code: string }>)[0];
    if (duplicate) {
      throw new HttpError({ status: 409, code: "CONFLICT", message: `${metadata.fullName} already exists at this site as ${duplicate.employee_code}.` });
    }
  }
  await tenantTx(access, [
    sqlClient`insert into people (id, tenant_id) values (${personId}, ${access.tenantId})`,
    sqlClient`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, work_email, designation, department, location, joining_date, basic_salary_minor, metadata) values (${employeeId}, ${access.tenantId}, ${personId}, ${code}, ${input.firstName}, ${input.lastName}, ${input.workEmail ?? null}, ${input.designation}, ${input.department}, ${input.location}, ${joining}, ${input.basicSalaryMinor ?? null}, ${JSON.stringify(metadata)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id) values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'people.create', 'employee', ${employeeId}, 'Employee record created', ${JSON.stringify({ employeeCode: code, ...metadata })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
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
  name: z.string().trim().min(3).max(120),
  code: z.string().trim().min(1).max(40).optional(),
  departmentId: z.string().uuid(),
  gradeId: z.string().uuid().optional(),
  jobProfileId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  workerClass: z.enum(picklistValues("PL_WORKER_CLASS")).default("standard"),
  reportsToPositionId: z.string().uuid().nullable().optional(),
  /** Part-time posts prorate the sanctioned count, which is why the workbook caps FTE at 0.25-1.00. */
  fte: z.number().min(0.25).max(1).default(1),
  availableFrom: z.iso.date().optional(),
  budgetCostMinor: z.number().int().min(0).max(1_000_000_000_000).optional(),
  effectiveFrom: z.iso.date().optional(),
});

/**
 * Position creation; reuses the tenant's first grade/profile when unspecified.
 *
 * Position status and incumbent are deliberately absent from the input: the workbook
 * states both are set by assignment, never by hand, and the register derives them from
 * `record_status` and the live assignment (see `derivePositionState`).
 */
export async function createPosition(access: Access, rawInput: z.input<typeof createPositionSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const input = createPositionSchema.parse(rawInput);
  const code = input.code ?? input.name.toUpperCase().replace(/[^A-Z]+/g, "-");
  const [deptRows, gradeRows, profileRows, locationRows, costCentreRows] = await tenantTx(access, [
    sqlClient`select id from departments where tenant_id = ${access.tenantId} and id = ${input.departmentId} limit 1`,
    input.gradeId
      ? sqlClient`select id from grades where tenant_id = ${access.tenantId} and id = ${input.gradeId} limit 1`
      : sqlClient`select id from grades where tenant_id = ${access.tenantId} order by created_at limit 1`,
    input.jobProfileId
      ? sqlClient`select id from job_profiles where tenant_id = ${access.tenantId} and id = ${input.jobProfileId} limit 1`
      : sqlClient`select id from job_profiles where tenant_id = ${access.tenantId} order by created_at limit 1`,
    input.locationId
      ? sqlClient`select id from locations where tenant_id = ${access.tenantId} and id = ${input.locationId} limit 1`
      : sqlClient`select id from locations where tenant_id = ${access.tenantId} order by created_at limit 1`,
    input.costCenterId
      ? sqlClient`select id from cost_centers where tenant_id = ${access.tenantId} and id = ${input.costCenterId} limit 1`
      : sqlClient`select id from cost_centers where tenant_id = ${access.tenantId} order by created_at limit 1`,
  ]);
  const department = (deptRows as Array<{ id: string }>)[0];
  const grade = (gradeRows as Array<{ id: string }>)[0];
  const profile = (profileRows as Array<{ id: string }>)[0];
  const location = (locationRows as Array<{ id: string }>)[0];
  const costCentre = (costCentreRows as Array<{ id: string }>)[0];
  if (!department) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The department was not found." });
  if (!grade) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No grade exists for this tenant yet." });
  if (!profile) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No job profile exists for this tenant yet." });
  if (!location) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The location was not found." });
  if (!costCentre) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The cost centre was not found." });
  const id = randomUUID();
  const attributes = {
    name: input.name,
    code,
    workerClass: input.workerClass,
    fte: input.fte,
    availableFrom: input.availableFrom,
    budgetCostMinor: input.budgetCostMinor ?? null,
    effectiveFrom: input.effectiveFrom,
  };
  await tenantTx(access, [
    sqlClient`insert into positions (id, tenant_id, department_id, grade_id, job_profile_id, location_id, cost_center_id, reports_to_position_id, attributes) values (${id}, ${access.tenantId}, ${department.id}, ${grade.id}, ${profile.id}, ${location.id}, ${costCentre.id}, ${input.reportsToPositionId ?? null}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id) values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'organization.position_create', 'position', ${id}, 'Position created', ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, name: input.name, code };
}

export type EmployeeTimelineState = "active" | "on_leave" | "separated" | "archived";

export type PositionRegisterState = "open" | "filled" | "frozen" | "abolished";

/** Pure vacancy mapping shared by the register contract (unit-tested). */
export function derivePositionState(
  recordStatus: string | null | undefined,
  hasIncumbent: boolean,
): PositionRegisterState {
  const normalized = (recordStatus ?? "").trim().toLowerCase();
  if (normalized === "frozen") return "frozen";
  if (["archived", "inactive"].includes(normalized)) return "abolished";
  if (hasIncumbent || normalized === "filled") return "filled";
  return "open";
}

export type PositionRegisterRow = {
  id: string;
  code: string;
  title: string;
  department: string;
  location: string;
  cost_centre: string;
  worker_class: string | null;
  fte: number | null;
  available_from: string | null;
  budget_cost_minor: number | null;
  effective_from: string | null;
  incumbent_code: string | null;
  incumbent_name: string | null;
  vacancy: "filled" | "vacant";
  status: PositionRegisterState;
  record_status: string;
};

/** The position master columns both the queue and the record detail project. */
const POSITION_MASTER_COLUMNS = `coalesce(cc.attributes->>'name', cc.attributes->>'code', 'Unassigned') as cost_centre,
   p.attributes->>'workerClass' as worker_class,
   (p.attributes->>'fte')::numeric as fte,
   p.attributes->>'availableFrom' as available_from,
   (p.attributes->>'budgetCostMinor')::bigint as budget_cost_minor,
   p.attributes->>'effectiveFrom' as effective_from`;

const POSITION_MASTER_JOIN = `left join cost_centers cc on cc.tenant_id = p.tenant_id and cc.id = p.cost_center_id`;

const POSITION_STATUS_CASE = `case when p.record_status = 'frozen' then 'frozen'
  when p.record_status in ('archived', 'inactive') then 'abolished'
  when inc.employee_code is not null or p.record_status = 'filled' then 'filled'
  else 'open' end`;

const INCUMBENT_LATERAL = `left join lateral (
  select e.employee_code, e.first_name, e.last_name
  from employee_assignments a
  join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id
  join employees e on e.tenant_id = a.tenant_id and e.id = em.employee_id
  where a.tenant_id = p.tenant_id and a.position_id = p.id and a.record_status = 'active'
    and coalesce(a.attributes->>'effectiveFrom', '') <= to_char(current_date, 'YYYY-MM-DD')
    and (a.attributes->>'effectiveTo' is null or a.attributes->>'effectiveTo' >= to_char(current_date, 'YYYY-MM-DD'))
  order by coalesce(a.attributes->>'effectiveFrom', '') desc, a.created_at desc limit 1
) inc on true`;

/** Position register queue with live incumbent and vacancy derivation. */
export async function listPositionRegister(access: Access, search: string): Promise<PositionRegisterRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select p.id, coalesce(p.attributes->>'code', p.id::text) as code,
         coalesce(p.attributes->>'name', 'Unnamed position') as title,
         coalesce(dep.attributes->>'name', dep.attributes->>'title', 'Unassigned') as department,
         coalesce(loc.attributes->>'name', loc.attributes->>'title', 'Unassigned') as location,
         inc.employee_code as incumbent_code,
         case when inc.employee_code is null then null else inc.first_name || ' ' || inc.last_name end as incumbent_name,
         case when inc.employee_code is null then 'vacant' else 'filled' end as vacancy,
         ${POSITION_MASTER_COLUMNS},
         (${POSITION_STATUS_CASE}) as status, p.record_status
       from positions p
       left join departments dep on dep.tenant_id = p.tenant_id and dep.id = p.department_id
       left join locations loc on loc.tenant_id = p.tenant_id and loc.id = p.location_id
       ${POSITION_MASTER_JOIN}
       ${INCUMBENT_LATERAL}
       where p.tenant_id = $1
         and (coalesce(p.attributes->>'code', '') || ' ' || coalesce(p.attributes->>'name', '') || ' ' || coalesce(dep.attributes->>'name', '')) ilike $2
       order by coalesce(p.attributes->>'code', p.id::text) asc limit 100`,
      [access.tenantId, like],
    ),
  ]);
  return rows as PositionRegisterRow[];
}

/** Single position with assignment history and an isolated audit trail. */
export async function getPositionRecord(access: Access, id: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select p.id, coalesce(p.attributes->>'code', p.id::text) as code,
         coalesce(p.attributes->>'name', 'Unnamed position') as title,
         coalesce(dep.attributes->>'name', dep.attributes->>'title', 'Unassigned') as department,
         coalesce(loc.attributes->>'name', loc.attributes->>'title', 'Unassigned') as location,
         inc.employee_code as incumbent_code,
         case when inc.employee_code is null then null else inc.first_name || ' ' || inc.last_name end as incumbent_name,
         case when inc.employee_code is null then 'vacant' else 'filled' end as vacancy,
         ${POSITION_MASTER_COLUMNS},
         (${POSITION_STATUS_CASE}) as status, p.record_status
       from positions p
       left join departments dep on dep.tenant_id = p.tenant_id and dep.id = p.department_id
       left join locations loc on loc.tenant_id = p.tenant_id and loc.id = p.location_id
       ${POSITION_MASTER_JOIN}
       ${INCUMBENT_LATERAL}
       where p.tenant_id = $1 and p.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  const record = (rows as PositionRegisterRow[])[0];
  if (!record) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [historyRows] = await tenantTx(access, [
    sqlClient.query(
      `select e.employee_code, e.first_name, e.last_name,
         a.attributes->>'effectiveFrom' as effective_from, a.attributes->>'effectiveTo' as effective_to
       from employee_assignments a
       join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id
       join employees e on e.tenant_id = a.tenant_id and e.id = em.employee_id
       where a.tenant_id = $1 and a.position_id = $2::uuid
       order by coalesce(a.attributes->>'effectiveFrom', '') desc, a.created_at desc limit 20`,
      [access.tenantId, id],
    ),
  ]);
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'position' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, history: historyRows as Array<Record<string, unknown>>, auditTrail };
}

const positionActionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

/**
 * A frozen post cannot be requisitioned, so the workbook holds the freeze reason to a
 * longer minimum than the reopen reason - FRM-PPL-03 `freeze_reason`, min 10 characters.
 */
export const freezePositionSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

async function transitionPosition(
  access: Access,
  id: string,
  to: "frozen" | "active",
  allowedFrom: string[],
  action: string,
  reason: string,
  requestId: string,
) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const schema = to === "frozen" ? freezePositionSchema : positionActionSchema;
  const parsed = schema.safeParse({ reason });
  if (!parsed.success) {
    const minimum = to === "frozen" ? 10 : 3;
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: `A reason (min ${minimum} characters) is required.` });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select id, record_status from positions where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const position = (rows as Array<{ id: string; record_status: string }>)[0];
  if (!position) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (!allowedFrom.includes(position.record_status)) {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: `This position cannot be ${to === "frozen" ? "frozen" : "reopened"} from status ${position.record_status}.` });
  }
  await tenantTx(access, [
    sqlClient`update positions set record_status = ${to}, updated_at = now() where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${action}, 'position', ${id}, ${parsed.data.reason},
        ${JSON.stringify({ from: position.record_status, to })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, from: position.record_status, to };
}

export async function freezePosition(access: Access, id: string, reason: string, requestId: string) {
  return transitionPosition(access, id, "frozen", ["active", "filled", "open", ""], "organization.position_freeze", reason, requestId);
}

export async function unfreezePosition(access: Access, id: string, reason: string, requestId: string) {
  return transitionPosition(access, id, "active", ["frozen"], "organization.position_unfreeze", reason, requestId);
}

/** Pure lifecycle mapping shared by the timeline contract (unit-tested). */
export function resolveLifecycleState(status: string | null | undefined, onLeave: boolean): EmployeeTimelineState {
  const normalized = (status ?? "").trim().toLowerCase();
  if (["separated", "exited", "relieved"].includes(normalized)) return "separated";
  if (["archived", "inactive"].includes(normalized)) return "archived";
  if (onLeave) return "on_leave";
  return "active";
}

/** Record detail for the employee-record queue: header, lifecycle timeline and audit trail. */
export async function getEmployeeTimeline(access: Access, id: string) {
  const employee = await getEmployee(access, id);
  // Auxiliary signals degrade independently: a leave or audit failure must never
  // fail the record itself (partial-data contract). Each falls back to unknown.
  let onLeave: boolean | null = null;
  const maySeeLeave = authorize(access.context, {
    action: "leave.read",
    resource: { tenantId: access.tenantId },
  }).allowed;
  if (maySeeLeave) {
    try {
      const [leaveRows] = await tenantTx(access, [
        sqlClient`select 1 from leave_requests where tenant_id = ${access.tenantId} and employee_id = ${id}
          and status = 'approved' and starts_on <= current_date and ends_on >= current_date
          and (actual_return_date is null or actual_return_date > current_date) limit 1`,
      ]);
      onLeave = (leaveRows as unknown[]).length > 0;
    } catch {
      onLeave = null;
    }
  }
  const state = resolveLifecycleState(employee.status ?? "", onLeave === true);
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'employee' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employee_code,
      firstName: employee.first_name,
      lastName: employee.last_name,
      designation: employee.designation,
      department: employee.department,
      location: employee.location,
      status: employee.status,
      joiningDate: employee.joining_date,
      version: employee.version,
    },
    state,
    onLeave,
    auditTrail,
  };
}
