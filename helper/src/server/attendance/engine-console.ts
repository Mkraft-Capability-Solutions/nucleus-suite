import "server-only";

import { sqlClient } from "@/lib/db";
import { assertSelfScopeTarget, attendanceScope } from "@/server/attendance/service";
import { enforce, tenantTx, type Access } from "@/server/platform/access";

/**
 * Smart Attendance module console — read models only.
 *
 * Every figure here is read from the canonical jsonb tables; nothing is
 * invented. Where the imported data carries no value the read model returns
 * null / an empty list rather than a plausible-looking default. This module
 * never writes, and deliberately owns no DDL: it is a sibling of
 * `service.ts` (which stays the only writer for attendance).
 *
 * The canonical tables are generic (`id, record_status, attributes jsonb,
 * version, created_at, updated_at, tenant_id` plus FK columns), so every
 * domain field arrives as text out of `attributes` and is regex-guarded
 * before any cast — a free-text "note" row in an imported sheet must degrade
 * to null, never abort the whole console.
 */

const READ_PERMISSION = "attendance.read";
const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * The read gate for every figure this console reports about ONE employee.
 *
 * `attendance.read` remains the full-scope key. `attendanceScope` (service.ts,
 * which delegates to the shared `operationalScope`) also admits
 * `attendance.team.read` and `attendance.self.read` and says which one was used,
 * so the employee role that migration 0025 grants can read its own strip. A
 * self-scoped caller is pinned to their own employee record here, on the server:
 * asking for somebody else's id is refused whatever the UI does.
 */
function enforceEmployeeRead(access: Access, employeeId: string): void {
  const scope = attendanceScope(access, "read");
  assertSelfScopeTarget(scope, access.context.employeeId, employeeId);
}

/* ------------------------------------------------------------------ */
/* 1. Rule pack / engine status                                        */
/* ------------------------------------------------------------------ */

export type AttendanceEngineStatus = {
  rulePackCode: string | null;
  rulePackVersion: string | null;
  effectiveFrom: string | null;
  rules: string[];
};

type EngineRow = {
  pack_code: string | null;
  version_code: string | null;
  version_number: string | null;
  effective_from: string | null;
  pack_rules: unknown;
};

/**
 * The tenant's active rule-pack assignment, newest effective date first.
 * `rule_pack_versions` and `statutory_rule_packs` are catalogue tables with no
 * `tenant_id` of their own — the tenant boundary is `rule_pack_assignments`.
 */
const ENGINE_SELECT = `select srp.attributes->>'code' as pack_code,
    rpv.attributes->>'code' as version_code,
    rpv.version::text as version_number,
    rpa.attributes->>'effective_from' as effective_from,
    case when jsonb_typeof(rpv.attributes->'rules') = 'array' then rpv.attributes->'rules' else '[]'::jsonb end as pack_rules
  from rule_pack_assignments rpa
  join rule_pack_versions rpv on rpv.id = rpa.rule_pack_version_id
  left join statutory_rule_packs srp on srp.id = rpv.statutory_rule_pack_id
  where rpa.tenant_id = $1 and rpa.record_status = 'active'
  order by coalesce(rpa.attributes->>'effective_from', '') desc, rpa.created_at desc
  limit 1`;

/**
 * Human-readable rule statements. The rule-pack rows themselves carry only a
 * code/scope/status, so the engine's actual thresholds are the stored
 * `rule_statement` strings on `attendance_policies`, one per shift length.
 * The prose "note" row imported alongside them has a free-text `shift_hours`,
 * so the numeric guard drops it.
 */
const ENGINE_RULES_SELECT = `select 'Shift ' || (ap.attributes->>'shift_hours') || 'h: ' || (ap.attributes->>'rule_statement') as rule,
    min((ap.attributes->>'shift_hours')::int) as shift_hours
  from attendance_policies ap
  where ap.tenant_id = $1 and ap.record_status = 'active'
    and ap.attributes->>'rule_statement' is not null
    and ap.attributes->>'shift_hours' ~ '^[0-9]{1,2}$'
  group by 1
  order by 2 desc`;

/** Rule strings stored on the rule-pack version itself, when it has any. */
function packRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
}

export async function getAttendanceEngineStatus(access: Access): Promise<AttendanceEngineStatus> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [sqlClient.query(ENGINE_SELECT, [access.tenantId])]);
  const found = (rows as EngineRow[])[0] ?? null;

  // Rule statements are evidence, not identity: a failure here must not take
  // the engine card down with it.
  let statements: string[] = [];
  try {
    const [ruleRows] = await tenantTx(access, [sqlClient.query(ENGINE_RULES_SELECT, [access.tenantId])]);
    statements = (ruleRows as Array<{ rule: string | null }>)
      .map((row) => (row.rule ?? "").trim())
      .filter((rule) => rule !== "");
  } catch {
    statements = [];
  }

  if (!found) {
    return { rulePackCode: null, rulePackVersion: null, effectiveFrom: null, rules: statements };
  }
  return {
    rulePackCode: found.pack_code ?? found.version_code ?? null,
    rulePackVersion: found.version_code ?? found.version_number ?? null,
    effectiveFrom: found.effective_from ?? null,
    rules: [...packRules(found.pack_rules), ...statements],
  };
}

/* ------------------------------------------------------------------ */
/* 2. Current session                                                  */
/* ------------------------------------------------------------------ */

export type CurrentSessionView = {
  employeeId: string;
  checkedInAt: string | null;
  elapsedMinutes: number | null;
  open: boolean;
};

/**
 * Openness is derived from the punches, not from a session row.
 *
 * `attendance_sessions` is written only by `recomputeDay` (service.ts
 * `persistSessionAndBreaks`), which stamps `status: "completed"` after the fact —
 * nothing ever writes an *open* session, so reading openness from that table made
 * the strip permanently blank between punch-in and the nightly recompute. The
 * punch rows are the evidence the employee just created, so they are what this
 * reads: the latest punch on the tenant's own work date decides, and the day is
 * open when that punch is an IN with no OUT after it.
 *
 * Nothing here writes, and `recomputeDay` still owns the session row unchanged.
 */
const SESSION_SELECT = `select (array_agg(lower(punch.type) order by punch.punched_at desc))[1] as last_type,
    to_char(max(punch.punched_at) filter (where lower(punch.type) = 'in'), 'YYYY-MM-DD"T"HH24:MI:SSOF') as open_in_at,
    to_char(min(punch.punched_at) filter (where lower(punch.type) = 'in'), 'YYYY-MM-DD"T"HH24:MI:SSOF') as first_in_at,
    case when count(*) filter (where lower(punch.type) = 'in') = 0 then null
         else greatest(0, floor(extract(epoch from (now() - max(punch.punched_at) filter (where lower(punch.type) = 'in'))) / 60))::int end as elapsed_minutes
  from attendance_punches punch
  join attendance_days att_day on att_day.id = punch.attendance_day_id and att_day.tenant_id = punch.tenant_id
  join tenants tn on tn.id = punch.tenant_id
  where punch.tenant_id = $1 and att_day.employee_id = $2::uuid
    and att_day.attendance_date = ((now() at time zone coalesce(tn.timezone, $3))::date)`;

/** The punch facts today's session state is derived from. */
export type SessionPunchFacts = {
  /** Direction of the latest punch on the work date; null when the day has none. */
  lastType: string | null;
  /** The latest IN — the punch an open session is running from. */
  openInAt: string | null;
  /** The day's first IN — what "punched in at" means once the session has closed. */
  firstInAt: string | null;
  /** Minutes since the latest IN, measured by the database against `now()`. */
  elapsedMinutes: number | null;
};

/**
 * Pure session derivation, so the rule is testable without a database.
 *
 * Open when the last punch of the day is an IN that actually exists; elapsed
 * minutes are reported only while it is open, because a closed day's worked time
 * is the engine's figure, not a running clock. A day with no punches reports
 * nothing rather than a zero.
 */
export function deriveCurrentSession(employeeId: string, facts: SessionPunchFacts): CurrentSessionView {
  const last = (facts.lastType ?? "").trim().toLowerCase();
  if (last === "in" && facts.openInAt) {
    return {
      employeeId,
      checkedInAt: facts.openInAt,
      elapsedMinutes: typeof facts.elapsedMinutes === "number" ? facts.elapsedMinutes : null,
      open: true,
    };
  }
  return { employeeId, checkedInAt: facts.firstInAt ?? null, elapsedMinutes: null, open: false };
}

export async function getCurrentSession(access: Access, employeeId: string): Promise<CurrentSessionView> {
  enforceEmployeeRead(access, employeeId);
  const [rows] = await tenantTx(access, [
    sqlClient.query(SESSION_SELECT, [access.tenantId, employeeId, DEFAULT_TIMEZONE]),
  ]);
  const found = (rows as Array<{
    last_type: string | null;
    open_in_at: string | null;
    first_in_at: string | null;
    elapsed_minutes: number | null;
  }>)[0];
  if (!found) return { employeeId, checkedInAt: null, elapsedMinutes: null, open: false };
  return deriveCurrentSession(employeeId, {
    lastType: found.last_type ?? null,
    openInAt: found.open_in_at ?? null,
    firstInAt: found.first_in_at ?? null,
    elapsedMinutes: typeof found.elapsed_minutes === "number" ? found.elapsed_minutes : null,
  });
}

/* ------------------------------------------------------------------ */
/* 3. Active shift assignment                                          */
/* ------------------------------------------------------------------ */

export type ShiftAssignmentView = {
  shiftCode: string | null;
  shiftName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  graceMinutes: number | null;
};

/**
 * The latest active assignment, with the grace window taken from the
 * `attendance_policies` row whose `shift_hours` matches the shift's own
 * duration; the generic `STD` policy is the fallback when no length-specific
 * row exists. Both policy shapes are supported: the imported sheet stores
 * `grace_in_min`, the application's own policy stores `grace_minutes`.
 *
 * `shifts` is a canonical jsonb table — `attributes` is its only domain column —
 * and two writers populate it with two different key spellings: the seeder
 * (scripts/seeder/domain04-attendance-leave.ts) writes `start_time` / `end_time`,
 * while `ensureShift` in service.ts writes `starts_at` / `ends_at`. Reading only
 * the seeder's spelling left the window, both targets, worked minutes and break
 * minutes blank on every shift the application itself created. Both spellings are
 * read here, the same way the grace lookup below already reads both policy shapes;
 * no column is renamed.
 */
const SHIFT_SELECT = `select s.attributes->>'code' as shift_code,
    s.attributes->>'name' as shift_name,
    coalesce(nullif(s.attributes->>'starts_at', ''), nullif(s.attributes->>'start_time', '')) as starts_at,
    coalesce(nullif(s.attributes->>'ends_at', ''), nullif(s.attributes->>'end_time', '')) as ends_at,
    (select case when p.attributes->>'grace_in_min' ~ '^[0-9]+$' then (p.attributes->>'grace_in_min')::int
                 when p.attributes->>'grace_minutes' ~ '^[0-9]+$' then (p.attributes->>'grace_minutes')::int
                 else null end
     from attendance_policies p
     where p.tenant_id = sa.tenant_id and p.record_status = 'active'
       and (p.attributes->>'shift_hours' = (case when s.attributes->>'duration_minutes' ~ '^[0-9]+$'
                                                 then ((s.attributes->>'duration_minutes')::int / 60)::text end)
            or upper(coalesce(p.attributes->>'code', '')) = 'STD')
     order by (p.attributes->>'shift_hours' is not null) desc, p.created_at asc
     limit 1) as grace_minutes
  from shift_assignments sa
  join shifts s on s.tenant_id = sa.tenant_id and s.id = sa.shift_id
  where sa.tenant_id = $1 and sa.employee_id = $2::uuid and sa.record_status = 'active'
    and coalesce(sa.attributes->>'active', 'true') <> 'false'
  order by coalesce(sa.attributes->>'effective_from', '') desc, sa.created_at desc
  limit 1`;

const UNASSIGNED_SHIFT: ShiftAssignmentView = {
  shiftCode: null,
  shiftName: null,
  startsAt: null,
  endsAt: null,
  graceMinutes: null,
};

export async function getActiveShiftAssignment(access: Access, employeeId: string): Promise<ShiftAssignmentView> {
  enforceEmployeeRead(access, employeeId);
  const [rows] = await tenantTx(access, [sqlClient.query(SHIFT_SELECT, [access.tenantId, employeeId])]);
  const found = (rows as Array<{
    shift_code: string | null;
    shift_name: string | null;
    starts_at: string | null;
    ends_at: string | null;
    grace_minutes: number | null;
  }>)[0];
  if (!found) return { ...UNASSIGNED_SHIFT };
  return {
    shiftCode: found.shift_code ?? null,
    shiftName: found.shift_name ?? null,
    startsAt: found.starts_at ?? null,
    endsAt: found.ends_at ?? null,
    graceMinutes: typeof found.grace_minutes === "number" ? found.grace_minutes : null,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Gate-pass quota                                                  */
/* ------------------------------------------------------------------ */

export type GatePassQuotaView = {
  usedMinutes: number;
  ceilingMinutes: number;
  requestsRemaining: number | null;
  period: string;
};

/**
 * The monthly ceiling is re-derived from `gate_pass_policies` rather than
 * copied: `src/server/attendance/service.ts` gets its 240-minute ceiling from
 * `gatePassEligibility` in `src/lib/hr-rules.ts`, where the number is inlined
 * in a comparison and exported nowhere. Both stored shapes are read — the
 * imported sheet stores `max_hours_per_month` (hours), the application's own
 * bootstrap row stores `monthly_minutes`.
 */
const GATE_PASS_POLICY_SELECT = `select max(case when gp.attributes->>'max_hours_per_month' ~ '^[0-9]+$' then (gp.attributes->>'max_hours_per_month')::int * 60
                 when gp.attributes->>'monthly_minutes' ~ '^[0-9]+$' then (gp.attributes->>'monthly_minutes')::int
                 else null end) as ceiling_minutes,
    max(case when gp.attributes->>'max_instances_per_month' ~ '^[0-9]+$' then (gp.attributes->>'max_instances_per_month')::int
             when gp.attributes->>'max_count' ~ '^[0-9]+$' then (gp.attributes->>'max_count')::int
             else null end) as max_instances
  from gate_pass_policies gp
  where gp.tenant_id = $1 and gp.record_status = 'active'`;

/**
 * Approved minutes for the month. The imported passes date themselves with
 * `pass_date` and capitalise the status ("Approved"); the application's own
 * writes use `date` and lower case — both are matched, and a rejection whose
 * status carries a trailing explanation is excluded by the prefix test.
 */
const GATE_PASS_USAGE_SELECT = `select coalesce(sum(case when g.attributes->>'minutes' ~ '^[0-9]+$' then (g.attributes->>'minutes')::int else 0 end), 0)::int as used_minutes,
    count(*)::int as used_requests
  from gate_passes g
  where g.tenant_id = $1 and g.employee_id = $2::uuid and g.record_status = 'active'
    and lower(coalesce(g.attributes->>'status', '')) like 'approved%'
    and left(coalesce(g.attributes->>'pass_date', g.attributes->>'date', to_char(g.created_at, 'YYYY-MM-DD')), 7) = $3`;

export async function getGatePassQuota(access: Access, employeeId: string, period: string): Promise<GatePassQuotaView> {
  enforceEmployeeRead(access, employeeId);
  const [policyRows, usageRows] = await tenantTx(access, [
    sqlClient.query(GATE_PASS_POLICY_SELECT, [access.tenantId]),
    sqlClient.query(GATE_PASS_USAGE_SELECT, [access.tenantId, employeeId, period]),
  ]);
  const policy = (policyRows as Array<{ ceiling_minutes: number | null; max_instances: number | null }>)[0]
    ?? { ceiling_minutes: null, max_instances: null };
  const usage = (usageRows as Array<{ used_minutes: number; used_requests: number }>)[0]
    ?? { used_minutes: 0, used_requests: 0 };
  const maxInstances = typeof policy.max_instances === "number" ? policy.max_instances : null;
  return {
    usedMinutes: usage.used_minutes ?? 0,
    // No policy row means no stated ceiling; 0 is reported rather than a
    // second hard-coded copy of the 240-minute figure.
    ceilingMinutes: typeof policy.ceiling_minutes === "number" ? policy.ceiling_minutes : 0,
    requestsRemaining: maxInstances === null ? null : Math.max(0, maxInstances - (usage.used_requests ?? 0)),
    period,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Monthly timesheet                                                */
/* ------------------------------------------------------------------ */

export type TimesheetDay = {
  date: string;
  status: "in" | "late" | "off" | "absent" | "leave" | "not_recorded";
  shiftCode: string | null;
  grossMinutes: number | null;
};

export type TimesheetRecord = {
  recorded: boolean;
  /** `attendance_entries.attributes->>'status'` — "Present" / "Absent" / … */
  status: string | null;
  /** `attributes->>'day_type'` — "Working" / "Weekly Off" / "On Leave" / "Holiday". */
  dayType: string | null;
  /** First in-punch of the day as stored, "HH:MM". */
  firstIn: string | null;
  /** The shift's latest permitted in-time, "HH:MM", from `shifts`. */
  latestIn: string | null;
  grossMinutes: number | null;
};

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Pure mapping from one stored day record onto the six console states.
 *
 * The live data determines the order of the tests:
 *  - no row at all is `not_recorded` — a missing day is never assumed absent;
 *  - `day_type` "On Leave" wins over `status`, because the imported sheet
 *    leaves `status` at "Present" on leave days while zeroing the punches;
 *  - "Weekly Off" / "Holiday" is `off` only when nobody actually worked —
 *    a rest day with punches (two exist in September 2026) still reads `in`,
 *    so rest-day working is never hidden;
 *  - an explicit "Absent" status is `absent`;
 *  - a present-ish day is `late` when the stored first in-punch is later than
 *    the shift's own `latest_in` window, otherwise `in`. Both times are the
 *    stored zero-padded "HH:MM" strings, so a string compare is the same
 *    comparison the data itself encodes;
 *  - a row that exists but carries no usable status stays `not_recorded`
 *    rather than being guessed into a state.
 */
export function deriveTimesheetStatus(row: Partial<TimesheetRecord> | null | undefined): TimesheetDay["status"] {
  if (!row || row.recorded === false) return "not_recorded";
  const status = normalise(row.status);
  const dayType = normalise(row.dayType);

  if (dayType.includes("leave") || status.includes("leave")) return "leave";

  const gross = typeof row.grossMinutes === "number" && Number.isFinite(row.grossMinutes) ? row.grossMinutes : 0;
  const firstIn = (row.firstIn ?? "").trim();
  const worked = firstIn !== "" || gross > 0;

  if (!worked && (dayType.includes("off") || dayType.includes("holiday") || dayType.includes("rest"))) return "off";
  if (status.includes("absent")) return "absent";

  const presentish = status.includes("present") || status.includes("half") || status.includes("late") || worked;
  if (!presentish) return "not_recorded";

  const latestIn = (row.latestIn ?? "").trim();
  if (status.includes("late")) return "late";
  if (firstIn !== "" && latestIn !== "" && firstIn > latestIn) return "late";
  return "in";
}

const TIMESHEET_SELECT = `select ae.attributes->>'date' as work_date,
    ae.attributes->>'status' as status,
    ae.attributes->>'day_type' as day_type,
    ae.attributes->>'first_in' as first_in,
    coalesce(ae.attributes->>'shift_applied', ae.attributes->>'shift_assigned') as shift_code,
    sh.attributes->>'latest_in' as latest_in,
    case when ae.attributes->>'gross_minutes' ~ '^[0-9]+$' then (ae.attributes->>'gross_minutes')::int else null end as gross_minutes
  from attendance_entries ae
  left join shifts sh on sh.tenant_id = ae.tenant_id
    and sh.attributes->>'code' = coalesce(ae.attributes->>'shift_applied', ae.attributes->>'shift_assigned')
  where ae.tenant_id = $1 and ae.employee_id = $2::uuid and ae.record_status = 'active'
    and ae.attributes->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and left(ae.attributes->>'date', 7) = $3
  order by 1 asc`;

/** Every calendar day of `YYYY-MM`, in order, so the UI can render a full grid. */
export function monthDays(period: string): string[] {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length }, (_, index) => `${period}-${String(index + 1).padStart(2, "0")}`);
}

export async function listMonthlyTimesheet(access: Access, employeeId: string, period: string): Promise<TimesheetDay[]> {
  enforceEmployeeRead(access, employeeId);
  const [rows] = await tenantTx(access, [
    sqlClient.query(TIMESHEET_SELECT, [access.tenantId, employeeId, period]),
  ]);
  const byDate = new Map<string, TimesheetRecord & { shiftCode: string | null }>();
  for (const row of rows as Array<{
    work_date: string;
    status: string | null;
    day_type: string | null;
    first_in: string | null;
    shift_code: string | null;
    latest_in: string | null;
    gross_minutes: number | null;
  }>) {
    byDate.set(row.work_date, {
      recorded: true,
      status: row.status,
      dayType: row.day_type,
      firstIn: row.first_in,
      latestIn: row.latest_in,
      grossMinutes: row.gross_minutes,
      shiftCode: row.shift_code,
    });
  }
  return monthDays(period).map((date) => {
    const record = byDate.get(date);
    return {
      date,
      status: deriveTimesheetStatus(record ?? { recorded: false }),
      shiftCode: record?.shiftCode ?? null,
      grossMinutes: record?.grossMinutes ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 6. Anomalies                                                        */
/* ------------------------------------------------------------------ */

export type AttendanceAnomaly = {
  id: string;
  employeeCode: string | null;
  employeeName: string | null;
  date: string | null;
  kind: string;
  detail: string | null;
  status: string;
};

const ANOMALY_SELECT = `select x.id,
    e.employee_code,
    nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '') as employee_name,
    x.attributes->>'date' as work_date,
    coalesce(nullif(trim(x.attributes->>'exception_type'), ''), nullif(trim(x.attributes->>'kind'), ''), 'unspecified') as kind,
    coalesce(x.attributes->>'detail', x.attributes->>'note', x.attributes->>'reason') as detail,
    coalesce(nullif(trim(x.attributes->>'status'), ''), x.record_status, 'open') as status
  from attendance_exceptions x
  left join employees e on e.tenant_id = x.tenant_id and e.id = x.employee_id
  where x.tenant_id = $1
  order by coalesce(x.attributes->>'date', '') desc, x.created_at desc
  limit $2`;

export async function listAttendanceAnomalies(access: Access, limit = 20): Promise<AttendanceAnomaly[]> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const clamped = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 20;
  const [rows] = await tenantTx(access, [sqlClient.query(ANOMALY_SELECT, [access.tenantId, clamped])]);
  return (rows as Array<{
    id: string;
    employee_code: string | null;
    employee_name: string | null;
    work_date: string | null;
    kind: string;
    detail: string | null;
    status: string;
  }>).map((row) => ({
    id: row.id,
    employeeCode: row.employee_code ?? null,
    employeeName: row.employee_name ?? null,
    date: row.work_date ?? null,
    kind: row.kind,
    detail: row.detail ?? null,
    status: row.status,
  }));
}

/* ------------------------------------------------------------------ */
/* 7. Worker categories                                                */
/* ------------------------------------------------------------------ */

export type WorkerCategoryRule = {
  code: string;
  name: string;
  wageType: string | null;
  restDayPattern: string | null;
  otEligibility: string | null;
  leaveEligible: string | null;
  statutorySet: string | null;
};

/**
 * The imported worker-category sheet carries a trailing prose "note" row whose
 * entire sentence landed in `code`. A real category code is short, so anything
 * missing or longer than this is not a category and is never shown.
 */
export const WORKER_CATEGORY_CODE_MAX = 40;

/** Pure row filter, applied in SQL and re-asserted here so it stays testable. */
export function isWorkerCategoryRow(code: string | null | undefined): boolean {
  const trimmed = (code ?? "").trim();
  return trimmed !== "" && trimmed.length <= WORKER_CATEGORY_CODE_MAX;
}

const WORKER_CATEGORY_SELECT = `select wc.attributes->>'code' as code,
    coalesce(nullif(trim(wc.attributes->>'name'), ''), wc.attributes->>'code') as name,
    wc.attributes->>'wage_type' as wage_type,
    wc.attributes->>'rest_day_pattern' as rest_day_pattern,
    wc.attributes->>'ot_eligibility' as ot_eligibility,
    wc.attributes->>'leave_eligible' as leave_eligible,
    wc.attributes->>'statutory_set' as statutory_set
  from worker_categories wc
  where wc.tenant_id = $1 and wc.record_status = 'active'
    and coalesce(trim(wc.attributes->>'code'), '') <> ''
    and length(trim(wc.attributes->>'code')) <= $2
  order by 1 asc`;

export async function listWorkerCategories(access: Access): Promise<WorkerCategoryRule[]> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(WORKER_CATEGORY_SELECT, [access.tenantId, WORKER_CATEGORY_CODE_MAX]),
  ]);
  return (rows as Array<{
    code: string;
    name: string | null;
    wage_type: string | null;
    rest_day_pattern: string | null;
    ot_eligibility: string | null;
    leave_eligible: string | null;
    statutory_set: string | null;
  }>)
    .filter((row) => isWorkerCategoryRow(row.code))
    .map((row) => ({
      code: row.code.trim(),
      name: (row.name ?? row.code).trim(),
      wageType: row.wage_type ?? null,
      restDayPattern: row.rest_day_pattern ?? null,
      otEligibility: row.ot_eligibility ?? null,
      leaveEligible: row.leave_eligible ?? null,
      statutorySet: row.statutory_set ?? null,
    }));
}

/* ------------------------------------------------------------------ */
/* 8. Plant calendars                                                  */
/* ------------------------------------------------------------------ */

export type PlantCalendar = {
  locationCode: string | null;
  locationName: string | null;
  holidayCount: number;
  holidays: Array<{ date: string; name: string }>;
};

/**
 * Holiday calendars are not keyed to a location by foreign key in this data
 * (`holiday_calendars.establishment_id` is null), so the applicability a plant
 * actually observes is the stored `applicable_locations` list on each holiday:
 * either the literal "ALL" or a comma-separated list of location codes. The
 * list is split rather than substring-matched so "LOC-BL" can never pick up
 * "LOC-BLR". Every holiday must still belong to a calendar row.
 */
const PLANT_CALENDAR_SELECT = `select l.attributes->>'code' as location_code,
    l.attributes->>'name' as location_name,
    h.attributes->>'holiday_date' as holiday_date,
    h.attributes->>'name' as holiday_name
  from locations l
  left join holidays h on h.tenant_id = l.tenant_id
    and h.record_status = 'active'
    and h.attributes->>'holiday_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and left(h.attributes->>'holiday_date', 4) = $2
    and exists (select 1 from holiday_calendars hc where hc.tenant_id = h.tenant_id and hc.id = h.holiday_calendar_id)
    and (upper(coalesce(h.attributes->>'applicable_locations', 'ALL')) = 'ALL'
         or upper(trim(coalesce(l.attributes->>'code', ''))) = any(
              string_to_array(upper(replace(coalesce(h.attributes->>'applicable_locations', ''), ' ', '')), ',')))
  where l.tenant_id = $1 and l.record_status = 'active'
  order by 1 asc, 3 asc`;

export async function listPlantCalendars(access: Access, year: number): Promise<PlantCalendar[]> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  if (!Number.isInteger(year)) return [];
  const [rows] = await tenantTx(access, [
    sqlClient.query(PLANT_CALENDAR_SELECT, [access.tenantId, String(year)]),
  ]);
  const byLocation = new Map<string, PlantCalendar>();
  for (const row of rows as Array<{
    location_code: string | null;
    location_name: string | null;
    holiday_date: string | null;
    holiday_name: string | null;
  }>) {
    const key = row.location_code ?? row.location_name ?? "";
    let calendar = byLocation.get(key);
    if (!calendar) {
      calendar = {
        locationCode: row.location_code ?? null,
        locationName: row.location_name ?? null,
        holidayCount: 0,
        holidays: [],
      };
      byLocation.set(key, calendar);
    }
    if (row.holiday_date) {
      calendar.holidays.push({ date: row.holiday_date, name: row.holiday_name ?? "Unnamed holiday" });
      calendar.holidayCount += 1;
    }
  }
  return [...byLocation.values()];
}
