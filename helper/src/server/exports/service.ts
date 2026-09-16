import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { dataScopeAllows } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const createExportSchema = z.object({
  resource: z.enum(["employees", "leave-requests", "payroll-lines", "attendance-days", "loans"]),
  format: z.enum(["csv", "json"]),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  employeeId: z.string().uuid().optional(),
});

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

/**
 * RL-24 for an extract row. The scope is judged on its own, not through `authorize`, because
 * a payroll-only role holds `payroll.read` rather than `employee.read` and would otherwise
 * fail the action check on every line of its own extract.
 */
function inPayrollScope(access: Access, row: Record<string, unknown>): boolean {
  return dataScopeAllows(access.context, {
    attendance_location: typeof row.location === "string" ? row.location : null,
    payroll_location: typeof row.payroll_location === "string" ? row.payroll_location : null,
  }, "compensation");
}

/**
 * The permission an extract of this resource needs. Declared once so the request and the
 * build cannot drift apart - the build is where the data is actually read.
 */
export function enforceExportPermission(access: Access, resource: string): void {
  if (resource === "payroll-lines" || resource === "loans") {
    enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  } else {
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
  }
}

export async function createExport(access: Access, input: z.infer<typeof createExportSchema>, requestId: string) {
  enforceExportPermission(access, input.resource);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into export_jobs (id, tenant_id, requested_by_membership_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId},
        ${JSON.stringify({ resource: input.resource, format: input.format, period: input.period ?? null, employee_id: input.employeeId ?? null, status: "queued" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'ops.export_request', 'export_job', ${id}, 'Export requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "queued" };
}

export async function buildExport(access: Access, exportId: string): Promise<{ rows: number; status: string }> {
  const [jobRows] = await tenantTx(access, [
    sqlClient`select id, requested_by_membership_id, attributes from export_jobs where tenant_id = ${access.tenantId} and id = ${exportId} limit 1`,
  ]);
  const job = (jobRows as Array<{ id: string; requested_by_membership_id: string; attributes: { resource: string; format: string; period?: string; employee_id?: string; status: string } }>)[0];
  if (!job) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // Building is the step that actually reads the data, so it re-runs the permission the
  // request was created under. Looking the job up by tenant alone would otherwise let any
  // member of the tenant build somebody else's queued payroll extract.
  enforceExportPermission(access, job.attributes.resource);
  if (job.requested_by_membership_id !== access.context.membershipId) {
    // Building someone else's request is an administrative act, not an ordinary read.
    enforce(access.context, "audit.read", { tenantId: access.tenantId });
  }
  if (job.attributes.status !== "queued") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Export is ${job.attributes.status}.` });
  }
  let rows: Array<Record<string, unknown>> = [];
  if (job.attributes.resource === "employees") {
    const [employeeRows] = await tenantTx(access, [
      sqlClient`select employee_code, first_name, last_name, work_email, designation, department, location, status, joining_date::text from employees where tenant_id = ${access.tenantId} order by employee_code limit 1000`,
    ]);
    rows = employeeRows as Array<Record<string, unknown>>;
  } else if (job.attributes.resource === "leave-requests") {
    const [leaveRows] = await tenantTx(access, [
      sqlClient`select employee_id, leave_type, starts_on::text, ends_on::text, requested_days::float, status from leave_requests where tenant_id = ${access.tenantId} order by created_at desc limit 1000`,
    ]);
    rows = leaveRows as Array<Record<string, unknown>>;
  } else if (job.attributes.resource === "payroll-lines") {
    const period = job.attributes.period ?? "";
    // RL-24 applies to exports as well as screens. The extract carries the payroll
    // processing location so each line can be judged, and a line whose location is outside
    // the caller's data scope is dropped rather than exported with its amount.
    const [lineRows] = await tenantTx(access, [
      sqlClient`
        select (l.attributes->>'code') as code, (l.attributes->>'kind') as kind,
               (l.attributes->>'amount_minor')::bigint as amount, r.period,
               emp.employee_code, emp.location, coalesce(emp.payroll_owner, emp.location) as payroll_location
        from payroll_lines l join payroll_run_employees e on e.id = l.payroll_run_employee_id
        join payroll_runs r on r.id = e.payroll_run_id
        join employees emp on emp.tenant_id = l.tenant_id and emp.id = e.employee_id
        where l.tenant_id = ${access.tenantId} and (${period} = '' or r.period = ${job.attributes.period})
        order by r.period desc limit 1000
      `,
    ]);
    rows = (lineRows as Array<Record<string, unknown>>).filter((row) => inPayrollScope(access, row));
  } else if (job.attributes.resource === "attendance-days") {
    const [dayRows] = await tenantTx(access, [
      sqlClient`select employee_id, attendance_date::text, assigned_shift, status, productive_minutes from attendance_days where tenant_id = ${access.tenantId} order by attendance_date desc limit 1000`,
    ]);
    rows = dayRows as Array<Record<string, unknown>>;
  } else {
    const [loanRows] = await tenantTx(access, [
      sqlClient`
        select l.employee_id, l.principal_minor, l.outstanding_minor, l.status,
               emp.employee_code, emp.location, coalesce(emp.payroll_owner, emp.location) as payroll_location
        from loans l join employees emp on emp.tenant_id = l.tenant_id and emp.id = l.employee_id
        where l.tenant_id = ${access.tenantId} order by l.created_at desc limit 1000
      `,
    ]);
    rows = (loanRows as Array<Record<string, unknown>>).filter((row) => inPayrollScope(access, row));
  }
  const content = job.attributes.format === "csv" ? toCsv(rows) : JSON.stringify(rows);
  await tenantTx(access, [
    sqlClient`
      update export_jobs set attributes = attributes || ${JSON.stringify({ status: "succeeded", rows: rows.length, bytes: content.length, content: rows.length <= 100 ? content : null })}::jsonb
      where id = ${exportId} and tenant_id = ${access.tenantId}
    `,
  ]);
  return { rows: rows.length, status: "succeeded" };
}

export async function listExports(access: Access) {
  const grants = new Set(access.context.permissions);
  if (!grants.has("employee.read") && !grants.has("payroll.read")) {
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, requested_by_membership_id, attributes, created_at from export_jobs
      where tenant_id = ${access.tenantId} and requested_by_membership_id = ${access.context.membershipId}
      order by created_at desc limit 50
    `,
  ]);
  return rows;
}

export async function getExport(access: Access, exportId: string) {
  const grants = new Set(access.context.permissions);
  if (!grants.has("employee.read") && !grants.has("payroll.read")) {
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select id, requested_by_membership_id, attributes from export_jobs where tenant_id = ${access.tenantId} and id = ${exportId} limit 1`,
  ]);
  const job = (rows as Array<{ id: string; requested_by_membership_id: string; attributes: Record<string, unknown> }>)[0];
  if (!job) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (job.requested_by_membership_id !== access.context.membershipId) {
    enforce(access.context, "audit.read", { tenantId: access.tenantId });
  }
  return job;
}
