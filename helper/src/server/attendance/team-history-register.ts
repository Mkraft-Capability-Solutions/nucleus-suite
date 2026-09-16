import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { resolveAttendanceScope } from "@/server/attendance/service";

export type TeamHistoryState = "ready" | "scheduled" | "expired";

/**
 * How long a history range stays offered as "ready" on the screen.
 *
 * This is a PRESENTATION rule only — it hides nothing and deletes nothing. A
 * range whose last day is more than 90 days behind today is marked `expired` so
 * the operator knows the extract is outside the window the team normally works
 * with; the rows are still returned and still counted from real data.
 */
export const HISTORY_READY_WINDOW_DAYS = 90;

/** Pure range state for one history extract (unit-tested). */
export function deriveHistoryState(from: string, to: string, today = new Date().toISOString().slice(0, 10)): TeamHistoryState {
  const start = (from ?? "").slice(0, 10);
  const end = (to ?? "").slice(0, 10);
  const now = (today ?? "").slice(0, 10);
  if (start > now) return "scheduled";
  const expiryBoundary = new Date(`${now}T00:00:00Z`);
  expiryBoundary.setUTCDate(expiryBoundary.getUTCDate() - HISTORY_READY_WINDOW_DAYS);
  if (end < expiryBoundary.toISOString().slice(0, 10)) return "expired";
  return "ready";
}

/** Pure `H:MM` rendering of a minute total (unit-tested). */
export function overtimeLabel(minutes: number | null | undefined): string {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return "0:00";
  const whole = Math.round(total);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Pure range resolution (unit-tested): the caller's dates when both are valid
 * ISO dates, otherwise the last 30 days ending today.
 */
export function historyRange(
  from: string | null | undefined,
  to: string | null | undefined,
  today = new Date().toISOString().slice(0, 10),
): { from: string; to: string } {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const end = iso.test((to ?? "").trim()) ? (to as string).trim() : today.slice(0, 10);
  if (iso.test((from ?? "").trim())) {
    const start = (from as string).trim();
    return start <= end ? { from: start, to: end } : { from: end, to: start };
  }
  const start = new Date(`${end}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: end };
}

export type TeamHistoryRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  present_days: number;
  absent_days: number;
  weekly_off_days: number;
  leave_days: number;
  overtime_minutes: number;
  overtime_label: string;
  gate_pass_minutes: number;
  status: TeamHistoryState;
};

type TeamHistoryQueryRow = Omit<TeamHistoryRow, "overtime_label" | "status">;

/**
 * Every figure is counted from a real row and nothing else:
 *  - present / absent / weekly-off days come from `attendance_entries` in the
 *    range (the imported day type carries "Working" / "Weekly Off");
 *  - leave days are the days of a `leave_requests` range that actually fall
 *    inside the window, excluding requests the approver turned down;
 *  - overtime minutes are the `ot_minutes` of `overtime_entries` dated in range;
 *  - gate-pass minutes are the minutes of approved `gate_passes` dated in range.
 * An employee with no rows scores zero — never an estimate.
 */
const HISTORY_SELECT = `select emp.id,
    emp.id as employee_id,
    emp.employee_code,
    nullif(trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')), '') as employee_name,
    emp.department,
    (select count(*) from attendance_entries a
      where a.tenant_id = emp.tenant_id and a.employee_id = emp.id
        and a.attributes->>'date' between $2::text and $3::text
        and lower(coalesce(a.attributes->>'day_type', '')) = 'working'
        and lower(coalesce(a.attributes->>'status', '')) in ('present', 'locked'))::int as present_days,
    (select count(*) from attendance_entries a
      where a.tenant_id = emp.tenant_id and a.employee_id = emp.id
        and a.attributes->>'date' between $2::text and $3::text
        and lower(coalesce(a.attributes->>'status', '')) = 'absent')::int as absent_days,
    (select count(*) from attendance_entries a
      where a.tenant_id = emp.tenant_id and a.employee_id = emp.id
        and a.attributes->>'date' between $2::text and $3::text
        and replace(lower(coalesce(a.attributes->>'day_type', '')), ' ', '_') = 'weekly_off')::int as weekly_off_days,
    (select coalesce(sum((least(l.ends_on, $3::date) - greatest(l.starts_on, $2::date)) + 1), 0)::int
      from leave_requests l
      where l.tenant_id = emp.tenant_id and l.employee_id = emp.id
        and lower(coalesce(l.status, '')) not in ('rejected', 'cancelled', 'canceled', 'withdrawn')
        and l.starts_on <= $3::date and l.ends_on >= $2::date) as leave_days,
    (select coalesce(sum(case when coalesce(o.attributes->>'ot_minutes', '') ~ '^[0-9]+$'
                              then (o.attributes->>'ot_minutes')::int else 0 end), 0)::int
      from overtime_entries o
      where o.tenant_id = emp.tenant_id and o.employee_id = emp.id
        and o.attributes->>'ot_date' between $2::text and $3::text) as overtime_minutes,
    (select coalesce(sum(case when coalesce(g.attributes->>'minutes', '') ~ '^[0-9]+$'
                              then (g.attributes->>'minutes')::int else 0 end), 0)::int
      from gate_passes g
      where g.tenant_id = emp.tenant_id and g.employee_id = emp.id
        and lower(coalesce(g.attributes->>'status', '')) = 'approved'
        and g.attributes->>'pass_date' between $2::text and $3::text) as gate_pass_minutes
  from employees emp`;

function projectHistory(row: TeamHistoryQueryRow, range: { from: string; to: string }): TeamHistoryRow {
  return {
    ...row,
    overtime_label: overtimeLabel(row.overtime_minutes),
    status: deriveHistoryState(range.from, range.to),
  };
}

/** SCR-027 register: one aggregated row per employee in the caller's scope. */
export async function listTeamHistory(
  access: Access,
  args: { from: string; to: string; search: string },
): Promise<TeamHistoryRow[]> {
  const scope = await resolveAttendanceScope(access);
  const range = historyRange(args.from, args.to);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${(args.search ?? "").replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${HISTORY_SELECT}
       where emp.tenant_id = $1 and emp.id = any($4::uuid[])
         and ($5 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(emp.department, '')) ilike $5)
       order by emp.employee_code asc
       limit 200`,
      [access.tenantId, range.from, range.to, scope.employeeIds, like],
    ),
  ]);
  return (rows as TeamHistoryQueryRow[]).map((row) => projectHistory(row, range));
}

/** One employee's aggregate plus the per-day rows the aggregate was counted from. */
/**
 * One day row of the drill-down, named rather than left as a bag. The screen and the
 * export read the same object, so the fields they rely on are stated here instead of
 * being reachable only through an index signature.
 */
export type TeamHistoryDay = {
  id: string;
  date: string | null;
  day: string | null;
  day_type: string | null;
  status: string | null;
  shift_applied: string | null;
  first_in: string | null;
  last_out: string | null;
  gross_minutes: string | null;
  break_minutes: string | null;
  gate_pass_minutes: string | null;
  overtime_minutes: number;
  overtime_label: string;
};

export async function getTeamHistoryRecord(access: Access, employeeId: string, args: { from: string; to: string }) {
  const scope = await resolveAttendanceScope(access);
  const range = historyRange(args.from, args.to);
  if (!scope.employeeIds.includes(employeeId)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${HISTORY_SELECT} where emp.tenant_id = $1 and emp.id = $4::uuid limit 1`, [
      access.tenantId,
      range.from,
      range.to,
      employeeId,
    ]),
  ]);
  const found = (rows as TeamHistoryQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  const [dayRows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.attributes->>'date' as date, a.attributes->>'day' as day,
             a.attributes->>'day_type' as day_type, a.attributes->>'status' as status,
             a.attributes->>'shift_applied' as shift_applied,
             a.attributes->>'first_in' as first_in, a.attributes->>'last_out' as last_out,
             a.attributes->>'gross_minutes' as gross_minutes, a.attributes->>'break_minutes' as break_minutes,
             a.attributes->>'gate_pass_minutes' as gate_pass_minutes,
             (select coalesce(sum(case when coalesce(o.attributes->>'ot_minutes', '') ~ '^[0-9]+$'
                                       then (o.attributes->>'ot_minutes')::int else 0 end), 0)::int
                from overtime_entries o
                where o.tenant_id = a.tenant_id and o.employee_id = a.employee_id
                  and o.attributes->>'ot_date' = a.attributes->>'date') as overtime_minutes
      from attendance_entries a
      where a.tenant_id = ${access.tenantId} and a.employee_id = ${employeeId}
        and a.attributes->>'date' between ${range.from} and ${range.to}
      order by a.attributes->>'date' asc
      limit 200
    `,
  ]);

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'employee' and entity_id = ${employeeId}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  const days: TeamHistoryDay[] = (dayRows as Array<Record<string, unknown>>).map((day) => ({
    ...(day as Omit<TeamHistoryDay, "overtime_label">),
    overtime_label: overtimeLabel(Number(day.overtime_minutes)),
  }));

  return { record: projectHistory(found, range), days, auditTrail, range };
}
