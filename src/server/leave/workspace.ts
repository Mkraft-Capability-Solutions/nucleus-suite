import "server-only";

import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Read models the Leave workspace needs around the caller: who they are as an
 * employee, which leave actions their role holds, the employees they may act
 * for, the tenant holiday list and the recent leave activity they may see.
 */

/** True when the caller's role holds the permission (never throws). */
export function can(access: Access, permission: string): boolean {
  return authorize(access.context, { action: permission, resource: { tenantId: access.tenantId } }).allowed;
}

/** HR maintainers and approvers may act for other employees; everyone else only for themselves. */
export function actsForOthers(access: Access): boolean {
  return can(access, "leave.maintain") || can(access, "leave.approve");
}

export type LeaveEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  department: string | null;
  designationLevel: number;
  hasBirthDate: boolean;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  department: string | null;
  designation_level: number | null;
  has_birth_date: boolean;
};

function toEmployee(row: EmployeeRow): LeaveEmployee {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    name: row.name,
    department: row.department,
    designationLevel: Number(row.designation_level) || 0,
    hasBirthDate: Boolean(row.has_birth_date),
  };
}

const EMPLOYEE_COLUMNS = `e.id, e.employee_code,
  trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name,
  e.department, e.designation_level, (e.date_of_birth is not null) as has_birth_date`;

/**
 * Resolves an employee by uuid or employee code inside the tenant. Unlike the
 * legacy profile lookup there is no "oldest employee" fallback: an unknown
 * reference is a 404, never someone else's record.
 */
export async function resolveEmployee(access: Access, reference: string): Promise<LeaveEmployee> {
  const trimmed = reference.trim();
  if (trimmed === "") throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An employee is required." });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ${EMPLOYEE_COLUMNS} from employees e
        where e.tenant_id = $1 and (e.id::text = $2 or e.employee_code = $2) limit 1`,
      [access.tenantId, trimmed],
    ),
  ]);
  const found = (rows as EmployeeRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The employee was not found." });
  return toEmployee(found);
}

/** Rejects acting for another employee unless the role maintains or approves leave. */
export function assertMayActFor(access: Access, employeeId: string): void {
  if (access.context.employeeId && access.context.employeeId === employeeId) return;
  if (actsForOthers(access)) return;
  throw new HttpError({ status: 403, code: "FORBIDDEN", message: "You can only manage your own leave." });
}

export type LeaveContext = {
  employee: LeaveEmployee | null;
  canApprove: boolean;
  canMaintain: boolean;
  actsForOthers: boolean;
};

/** The caller as a leave participant. `employee` is null when the login is not linked to an employee. */
export async function getLeaveContext(access: Access): Promise<LeaveContext> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const ownId = access.context.employeeId ?? null;
  let employee: LeaveEmployee | null = null;
  if (ownId) {
    try {
      employee = await resolveEmployee(access, ownId);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
      employee = null;
    }
  }
  return {
    employee,
    canApprove: can(access, "leave.approve"),
    canMaintain: can(access, "leave.maintain"),
    actsForOthers: actsForOthers(access),
  };
}

/** Employees the caller may apply or adjust leave for: the tenant for HR/approvers, otherwise only themselves. */
export async function searchLeaveEmployees(access: Access, search: string): Promise<LeaveEmployee[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (!actsForOthers(access)) {
    const ownId = access.context.employeeId;
    if (!ownId) return [];
    try {
      return [await resolveEmployee(access, ownId)];
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return [];
      throw error;
    }
  }
  const like = `%${search.replace(/[%_]/g, "").trim().slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ${EMPLOYEE_COLUMNS} from employees e
        where e.tenant_id = $1 and coalesce(e.status, 'active') = 'active'
          and ($2 = '%%' or (e.employee_code || ' ' || e.first_name || ' ' || e.last_name) ilike $2)
        order by e.first_name asc, e.last_name asc, e.employee_code asc
        limit 50`,
      [access.tenantId, like],
    ),
  ]);
  return (rows as EmployeeRow[]).map(toEmployee);
}

export type LeaveHoliday = { date: string; name: string; applicableLocations: string };

/** Active holidays of the tenant for one calendar year, from the holiday calendars. */
export async function listLeaveHolidays(access: Access, year: number): Promise<LeaveHoliday[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid year is required." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select h.attributes->>'holiday_date' as date,
          coalesce(h.attributes->>'name', '') as name,
          coalesce(h.attributes->>'applicable_locations', 'ALL') as "applicableLocations"
        from holidays h
        where h.tenant_id = $1 and h.record_status = 'active'
          and h.attributes->>'holiday_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
          and left(h.attributes->>'holiday_date', 4) = $2
        order by 1 asc
        limit 400`,
      [access.tenantId, String(year)],
    ),
  ]);
  return rows as LeaveHoliday[];
}

export type LeaveActivity = {
  id: string;
  action: string;
  entityId: string;
  reason: string | null;
  createdAt: string;
  employeeName: string | null;
};

/**
 * Recent leave audit events. Approvers and HR see the tenant's; everyone else
 * sees only events on their own leave requests.
 */
export async function listLeaveActivity(access: Access): Promise<LeaveActivity[]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const ownOnly = !actsForOthers(access);
  if (ownOnly && !access.context.employeeId) return [];
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select a.id::text as id, a.action, a.entity_id::text as "entityId", a.reason,
          a.created_at::text as "createdAt",
          case when emp.id is null then null
               else trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')) end as "employeeName"
        from audit_events a
        left join leave_requests r on r.tenant_id = a.tenant_id and r.id::text = a.entity_id::text
        left join employees emp on emp.tenant_id = r.tenant_id and emp.id = r.employee_id
        where a.tenant_id = $1 and a.entity_type = 'leave_request'
          and ($2::boolean = false or r.employee_id::text = $3)
        order by a.created_at desc
        limit 30`,
      [access.tenantId, ownOnly, access.context.employeeId ?? ""],
    ),
  ]);
  return rows as LeaveActivity[];
}

/** Placeholder that matches no employee, for a login with no linked employee record. */
const NO_EMPLOYEE = "00000000-0000-0000-0000-000000000000";

/**
 * Row scope for tenant-wide leave read models: null (whole tenant) for HR and
 * approvers, otherwise only the caller's own employee id.
 */
export function ownScope(access: Access): string | null {
  if (actsForOthers(access)) return null;
  return access.context.employeeId || NO_EMPLOYEE;
}
