import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  analyzePunchDay,
  attendanceStatus,
  detectionWindowContains,
  evaluateLateArrival,
  evaluateNightExtension,
  gatePassEligibility,
  isOvertimeEligible,
  type AttendanceStatus,
} from "@/lib/hr-rules";
import { picklistLabel, picklistValues } from "@/lib/picklists";
import {
  lateCounterWindow,
  loadAttendancePolicy,
  nightExtensionForShift,
  requireExemptGradeRank,
  requireNightExtensionRule,
  UNCLASSIFIED_BREAK_TYPE,
} from "@/server/attendance/attendance-policy";
import { RECOMPUTE_QUEUE_ACTION } from "@/server/attendance/recompute-monitor";
import { hasRestDaysFromPattern } from "@/server/organization/work-rules";
import { detectShift, listShiftMaster, resolveShift, SEED_SHIFTS, type ShiftMasterRecord } from "@/server/attendance/shift-master";
import { enforce, recordAudit, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";

/**
 * The shifts a tenant is seeded with. They are the starting point for the shift
 * master records the engine actually reads — see `shift-master.ts`, which is what
 * resolves thresholds, grace, detection windows and the overtime base.
 */
export const SHIFT_DEFINITIONS = SEED_SHIFTS;

export type ShiftCode = keyof typeof SHIFT_DEFINITIONS;

async function tenantTimezone(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select timezone from tenants where id = ${access.tenantId} limit 1`,
  ]);
  const row = (rows as Array<{ timezone: string }>)[0];
  return row?.timezone ?? "Asia/Kolkata";
}

const TENANT_WIDE_ATTENDANCE_ROLES = new Set(["owner", "super-admin", "hr-manager", "time-office", "payroll-admin"]);

export type AttendanceScopeKind = "tenant" | "hierarchy";

/** Pure role decision used by API services and unit tests. */
export function attendanceScopeKind(context: Pick<Access["context"], "permissions" | "roles">): AttendanceScopeKind {
  return context.roles.some((role) => TENANT_WIDE_ATTENDANCE_ROLES.has(role))
    || context.permissions.includes("tenant.manage")
    || context.permissions.includes("membership.manage")
    ? "tenant"
    : "hierarchy";
}

export async function resolveAttendanceScope(access: Access): Promise<{ kind: AttendanceScopeKind; rootEmployeeId: string | null; employeeIds: string[] }> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const kind = attendanceScopeKind(access.context);
  if (kind === "tenant") {
    const [rows] = await tenantTx(access, [
      sqlClient`select id from employees where tenant_id = ${access.tenantId} and status = 'active' order by employee_code`,
    ]);
    return { kind, rootEmployeeId: access.context.employeeId ?? null, employeeIds: (rows as Array<{ id: string }>).map((row) => row.id) };
  }

  const rootEmployeeId = access.context.employeeId;
  if (!rootEmployeeId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This account is not linked to an employee reporting hierarchy." });
  }
  const [rows] = await tenantTx(access, [sqlClient`
    with recursive visible_employee(id) as (
      select id from employees where tenant_id = ${access.tenantId} and id = ${rootEmployeeId} and status = 'active'
      union
      select employee.id
      from employees employee
      join visible_employee manager on employee.manager_employee_id = manager.id
      where employee.tenant_id = ${access.tenantId} and employee.status = 'active'
    )
    select id from visible_employee
  `]);
  return { kind, rootEmployeeId, employeeIds: (rows as Array<{ id: string }>).map((row) => row.id) };
}

export async function assertAttendanceEmployeeVisible(access: Access, employeeId: string): Promise<void> {
  const scope = await resolveAttendanceScope(access);
  if (!scope.employeeIds.includes(employeeId)) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

/* ------------------------------------------------------------------ */
/* Attendance permission scope — the one resolver, used everywhere      */
/* ------------------------------------------------------------------ */

export type AttendancePermissionScope = "all" | "team" | "self";

/**
 * The data scope this caller acts in for attendance, resolved through the single
 * shared helper the rest of the platform already uses
 * (`operationalScope`, src/server/workflows/operational-access.ts): the full
 * `attendance.<verb>` key first, then `attendance.team.<verb>`, then
 * `attendance.self.<verb>`. The key that was selected is the key that is
 * enforced, so the employee role — which migration 0025 grants
 * `attendance.self.read` / `attendance.self.write` and nothing wider — is
 * admitted here and confined by `assertSelfScopeTarget` below.
 *
 * `operationalScope` allows no `team` key for a write and no `self` key for an
 * approve, so a write resolves to exactly `all` or `self`.
 */
export function attendanceScope(access: Access, verb: "read" | "write" | "approve"): AttendancePermissionScope {
  return operationalScope(access, "attendance", verb);
}

/**
 * Server-side confinement of a self key to its own holder.
 *
 * A self-scoped principal may act on exactly one employee record: the one their
 * account is linked to. The cockpit never offers another employee, but the
 * cockpit is not the boundary — a hand-written request naming somebody else is
 * refused here, before any row is read or written.
 */
export function assertSelfScopeTarget(
  scope: AttendancePermissionScope,
  callerEmployeeId: string | null | undefined,
  targetEmployeeId: string,
): void {
  if (scope !== "self") return;
  if (!callerEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile before using attendance self-service.",
    });
  }
  if (callerEmployeeId !== targetEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "FORBIDDEN",
      message: "Attendance self-service covers your own employee record only.",
    });
  }
}

/**
 * RL-02 alternation, stated once for both halves of the rule: the punches inside
 * the submitted batch, and the last punch already stored for the same attributed
 * day. Pass the stored tail as `lastStoredType` (null when the day has none) and
 * the batch's directions in time order.
 *
 * Returns the sentence to show the person, or null when the sequence alternates.
 * Pure on purpose — the whole rule is unit-testable without a database.
 */
export function punchSequenceRefusal(
  lastStoredType: string | null | undefined,
  types: readonly string[],
): string | null {
  let previous = ((lastStoredType ?? "").trim().toLowerCase() || null) as string | null;
  for (const raw of types) {
    const next = (raw ?? "").trim().toLowerCase();
    if (previous !== null && next === previous) {
      return previous === "in"
        ? "You are already punched in. Punch out before punching in again."
        : "You are already punched out. Punch in before punching out again.";
    }
    previous = next;
  }
  return null;
}

type AttendanceTeamRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string;
  department: string;
  location: string;
  manager_employee_id: string | null;
  manager_name: string | null;
  recorded_days: number;
  present: number;
  half_day: number;
  absent: number;
  other: number;
  productive_minutes: number;
  payable_ot_minutes: number;
};

export async function summarizeAttendanceTeam(access: Access, args: { from: string; to: string }) {
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) {
    return { scope: { kind: scope.kind, rootEmployeeId: scope.rootEmployeeId, visibleEmployees: 0 }, summary: { visibleEmployees: 0, recordedDays: 0, present: 0, halfDay: 0, absent: 0, other: 0, productiveMinutes: 0, payableOtMinutes: 0 }, employees: [] };
  }
  const [rows] = await tenantTx(access, [sqlClient`
    select employee.id, employee.employee_code, employee.first_name, employee.last_name, employee.designation,
           employee.department, employee.location, employee.manager_employee_id,
           nullif(trim(coalesce(manager.first_name, '') || ' ' || coalesce(manager.last_name, '')), '') as manager_name,
           count(day.id)::int as recorded_days,
           (count(day.id) filter (where replace(lower(day.status), ' ', '_') in ('present', 'locked')))::int as present,
           (count(day.id) filter (where replace(lower(day.status), ' ', '_') in ('half_day', 'halfday')))::int as half_day,
           (count(day.id) filter (where lower(day.status) = 'absent'))::int as absent,
           (count(day.id) filter (where replace(lower(day.status), ' ', '_') not in ('present', 'locked', 'half_day', 'halfday', 'absent')))::int as other,
           coalesce(sum(day.productive_minutes), 0)::int as productive_minutes,
           coalesce(sum(day.payable_ot_minutes), 0)::int as payable_ot_minutes
    from employees employee
    left join employees manager on manager.tenant_id = employee.tenant_id and manager.id = employee.manager_employee_id
    left join attendance_days day on day.tenant_id = employee.tenant_id and day.employee_id = employee.id
      and day.attendance_date between ${args.from} and ${args.to}
    where employee.tenant_id = ${access.tenantId} and employee.id = any(${scope.employeeIds}::uuid[])
    group by employee.id, manager.first_name, manager.last_name
    order by employee.employee_code
  `]);
  const employees = rows as AttendanceTeamRow[];
  const summary = employees.reduce((total, employee) => ({
    visibleEmployees: total.visibleEmployees + 1,
    recordedDays: total.recordedDays + employee.recorded_days,
    present: total.present + employee.present,
    halfDay: total.halfDay + employee.half_day,
    absent: total.absent + employee.absent,
    other: total.other + employee.other,
    productiveMinutes: total.productiveMinutes + employee.productive_minutes,
    payableOtMinutes: total.payableOtMinutes + employee.payable_ot_minutes,
  }), { visibleEmployees: 0, recordedDays: 0, present: 0, halfDay: 0, absent: 0, other: 0, productiveMinutes: 0, payableOtMinutes: 0 });
  return {
    scope: { kind: scope.kind, rootEmployeeId: scope.rootEmployeeId, visibleEmployees: scope.employeeIds.length },
    summary,
    employees: employees.map((employee) => ({
      id: employee.id,
      employeeCode: employee.employee_code,
      firstName: employee.first_name,
      lastName: employee.last_name,
      designation: employee.designation,
      department: employee.department,
      location: employee.location,
      managerEmployeeId: employee.manager_employee_id,
      managerName: employee.manager_name,
      recordedDays: employee.recorded_days,
      present: employee.present,
      halfDay: employee.half_day,
      absent: employee.absent,
      other: employee.other,
      productiveMinutes: employee.productive_minutes,
      payableOtMinutes: employee.payable_ot_minutes,
    })),
  };
}

/**
 * Shared reference-data helper: callers must enforce authorization before invoking.
 *
 * The reference row carries whatever the shift master says about the code, so the
 * thresholds and windows an operator configured are what the row records. An
 * unknown code is refused by `resolveShift` rather than quietly becoming A shift.
 */
export async function ensureShift(access: Access, code: string): Promise<string> {
  const shift = await resolveShift(access, code);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from shifts where tenant_id = ${access.tenantId} and attributes->>'code' = ${shift.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into shifts (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({
        code: shift.code,
        name: shift.name,
        starts_at: minuteClock(shift.startMinute),
        ends_at: minuteClock(shift.endMinute),
        duration_minutes: shift.durationMinutes,
        half_day_minutes: shift.thresholds.halfDayBelowMinutes,
        absent_below_minutes: shift.thresholds.absentBelowMinutes,
        ot_after_minutes: shift.overtimeAfterMinutes,
        ot_basis: shift.overtimeBasis,
        source: shift.source,
      })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'attendance.shift_ensure', 'shift', ${id}, 'Canonical shift bootstrap')
    `,
  ]);
  return id;
}

function minuteClock(minute: number | null): string | null {
  if (minute === null) return null;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/** One capture channel, created on first use so every punch can name its source row. */
export async function ensureAttendanceSource(access: Access, code: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from attendance_sources where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into attendance_sources (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name: picklistLabel("PL_PUNCH_SOURCE", code) })}::jsonb)
    `,
  ]);
  return id;
}

const punchSchema = z
  .object({
    at: z.string().datetime({ offset: true }),
    type: z.enum(picklistValues("PL_PUNCH_DIRECTION")),
    source: z.enum(picklistValues("PL_PUNCH_SOURCE")).default("web"),
    deviceReference: z.string().max(120).optional(),
    /** Capture coordinates. Stored as a pair so a punch is never half-located. */
    geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
    geofenceResult: z.enum(picklistValues("PL_GEOFENCE_RESULT")).optional(),
    selfieRef: z.string().trim().min(1).max(500).optional(),
    jobCode: z.string().trim().min(1).max(60).optional(),
    offlineQueued: z.boolean().optional(),
    remark: z.string().trim().max(120).optional(),
  })
  // A mobile punch carries its location and the geofence verdict; an outside-the-fence
  // punch is still accepted, which is why the verdict is recorded rather than enforced.
  .refine((punch) => punch.source !== "mobile_app" || (punch.geo !== undefined && punch.geofenceResult !== undefined), {
    path: ["geo"],
    message: "A mobile punch must carry its coordinates and geofence result.",
  });

export const ingestPunchesSchema = z.object({
  employeeId: z.string().uuid(),
  /**
   * The date the device believes it is posting for. RL-01 attributes a session to
   * the date of its first IN, so this is the starting point for attribution, not
   * the answer: a punch that belongs to the previous date's open session is filed
   * against that session.
   */
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Any code the shift master carries; an unknown code is refused, not defaulted. */
  shiftCode: z.string().trim().min(1).max(20).default("A"),
  /**
   * One punch is a valid batch. A device streams events as they happen, so the tail of an
   * overnight session — a lone OUT after midnight — arrives on its own; requiring a pair
   * would force the caller to re-post the previous day's IN to file it, which would
   * duplicate the evidence. Pairing is a property of the session, decided by attribution,
   * not of the batch.
   */
  punches: z.array(punchSchema).min(1).max(32),
});

/**
 * The date one punch's session is attributed to (RL-01).
 *
 * An IN that falls inside the shift's detection window opens a session on its own
 * local date. Anything else joins the previous date's session while that session is
 * still open — which is what keeps `IN 08:00 / OUT 20:30 / IN 21:15 / OUT 03:20` one
 * session on day 1, and keeps day 2 out of the register entirely.
 */
async function attributeSessionDate(
  access: Access,
  employeeId: string,
  punch: { at: string; type: string },
  shift: ShiftMasterRecord,
  timeZone: string,
  /**
   * The punches earlier in this same batch that have already been attributed. Nothing in
   * the batch is written until every punch has been attributed, so the database alone
   * cannot answer "is yesterday's session still open" for the second punch of a batch:
   * `IN 08:00 / OUT 03:20` would file its own OUT onto day 2 because the IN it closes is
   * still only in memory. The batch is consulted alongside the stored punches, and the
   * later of the two wins, so a batch reads the same as the same punches posted one by one.
   */
  pending: ReadonlyArray<{ date: string; at: string; type: string }>,
): Promise<string> {
  const localDate = localDateOf(punch.at, timeZone);
  const minute = localMinuteOf(punch.at, timeZone);
  const opensSession = punch.type === "in" && (shift.detection.length === 0 || detectionWindowContains(shift.detection, minute));
  const previousDate = shiftDate(localDate, -1);
  const [openRows] = await tenantTx(access, [
    sqlClient`
      select d.id, (
        select p.type from attendance_punches p
        where p.tenant_id = ${access.tenantId} and p.attendance_day_id = d.id
        order by p.punched_at desc limit 1
      ) as last_type, (
        select p.punched_at from attendance_punches p
        where p.tenant_id = ${access.tenantId} and p.attendance_day_id = d.id
        order by p.punched_at desc limit 1
      ) as last_at
      from attendance_days d
      where d.tenant_id = ${access.tenantId} and d.employee_id = ${employeeId}
        and d.attendance_date = ${previousDate} and d.locked_at is null
      limit 1
    `,
  ]);
  const previous = (openRows as Array<{ id: string; last_type: string | null; last_at: string | null }>)[0];
  const storedLast = previous?.last_type ? { type: previous.last_type, at: Date.parse(String(previous.last_at)) } : null;
  const batchLast = pending
    .filter((entry) => entry.date === previousDate)
    .reduce<{ type: string; at: number } | null>((latest, entry) => {
      const at = Date.parse(entry.at);
      return latest === null || at > latest.at ? { type: entry.type, at } : latest;
    }, null);
  const last = batchLast !== null && (storedLast === null || batchLast.at >= storedLast.at) ? batchLast : storedLast;
  const previousSessionOpen = last?.type === "in";
  // A punch only joins yesterday when yesterday's session is still open; an IN
  // inside today's detection window always starts today's session instead.
  if (previousSessionOpen && !(opensSession && shift.detection.length > 0)) return previousDate;
  return localDate;
}

function localDateOf(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function localMinuteOf(iso: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  return hour * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** Finds or opens the attendance day one session is attributed to. */
async function ensureAttendanceDay(access: Access, employeeId: string, date: string, shiftCode: string) {
  const [existing] = await tenantTx(access, [
    sqlClient`select id, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attendance_date = ${date} limit 1`,
  ]);
  const found = (existing as Array<{ id: string; status: string; locked_at: string | null }>)[0];
  if (found) return found;
  const dayId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, status)
      values (${dayId}, ${access.tenantId}, ${employeeId}, ${date}, ${shiftCode}, 'pending')
      on conflict (tenant_id, employee_id, attendance_date) do nothing
    `,
  ]);
  const [reread] = await tenantTx(access, [
    sqlClient`select id, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attendance_date = ${date} limit 1`,
  ]);
  return (reread as Array<{ id: string; status: string; locked_at: string | null }>)[0] ?? { id: dayId, status: "pending", locked_at: null };
}

export async function ingestPunches(access: Access, input: z.infer<typeof ingestPunchesSchema>, requestId: string) {
  // Recording one's own time is not the same right as recording everybody's:
  // `attendance.write` stays the full-scope key, and the employee role's
  // `attendance.self.write` (migration 0025) is admitted here and then confined
  // to the caller's own employee record. A write never resolves to team scope.
  const scope = attendanceScope(access, "write");
  assertSelfScopeTarget(scope, access.context.employeeId, input.employeeId);
  // A self-scoped caller has already been pinned to their own record; the
  // hierarchy walk below both costs a query and demands the full read key.
  if (scope !== "self") await assertAttendanceEmployeeVisible(access, input.employeeId);
  // A batch is a slice of a device's stream, not a whole day: the tail of an
  // overnight session legitimately arrives on its own, beginning with an OUT. The
  // session boundary is decided by attribution below, never by the batch edges.
  // Alternation is therefore checked per attributed day, against what is already
  // stored, once attribution has run — not against the batch edges here.
  const shift = await resolveShift(access, input.shiftCode);
  await ensureShift(access, input.shiftCode);
  const timeZone = await tenantTimezone(access);
  const ordered = [...input.punches].sort((left, right) => Date.parse(left.at) - Date.parse(right.at));
  const dayByDate = new Map<string, { id: string; status: string; locked_at: string | null }>();
  const attribution: Array<{ punch: (typeof ordered)[number]; date: string; dayId: string }> = [];
  for (const punch of ordered) {
    const date = await attributeSessionDate(
      access,
      input.employeeId,
      punch,
      shift,
      timeZone,
      attribution.map((entry) => ({ date: entry.date, at: entry.punch.at, type: entry.punch.type })),
    );
    let day = dayByDate.get(date);
    if (!day) {
      day = await ensureAttendanceDay(access, input.employeeId, date, input.shiftCode);
      if (day.locked_at) {
        throw new HttpError({ status: 422, code: "PERIOD_LOCKED", message: "The attendance day is locked. Raise a correction instead." });
      }
      dayByDate.set(date, day);
    }
    attribution.push({ punch, date, dayId: day.id });
  }
  // RL-02 across the day boundary, not just the batch: a second punch-in must be
  // refused against the punch already on file, otherwise two clicks leave two lone
  // INs that no session can ever pair. Checked after attribution so an overnight
  // OUT is compared with the session it actually belongs to, and after the locked-day
  // check so a locked day still answers PERIOD_LOCKED.
  for (const date of dayByDate.keys()) {
    const [tailRows] = await tenantTx(access, [sqlClient`
      select lower(punch.type) as type
      from attendance_punches punch
      join attendance_days att_day on att_day.id = punch.attendance_day_id and att_day.tenant_id = punch.tenant_id
      where punch.tenant_id = ${access.tenantId} and att_day.employee_id = ${input.employeeId} and att_day.attendance_date = ${date}
      order by punch.punched_at desc, punch.created_at desc
      limit 1
    `]);
    const refusal = punchSequenceRefusal(
      (tailRows as Array<{ type: string | null }>)[0]?.type ?? null,
      attribution.filter((entry) => entry.date === date).map((entry) => entry.punch.type),
    );
    if (refusal) {
      throw new HttpError({ status: 409, code: "PUNCH_OUT_OF_SEQUENCE", message: refusal });
    }
  }
  const day = dayByDate.get(attribution[0]?.date ?? input.workDate) ?? (await ensureAttendanceDay(access, input.employeeId, input.workDate, input.shiftCode));
  // Every distinct channel in this batch needs its source row before the events are written.
  const sourceIds = new Map<string, string>();
  for (const channel of new Set(input.punches.map((punch) => punch.source))) {
    sourceIds.set(channel, await ensureAttendanceSource(access, channel));
  }
  const punchIds: string[] = [];
  await tenantTx(access, [
    ...attribution.flatMap(({ punch, date, dayId }) => {
      const id = crypto.randomUUID();
      punchIds.push(id);
      // attendance_punches holds the columns the day engine reads; the event envelope
      // holds the rest of the capture evidence (geo, selfie, job code, offline flag)
      // and is what the punch register projects. `punch_date` is where the punch
      // physically happened; `attendance_date` is the session it belongs to (RL-01).
      const event = {
        event_id: id,
        direction: punch.type,
        time: toClockString(punch.at, timeZone),
        punch_date: localDateOf(punch.at, timeZone),
        attendance_date: date,
        punched_at: punch.at,
        device: punch.deviceReference ?? null,
        geo_lat: punch.geo?.lat ?? null,
        geo_lng: punch.geo?.lng ?? null,
        geofence_result: punch.geofenceResult ?? null,
        selfie_ref: punch.selfieRef ?? null,
        job_code: punch.jobCode ?? null,
        offline_queued: punch.offlineQueued ?? false,
        note: punch.remark ?? null,
        status: "captured",
      };
      return [
        sqlClient`
          insert into attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source, device_reference)
          values (${id}, ${access.tenantId}, ${dayId}, ${punch.at}, ${punch.type}, ${punch.source}, ${punch.deviceReference ?? null})
        `,
        sqlClient`
          insert into attendance_events (id, tenant_id, employee_id, attendance_source_id, attributes)
          values (${crypto.randomUUID()}, ${access.tenantId}, ${input.employeeId}, ${sourceIds.get(punch.source) ?? null},
            ${JSON.stringify(event)}::jsonb)
        `,
      ];
    }),
    sqlClient`
      update attendance_days set updated_at = now()
      where id = any(${[...dayByDate.values()].map((row) => row.id)}::uuid[]) and tenant_id = ${access.tenantId} and locked_at is null
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.punches_received', 'attendance_day', ${day.id}, 'Punch evidence ingested',
        ${JSON.stringify({ punches: input.punches.length, postedFor: input.workDate, attributedTo: [...dayByDate.keys()] })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'attendance.punches_received', 'attendance_day', ${day.id},
        ${JSON.stringify({ employeeId: input.employeeId, workDate: input.workDate, attributedTo: [...dayByDate.keys()], punches: input.punches.length })}::jsonb)
    `,
  ]);
  return {
    dayId: day.id,
    punches: punchIds.length,
    status: "pending",
    /** The session dates the batch was filed against, which need not be `workDate` (RL-01). */
    attributedDates: [...dayByDate.keys()],
  };
}

function toClockString(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/** Facts about the employee that the day rules resolve against, in RL-05 order. */
type EmployeeRuleContext = {
  designationLevel: number;
  category: string;
  /** Employee-record override first, then the worker category; null when neither states one. */
  otEligibility: string | null;
  restDayPattern: string | null;
  hasRestDay: boolean;
};

async function loadEmployeeRuleContext(access: Access, employeeId: string): Promise<EmployeeRuleContext> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.designation_level, e.category,
             coalesce(nullif(a.attributes->>'overrideOtEligibility', ''), wc.attributes->>'ot_eligibility') as ot_eligibility,
             coalesce(nullif(a.attributes->>'overrideRestDayPattern', ''), wc.attributes->>'rest_day_pattern') as rest_day_pattern,
             a.attributes->>'overrideHasRestDays' as override_has_rest_days
      from employees e
      left join lateral (
        select em.id, em.worker_category_id from employments em
        where em.tenant_id = e.tenant_id and em.employee_id = e.id
        order by em.created_at desc limit 1
      ) em on true
      left join worker_categories wc on wc.tenant_id = e.tenant_id and wc.id = em.worker_category_id
      left join lateral (
        select ea.attributes from employee_assignments ea
        where ea.tenant_id = e.tenant_id and ea.employment_id = em.id and ea.record_status = 'active'
        order by ea.created_at desc limit 1
      ) a on true
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId} limit 1
    `,
  ]);
  const row = (rows as Array<{ designation_level: number; category: string; ot_eligibility: string | null; rest_day_pattern: string | null; override_has_rest_days: string | null }>)[0];
  const category = row?.category ?? "regular";
  // RL-05. Rest-day applicability follows the resolved pattern - `!== "none"` is the
  // one comparison both pattern vocabularies agree on, and it is what
  // `src/server/organization/work-rules.ts` resolves for every other caller. The
  // category-literal table this used to consult was a second answer to the same
  // question, and telling two worker categories apart must stay configuration.
  const declaredRestDay = hasRestDaysFromPattern(row?.rest_day_pattern ?? null) ?? false;
  return {
    designationLevel: Number(row?.designation_level ?? 0),
    category,
    otEligibility: row?.ot_eligibility ?? null,
    restDayPattern: row?.rest_day_pattern ?? null,
    hasRestDay: row?.override_has_rest_days === null || row?.override_has_rest_days === undefined
      ? declaredRestDay
      : row.override_has_rest_days === "true",
  };
}

/**
 * The OT eligibility basis (RL-04, T-04). The employee record's own
 * `PL_OT_ELIGIBILITY` override wins over the worker category's `ot_eligibility`,
 * which is the resolution order RL-05 states for rest days and the same masters
 * carry for overtime.
 *
 * "Beyond weekly hours only" has no per-day answer - the weekly cap it refers to is
 * stated nowhere - so it is treated as eligible and recorded as a gap rather than
 * silently zeroing a day's overtime.
 */
function overtimeBasisOf(context: EmployeeRuleContext): "all-days" | "rest-holiday-only" | "not-eligible" {
  switch (context.otEligibility) {
    case "none":
      return "not-eligible";
    case "rest_day_and_holiday_only":
    case "restday_holiday_only":
      return "rest-holiday-only";
    default:
      return "all-days";
  }
}

export type DayType = "working" | "rest_day" | "holiday";

/**
 * Working day, rest day or holiday for one employee and date.
 *
 * A published holiday record outranks everything. A rest day is only claimed where
 * the configured pattern actually names a day: a rotating weekly off is decided by
 * the roster, and guessing a day here would hand out unearned rest-day overtime.
 */
async function resolveDayType(access: Access, context: EmployeeRuleContext, date: string): Promise<DayType> {
  const [holidayRows] = await tenantTx(access, [
    sqlClient`
      select 1 from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'holidays'
        and status in ('approved', 'published') and data->>'holidayDate' = ${date}
      limit 1
    `,
  ]);
  if ((holidayRows as unknown[]).length > 0) return "holiday";
  if (!context.hasRestDay) return "working";
  const sunday = new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
  const pattern = context.restDayPattern ?? "";
  if (sunday && (pattern === "fixed_sunday" || pattern === "fixed_sunday_alt_saturday")) return "rest_day";
  return "working";
}

/** One punch as the engine reads it, with the day row it was filed against. */
type SessionPunch = { punched_at: string; type: "in" | "out"; day_date: string; event_id: string | null };

/**
 * The punches of one session (RL-01).
 *
 * Ingest files each punch against the date its session belongs to, so a day's own
 * punches are normally the whole session. The next date is still consulted for rows
 * written before attribution existed: where this day's sequence is still open and
 * the next date opens with an OUT, that OUT closes this session rather than starting
 * the next one.
 */
async function loadSessionPunches(access: Access, employeeId: string, workDate: string): Promise<SessionPunch[]> {
  const nextDate = shiftDate(workDate, 1);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.punched_at, p.type, d.attendance_date::text as day_date,
             (select e.id from attendance_events e
                where e.tenant_id = p.tenant_id and e.employee_id = d.employee_id
                  and e.attributes->>'event_id' = p.id::text limit 1) as event_id
      from attendance_punches p
      join attendance_days d on d.id = p.attendance_day_id
      where p.tenant_id = ${access.tenantId} and d.employee_id = ${employeeId}
        and d.attendance_date in (${workDate}, ${nextDate})
      order by p.punched_at asc
    `,
  ]);
  const all = rows as SessionPunch[];
  const own = all.filter((punch) => punch.day_date === workDate);
  const spill = all.filter((punch) => punch.day_date === nextDate);
  if (own.length > 0 && own[own.length - 1].type === "in" && spill[0]?.type === "out") return [...own, spill[0]];
  return own;
}

/** The last OUT of the previous day's session, as a clock minute on this date (RL-18). */
async function previousSessionEndMinute(access: Access, employeeId: string, workDate: string, timeZone: string): Promise<number | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.punched_at from attendance_punches p
      join attendance_days d on d.id = p.attendance_day_id
      where p.tenant_id = ${access.tenantId} and d.employee_id = ${employeeId}
        and d.attendance_date = ${shiftDate(workDate, -1)} and p.type = 'out'
      order by p.punched_at desc limit 1
    `,
  ]);
  const last = (rows as Array<{ punched_at: string }>)[0];
  if (!last) return null;
  // Only an OUT that ran past midnight into this date can trigger the extension.
  return localDateOf(last.punched_at, timeZone) === workDate ? localMinuteOf(last.punched_at, timeZone) : null;
}

/** Late marks already recorded in the counter window, this day excluded (RL-17). */
async function lateMarksInWindow(access: Access, employeeId: string, window: { from: string; to: string }, excludeDate: string): Promise<number> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'date' between ${window.from} and ${window.to}
        and attributes->>'date' <> ${excludeDate}
        and coalesce(attributes->>'late_mark_applied', 'false') = 'true'
    `,
  ]);
  return (rows as Array<{ total: number }>)[0]?.total ?? 0;
}

/** Night extensions already used in the counter window, this day excluded (Q-11). */
async function nightExtensionsInWindow(access: Access, employeeId: string, window: { from: string; to: string }, excludeDate: string): Promise<number> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'date' between ${window.from} and ${window.to}
        and attributes->>'date' <> ${excludeDate}
        and coalesce(attributes->>'night_extension_applied', 'false') = 'true'
    `,
  ]);
  return (rows as Array<{ total: number }>)[0]?.total ?? 0;
}

/**
 * RL-03 / Q-01: every gap between an OUT and the following IN is a break, written to
 * the break register with its start, end and duration, and reported rather than
 * deducted. The constant is here so the decision is visible where net time is built.
 */
const DEDUCTED_BREAK_MINUTES = 0;

/** Minutes after the shift start, treating an early arrival as zero rather than negative. */
function lateMinutes(shiftStartMinute: number, arrivalMinute: number): number {
  const difference = (arrivalMinute - shiftStartMinute + 1440) % 1440;
  return difference > 720 ? 0 : difference;
}

/**
 * FRM-TIM-04 `early_out_minutes`: minutes short of the shift end, treating a late
 * departure as zero. The mirror of `lateMinutes`, and wrapped the same way so a shift
 * that ends after midnight measures against its own end rather than the clock's.
 */
function earlyOutMinutes(shiftEndMinute: number, departureMinute: number): number {
  const difference = (shiftEndMinute - departureMinute + 1440) % 1440;
  return difference > 720 ? 0 : difference;
}

/**
 * FRM-TIM-04 `attendance_segment[]`: one entry per IN/OUT pair of the session.
 *
 * A day is stored as a single attendance row, so an employee who punches out and back
 * in twice had no record of which stretch was which — the day register already asked
 * for a segment number and nothing ever wrote one. Each segment carries its own
 * ordinal, clock times and worked minutes; the gaps between them are the breaks, which
 * are reported separately (RL-03).
 */
function sessionSegments(
  session: readonly SessionPunch[],
  timeZone: string,
): Array<{ segment: number; in: string; out: string | null; minutes: number | null }> {
  const segments: Array<{ segment: number; in: string; out: string | null; minutes: number | null }> = [];
  for (const punch of session) {
    if (punch.type === "in") {
      segments.push({ segment: segments.length + 1, in: toClockString(punch.punched_at, timeZone), out: null, minutes: null });
      continue;
    }
    const open = segments[segments.length - 1];
    // An OUT with no open segment is an unpaired punch; the day's exception handling
    // reports it, and inventing a segment for it here would hide it.
    if (!open || open.out !== null) continue;
    open.out = toClockString(punch.punched_at, timeZone);
    open.minutes = Math.max(0, Math.round((Date.parse(punch.punched_at) - Date.parse(segmentStart(session, open.segment))) / 60000));
  }
  return segments;
}

/** The ISO instant the nth segment opened, so a segment's minutes come from real timestamps. */
function segmentStart(session: readonly SessionPunch[], ordinal: number): string {
  let seen = 0;
  for (const punch of session) {
    if (punch.type !== "in") continue;
    seen += 1;
    if (seen === ordinal) return punch.punched_at;
  }
  return session[0]?.punched_at ?? new Date().toISOString();
}

async function calculateDay(access: Access, dayId: string, persist: boolean) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [dayRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attendance_date::text as work_date, assigned_shift, detected_shift, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and id = ${dayId} limit 1`,
  ]);
  const day = (dayRows as Array<{ id: string; employee_id: string; work_date: string; assigned_shift: string; detected_shift: string | null; status: string; locked_at: string | null }>)[0];
  if (!day) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const timeZone = await tenantTimezone(access);
  const [gateRows] = await tenantTx(access, [
    sqlClient`
      select (attributes->>'minutes')::int as minutes from gate_passes
      where tenant_id = ${access.tenantId} and employee_id = ${day.employee_id}
        and attributes->>'status' = 'approved' and (attributes->>'date') = ${day.work_date}
    `,
  ]);
  const session = await loadSessionPunches(access, day.employee_id, day.work_date);
  if (session.length < 2) {
    return { day: { ...day, computedStatus: undefined as AttendanceStatus | undefined }, trace: null, reason: "Insufficient punch evidence for this work date." };
  }
  // An unpaired session is evidence of a missing punch, not a day to compute: it is
  // reported back for the exception queue rather than thrown as an engine failure.
  if (session[0].type !== "in" || session[session.length - 1].type !== "out") {
    return {
      day: { ...day, computedStatus: undefined as AttendanceStatus | undefined },
      trace: null,
      reason: "The session does not open with an in punch and close with an out punch. Regularise the missing punch first.",
    };
  }

  // RL-19: the detected shift is resolved from the first in-punch and governs over
  // the rostered one; the rostered code stays on `assigned_shift`, untouched.
  const firstIn = session.find((punch) => punch.type === "in") ?? session[0];
  const firstInMinute = localMinuteOf(firstIn.punched_at, timeZone);
  const configured = await listShiftMaster(access);
  const rosteredShift = await resolveShift(access, day.assigned_shift, configured);
  const records = configured.length > 0 ? configured : [rosteredShift];
  const detection = detectShift(records, day.assigned_shift, firstInMinute);
  const shift = detection.effective === rosteredShift.code
    ? rosteredShift
    : records.find((record) => record.code === detection.effective) ?? rosteredShift;

  const gatePassMinutes = (gateRows as Array<{ minutes: number }>).reduce((total, row) => total + (row.minutes || 0), 0);
  const trace = analyzePunchDay({
    punches: session.map((punch) => ({ type: punch.type, at: toClockString(punch.punched_at, timeZone) })),
    shiftMinutes: shift.durationMinutes,
    approvedGatePassMinutes: gatePassMinutes,
    // RL-04. The base is the shift record's own setting, not the shift duration and
    // not a constant: "OT hours equal gross work hours less the shift OT threshold".
    overtimeBasis: shift.overtimeBasis,
    overtimeAfterMinutes: shift.overtimeAfterMinutes,
  });
  // The figure the thresholds compare against: gross span, no break deduction, plus
  // approved gate-pass time.
  const netMinutes = trace.grossSpanMinutes - DEDUCTED_BREAK_MINUTES + gatePassMinutes;

  // The pack in force on the day itself, so a policy published with a later
  // effective date does not rewrite days already worked.
  const policy = await loadAttendancePolicy(access, day.work_date);
  const employee = await loadEmployeeRuleContext(access, day.employee_id);
  const dayType = await resolveDayType(access, employee, day.work_date);
  const counterWindow = lateCounterWindow(policy.graceLate, day.work_date);

  // RL-17: minutes late are measured from the shift's own start time, and the grace
  // window is the shift's when it sets one and the late policy's otherwise.
  const graceMinutes = shift.graceInMinutes ?? policy.graceLate.graceMinutesIn;
  const lastOut = session[session.length - 1];
  const minutesLate = shift.startMinute === null ? 0 : lateMinutes(shift.startMinute, firstInMinute);

  // RL-18: the extension is decided before the threshold verdict, because its whole
  // purpose is to turn a late, short day into a full one.
  const previousEnd = await previousSessionEndMinute(access, day.employee_id, day.work_date, timeZone);
  // The rule is the one published for this shift (F-SHF-03 "applies to shift"); a
  // shift no rule names is simply outside the extension.
  const nightRule = previousEnd === null ? null : nightExtensionForShift(policy, shift.code);
  let nightExtension = previousEnd === null
    ? { applies: false, reason: "The previous session did not run past midnight into this date." }
    : nightRule === null
      ? { applies: false, reason: `No night extension rule covers shift ${shift.code}.` }
      : evaluateNightExtension({
        previousSessionEndMinute: previousEnd,
        arrivalMinute: firstInMinute,
        departureMinute: localMinuteOf(lastOut.punched_at, timeZone),
        rule: requireNightExtensionRule(nightRule),
      });
  if (nightExtension.applies && nightRule !== null && nightRule.maxUsesPerMonth !== null) {
    const used = await nightExtensionsInWindow(access, day.employee_id, counterWindow, day.work_date);
    if (used >= nightRule.maxUsesPerMonth) {
      nightExtension = { applies: false, reason: `The night extension has already been used ${used} time(s) in this period.` };
    }
  }

  // Q-06: the exemption is a grade rank, and the rank is only read when it would
  // change the outcome, so an unconfigured rank does not block an on-time day.
  const beyondGrace = minutesLate > graceMinutes;
  const exempt = beyondGrace && !nightExtension.applies
    ? employee.designationLevel >= requireExemptGradeRank(policy.graceLate)
    : false;
  const lateOccurrences = beyondGrace ? await lateMarksInWindow(access, day.employee_id, counterWindow, day.work_date) : 0;
  const late = evaluateLateArrival({
    minutesLate,
    lateOccurrencesThisMonth: lateOccurrences,
    assistantManagerOrAbove: exempt,
    workedPast3AmPreviousDay: nightExtension.applies,
    policy: {
      graceMinutes,
      latesAllowedPerMonth: policy.graceLate.latesAllowedPerMonth,
      consequence: policy.graceLate.consequence,
    },
  });

  const thresholdStatus = attendanceStatus(shift.thresholds, netMinutes);
  // RL-18 upgrades as well as exempts: a qualifying night extension gives the day
  // the status the rule names, "Present" as the workbook states it.
  const status: AttendanceStatus = nightExtension.applies && nightRule !== null
    ? nightRule.resultingDayStatus
    : late.status === "Half day" && thresholdStatus === "Present"
      ? "Half day"
      : thresholdStatus;
  const statusReason = nightExtension.applies
    ? nightExtension.reason
    : status === "Half day" && late.status === "Half day"
      ? late.reason
      : `Net-hours threshold for shift ${shift.code}`;

  // RL-04 / T-04: OT is zero where the employee's eligibility basis does not cover
  // this day type, and the basis comes from the employee, not from the request.
  const otPolicy = overtimeBasisOf(employee);
  const otEligible = shift.otEligible && isOvertimeEligible({
    policy: otPolicy,
    isRestDay: dayType === "rest_day",
    isHoliday: dayType === "holiday",
  });
  const payableOtMinutes = otEligible ? trace.overtimeMinutes : 0;

  const departureMinute = localMinuteOf(lastOut.punched_at, timeZone);
  const minutesEarlyOut = shift.endMinute === null ? 0 : earlyOutMinutes(shift.endMinute, departureMinute);
  const segments = sessionSegments(session, timeZone);
  // FRM-TIM-04 `applied_rule_ids`: the rules that actually fired on this day, so a
  // verdict can be traced to the policies behind it rather than only to its numbers.
  // Recorded by identifier, never by prose, because the screen groups on them.
  const appliedRuleIds = [
    `shift:${shift.code}`,
    `ot-basis:${shift.overtimeBasis}`,
    `ot-eligibility:${otPolicy}`,
    ...(detection.detected !== null ? ["RL-19:shift-detection"] : []),
    ...(minutesLate > 0 ? ["RL-17:grace-window"] : []),
    ...(late.late ? ["RL-17:late-mark"] : []),
    ...(nightExtension.applies ? ["RL-18:night-extension"] : []),
    ...(gatePassMinutes > 0 ? ["RL-05:gate-pass-credit"] : []),
    ...(trace.breaks.length > 0 ? ["RL-03:break-register"] : []),
    ...(otEligible && trace.overtimeMinutes > 0 ? ["RL-04:overtime"] : []),
    ...(dayType === "rest_day" ? ["RL-13:rest-day"] : dayType === "holiday" ? ["RL-13:holiday"] : []),
  ];

  const physicalStatus = dayType === "holiday"
    ? "holiday"
    : dayType === "rest_day"
      ? "rest_day"
      : status === "Present" ? "present" : status === "Half day" ? "half_day" : "absent";
  const computed = {
    dayType,
    shiftCode: shift.code,
    rosteredShift: detection.rostered,
    detectedShift: detection.detected,
    detectionReason: detection.reason,
    firstIn: toClockString(firstIn.punched_at, timeZone),
    lastOut: toClockString(lastOut.punched_at, timeZone),
    netMinutes,
    gatePassMinutes,
    minutesLate,
    graceMinutes,
    lateMarkApplied: late.late,
    lateCountInMonth: late.late ? lateOccurrences + 1 : lateOccurrences,
    nightExtensionApplied: nightExtension.applies,
    otPolicy,
    otEligible,
    payableOtMinutes,
    status,
    statusReason,
    physicalStatus,
    minutesEarlyOut,
    segments,
    appliedRuleIds,
    rulesetVersion: policy.version,
    sourceEventCount: session.length,
  };

  if (persist) {
    await persistComputedDay(access, day, computed, trace, session, timeZone, policy.breakTypes);
  }
  return {
    day: { ...day, computedStatus: status, detected_shift: detection.detected ?? day.detected_shift },
    trace: {
      grossSpanMinutes: trace.grossSpanMinutes,
      productiveMinutes: trace.productiveMinutes,
      rawProductiveMinutes: trace.rawProductiveMinutes,
      netMinutes,
      breakMinutes: trace.breakMinutes,
      breaks: trace.breaks,
      overtimeMinutes: trace.overtimeMinutes,
      payableOtMinutes,
      otEligible,
      otPolicy,
      dayType,
      gatePassMinutes,
      shiftMinutes: shift.durationMinutes,
      shiftCode: shift.code,
      rosteredShift: detection.rostered,
      detectedShift: detection.detected,
      detectionReason: detection.reason,
      overtimeBasis: shift.overtimeBasis,
      overtimeAfterMinutes: shift.overtimeAfterMinutes,
      minutesLate,
      graceMinutes,
      lateMarkApplied: late.late,
      lateCountInMonth: computed.lateCountInMonth,
      lateReason: late.reason,
      nightExtensionApplied: nightExtension.applies,
      nightExtensionReason: nightExtension.reason,
      statusReason,
      evidencePunches: session.length,
      minutesEarlyOut,
      segments,
      appliedRuleIds,
      rulesetVersion: policy.version,
      sourceEventCount: session.length,
    },
  };
}

type ComputedDay = {
  dayType: DayType;
  shiftCode: string;
  rosteredShift: string;
  detectedShift: string | null;
  detectionReason: string | null;
  firstIn: string;
  lastOut: string;
  netMinutes: number;
  gatePassMinutes: number;
  minutesLate: number;
  graceMinutes: number;
  lateMarkApplied: boolean;
  lateCountInMonth: number;
  nightExtensionApplied: boolean;
  minutesEarlyOut: number;
  segments: Array<{ segment: number; in: string; out: string | null; minutes: number | null }>;
  appliedRuleIds: string[];
  rulesetVersion: string;
  sourceEventCount: number;
  otPolicy: string;
  otEligible: boolean;
  payableOtMinutes: number;
  status: AttendanceStatus;
  statusReason: string;
  physicalStatus: string;
};

/** The attendance policy row every envelope attendance record hangs off. */
/**
 * The overtime policy an entry hangs off. `overtime_entries.overtime_policy_id` is NOT
 * NULL and the register reads the entry's multiplier through it, so an entry cannot be
 * written without one. The rate is the workbook's own standard policy; a tenant that
 * configures its own keeps it, because this only ever inserts when none exists.
 */
async function ensureOvertimePolicyRow(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from overtime_policies where tenant_id = ${access.tenantId} order by created_at asc limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into overtime_policies (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: "OT-STANDARD", name: "Standard Factory Overtime Policy", rate_multiplier: 2 })}::jsonb)`,
  ]);
  return id;
}

/**
 * The overtime entry for a computed day (FRM-TIM-07).
 *
 * `overtime_entries` is what the overtime approval queue, the team history register and
 * the day register all read — and nothing wrote it, so the queue showed only whatever a
 * seeder had put there and a genuinely worked overtime day never reached an approver.
 * Overtime *payment* never depended on it (the payroll OT run reads the locked day's own
 * `payable_ot_minutes`), which is exactly why the gap went unnoticed.
 *
 * The entry is re-derived on every recompute like the rest of the day. An approver's own
 * figures are preserved: `ot_minutes_payable`, the approval stamp and the pay-run tag are
 * left alone once set, because the engine's job is to report what was worked, not to
 * overrule a decision somebody already took. A day that no longer earns overtime has its
 * undecided entry withdrawn rather than left standing at zero.
 */
async function persistOvertimeEntry(
  access: Access,
  day: { employee_id: string; work_date: string },
  entryId: string,
  computed: ComputedDay,
  trace: { overtimeMinutes: number },
): Promise<void> {
  const [existingRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes->>'approved_on' as approved_on, paid_payroll_run_id::text as paid_run
      from overtime_entries
      where tenant_id = ${access.tenantId} and employee_id = ${day.employee_id}
        and attributes->>'ot_date' = ${day.work_date}
      limit 1
    `,
  ]);
  const existing = (existingRows as Array<{ id: string; approved_on: string | null; paid_run: string | null }>)[0];
  const decided = Boolean(existing?.approved_on) || Boolean(existing?.paid_run);

  if (computed.payableOtMinutes <= 0) {
    // Nothing earned. An entry nobody has acted on is withdrawn; a decided one stays,
    // because retracting an approved figure is an approver's call and not a recompute's.
    if (existing && !decided) {
      await tenantTx(access, [
        sqlClient`delete from overtime_entries where tenant_id = ${access.tenantId} and id = ${existing.id}`,
      ]);
    }
    return;
  }

  const policyId = await ensureOvertimePolicyRow(access);
  const attributes = {
    ot_date: day.work_date,
    ot_minutes: computed.payableOtMinutes,
    ot_minutes_raw: trace.overtimeMinutes,
    ot_hours: minutesToHours(computed.payableOtMinutes),
    eligibility_basis: computed.otPolicy,
    day_type: computed.dayType === "rest_day" ? "Weekly Off" : computed.dayType === "holiday" ? "Holiday" : "Working",
    shift_code: computed.shiftCode,
    source: "attendance.recompute",
    computed_at: new Date().toISOString(),
  };
  if (existing) {
    await tenantTx(access, [
      sqlClient`
        update overtime_entries
        set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify(attributes)}::jsonb,
            attendance_entry_id = ${entryId}, overtime_policy_id = ${policyId}, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${existing.id}
      `,
    ]);
    return;
  }
  await tenantTx(access, [
    sqlClient`
      insert into overtime_entries (id, tenant_id, employee_id, attendance_entry_id, overtime_policy_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${day.employee_id}, ${entryId}, ${policyId},
        ${JSON.stringify(attributes)}::jsonb)
    `,
  ]);
}

/** Minutes as the register's `H:MM` label, so the stored hours and the shown hours agree. */
function minutesToHours(minutes: number): string {
  const whole = Math.floor(minutes / 60);
  return `${whole}:${String(minutes % 60).padStart(2, "0")}`;
}

async function ensureAttendancePolicyRow(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from attendance_policies where tenant_id = ${access.tenantId} and attributes->>'code' = 'STD' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into attendance_policies (id, tenant_id, attributes) values (${id}, ${access.tenantId}, '{"code":"STD"}'::jsonb)`,
  ]);
  return id;
}

/**
 * Writes the computed day everywhere it has to be readable.
 *
 * `attendance_days` stays the engine's own row, and the envelope `attendance_entries`
 * row is what the daily register, the team history and the punch register read - the
 * engine used to write only the first, which is why a computed day never reached a
 * screen and its punches stayed "ingested". The session and its breaks are written
 * as records in their own right so the break register (RP-01) has rows to report.
 */
async function persistComputedDay(
  access: Access,
  day: { id: string; employee_id: string; work_date: string; assigned_shift: string; status: string; locked_at: string | null },
  computed: ComputedDay,
  trace: ReturnType<typeof analyzePunchDay>,
  session: SessionPunch[],
  timeZone: string,
  breakTypes: string[],
): Promise<void> {
  const policyId = await ensureAttendancePolicyRow(access);
  const shiftId = await ensureShift(access, computed.shiftCode);
  await tenantTx(access, [
    sqlClient`
      update attendance_days
      set gross_span_minutes = ${trace.grossSpanMinutes}, productive_minutes = ${trace.productiveMinutes},
          break_minutes = ${trace.breakMinutes}, credited_gate_pass_minutes = ${computed.gatePassMinutes},
          payable_ot_minutes = ${computed.payableOtMinutes},
          detected_shift = ${computed.detectedShift},
          status = ${day.locked_at ? day.status : computed.physicalStatus}, updated_at = now()
      where id = ${day.id} and tenant_id = ${access.tenantId} and locked_at is null
    `,
  ]);

  const attributes = {
    date: day.work_date,
    day_type: computed.dayType === "rest_day" ? "Weekly Off" : computed.dayType === "holiday" ? "Holiday" : "Working",
    status: computed.status,
    status_reason: computed.statusReason,
    shift_assigned: computed.rosteredShift,
    shift_applied: computed.shiftCode,
    detected_shift: computed.detectedShift,
    shift_override_reason: computed.detectedShift === null ? null : computed.detectionReason,
    first_in: computed.firstIn,
    last_out: computed.lastOut,
    gross_minutes: trace.grossSpanMinutes,
    net_minutes: computed.netMinutes,
    break_minutes: trace.breakMinutes,
    productive_minutes: trace.productiveMinutes,
    // FRM-TIM-04's own field name, and the one every reader asks for — the exception
    // register, the team history register, the VP screens and the day projection. The
    // engine used to write `gatepass_minutes_credited`, which nothing read, so credited
    // gate-pass minutes were computed correctly and then shown as blank everywhere.
    gate_pass_minutes: computed.gatePassMinutes,
    overtime_minutes: computed.payableOtMinutes,
    ot_basis_minutes: trace.overtimeBasis === "gross-span" ? trace.grossSpanMinutes : trace.productiveMinutes,
    ot_eligibility_basis: computed.otPolicy,
    ot_eligible: computed.otEligible,
    minutes_late: computed.minutesLate,
    grace_minutes: computed.graceMinutes,
    late_mark_applied: computed.lateMarkApplied,
    late_count_in_month: computed.lateCountInMonth,
    night_extension_applied: computed.nightExtensionApplied,
    early_out_minutes: computed.minutesEarlyOut,
    attendance_segment: computed.segments,
    applied_rule_ids: computed.appliedRuleIds,
    ruleset_version: computed.rulesetVersion,
    source_event_count: computed.sourceEventCount,
    attendance_day_id: day.id,
    computed_at: new Date().toISOString(),
  };
  const [entryRows] = await tenantTx(access, [
    sqlClient`select id from attendance_entries where tenant_id = ${access.tenantId} and employee_id = ${day.employee_id} and attributes->>'date' = ${day.work_date} limit 1`,
  ]);
  const entryId = (entryRows as Array<{ id: string }>)[0]?.id ?? crypto.randomUUID();
  await tenantTx(access, [
    (entryRows as unknown[]).length > 0
      ? sqlClient`update attendance_entries set attributes = attributes || ${JSON.stringify(attributes)}::jsonb, shift_id = ${shiftId}, updated_at = now()
          where tenant_id = ${access.tenantId} and id = ${entryId}`
      : sqlClient`insert into attendance_entries (id, tenant_id, attendance_policy_id, employee_id, shift_id, attributes)
          values (${entryId}, ${access.tenantId}, ${policyId}, ${day.employee_id}, ${shiftId}, ${JSON.stringify(attributes)}::jsonb)`,
  ]);

  await persistOvertimeEntry(access, day, entryId, computed, trace);
  await persistSessionAndBreaks(access, day, computed, trace, session, shiftId, timeZone, breakTypes);
}

/**
 * RL-03. Each derived break becomes a row of the break register, keyed to the
 * session it was taken inside. Breaks are re-derived on every recompute, so the
 * previous set is replaced rather than added to.
 */
async function persistSessionAndBreaks(
  access: Access,
  day: { id: string; employee_id: string; work_date: string },
  computed: ComputedDay,
  trace: ReturnType<typeof analyzePunchDay>,
  session: SessionPunch[],
  shiftId: string,
  timeZone: string,
  breakTypes: string[],
): Promise<void> {
  const firstIn = session.find((punch) => punch.type === "in") ?? session[0];
  if (!firstIn.event_id) return; // No capture event to anchor the session to; nothing is invented.
  const sessionAttributes = {
    session_date: day.work_date,
    attendance_day_id: day.id,
    shift_code: computed.shiftCode,
    first_in: computed.firstIn,
    last_out: computed.lastOut,
    duration_minutes: trace.grossSpanMinutes,
    net_minutes: computed.netMinutes,
    break_minutes: trace.breakMinutes,
    status: "completed",
  };
  const [sessionRows] = await tenantTx(access, [
    sqlClient`select id from attendance_sessions where tenant_id = ${access.tenantId} and employee_id = ${day.employee_id} and attributes->>'session_date' = ${day.work_date} limit 1`,
  ]);
  const sessionId = (sessionRows as Array<{ id: string }>)[0]?.id ?? crypto.randomUUID();
  const lastOutEventId = [...session].reverse().find((punch) => punch.type === "out")?.event_id ?? null;
  await tenantTx(access, [
    (sessionRows as unknown[]).length > 0
      ? sqlClient`update attendance_sessions set attributes = attributes || ${JSON.stringify(sessionAttributes)}::jsonb, shift_id = ${shiftId},
            in_event_id = ${firstIn.event_id}, out_event_id = ${lastOutEventId}, updated_at = now()
          where tenant_id = ${access.tenantId} and id = ${sessionId}`
      : sqlClient`insert into attendance_sessions (id, tenant_id, employee_id, shift_id, in_event_id, out_event_id, attributes)
          values (${sessionId}, ${access.tenantId}, ${day.employee_id}, ${shiftId}, ${firstIn.event_id}, ${lastOutEventId}, ${JSON.stringify(sessionAttributes)}::jsonb)`,
    sqlClient`delete from attendance_breaks where tenant_id = ${access.tenantId} and attendance_session_id = ${sessionId}`,
  ]);

  // The derived breaks come back in session order, and the punch pairs that produced
  // them are walked in the same order, so a break keeps the two events that bound it.
  const pairs: Array<{ out: SessionPunch; in: SessionPunch }> = [];
  for (let index = 0; index < session.length - 1; index += 1) {
    if (session[index].type === "out" && session[index + 1].type === "in") {
      pairs.push({ out: session[index], in: session[index + 1] });
    }
  }
  const defaultType = breakTypes.includes(UNCLASSIFIED_BREAK_TYPE) ? UNCLASSIFIED_BREAK_TYPE : breakTypes[breakTypes.length - 1];
  if (trace.breaks.length === 0) return;
  await tenantTx(access, trace.breaks.map((entry, index) => {
    const pair = pairs[index];
    return sqlClient`
      insert into attendance_breaks (id, tenant_id, attendance_session_id, out_event_id, in_event_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${sessionId}, ${pair?.out.event_id ?? null}, ${pair?.in.event_id ?? null},
        ${JSON.stringify({
          attendance_date: day.work_date,
          employee_id: day.employee_id,
          break_seq: index + 1,
          break_start_time: entry.from,
          break_end_time: entry.to,
          start_time: entry.from,
          end_time: entry.to,
          break_start_ts: pair?.out.punched_at ?? null,
          break_end_ts: pair?.in.punched_at ?? null,
          duration_minutes: entry.minutes,
          break_minutes: entry.minutes,
          // EN_BREAK_TYPE. Nothing in the punch stream says which kind of break this
          // was, so it is reported unclassified rather than guessed as a meal.
          break_type: defaultType,
          deducted: false,
          time_zone: timeZone,
        })}::jsonb)
    `;
  }));
}

/** Pure, repeatable attendance explanation used by GET routes. */
export async function traceDay(access: Access, dayId: string) {
  return calculateDay(access, dayId, false);
}

/** Explicit command for persisting a recalculated day. */
export async function recomputeDay(access: Access, dayId: string, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const result = await calculateDay(access, dayId, true);
  await recordAudit(access, {
    action: "attendance.day_recompute",
    entityType: "attendance_day",
    entityId: dayId,
    reason: "Attendance day explicitly recomputed",
    after: { computedStatus: result.day.computedStatus },
    requestId,
  });
  return result;
}

export async function transitionDay(access: Access, dayId: string, action: "approve" | "lock" | "reopen", requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [dayRows] = await tenantTx(access, [
    sqlClient`select id, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and id = ${dayId} limit 1`,
  ]);
  const day = (dayRows as Array<{ id: string; status: string; locked_at: string | null }>)[0];
  if (!day) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (action === "approve") {
    if (day.locked_at) throw new HttpError({ status: 422, code: "PERIOD_LOCKED", message: "The attendance day is locked." });
    if (day.status !== "pending") {
      throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Day status ${day.status} is already resolved.` });
    }
    // Approval recomputes and persists the trace, resolving pending -> computed.
    const traced = await calculateDay(access, dayId, true);
    await tenantTx(access, [
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'attendance.day_approve', 'attendance_day', ${day.id}, 'Day approved by time office',
          ${JSON.stringify({ to: traced.day.computedStatus })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
    return { id: day.id, from: day.status, to: traced.day.computedStatus ?? "present" };
  }
  if (action === "lock" && day.locked_at) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The attendance day is already locked." });
  }
  if (action === "lock" && day.status === "pending") {
    // A pending day has never been computed, and the computed figures are written
    // `where locked_at is null` — so locking one freezes its zeros permanently. Payroll
    // reads `payable_ot_minutes` off locked days, which meant a worked overtime day that
    // was locked without being approved paid no overtime at all, silently and
    // irreversibly. Approval is what computes and persists the day, so it comes first.
    throw new HttpError({
      status: 422,
      code: "DAY_NOT_COMPUTED",
      message: "This day has not been computed yet, so locking it would freeze empty figures into payroll. Approve the day first.",
      details: [{ field: "action", issue: `Day ${day.id} is still pending. Approve it, which computes and persists the trace, then lock.` }],
    });
  }
  if (action === "lock") {
    // A critical exception blocks the period lock (FRM-TIM-08, Severity): locking
    // over one would freeze a day the time office has not yet settled.
    const [criticalRows] = await tenantTx(access, [
      sqlClient`
        select count(*)::int as total from attendance_exceptions x
        join attendance_days d on d.tenant_id = x.tenant_id and d.employee_id = x.employee_id
        where x.tenant_id = ${access.tenantId} and d.id = ${dayId}
          and x.attributes->>'date' = d.attendance_date::text
          and lower(coalesce(x.attributes->>'severity', '')) = 'critical'
          and lower(coalesce(x.attributes->>'status', '')) not in ('resolved', 'regularized', 'closed', 'approved', 'rejected', 'declined')
      `,
    ]);
    if (((criticalRows as Array<{ total: number }>)[0]?.total ?? 0) > 0) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "A critical attendance exception is still open on this day, so the period cannot be locked.",
      });
    }
  }
  if (action === "reopen" && !day.locked_at) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only a locked day can be reopened." });
  }
  const next = action === "lock" ? "locked" : "pending";
  await tenantTx(access, [
    action === "lock"
      ? sqlClient`update attendance_days set locked_at = now(), updated_at = now() where id = ${day.id} and tenant_id = ${access.tenantId}`
      : sqlClient`update attendance_days set status = 'pending', locked_at = null, updated_at = now() where id = ${day.id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.day_${action}`}, 'attendance_day', ${day.id}, ${`Day ${action} by time office`},
        ${JSON.stringify({ from: day.status, to: next })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    ...(action === "reopen"
      ? [sqlClient`
        insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
        values (${access.tenantId}, 'attendance.day_reopened', 'attendance_day', ${day.id}, '{"invalidatesPayrollReadiness":true}'::jsonb)
      `]
      : []),
  ]);
  return { id: day.id, from: day.status, to: next };
}

export async function listDays(access: Access, args: { employeeId: string; from: string; to: string; page: number; pageSize: number }) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, args.employeeId);
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${args.employeeId} and attendance_date between ${args.from} and ${args.to}`,
    sqlClient`
      select id, employee_id, attendance_date::text as work_date, assigned_shift, gross_span_minutes, productive_minutes,
             break_minutes, payable_ot_minutes, status, locked_at is not null as locked
      from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${args.employeeId}
        and attendance_date between ${args.from} and ${args.to}
      order by attendance_date desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export type TodayBucket = "present" | "halfDay" | "absent";

/** Pure day-status normalizer for the command-centre aggregate (unit-tested). */
export function normalizeTodayBucket(status: string): TodayBucket | null {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "present" || key === "locked") return "present";
  if (key === "half_day" || key === "halfday") return "halfDay";
  if (key === "absent") return "absent";
  return null;
}

/**
 * Tenant-wide attendance breakdown for the current work date in the tenant's
 * timezone. Employees with an approved leave covering today count as on leave;
 * everyone else without a day row is reported as not recorded (never assumed
 * absent). Read-only; enforced by attendance.read.
 */
export async function summarizeToday(access: Access) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const timezone = await tenantTimezone(access);
  const [dateRows, dayRows, leaveRows, headRows] = await tenantTx(access, [
    sqlClient`select ((now() at time zone ${timezone})::date)::text as today`,
    sqlClient`select employee_id, status from attendance_days where tenant_id = ${access.tenantId} and attendance_date = ((now() at time zone ${timezone})::date)`,
    sqlClient`select distinct employee_id from leave_requests where tenant_id = ${access.tenantId} and status = 'approved' and starts_on <= ((now() at time zone ${timezone})::date) and ends_on >= ((now() at time zone ${timezone})::date)`,
    sqlClient`select count(*)::int as total from employees where tenant_id = ${access.tenantId} and status = 'active'`,
  ]);
  const today = ((dateRows as Array<{ today: string }>)[0]?.today ?? "").slice(0, 10);
  const withDay = new Set<string>();
  let present = 0;
  let halfDay = 0;
  let absent = 0;
  for (const row of dayRows as Array<{ employee_id: string; status: string }>) {
    withDay.add(row.employee_id);
    const bucket = normalizeTodayBucket(row.status);
    if (bucket === "present") present += 1;
    else if (bucket === "halfDay") halfDay += 1;
    else if (bucket === "absent") absent += 1;
  }
  let onLeave = 0;
  for (const row of leaveRows as Array<{ employee_id: string }>) {
    if (!withDay.has(row.employee_id)) onLeave += 1;
  }
  const total = ((headRows as Array<{ total: number }>)[0]?.total ?? 0);
  const notRecorded = Math.max(0, total - withDay.size - onLeave);
  const denominator = present + halfDay + absent + onLeave;
  return {
    date: today,
    present,
    halfDay,
    onLeave,
    absent,
    notRecorded,
    total,
    percentPresent: denominator > 0 ? Math.round(((present + halfDay * 0.5) / denominator) * 1000) / 10 : null,
  };
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Minutes between two same-day HH:MM clock times. Negative when they are out of order. */
function minutesBetween(from: string, to: string): number {
  const [fromHour = 0, fromMinute = 0] = from.split(":").map(Number);
  const [toHour = 0, toMinute = 0] = to.split(":").map(Number);
  return (toHour * 60 + toMinute) - (fromHour * 60 + fromMinute);
}

export const requestGatePassSchema = z
  .object({
    employeeId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fromTime: z.string().regex(TIME_OF_DAY),
    toTime: z.string().regex(TIME_OF_DAY),
    passType: z.enum(picklistValues("PL_GATE_PASS_TYPE")).default("personal"),
    reason: z.string().trim().min(5).max(300),
    expectedReturn: z.string().regex(TIME_OF_DAY).optional(),
  })
  // The duration is derived from the two times, so the pair must be in order; the
  // 2h / 4h personal options are enforced downstream by the gate-pass rule.
  .refine((input) => minutesBetween(input.fromTime, input.toTime) > 0, {
    path: ["toTime"],
    message: "The gate pass must end after it starts.",
  })
  .refine((input) => input.expectedReturn === undefined || minutesBetween(input.fromTime, input.expectedReturn) > 0, {
    path: ["expectedReturn"],
    message: "The expected return must fall after the pass starts.",
  });

export async function requestGatePass(access: Access, input: z.infer<typeof requestGatePassSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const monthStart = `${input.date.slice(0, 7)}-01`;
  const minutes = minutesBetween(input.fromTime, input.toTime);
  // Only personal passes consume the monthly ceiling, so only they are counted and
  // only they are measured against it.
  const [usageRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as count, coalesce(sum((attributes->>'minutes')::int), 0)::int as minutes
      from gate_passes
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId}
        and attributes->>'status' in ('approved', 'submitted')
        and coalesce(attributes->>'type', 'personal') = 'personal'
        and created_at >= ${monthStart}::date
    `,
  ]);
  const usage = (usageRows as Array<{ count: number; minutes: number }>)[0] ?? { count: 0, minutes: 0 };
  if (input.passType === "personal") {
    const eligibility = gatePassEligibility({ approvedMinutesThisMonth: usage.minutes, approvedCountThisMonth: usage.count, requestedMinutes: minutes });
    if (!eligibility.eligible) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: eligibility.reasons.join(" ") });
    }
  }
  const [policyRows] = await tenantTx(access, [
    sqlClient`select id from gate_pass_policies where tenant_id = ${access.tenantId} and attributes->>'code' = 'personal-monthly' limit 1`,
  ]);
  let policyId = (policyRows as Array<{ id: string }>)[0]?.id;
  if (!policyId) {
    policyId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into gate_pass_policies (id, tenant_id, attributes)
        values (${policyId}, ${access.tenantId}, '{"code":"personal-monthly","monthly_minutes":240,"max_count":2,"allowed_minutes":[120,240]}'::jsonb)
      `,
    ]);
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into gate_passes (id, tenant_id, employee_id, gate_pass_policy_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${policyId},
        ${JSON.stringify({
          date: input.date,
          from_time: input.fromTime,
          to_time: input.toTime,
          minutes,
          type: input.passType,
          reason: input.reason,
          expected_return: input.expectedReturn ?? input.toTime,
          actual_out_ts: null,
          actual_in_ts: null,
          status: "submitted",
          version: 1,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'gatepass.submit', 'gate_pass', ${id}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted", minutes, passType: input.passType };
}

export const decideGatePassSchema = z
  .object({
    approve: z.boolean(),
    decisionRemarks: z.string().trim().min(1).max(300).optional(),
  })
  // The workbook makes the remark mandatory only when the pass is refused.
  .refine((input) => input.approve || input.decisionRemarks !== undefined, {
    path: ["decisionRemarks"],
    message: "A rejected gate pass must carry its remarks.",
  });

export async function decideGatePass(
  access: Access,
  id: string,
  input: z.infer<typeof decideGatePassSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from gate_passes where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const pass = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!pass) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (pass.attributes.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Gate pass is already ${pass.attributes.status}.` });
  }
  const status = input.approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`update gate_passes set attributes = attributes || ${JSON.stringify({ status, decided_by: access.context.actorUserId, approver: access.context.actorUserId, decision_remarks: input.decisionRemarks ?? null })}::jsonb where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`gatepass.${status}`}, 'gate_pass', ${id}, ${input.decisionRemarks ?? "Gate pass decision"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status };
}

export const recordGateScanSchema = z
  .object({
    actualOut: z.string().datetime({ offset: true }).optional(),
    actualIn: z.string().datetime({ offset: true }).optional(),
  })
  .refine((input) => input.actualOut !== undefined || input.actualIn !== undefined, {
    message: "A gate scan must record an out or an in timestamp.",
  });

/**
 * Records the security gate's own out/in scans against an approved pass. Overstay is
 * not judged here — the scans are the evidence the attendance day is computed from.
 */
export async function recordGateScan(
  access: Access,
  id: string,
  input: z.infer<typeof recordGateScanSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from gate_passes where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const pass = (rows as Array<{ id: string; attributes: { status: string; actual_out_ts: string | null } }>)[0];
  if (!pass) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (pass.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only an approved gate pass can be scanned at the gate." });
  }
  if (input.actualIn !== undefined && input.actualOut === undefined && !pass.attributes.actual_out_ts) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An in scan cannot precede the out scan." });
  }
  const after = {
    ...(input.actualOut !== undefined ? { actual_out_ts: input.actualOut } : {}),
    ...(input.actualIn !== undefined ? { actual_in_ts: input.actualIn } : {}),
  };
  await tenantTx(access, [
    sqlClient`update gate_passes set attributes = attributes || ${JSON.stringify(after)}::jsonb, updated_at = now()
      where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'gatepass.scan', 'gate_pass', ${id}, 'Gate scan recorded', ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, ...after };
}

/** Audit action for a supervisor / HR override of one computed attendance day. */
export const DAY_OVERRIDE_ACTION = "attendance.day_override";

export const overrideAttendanceDaySchema = z
  .object({
    overrideShiftCode: z.string().trim().min(1).max(20).optional(),
    overrideStatus: z.enum(picklistValues("PL_ATTENDANCE_STATUS")).optional(),
    reason: z.string().trim().min(10).max(300),
  })
  .refine((input) => input.overrideShiftCode !== undefined || input.overrideStatus !== undefined, {
    message: "An override must change the shift, the status, or both.",
  });

/**
 * Overrides the shift and/or the disposition of one computed day.
 *
 * The previous values are written into the audit event's `before`, so the change
 * is a recorded delta rather than a silent overwrite, and the recompute the
 * override calls for is queued as its own audit trace (there is no job table —
 * see recompute-monitor.ts). A locked day is refused: a locked period produces
 * arrears, never a rewrite.
 */
export async function overrideAttendanceDay(
  access: Access,
  id: string,
  input: z.infer<typeof overrideAttendanceDaySchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.employee_id, a.record_status,
             a.attributes->>'date' as date,
             a.attributes->>'status' as status,
             coalesce(a.attributes->>'shift_applied', a.attributes->>'shift_assigned') as shift_applied,
             coalesce(a.attributes->>'locked_at', '') as locked_at
      from attendance_entries a where a.tenant_id = ${access.tenantId} and a.id = ${id} limit 1
    `,
  ]);
  const day = (rows as Array<{ id: string; employee_id: string; record_status: string; date: string | null; status: string | null; shift_applied: string | null; locked_at: string }>)[0];
  if (!day) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, day.employee_id);
  if (day.record_status === "locked" || day.locked_at !== "") {
    throw new HttpError({
      status: 422,
      code: "PERIOD_LOCKED",
      message: "This attendance day is locked. A locked period is corrected through arrears, not by an override.",
    });
  }
  const before = { shift_applied: day.shift_applied, status: day.status };
  const after = {
    ...(input.overrideShiftCode !== undefined ? { shift_applied: input.overrideShiftCode } : {}),
    ...(input.overrideStatus !== undefined ? { status: input.overrideStatus } : {}),
    override_reason: input.reason,
    recompute_required: true,
  };
  await tenantTx(access, [
    sqlClient`update attendance_entries set attributes = attributes || ${JSON.stringify(after)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${DAY_OVERRIDE_ACTION}, 'attendance_entry', ${id}, ${input.reason},
        ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${RECOMPUTE_QUEUE_ACTION}, 'attendance_recompute', ${day.employee_id}, ${`Override on ${day.date ?? "an undated day"}: ${input.reason}`},
        ${JSON.stringify({ scope: "Single day", employee_scope: day.employee_id, from_date: day.date, to_date: day.date, status: "queued" })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, before, after };
}
