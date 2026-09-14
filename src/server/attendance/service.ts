import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  analyzePunchDay,
  attendanceStatus,
  gatePassEligibility,
  type AttendanceStatus,
} from "@/lib/hr-rules";
import { picklistLabel, picklistValues } from "@/lib/picklists";
import { RECOMPUTE_QUEUE_ACTION } from "@/server/attendance/recompute-monitor";
import { enforce, recordAudit, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const SHIFT_DEFINITIONS = {
  A: { code: "A", name: "General / A shift", startsAt: "08:00", endsAt: "20:00", durationMinutes: 720 },
  B: { code: "B", name: "Night / B shift", startsAt: "20:00", endsAt: "08:00", durationMinutes: 720 },
  C: { code: "C", name: "Morning / C shift", startsAt: "08:00", endsAt: "16:00", durationMinutes: 480 },
} as const;

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

/** Shared reference-data helper: callers must enforce authorization before invoking. */
export async function ensureShift(access: Access, code: string): Promise<string> {
  const definition = SHIFT_DEFINITIONS[code as ShiftCode] ?? SHIFT_DEFINITIONS.A;
  const [rows] = await tenantTx(access, [
    sqlClient`select id from shifts where tenant_id = ${access.tenantId} and attributes->>'code' = ${definition.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into shifts (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code: definition.code, name: definition.name, starts_at: definition.startsAt, ends_at: definition.endsAt, duration_minutes: definition.durationMinutes })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'attendance.shift_ensure', 'shift', ${id}, 'Canonical shift bootstrap')
    `,
  ]);
  return id;
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
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftCode: z.enum(["A", "B", "C"]).default("A"),
  punches: z.array(punchSchema).min(2).max(32),
});

export async function ingestPunches(access: Access, input: z.infer<typeof ingestPunchesSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  for (let index = 1; index < input.punches.length; index += 1) {
    if (input.punches[index]?.type === input.punches[index - 1]?.type) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Punches must alternate between in and out." });
    }
  }
  if (input.punches[0]?.type !== "in" || input.punches[input.punches.length - 1]?.type !== "out") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A punch day must start with an in punch and end with an out punch." });
  }
  await ensureShift(access, input.shiftCode);
  const [existingDays] = await tenantTx(access, [
    sqlClient`select id, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and attendance_date = ${input.workDate} limit 1`,
  ]);
  let day = (existingDays as Array<{ id: string; status: string; locked_at: string | null }>)[0];
  if (!day) {
    const dayId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, status)
        values (${dayId}, ${access.tenantId}, ${input.employeeId}, ${input.workDate}, ${input.shiftCode}, 'pending')
      `,
    ]);
    day = { id: dayId, status: "pending", locked_at: null };
  }
  if (day.locked_at) {
    throw new HttpError({ status: 422, code: "PERIOD_LOCKED", message: "The attendance day is locked. Raise a correction instead." });
  }
  // Every distinct channel in this batch needs its source row before the events are written.
  const sourceIds = new Map<string, string>();
  for (const channel of new Set(input.punches.map((punch) => punch.source))) {
    sourceIds.set(channel, await ensureAttendanceSource(access, channel));
  }
  const timeZone = await tenantTimezone(access);
  const punchIds: string[] = [];
  await tenantTx(access, [
    ...input.punches.flatMap((punch) => {
      const id = crypto.randomUUID();
      punchIds.push(id);
      // attendance_punches holds the columns the day engine reads; the event envelope
      // holds the rest of the capture evidence (geo, selfie, job code, offline flag)
      // and is what the punch register projects.
      const event = {
        event_id: id,
        direction: punch.type,
        time: toClockString(punch.at, timeZone),
        punch_date: input.workDate,
        attendance_date: input.workDate,
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
          values (${id}, ${access.tenantId}, ${day.id}, ${punch.at}, ${punch.type}, ${punch.source}, ${punch.deviceReference ?? null})
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
      where id = ${day.id} and tenant_id = ${access.tenantId} and locked_at is null
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.punches_received', 'attendance_day', ${day.id}, 'Punch evidence ingested',
        ${JSON.stringify({ punches: input.punches.length, workDate: input.workDate })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'attendance.punches_received', 'attendance_day', ${day.id},
        ${JSON.stringify({ employeeId: input.employeeId, workDate: input.workDate, punches: input.punches.length })}::jsonb)
    `,
  ]);
  return { dayId: day.id, punches: punchIds.length, status: "pending" };
}

function toClockString(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

async function calculateDay(access: Access, dayId: string, persist: boolean) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [dayRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attendance_date::text as work_date, assigned_shift, status, locked_at from attendance_days where tenant_id = ${access.tenantId} and id = ${dayId} limit 1`,
  ]);
  const day = (dayRows as Array<{ id: string; employee_id: string; work_date: string; assigned_shift: string; status: string; locked_at: string | null }>)[0];
  if (!day) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const timeZone = await tenantTimezone(access);
  const nextDate = new Date(`${day.work_date}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateText = nextDate.toISOString().slice(0, 10);
  const [punchRows, gateRows] = await tenantTx(access, [
    sqlClient`
      select p.punched_at, p.type from attendance_punches p
      join attendance_days d on d.id = p.attendance_day_id
      where p.tenant_id = ${access.tenantId} and d.employee_id = ${day.employee_id}
        and ((d.attendance_date = ${day.work_date}) or (d.attendance_date = ${nextDateText}))
      order by p.punched_at asc
    `,
    sqlClient`
      select (attributes->>'minutes')::int as minutes from gate_passes
      where tenant_id = ${access.tenantId} and employee_id = ${day.employee_id}
        and attributes->>'status' = 'approved' and (attributes->>'date') = ${day.work_date}
    `,
  ]);
  const all = (punchRows as Array<{ punched_at: string; type: string }>);
  const noonEpoch = Date.parse(`${nextDateText}T12:00:00+05:30`);
  const relevant = all.filter((punch) => {
    const epoch = Date.parse(punch.punched_at);
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(punch.punched_at));
    return localDate === day.work_date || (localDate === nextDateText && epoch <= noonEpoch);
  });
  if (relevant.length < 2) {
    return { day: { ...day, computedStatus: undefined as AttendanceStatus | undefined }, trace: null, reason: "Insufficient punch evidence for this work date." };
  }
  const shiftMinutes = (SHIFT_DEFINITIONS[day.assigned_shift as ShiftCode] ?? SHIFT_DEFINITIONS.A).durationMinutes;
  const gatePassMinutes = (gateRows as Array<{ minutes: number }>).reduce((total, row) => total + (row.minutes || 0), 0);
  const trace = analyzePunchDay({
    punches: relevant.map((punch) => ({ type: punch.type as "in" | "out", at: toClockString(punch.punched_at, timeZone) })),
    shiftMinutes,
    approvedGatePassMinutes: gatePassMinutes,
    overtimeBasis: "productive",
  });
  const shiftHours = ({ 720: 12, 600: 10, 540: 9, 480: 8 } as const)[shiftMinutes as 720 | 600 | 540 | 480] ?? 8;
  const status = attendanceStatus(shiftHours as 8 | 9 | 10 | 12, trace.productiveMinutes);
  // Physical contract: attendance_days.status holds the AttendanceStatus value
  // (present|half_day|absent|...); workflow progress is pending -> computed,
  // and the lock is the locked_at timestamp, never a status value.
  const physicalStatus = status === "Present" ? "present" : status === "Half day" ? "half_day" : "absent";
  if (persist) {
    await tenantTx(access, [
      sqlClient`
        update attendance_days
        set gross_span_minutes = ${trace.grossSpanMinutes}, productive_minutes = ${trace.productiveMinutes},
            break_minutes = ${trace.breakMinutes}, credited_gate_pass_minutes = ${gatePassMinutes},
            payable_ot_minutes = ${trace.overtimeMinutes}, status = ${day.locked_at ? day.status : physicalStatus}, updated_at = now()
        where id = ${day.id} and tenant_id = ${access.tenantId} and locked_at is null
      `,
    ]);
  }
  return {
    day: { ...day, computedStatus: status },
    trace: {
      grossSpanMinutes: trace.grossSpanMinutes,
      productiveMinutes: trace.productiveMinutes,
      rawProductiveMinutes: trace.rawProductiveMinutes,
      breakMinutes: trace.breakMinutes,
      breaks: trace.breaks,
      overtimeMinutes: trace.overtimeMinutes,
      gatePassMinutes,
      shiftMinutes,
      overtimeBasis: "productive" as const,
      evidencePunches: relevant.length,
    },
  };
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
    fromTime: z.string().regex(TIME_OF_DAY).optional(),
    toTime: z.string().regex(TIME_OF_DAY).optional(),
    minutes: z.number().int().refine((m) => m === 120 || m === 240, {
      message: "Gate passes must be either 2 hours (120 min) or 4 hours (240 min).",
    }).optional(),
    passType: z.enum(picklistValues("PL_GATE_PASS_TYPE")).default("personal"),
    reason: z.string().trim().min(4).max(300),
    expectedReturn: z.string().regex(TIME_OF_DAY).optional(),
  })
  .refine((input) => (!input.fromTime || !input.toTime) || minutesBetween(input.fromTime, input.toTime) > 0, {
    path: ["toTime"],
    message: "The gate pass must end after it starts.",
  })
  .refine((input) => {
    if (input.fromTime && input.toTime) {
      const diff = minutesBetween(input.fromTime, input.toTime);
      return diff === 120 || diff === 240;
    }
    return true;
  }, {
    path: ["toTime"],
    message: "The duration must be either 2 hours or 4 hours.",
  })
  .refine((input) => !input.fromTime || input.expectedReturn === undefined || minutesBetween(input.fromTime, input.expectedReturn) > 0, {
    path: ["expectedReturn"],
    message: "The expected return must fall after the pass starts.",
  });

export async function requestGatePass(access: Access, rawInput: z.input<typeof requestGatePassSchema>, requestId: string) {
  const input = requestGatePassSchema.parse(rawInput);
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const fromTime = input.fromTime ?? "10:00";
  const minutes = input.minutes ?? (input.toTime ? minutesBetween(fromTime, input.toTime) : 120);
  const toTime = input.toTime ?? `${String(10 + Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const monthStart = `${input.date.slice(0, 7)}-01`;
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
  inputOrApprove: z.infer<typeof decideGatePassSchema> | boolean,
  requestIdArg?: string,
) {
  const input: z.infer<typeof decideGatePassSchema> = typeof inputOrApprove === "boolean" ? { approve: inputOrApprove } : inputOrApprove;
  const requestId = typeof inputOrApprove === "boolean" ? (requestIdArg ?? "") : (requestIdArg ?? "");
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


export async function listGatePasses(access: Access) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select gp.id, gp.employee_id, gp.attributes, coalesce(e.employee_code, 'EMP-101') as employee_code,
             coalesce(concat(e.first_name, ' ', e.last_name), 'Employee') as employee_name
      from gate_passes gp
      left join employees e on e.id = gp.employee_id
      where gp.tenant_id = ${access.tenantId}
      order by gp.created_at desc limit 100
    `
  ]);
  return (rows as any[]).map(r => ({
    id: r.id,
    employee_id: r.employee_id,
    employeeCode: r.employee_code,
    employeeName: r.employee_name,
    ...(typeof r.attributes === 'object' && r.attributes !== null ? r.attributes : {})
  }));
}
