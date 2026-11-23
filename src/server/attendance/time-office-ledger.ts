import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { resolveAttendanceScope } from "@/server/attendance/service";

/**
 * Time-office recompute ledger: one row per computed attendance day in the caller's attendance scope, with the
 * minutes the engine stored (gross span, break, gate pass, net, overtime) and the shift it applied. Read only.
 * Every figure is read from `attendance_entries.attributes`; a value that was never recorded is `null`, never 0.
 */

export type LedgerRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  designation: string | null;
  worker_category_code: string | null;
  date: string | null;
  day_type: string | null;
  shift_assigned: string | null;
  shift_applied: string | null;
  shift_inferred: boolean;
  gross_minutes: number | null;
  break_minutes: number | null;
  gate_pass_minutes: number | null;
  net_minutes: number | null;
  ot_minutes: number | null;
  status: string | null;
  status_reason: string | null;
};

/** Pure parser for a stored minute value (unit-tested): only whole, non-negative numbers count. */
export function storedMinutes(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[0-9]{1,5}$/.test(trimmed) ? Number(trimmed) : null;
}

/** Pure check (unit-tested): a shift is inferred when the engine applied a different shift than was assigned. */
export function isShiftInferred(assigned: string | null, applied: string | null): boolean {
  const a = (assigned ?? "").trim().toUpperCase();
  const b = (applied ?? "").trim().toUpperCase();
  return a !== "" && b !== "" && a !== b;
}

type LedgerQueryRow = Omit<LedgerRow, "shift_inferred" | "gross_minutes" | "break_minutes" | "gate_pass_minutes" | "net_minutes" | "ot_minutes"> & {
  gross_minutes: string | null;
  break_minutes: string | null;
  gate_pass_minutes: string | null;
  net_minutes: string | null;
  ot_minutes: string | null;
};

const LEDGER_SELECT = `select a.id,
    a.employee_id,
    e.employee_code,
    nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '') as employee_name,
    nullif(e.designation, '') as designation,
    wc.code as worker_category_code,
    nullif(a.attributes->>'date', '') as date,
    nullif(a.attributes->>'day_type', '') as day_type,
    nullif(a.attributes->>'shift_assigned', '') as shift_assigned,
    coalesce(nullif(a.attributes->>'shift_applied', ''), nullif(sh.attributes->>'code', '')) as shift_applied,
    a.attributes->>'gross_minutes' as gross_minutes,
    a.attributes->>'break_minutes' as break_minutes,
    a.attributes->>'gate_pass_minutes' as gate_pass_minutes,
    a.attributes->>'net_minutes' as net_minutes,
    coalesce(
      (select ot.attributes->>'ot_minutes' from overtime_entries ot
        where ot.tenant_id = a.tenant_id and ot.attendance_entry_id = a.id
        order by ot.created_at desc limit 1),
      a.attributes->>'overtime_minutes', a.attributes->>'ot_minutes') as ot_minutes,
    nullif(a.attributes->>'status', '') as status,
    coalesce(nullif(a.attributes->>'exception_reason', ''), nullif(a.attributes->>'status_reason', '')) as status_reason
  from attendance_entries a
  left join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
  left join shifts sh on sh.tenant_id = a.tenant_id and sh.id = a.shift_id
  left join lateral (
    select wcat.attributes->>'code' as code
    from employments em
    join worker_categories wcat on wcat.tenant_id = em.tenant_id and wcat.id = em.worker_category_id
    where em.tenant_id = a.tenant_id and em.employee_id = a.employee_id
    order by em.created_at desc limit 1
  ) wc on true`;

export function projectLedgerRow(row: LedgerQueryRow): LedgerRow {
  return {
    ...row,
    shift_inferred: isShiftInferred(row.shift_assigned, row.shift_applied),
    gross_minutes: storedMinutes(row.gross_minutes),
    break_minutes: storedMinutes(row.break_minutes),
    gate_pass_minutes: storedMinutes(row.gate_pass_minutes),
    net_minutes: storedMinutes(row.net_minutes) ?? storedMinutes(row.gross_minutes),
    ot_minutes: storedMinutes(row.ot_minutes),
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Ledger rows for the caller's visible employees, newest day first, capped at `limit` (1-200). */
export async function listTimeOfficeLedger(
  access: Access,
  args: { from: string | null; to: string | null; search: string; limit: number },
): Promise<LedgerRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const from = args.from && DATE.test(args.from) ? args.from : null;
  const to = args.to && DATE.test(args.to) ? args.to : null;
  const limit = Math.min(Math.max(Math.trunc(args.limit) || 50, 1), 200);
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${LEDGER_SELECT}
       where a.tenant_id = $1
         and a.employee_id = any($2::uuid[])
         and coalesce(a.attributes->>'date', '') <> ''
         and ($3::text is null or a.attributes->>'date' >= $3::text)
         and ($4::text is null or a.attributes->>'date' <= $4::text)
         and ($5 = '%%' or (coalesce(e.employee_code, '') || ' ' || coalesce(e.first_name, '') || ' '
              || coalesce(e.last_name, '') || ' ' || coalesce(a.attributes->>'status', '')) ilike $5)
       order by a.attributes->>'date' desc, coalesce(e.employee_code, ''), a.created_at desc
       limit $6`,
      [access.tenantId, scope.employeeIds, from, to, like, limit],
    ),
  ]);
  return (rows as LedgerQueryRow[]).map(projectLedgerRow);
}
