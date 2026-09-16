import "server-only";

import { sqlClient } from "@/lib/db";
import { DEFAULT_BREAK_TYPES, loadAttendancePolicy } from "@/server/attendance/attendance-policy";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * RP-01 break register (F-ATT-03).
 *
 * RL-03 makes every gap between an OUT and the following IN inside a session a
 * break, "written to the break register with its start, end and duration". The rows
 * are the `attendance_breaks` records the engine writes when it computes a day, so
 * nothing here re-derives anything — the register reports what was computed.
 */
export type BreakRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  department: string | null;
  attendance_date: string | null;
  shift_code: string | null;
  break_seq: number;
  break_start_time: string | null;
  break_end_time: string | null;
  break_minutes: number;
  break_label: string;
  break_type: string;
  deducted: boolean;
};

type BreakQueryRow = Omit<BreakRow, "break_label">;

/** Durations print as H:MM like every other attendance figure, never as a decimal. */
export function breakLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.trunc(minutes);
  return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const BREAK_SELECT = `select b.id,
    s.employee_id,
    emp.employee_code,
    nullif(trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')), '') as employee_name,
    emp.department,
    coalesce(nullif(b.attributes->>'attendance_date', ''), nullif(s.attributes->>'session_date', '')) as attendance_date,
    nullif(s.attributes->>'shift_code', '') as shift_code,
    coalesce(case when b.attributes->>'break_seq' ~ '^[0-9]+$' then (b.attributes->>'break_seq')::int end, 1) as break_seq,
    coalesce(nullif(b.attributes->>'break_start_time', ''), nullif(b.attributes->>'start_time', '')) as break_start_time,
    coalesce(nullif(b.attributes->>'break_end_time', ''), nullif(b.attributes->>'end_time', '')) as break_end_time,
    coalesce(
      case when b.attributes->>'break_minutes' ~ '^[0-9]+$' then (b.attributes->>'break_minutes')::int end,
      case when b.attributes->>'duration_minutes' ~ '^[0-9]+$' then (b.attributes->>'duration_minutes')::int end,
      0) as break_minutes,
    coalesce(nullif(b.attributes->>'break_type', ''), 'Unclassified') as break_type,
    coalesce((b.attributes->>'deducted')::bool, false) as deducted
  from attendance_breaks b
  join attendance_sessions s on s.tenant_id = b.tenant_id and s.id = b.attendance_session_id
  left join employees emp on emp.tenant_id = s.tenant_id and emp.id = s.employee_id`;

function project(rows: BreakQueryRow[]): BreakRow[] {
  return rows.map((row) => ({ ...row, break_label: breakLabel(row.break_minutes) }));
}

export async function listBreakRegister(
  access: Access,
  args: { employeeId: string | null; from: string | null; to: string | null; breakType: string | null; search: string },
): Promise<BreakRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const employeeId = args.employeeId && args.employeeId.trim() !== "" ? args.employeeId.trim() : null;
  if (employeeId) await assertAttendanceEmployeeVisible(access, employeeId);
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${BREAK_SELECT}
       where b.tenant_id = $1
         and s.employee_id = any($2::uuid[])
         and ($3::uuid is null or s.employee_id = $3::uuid)
         and ($4::text is null or coalesce(b.attributes->>'attendance_date', s.attributes->>'session_date', '') >= $4::text)
         and ($5::text is null or coalesce(b.attributes->>'attendance_date', s.attributes->>'session_date', '') <= $5::text)
         and ($6::text is null or coalesce(b.attributes->>'break_type', 'Unclassified') = $6::text)
         and ($7 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(emp.department, '') || ' '
              || coalesce(b.attributes->>'break_type', '')) ilike $7)
       order by coalesce(b.attributes->>'attendance_date', s.attributes->>'session_date', '') desc,
         coalesce(emp.employee_code, ''),
         coalesce(case when b.attributes->>'break_seq' ~ '^[0-9]+$' then (b.attributes->>'break_seq')::int end, 1)
       limit 300`,
      [
        access.tenantId,
        scope.employeeIds,
        employeeId,
        args.from && args.from.trim() !== "" ? args.from.trim() : null,
        args.to && args.to.trim() !== "" ? args.to.trim() : null,
        args.breakType && args.breakType.trim() !== "" ? args.breakType.trim() : null,
        like,
      ],
    ),
  ]);
  return project(rows as BreakQueryRow[]);
}

/** One break with the session it was taken inside, for the register's detail pane. */
export async function getBreakRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${BREAK_SELECT} where b.tenant_id = $1 and b.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as BreakQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, found.employee_id);
  const record = project([found])[0];
  const [sessionRows] = await tenantTx(access, [
    sqlClient.query(
      `select s.id, s.attributes->>'session_date' as session_date, s.attributes->>'first_in' as first_in,
          s.attributes->>'last_out' as last_out, s.attributes->>'shift_code' as shift_code,
          case when s.attributes->>'duration_minutes' ~ '^[0-9]+$' then (s.attributes->>'duration_minutes')::int end as gross_minutes,
          case when s.attributes->>'break_minutes' ~ '^[0-9]+$' then (s.attributes->>'break_minutes')::int end as break_minutes,
          case when s.attributes->>'net_minutes' ~ '^[0-9]+$' then (s.attributes->>'net_minutes')::int end as net_minutes
        from attendance_sessions s
        join attendance_breaks b on b.tenant_id = s.tenant_id and b.attendance_session_id = s.id
        where s.tenant_id = $1 and b.id = $2::uuid limit 1`,
      [access.tenantId, id],
    ),
  ]);
  return { record, session: (sessionRows as Array<Record<string, unknown>>)[0] ?? null };
}

/** The configurable break-type vocabulary the register filters on (EN_BREAK_TYPE). */
export async function breakTypeOptions(access: Access): Promise<string[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const policy = await loadAttendancePolicy(access);
  return policy.breakTypes.length > 0 ? policy.breakTypes : [...DEFAULT_BREAK_TYPES];
}
