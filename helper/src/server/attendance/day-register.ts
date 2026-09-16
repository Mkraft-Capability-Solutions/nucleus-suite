import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";
import { canSeeCompensation } from "@/server/organization/service";
import { rulePack } from "@/server/payroll/rule-pack";

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
  /** RP-03 shows the detected shift alongside the rostered one, never instead of it. */
  rostered_shift_code: string | null;
  detected_shift_code: string | null;
  shift_override_reason: string | null;
  gross_minutes: number;
  gross_hours: string;
  break_minutes: number;
  break_hours: string;
  net_minutes: number;
  net_hours: string;
  overtime_minutes: number;
  overtime_hours: string;
  late_mark_applied: boolean;
  late_count_in_month: number;
  minutes_late: number;
  /** FRM-TIM-04: minutes short of the shift end, the mirror of `minutes_late`. */
  early_out_minutes: number;
  /** Credited gate-pass minutes (RL-05), written by the engine and shown on the day. */
  gate_pass_minutes: number;
  /** How many punch events the verdict was built from, so a thin day is visible as thin. */
  source_event_count: number;
  /** Which configuration decided the day; two days sharing it were judged the same way. */
  ruleset_version: string | null;
  computed_at: string | null;
  /** The rules that fired, by identifier. */
  applied_rule_ids: string[];
  /** One entry per IN/OUT pair; the gaps between them are the breaks. */
  attendance_segment: Array<{ segment: number; in: string; out: string | null; minutes: number | null }>;
  night_extension_applied: boolean;
  first_in: string | null;
  last_out: string | null;
  status: AttendanceDayState;
};

type DayQueryRow = Omit<AttendanceDayRow, "net_hours" | "overtime_hours" | "gross_hours" | "break_hours" | "status"> & {
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
    nullif(a.attributes->>'shift_assigned', '') as rostered_shift_code,
    nullif(a.attributes->>'detected_shift', '') as detected_shift_code,
    nullif(a.attributes->>'shift_override_reason', '') as shift_override_reason,
    coalesce(case when a.attributes->>'gross_minutes' ~ '^[0-9]+$' then (a.attributes->>'gross_minutes')::int end, 0) as gross_minutes,
    coalesce(case when a.attributes->>'break_minutes' ~ '^[0-9]+$' then (a.attributes->>'break_minutes')::int end, 0) as break_minutes,
    coalesce((a.attributes->>'late_mark_applied')::bool, false) as late_mark_applied,
    coalesce(case when a.attributes->>'late_count_in_month' ~ '^[0-9]+$' then (a.attributes->>'late_count_in_month')::int end, 0) as late_count_in_month,
    coalesce(case when a.attributes->>'minutes_late' ~ '^[0-9]+$' then (a.attributes->>'minutes_late')::int end, 0) as minutes_late,
    coalesce(case when a.attributes->>'early_out_minutes' ~ '^[0-9]+$' then (a.attributes->>'early_out_minutes')::int end, 0) as early_out_minutes,
    coalesce(case when a.attributes->>'gate_pass_minutes' ~ '^[0-9]+$' then (a.attributes->>'gate_pass_minutes')::int end, 0) as gate_pass_minutes,
    coalesce(case when a.attributes->>'source_event_count' ~ '^[0-9]+$' then (a.attributes->>'source_event_count')::int end, 0) as source_event_count,
    nullif(a.attributes->>'ruleset_version', '') as ruleset_version,
    nullif(a.attributes->>'computed_at', '') as computed_at,
    coalesce(a.attributes->'applied_rule_ids', '[]'::jsonb) as applied_rule_ids,
    coalesce(a.attributes->'attendance_segment', '[]'::jsonb) as attendance_segment,
    coalesce((a.attributes->>'night_extension_applied')::bool, false) as night_extension_applied,
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
      gross_hours: formatHoursLabel(rest.gross_minutes),
      break_hours: formatHoursLabel(rest.break_minutes),
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

/**
 * FRM-TIM-04's pay block: the rate the day is worth and what its overtime comes to.
 *
 * Derived on read, never stored on the attendance row. Salary is scope-gated compensation
 * (RL-24) and an attendance record is not — copying pay figures into it would put them in
 * a store with different access rules, where the scope could not reach them.
 *
 * The arithmetic is the payroll engine's own, from the same rule pack, so the figure shown
 * beside a day and the figure eventually paid for it cannot drift apart. Where the pack
 * does not supply the OT basis or the multiplier, the block reports that it cannot be
 * computed and names the missing rule rather than showing a number nobody approved.
 */
async function daySalaryStructure(
  access: Access,
  employeeId: string,
  overtimeMinutes: number,
): Promise<{
  visible: boolean;
  reason: string | null;
  currency: string | null;
  basicMonthlyMinor: number | null;
  hourlyRateMinor: number | null;
  overtimeAmountMinor: number | null;
}> {
  const blank = { visible: false, reason: null as string | null, currency: null, basicMonthlyMinor: null, hourlyRateMinor: null, overtimeAmountMinor: null };
  const [rows] = await tenantTx(access, [
    sqlClient`
      select basic_salary_minor, currency, location, payroll_owner
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
  ]);
  const employee = (rows as Array<{ basic_salary_minor: string | number | null; currency: string | null; location: string | null; payroll_owner: string | null }>)[0];
  if (!employee) return blank;
  if (!canSeeCompensation(access, { location: employee.location ?? "", payroll_owner: employee.payroll_owner })) {
    return { ...blank, reason: "Salary is outside this account's compensation scope." };
  }
  // A bigint arrives as a string; the rest of the arithmetic is in minor units.
  const basic = employee.basic_salary_minor === null || employee.basic_salary_minor === undefined
    ? null
    : Number(employee.basic_salary_minor);
  if (basic === null || !Number.isFinite(basic) || basic <= 0) {
    return { ...blank, visible: true, reason: "No basic salary is recorded for this employee.", currency: employee.currency };
  }
  const pack = rulePack();
  const basis = pack.overtime.hoursBasis;
  const multiplier = pack.overtime.workingDayMultiplier;
  if (basis === null || multiplier === null) {
    return {
      visible: true,
      reason: `Rule pack ${pack.code} does not state ${basis === null ? "overtime.hoursBasis" : "overtime.workingDayMultiplier"}, so the day rate cannot be derived.`,
      currency: employee.currency,
      basicMonthlyMinor: basic,
      hourlyRateMinor: null,
      overtimeAmountMinor: null,
    };
  }
  const hourlyRateMinor = basic / (basis.daysPerMonth * basis.hoursPerDay);
  return {
    visible: true,
    reason: null,
    currency: employee.currency,
    basicMonthlyMinor: basic,
    hourlyRateMinor: Math.round(hourlyRateMinor),
    overtimeAmountMinor: Math.round((hourlyRateMinor / 60) * Math.max(0, overtimeMinutes) * multiplier),
  };
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
          -- FRM-TIM-04 segment number. Nothing ever wrote a segment key onto an event, so this
          -- asked for a key that did not exist and every punch came back unsegmented. It is
          -- a property of the punch's position in the day, not of the punch, so it is counted
          -- here: each IN opens the next segment and its OUT belongs to the same one. Deriving
          -- it also means punches already stored are segmented without being re-ingested.
          sum(case when lower(coalesce(e.attributes->>'direction', '')) = 'in' then 1 else 0 end)
            over (order by coalesce(nullif(e.attributes->>'punched_at', ''), ''), e.created_at
                  rows between unbounded preceding and current row)::int as segment,
          nullif(e.attributes->>'note', '') as note
        from attendance_events e
        where e.tenant_id = $1 and e.employee_id = $2::uuid
          and coalesce(e.attributes->>'attendance_date', e.attributes->>'punch_date') = $3::text
        -- By the instant, not by the displayed time: that is a 12-hour clock string, so
        -- ordering on it sorted "1:00 PM" before "8:00 AM" and listed the day's first
        -- punch last. The ordering is what the segment numbering counts along.
        order by coalesce(nullif(e.attributes->>'punched_at', ''), ''), e.created_at
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
          -- FRM-TIM-05. Both were accepted and stored and neither was ever read back, so a
          -- correction's supporting document and the status it was raised against existed
          -- only in the database.
          nullif(r.attributes->>'document_ref', '') as document_ref,
          nullif(r.attributes->>'current_status', '') as current_status,
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
    salaryStructure: await daySalaryStructure(access, found.employee_id, record.overtime_minutes),
    auditTrail,
  };
}
