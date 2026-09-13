import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  analyzePunchDay,
  attendanceStatus,
  gatePassEligibility,
  type AttendanceStatus,
} from "@/lib/hr-rules";
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

export const ingestPunchesSchema = z.object({
  employeeId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shiftCode: z.enum(["A", "B", "C"]).default("A"),
  punches: z.array(z.object({
    at: z.string().datetime({ offset: true }),
    type: z.enum(["in", "out"]),
    source: z.string().trim().min(1).max(40).default("web"),
    deviceReference: z.string().max(120).optional(),
  })).min(2).max(32),
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
  const punchIds: string[] = [];
  await tenantTx(access, [
    ...input.punches.map((punch) => {
      const id = crypto.randomUUID();
      punchIds.push(id);
      return sqlClient`
        insert into attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source, device_reference)
        values (${id}, ${access.tenantId}, ${day.id}, ${punch.at}, ${punch.type}, ${punch.source}, ${punch.deviceReference ?? null})
      `;
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

export const requestGatePassSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.union([z.literal(120), z.literal(240)]),
  reason: z.string().trim().min(1).max(300),
});

export async function requestGatePass(access: Access, input: z.infer<typeof requestGatePassSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const monthStart = `${input.date.slice(0, 7)}-01`;
  const [usageRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as count, coalesce(sum((attributes->>'minutes')::int), 0)::int as minutes
      from gate_passes
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId}
        and attributes->>'status' in ('approved', 'submitted')
        and created_at >= ${monthStart}::date
    `,
  ]);
  const usage = (usageRows as Array<{ count: number; minutes: number }>)[0] ?? { count: 0, minutes: 0 };
  const eligibility = gatePassEligibility({ approvedMinutesThisMonth: usage.minutes, approvedCountThisMonth: usage.count, requestedMinutes: input.minutes });
  if (!eligibility.eligible) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: eligibility.reasons.join(" ") });
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
        ${JSON.stringify({ date: input.date, minutes: input.minutes, reason: input.reason, status: "submitted", version: 1 })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'gatepass.submit', 'gate_pass', ${id}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted" };
}

export async function decideGatePass(access: Access, id: string, approve: boolean, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from gate_passes where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const pass = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!pass) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (pass.attributes.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Gate pass is already ${pass.attributes.status}.` });
  }
  const status = approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`update gate_passes set attributes = attributes || ${JSON.stringify({ status, decided_by: access.context.actorUserId })}::jsonb where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`gatepass.${status}`}, 'gate_pass', ${id}, 'Gate pass decision', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status };
}
