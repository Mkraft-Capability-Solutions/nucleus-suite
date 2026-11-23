import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Location-scoped wage register (PayrollView, "Location scoping" tab).
 *
 * Operational fields (shift, payable OT, attended days) come from
 * `attendance_days` for the period; pay fields come from the employee's basic
 * salary and the totals stored on their payslip for that period.
 *
 * Masking is decided here, on the server: pay fields are returned only when the
 * caller is authorised for the `compensation` field (`payroll.rate.read`, see
 * FIELD_PERMISSION in src/server/identity/authorization.ts). Otherwise they are
 * null and `masked` is true, so a plant supervisor's browser never receives a
 * salary it may not see.
 */

export const wageRegisterQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A period must be YYYY-MM."),
  search: z.string().trim().max(80).default(""),
});

export type WageRegisterRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  department: string | null;
  location: string | null;
  category: string | null;
  shift: string | null;
  payableOtMinutes: number;
  attendedDays: number;
  attendanceRecorded: boolean;
  currency: string;
  basicMinor: number | null;
  grossMinor: number | null;
  netMinor: number | null;
  masked: boolean;
};

export type WageRegisterViewer = { roles: string[]; compensationVisible: boolean };

type Row = {
  id: string;
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  designation: string | null;
  department: string | null;
  location: string | null;
  category: string | null;
  currency: string | null;
  basic_salary_minor: number | string | null;
  shift: string | null;
  ot_minutes: number | string | null;
  attended_days: number | string | null;
  day_rows: number | string | null;
  gross_minor: number | string | null;
  net_minor: number | string | null;
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toWageRow(row: Row, compensationVisible: boolean): WageRegisterRow {
  const name = [row.first_name, row.last_name].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ").trim();
  const dayRows = num(row.day_rows) ?? 0;
  return {
    employeeId: row.id,
    employeeCode: row.employee_code,
    name: name || row.employee_code,
    designation: row.designation,
    department: row.department,
    location: row.location,
    category: row.category,
    shift: row.shift,
    payableOtMinutes: Math.trunc(num(row.ot_minutes) ?? 0),
    attendedDays: num(row.attended_days) ?? 0,
    attendanceRecorded: dayRows > 0,
    currency: row.currency ?? "INR",
    basicMinor: compensationVisible ? (num(row.basic_salary_minor) === null ? null : Math.trunc(num(row.basic_salary_minor) ?? 0)) : null,
    grossMinor: compensationVisible ? (num(row.gross_minor) === null ? null : Math.trunc(num(row.gross_minor) ?? 0)) : null,
    netMinor: compensationVisible ? (num(row.net_minor) === null ? null : Math.trunc(num(row.net_minor) ?? 0)) : null,
    masked: !compensationVisible,
  };
}

export async function listWageRegister(
  access: Access,
  args: z.infer<typeof wageRegisterQuerySchema> & { page: number; pageSize: number },
): Promise<{ items: WageRegisterRow[]; total: number; viewer: WageRegisterViewer; period: string }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const compensationVisible = authorize(access.context, {
    action: "employee.read",
    resource: { tenantId: access.tenantId },
    requestedFields: ["compensation"],
  }).allowed;
  const from = `${args.period}-01`;
  const search = args.search ? `%${args.search.replace(/[%_]/g, "")}%` : null;
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from employees e
      where e.tenant_id = ${access.tenantId} and e.status <> 'separated'
        and (${search}::text is null or (e.first_name || ' ' || e.last_name || ' ' || e.employee_code) ilike ${search}::text)
    `,
    sqlClient`
      select e.id, e.employee_code, e.first_name, e.last_name, e.designation, e.department, e.location, e.category, e.currency,
             e.basic_salary_minor,
             att.shift, att.ot_minutes, att.attended_days, att.day_rows,
             slip.gross_minor, slip.net_minor
      from employees e
      left join lateral (
        select mode() within group (order by d.assigned_shift) as shift,
               coalesce(sum(d.payable_ot_minutes), 0) as ot_minutes,
               coalesce(sum(case d.status when 'present' then 1 when 'half_day' then 0.5 else 0 end), 0) as attended_days,
               count(*) as day_rows
        from attendance_days d
        where d.tenant_id = e.tenant_id and d.employee_id = e.id
          and d.attendance_date >= ${from}::date and d.attendance_date < (${from}::date + interval '1 month')
      ) att on true
      left join lateral (
        select (p.attributes->'totals'->>'gross_minor') as gross_minor, (p.attributes->'totals'->>'net_minor') as net_minor
        from payslips p
        join payroll_run_employees m on m.tenant_id = p.tenant_id and m.id = p.payroll_run_employee_id
        join payroll_runs r on r.tenant_id = p.tenant_id and r.id = m.payroll_run_id
        where p.tenant_id = e.tenant_id and m.employee_id = e.id and r.period = ${args.period} and r.scope = 'regular'
        order by p.created_at desc limit 1
      ) slip on true
      where e.tenant_id = ${access.tenantId} and e.status <> 'separated'
        and (${search}::text is null or (e.first_name || ' ' || e.last_name || ' ' || e.employee_code) ilike ${search}::text)
      order by e.employee_code, e.id
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return {
    items: (rows as Row[]).map((row) => toWageRow(row, compensationVisible)),
    total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0),
    viewer: { roles: [...access.context.roles], compensationVisible },
    period: args.period,
  };
}
