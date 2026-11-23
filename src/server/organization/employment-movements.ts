import "server-only";

import { sqlClient } from "@/lib/db";
import {
  CAREER_TYPE_FOR_MOVEMENT, movementIssues, rootCompanyOf, withTenure,
  type CreateMovementInput, type EmploymentMovementType, type MovementList, type MovementRecord,
} from "@/lib/employment-movements";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Intra-group employment movements (employment_movement_logs, db/migrations/0039).
 *
 * Recording needs employee.write; reading needs employee.read. One transaction writes the
 * append-only log row, the audit event and the idempotency key. A movement effective today or
 * earlier also updates the employee record (company, designation, department, currency) and the
 * career history (employee_job_history); a later date enqueues the scheduled task
 * 'people.apply_movement', which applies it on the effective date.
 */

export const MOVEMENT_TASK = "people.apply_movement";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED_STATUSES = ["separated", "exited", "relieved", "archived", "inactive"];

type EmployeeRow = {
  id: string; name: string; legal_entity_id: string | null; designation: string | null; department: string | null; currency: string | null;
  status: string | null; joining_date: string | null; today: string; timezone: string;
};
type CompanyRow = { id: string; legal_name: string; code: string | null; industry: string | null; parent_legal_entity_id: string | null; status: string; currency_code: string };

async function loadEmployee(access: Access, idOrCode: string): Promise<EmployeeRow> {
  const byId = UUID.test(idOrCode);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, e.legal_entity_id, e.designation, e.department, e.currency, e.status,
        to_char(e.joining_date, 'YYYY-MM-DD') as joining_date,
        coalesce((select s.timezone from tenant_settings s where s.tenant_id = e.tenant_id limit 1), 'Asia/Kolkata') as timezone,
        to_char((now() at time zone coalesce((select s.timezone from tenant_settings s where s.tenant_id = e.tenant_id limit 1), 'Asia/Kolkata'))::date, 'YYYY-MM-DD') as today
      from employees e
      where e.tenant_id = ${access.tenantId} and (${byId ? idOrCode : null}::uuid = e.id or e.employee_code = ${idOrCode})
      limit 1`,
  ]);
  const employee = (rows as EmployeeRow[])[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This employee is not in the organisation's records." });
  return employee;
}

async function loadCompanies(access: Access): Promise<CompanyRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, legal_name, code, industry, parent_legal_entity_id, status, currency_code from legal_entities where tenant_id = ${access.tenantId}`,
  ]);
  return rows as CompanyRow[];
}

function invalid(details: Array<{ field: string; issue: string }>): never {
  throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: details[0]?.issue ?? "Check the highlighted fields.", details });
}

export type Idempotency = { operation: string; key: string; fingerprint: string };

/** Statements that make the movement the employee's current position. */
function applyStatements(access: Access, args: {
  movementId: string; employeeId: string; movementType: EmploymentMovementType; effectiveDate: string;
  company: CompanyRow; designation: string | null; department: string | null; currency: string | null; remarks: string | null;
}) {
  return [
    sqlClient`select set_config('app.job_history_recorded', 'on', true)`,
    sqlClient`
      update employees set legal_entity_id = ${args.company.id}, designation = coalesce(${args.designation}, designation),
        department = coalesce(${args.department}, department), currency = coalesce(${args.currency}, currency), updated_at = clock_timestamp()
      where tenant_id = ${access.tenantId} and id = ${args.employeeId}`,
    sqlClient`
      insert into employee_job_history (tenant_id, employee_id, movement_type, effective_from, legal_entity_id, legal_entity_name, location,
        department, designation, grade, category, manager_employee_id, manager_name, reason, source, recorded_by_membership_id, recorded_by_user_id)
      select e.tenant_id, e.id, ${CAREER_TYPE_FOR_MOVEMENT[args.movementType]}, ${args.effectiveDate}::date, ${args.company.id}, ${args.company.legal_name},
        e.location, e.department, e.designation,
        (select h.grade from employee_job_history h where h.tenant_id = e.tenant_id and h.employee_id = e.id
           order by h.effective_from desc, h.recorded_at desc limit 1),
        e.category, e.manager_employee_id,
        (select nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), '') from employees m where m.tenant_id = e.tenant_id and m.id = e.manager_employee_id),
        ${args.remarks ?? "Employment movement"}, 'move', ${access.context.membershipId}, ${access.context.actorUserId}
      from employees e where e.tenant_id = ${access.tenantId} and e.id = ${args.employeeId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'people.movement_applied', 'employment_movement',
        ${args.movementId}, ${args.remarks}, ${JSON.stringify({ employeeId: args.employeeId, companyId: args.company.id, designation: args.designation, department: args.department, currency: args.currency })}::jsonb)`,
  ];
}

export async function createMovement(access: Access, idOrCode: string, input: CreateMovementInput, requestId: string, idem: Idempotency) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const employee = await loadEmployee(access, idOrCode);
  if (CLOSED_STATUSES.includes((employee.status ?? "active").toLowerCase())) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee has left the group; movements can no longer be recorded." });
  }
  const companies = await loadCompanies(access);
  const byId = new Map(companies.map((company) => [company.id, company]));
  const to = byId.get(input.toCompanyId);
  if (!to) invalid([{ field: "toCompanyId", issue: "The company is not part of this organisation's group structure." }]);
  if (to.status !== "active") invalid([{ field: "toCompanyId", issue: "The company is not active." }]);

  const [hireRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as n from employment_movement_logs where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and movement_type = 'HIRE'`,
  ]);
  if (input.approvedBy) {
    const [approver] = await tenantTx(access, [
      sqlClient`select 1 from memberships where tenant_id = ${access.tenantId} and id = ${input.approvedBy} and status = 'active'`,
    ]);
    if ((approver as unknown[]).length === 0) invalid([{ field: "approvedBy", issue: "The approver is not an active member of this organisation." }]);
  }
  const current = { companyId: employee.legal_entity_id, designation: employee.designation, department: employee.department, currency: employee.currency };
  const issues = movementIssues(input, current, { hasHire: Number((hireRows as Array<{ n: number }>)[0]?.n ?? 0) > 0, today: employee.today, joiningDate: employee.joining_date });
  if (issues.length) invalid(issues);

  const toDesignation = input.toDesignation === undefined ? employee.designation : input.toDesignation;
  const toDepartment = input.toDepartment === undefined ? employee.department : input.toDepartment;
  const toCurrency = input.toCurrency ?? (input.toCompanyId !== employee.legal_entity_id ? to.currency_code : employee.currency);
  const root = rootCompanyOf(to.id, new Map(companies.map((company) => [company.id, company.parent_legal_entity_id])));
  const movementId = crypto.randomUUID();
  const applyNow = input.effectiveDate <= employee.today;
  const remarks = input.remarks ?? null;

  await tenantTx(access, [
    sqlClient`
      insert into employment_movement_logs (id, tenant_id, root_group_id, employee_id, movement_type, from_company_id, to_company_id,
        from_designation, to_designation, from_department, to_department, from_currency, to_currency, effective_date, remarks,
        approved_by, created_by, created_by_user_id)
      values (${movementId}, ${access.tenantId}, ${root}, ${employee.id}, ${input.movementType}, ${employee.legal_entity_id}, ${to.id},
        ${employee.designation}, ${toDesignation}, ${employee.department}, ${toDepartment}, ${employee.currency}, ${toCurrency},
        ${input.effectiveDate}::date, ${remarks}, ${input.approvedBy ?? null}, ${access.context.membershipId}, ${access.context.actorUserId})`,
    ...(applyNow
      ? applyStatements(access, { movementId, employeeId: employee.id, movementType: input.movementType, effectiveDate: input.effectiveDate, company: to, designation: toDesignation, department: toDepartment, currency: toCurrency, remarks })
      : [sqlClient`
          insert into scheduled_tasks (tenant_id, task_type, payload, available_at)
          values (${access.tenantId}, ${MOVEMENT_TASK}, ${JSON.stringify({ movementId })}::jsonb,
            (${input.effectiveDate}::date::timestamp at time zone ${employee.timezone}))`]),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'people.movement_recorded', 'employee', ${employee.id},
        ${remarks}, ${JSON.stringify({ movementId, ...input, scheduled: !applyNow })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
    sqlClient`
      insert into idempotency_keys (tenant_id, membership_id, operation, idempotency_key, request_hash, response_status, response_locator, expires_at)
      values (${access.tenantId}, ${access.context.membershipId}, ${idem.operation}, ${idem.key}, ${idem.fingerprint}, 201, ${movementId}, now() + interval '24 hours')`,
  ]);
  return { id: movementId, employeeId: employee.id, status: applyNow ? "applied" as const : "scheduled" as const, effectiveDate: input.effectiveDate };
}

/** Scheduled-task handler: applies a future-dated movement on its effective date. Safe to run twice. */
export async function applyScheduledMovement(access: Access, payload: Record<string, unknown>): Promise<{ applied: boolean }> {
  const movementId = typeof payload.movementId === "string" && UUID.test(payload.movementId) ? payload.movementId : null;
  if (!movementId) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The movement task has no valid movementId." });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select l.id, l.employee_id, l.movement_type, to_char(l.effective_date, 'YYYY-MM-DD') as effective_date, l.to_designation, l.to_department,
        l.to_currency, l.remarks, le.id as company_id, le.legal_name, le.code, le.industry, le.parent_legal_entity_id, le.status, le.currency_code,
        exists (select 1 from audit_events a where a.tenant_id = l.tenant_id and a.entity_type = 'employment_movement' and a.entity_id = l.id::text
          and a.action = 'people.movement_applied') as already_applied
      from employment_movement_logs l join legal_entities le on le.tenant_id = l.tenant_id and le.id = l.to_company_id
      where l.tenant_id = ${access.tenantId} and l.id = ${movementId}`,
  ]);
  const row = (rows as Array<{
    id: string; employee_id: string; movement_type: EmploymentMovementType; effective_date: string; to_designation: string | null; to_department: string | null;
    to_currency: string | null; remarks: string | null; company_id: string; legal_name: string; code: string | null; industry: string | null;
    parent_legal_entity_id: string | null; status: string; currency_code: string; already_applied: boolean;
  }>)[0];
  if (!row) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The scheduled movement no longer exists." });
  if (row.already_applied) return { applied: false };
  await tenantTx(access, applyStatements(access, {
    movementId: row.id, employeeId: row.employee_id, movementType: row.movement_type, effectiveDate: row.effective_date,
    company: { id: row.company_id, legal_name: row.legal_name, code: row.code, industry: row.industry, parent_legal_entity_id: row.parent_legal_entity_id, status: row.status, currency_code: row.currency_code },
    designation: row.to_designation, department: row.to_department, currency: row.to_currency, remarks: row.remarks,
  }));
  return { applied: true };
}

type RawMovement = {
  id: string; movement_type: EmploymentMovementType; effective_date: string; root_group_id: string | null;
  from_company_id: string | null; from_name: string | null; from_code: string | null; from_industry: string | null;
  to_company_id: string; to_name: string; to_code: string | null; to_industry: string | null;
  from_designation: string | null; to_designation: string | null; from_department: string | null; to_department: string | null;
  from_currency: string | null; to_currency: string | null; remarks: string | null; approved_by: string | null; created_by: string | null; created_at: string;
};

export async function listMovements(access: Access, idOrCode: string, opts: { page: number; pageSize: number; order: "asc" | "desc" }): Promise<MovementList> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employee = await loadEmployee(access, idOrCode);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select l.id, l.movement_type, to_char(l.effective_date, 'YYYY-MM-DD') as effective_date, l.root_group_id,
        l.from_company_id, f.legal_name as from_name, f.code as from_code, f.industry as from_industry,
        l.to_company_id, t.legal_name as to_name, t.code as to_code, t.industry as to_industry,
        l.from_designation, l.to_designation, l.from_department, l.to_department, l.from_currency, l.to_currency, l.remarks,
        (select u.name from memberships m join "user" u on u.id = m.user_id where m.tenant_id = l.tenant_id and m.id = l.approved_by) as approved_by,
        (select u.name from "user" u where u.id = l.created_by_user_id) as created_by,
        l.created_at::text as created_at
      from employment_movement_logs l
      join legal_entities t on t.tenant_id = l.tenant_id and t.id = l.to_company_id
      left join legal_entities f on f.tenant_id = l.tenant_id and f.id = l.from_company_id
      where l.tenant_id = ${access.tenantId} and l.employee_id = ${employee.id}
      order by l.effective_date, l.created_at
      limit 1000`,
  ]);
  const records = withTenure((rows as RawMovement[]).map((row): Omit<MovementRecord, "status" | "tenureDays" | "industryChanged" | "designationChanged"> => ({
    id: row.id, movementType: row.movement_type, effectiveDate: row.effective_date, rootGroupId: row.root_group_id,
    fromCompany: row.from_company_id ? { id: row.from_company_id, name: row.from_name ?? "", code: row.from_code, industry: row.from_industry } : null,
    toCompany: { id: row.to_company_id, name: row.to_name, code: row.to_code, industry: row.to_industry },
    fromDesignation: row.from_designation, toDesignation: row.to_designation, fromDepartment: row.from_department, toDepartment: row.to_department,
    fromCurrency: row.from_currency, toCurrency: row.to_currency, remarks: row.remarks, approvedBy: row.approved_by, createdBy: row.created_by, createdAt: row.created_at,
  })), employee.today);
  const ordered = opts.order === "desc" ? [...records].reverse() : records;
  const start = (opts.page - 1) * opts.pageSize;
  return {
    employee: { id: employee.id, name: employee.name, companyId: employee.legal_entity_id, designation: employee.designation, department: employee.department, currency: employee.currency, joiningDate: employee.joining_date },
    hasHire: records.some((record) => record.movementType === "HIRE"),
    items: ordered.slice(start, start + opts.pageSize), total: records.length, page: opts.page, pageSize: opts.pageSize, today: employee.today,
    canRecord: authorize(access.context, { action: "employee.write", resource: { tenantId: access.tenantId } }).allowed,
  };
}
