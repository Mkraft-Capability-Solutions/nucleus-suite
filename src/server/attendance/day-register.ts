import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";

export type AttendanceDayState = "computed" | "exception" | "locked";

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const EXCEPTION_TOKENS = ["exception", "missing_punch", "mispunch", "anomaly", "incomplete", "disputed"];

/**
 * Pure state mapping for one computed attendance day (unit-tested). A locked
 * day is closed for payroll and outranks everything; an unresolved exception
 * outranks a clean computation; anything else is simply computed.
 */
export function deriveDayState(
  storedStatus: string | null | undefined,
  hasException: boolean,
  locked: boolean,
): AttendanceDayState {
  const normalized = normalizeToken(storedStatus);
  if (locked || normalized === "locked") return "locked";
  if (hasException || EXCEPTION_TOKENS.includes(normalized)) return "exception";
  return "computed";
}

/**
 * Pure duration renderer (unit-tested). Attendance prints durations as H:MM,
 * never as a decimal, and prints an em dash rather than a misleading zero when
 * there is nothing to show.
 */
export function formatHoursLabel(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.trunc(minutes);
  if (total <= 0) return "—";
  return `${Math.trunc(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export type AttendanceDayRow = {
  id: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  day_type: string | null;
  shift_code: string | null;
  net_minutes: number;
  net_hours: string;
  overtime_minutes: number;
  overtime_hours: string;
  first_in: string | null;
  last_out: string | null;
  status: AttendanceDayState;
};

type DayQueryRow = Omit<AttendanceDayRow, "net_hours" | "overtime_hours" | "status"> & {
  stored_status: string | null;
  has_exception: boolean;
  locked: boolean;
};

/**
 * Net minutes fall back to the stored gross span because this tenant records
 * breaks but does not deduct them; overtime prefers the approved overtime entry
 * linked to the day and only then the day's own stored figure.
 */
const DAY_SELECT = `select a.id,
    a.employee_id,
    emp.employee_code,
    nullif(trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')), '') as employee_name,
    nullif(a.attributes->>'date', '') as date,
    nullif(a.attributes->>'day_type', '') as day_type,
    coalesce(nullif(a.attributes->>'shift_applied', ''), nullif(a.attributes->>'shift_assigned', ''),
             nullif(sh.attributes->>'code', '')) as shift_code,
    coalesce(
      case when a.attributes->>'net_minutes' ~ '^[0-9]+$' then (a.attributes->>'net_minutes')::int end,
      case when a.attributes->>'gross_minutes' ~ '^[0-9]+$' then (a.attributes->>'gross_minutes')::int end,
      0) as net_minutes,
    coalesce(
      (select case when ot.attributes->>'ot_minutes' ~ '^[0-9]+$' then (ot.attributes->>'ot_minutes')::int end
         from overtime_entries ot
         where ot.tenant_id = a.tenant_id and ot.attendance_entry_id = a.id
         order by ot.created_at desc limit 1),
      case when a.attributes->>'overtime_minutes' ~ '^[0-9]+$' then (a.attributes->>'overtime_minutes')::int end,
      case when a.attributes->>'ot_minutes' ~ '^[0-9]+$' then (a.attributes->>'ot_minutes')::int end,
      0) as overtime_minutes,
    nullif(a.attributes->>'first_in', '') as first_in,
    nullif(a.attributes->>'last_out', '') as last_out,
    nullif(a.attributes->>'status', '') as stored_status,
    (
      coalesce(a.attributes->>'exception_reason', '') <> ''
      or (
        coalesce(a.attributes->>'day_type', 'Working') not in ('Weekly Off', 'Holiday', 'On Leave')
        and (coalesce(a.attributes->>'first_in', '') = '' or coalesce(a.attributes->>'last_out', '') = '')
      )
    ) as has_exception,
    (a.record_status = 'locked' or coalesce(a.attributes->>'locked_at', '') <> '') as locked
  from attendance_entries a
  left join employees emp on emp.tenant_id = a.tenant_id and emp.id = a.employee_id
  left join shifts sh on sh.tenant_id = a.tenant_id and sh.id = a.shift_id`;

function project(rows: DayQueryRow[]): AttendanceDayRow[] {
  return rows.map((row) => {
    const { stored_status, has_exception, locked, ...rest } = row;
    return {
      ...rest,
      net_hours: formatHoursLabel(rest.net_minutes),
      overtime_hours: formatHoursLabel(rest.overtime_minutes),
      status: deriveDayState(stored_status, has_exception, locked),
    };
  });
}

/**
 * SCR-021 (one employee's attendance register) and SCR-022 (the whole visible
 * scope) read this one projection; the employee filter is what separates them.
 */
export async function listAttendanceDayRegister(
  access: Access,
  args: { employeeId: string | null; from: string | null; to: string | null; search: string },
): Promise<AttendanceDayRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const employeeId = args.employeeId && args.employeeId.trim() !== "" ? args.employeeId.trim() : null;
  if (employeeId) await assertAttendanceEmployeeVisible(access, employeeId);
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const from = args.from && args.from.trim() !== "" ? args.from.trim() : null;
  const to = args.to && args.to.trim() !== "" ? args.to.trim() : null;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${DAY_SELECT}
       where a.tenant_id = $1
         and a.employee_id = any($2::uuid[])
         and ($3::uuid is null or a.employee_id = $3::uuid)
         and ($4::text is null or coalesce(a.attributes->>'date', '') >= $4::text)
         and ($5::text is null or coalesce(a.attributes->>'date', '') <= $5::text)
         and ($6 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(a.attributes->>'shift_applied', '') || ' '
              || coalesce(a.attributes->>'day_type', '') || ' ' || coalesce(a.attributes->>'status', '')) ilike $6)
       order by coalesce(emp.employee_code, '') , coalesce(a.attributes->>'date', ''), a.created_at
       limit 300`,
      [access.tenantId, scope.employeeIds, employeeId, from, to, like],
    ),
  ]);
  return project(rows as DayQueryRow[]);
}

/** One attendance day with the punches behind it and its regularisations. */
export async function getAttendanceDayRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${DAY_SELECT} where a.tenant_id = $1 and a.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as DayQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, found.employee_id);
  const record = project([found])[0];

  const [punchRows, regularizationRows] = await tenantTx(access, [
    sqlClient.query(
      `select e.id,
          coalesce(nullif(e.attributes->>'event_id', ''), left(e.id::text, 8)) as event_reference,
          case lower(coalesce(e.attributes->>'direction', ''))
            when 'in' then 'in' when 'out' then 'out' else 'unknown' end as direction,
          nullif(e.attributes->>'time', '') as punch_time,
          coalesce(nullif(e.attributes->>'punch_date', ''), nullif(e.attributes->>'attendance_date', '')) as punch_date,
          nullif(e.attributes->>'device', '') as device,
          case when e.attributes->>'segment' ~ '^[0-9]+$' then (e.attributes->>'segment')::int end as segment,
          nullif(e.attributes->>'note', '') as note
        from attendance_events e
        where e.tenant_id = $1 and e.employee_id = $2::uuid
          and coalesce(e.attributes->>'attendance_date', e.attributes->>'punch_date') = $3::text
        order by coalesce(e.attributes->>'time', ''), e.created_at
        limit 100`,
      [access.tenantId, found.employee_id, record.date],
    ),
    sqlClient.query(
      `select r.id, r.record_status,
          nullif(r.attributes->>'status', '') as status,
          nullif(r.attributes->>'kind', '') as kind,
          nullif(r.attributes->>'reason', '') as reason,
          coalesce(nullif(r.attributes->>'claimed_in', ''), nullif(r.attributes->>'requested_punch_in', '')) as claimed_in,
          nullif(r.attributes->>'claimed_out', '') as claimed_out,
          r.created_at::text as created_at
        from attendance_regularizations r
        where r.tenant_id = $1 and r.attendance_entry_id = $2::uuid
        order by r.created_at desc
        limit 50`,
      [access.tenantId, id],
    ),
  ]);

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type in ('attendance_entry', 'attendance_day')
          and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return {
    record,
    punches: punchRows as Array<Record<string, unknown>>,
    regularizations: regularizationRows as Array<Record<string, unknown>>,
    auditTrail,
  };
}
