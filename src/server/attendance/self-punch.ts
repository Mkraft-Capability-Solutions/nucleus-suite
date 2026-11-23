import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { ensureAttendanceSource } from "@/server/attendance/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Employee self-punch (the single punch control, AttendanceFAB).
 *
 * The subject is always the caller's own linked employee (`access.context.employeeId`); no employee id is
 * accepted from the client. The punch instant is the server clock, never a client timestamp, and the work
 * date is "today" in the tenant's timezone. Punches must alternate (first IN, then OUT, IN ...), a locked
 * day refuses new evidence, and every punch is audited and emitted to the outbox for recomputation.
 * Storage mirrors `ingestPunches` (attendance_punches for the day engine + attendance_events envelope).
 */

const SELF_WRITE = ["attendance.self.write", "attendance.write"] as const;
const SELF_READ = ["attendance.self.read", "attendance.read"] as const;
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export const recordPunchSchema = z.object({
  direction: z.enum(["in", "out"]),
  remark: z.string().trim().max(120).optional(),
});
export type RecordPunchInput = z.infer<typeof recordPunchSchema>;

export type PunchView = { id: string; at: string; type: "in" | "out"; source: string | null };
export type ShiftView = { code: string | null; name: string | null; startsAt: string | null; endsAt: string | null; graceMinutes: number | null };
export type PunchDayView = {
  employeeId: string;
  workDate: string;
  timezone: string;
  dayStatus: string | null;
  locked: boolean;
  punches: PunchView[];
  state: "not_started" | "in" | "out";
  firstIn: string | null;
  lastOut: string | null;
  /** Worked minutes from paired punches; an open IN counts up to the server's current time. */
  workedMinutes: number;
  nextDirection: "in" | "out";
  shift: ShiftView | null;
  serverTime: string;
};

/** Any one of the listed permissions admits the call (self key first, full key second). */
export function enforceAny(access: Access, actions: readonly string[]): void {
  let denial: unknown = null;
  for (const action of actions) {
    try {
      enforce(access.context, action, { tenantId: access.tenantId });
      return;
    } catch (error) {
      denial = error;
    }
  }
  throw denial ?? new HttpError({ status: 403, code: "FORBIDDEN", message: "This action is not permitted for the current role." });
}

function ownEmployeeId(access: Access): string {
  const employeeId = access.context.employeeId;
  if (!employeeId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This account is not linked to an employee profile, so it cannot record attendance." });
  }
  return employeeId;
}

/** Pure: pair alternating punches into worked minutes; an open IN runs to `nowIso`. */
export function workedMinutes(punches: ReadonlyArray<Pick<PunchView, "at" | "type">>, nowIso: string): number {
  let total = 0;
  let openedAt: number | null = null;
  for (const punch of punches) {
    const epoch = Date.parse(punch.at);
    if (Number.isNaN(epoch)) continue;
    if (punch.type === "in") openedAt = epoch;
    else if (openedAt !== null) {
      total += Math.max(0, epoch - openedAt);
      openedAt = null;
    }
  }
  if (openedAt !== null) total += Math.max(0, Date.parse(nowIso) - openedAt);
  return Math.floor(total / 60000);
}

/** Pure: the next legal direction, or a policy error when the requested one breaks alternation. */
export function assertAlternation(last: "in" | "out" | null, requested: "in" | "out"): void {
  const expected = last === "in" ? "out" : "in";
  if (requested !== expected) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: expected === "in" ? "You are not punched in. Punch in first." : "You are already punched in. Punch out first.",
    });
  }
}

const SHIFT_SELECT = `select s.attributes->>'code' as code, s.attributes->>'name' as name,
    coalesce(s.attributes->>'start_time', s.attributes->>'starts_at') as starts_at,
    coalesce(s.attributes->>'end_time', s.attributes->>'ends_at') as ends_at,
    (select case when p.attributes->>'grace_in_min' ~ '^[0-9]+$' then (p.attributes->>'grace_in_min')::int
                 when p.attributes->>'grace_minutes' ~ '^[0-9]+$' then (p.attributes->>'grace_minutes')::int else null end
       from attendance_policies p
      where p.tenant_id = sa.tenant_id and p.record_status = 'active'
        and (p.attributes->>'shift_hours' = (case when s.attributes->>'duration_minutes' ~ '^[0-9]+$'
                                                  then ((s.attributes->>'duration_minutes')::int / 60)::text end)
             or upper(coalesce(p.attributes->>'code', '')) = 'STD')
      order by (p.attributes->>'shift_hours' is not null) desc, p.created_at asc limit 1) as grace_minutes
  from shift_assignments sa
  join shifts s on s.tenant_id = sa.tenant_id and s.id = sa.shift_id
  where sa.tenant_id = $1 and sa.employee_id = $2::uuid and sa.record_status = 'active'
    and coalesce(sa.attributes->>'active', 'true') <> 'false'
  order by coalesce(sa.attributes->>'effective_from', '') desc, sa.created_at desc
  limit 1`;

type DayRow = { id: string; status: string | null; locked: boolean };
type PunchRow = { id: string; at: string; type: "in" | "out"; source: string | null };
type ShiftRow = { code: string | null; name: string | null; starts_at: string | null; ends_at: string | null; grace_minutes: number | null };

async function readDay(access: Access, employeeId: string) {
  // Facility timezone first (the employee's location master), tenant timezone as the fallback.
  const [contextRows] = await tenantTx(access, [
    sqlClient`with zone as (
                select coalesce(nullif(l.attributes->>'timezone', ''), nullif(l.attributes->>'timeZone', ''), tn.timezone, ${DEFAULT_TIMEZONE}) as tz
                  from employees e
                  join tenants tn on tn.id = e.tenant_id
                  left join locations l on l.tenant_id = e.tenant_id and l.attributes->>'code' = e.location
                 where e.tenant_id = ${access.tenantId} and e.id = ${employeeId} and e.status = 'active'
                 limit 1)
              select tz as timezone, ((now() at time zone tz)::date)::text as work_date,
                     to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as server_time
                from zone`,
  ]);
  const context = (contextRows as Array<{ timezone: string; work_date: string; server_time: string }>)[0];
  if (!context) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Your employee profile is not active, so attendance cannot be recorded." });
  }
  const [dayRows, punchRows, shiftRows] = await tenantTx(access, [
    sqlClient`select id, status, locked_at is not null as locked from attendance_days
               where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attendance_date = ${context.work_date} limit 1`,
    sqlClient`select p.id, to_char(p.punched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as at, p.type, p.source
                from attendance_punches p join attendance_days d on d.tenant_id = p.tenant_id and d.id = p.attendance_day_id
               where p.tenant_id = ${access.tenantId} and d.employee_id = ${employeeId} and d.attendance_date = ${context.work_date}
               order by p.punched_at asc limit 64`,
    sqlClient.query(SHIFT_SELECT, [access.tenantId, employeeId]),
  ]);
  return {
    context,
    day: (dayRows as DayRow[])[0] ?? null,
    punches: (punchRows as PunchRow[]).filter((row) => row.type === "in" || row.type === "out"),
    shift: (shiftRows as ShiftRow[])[0] ?? null,
  };
}

function toView(employeeId: string, snapshot: Awaited<ReturnType<typeof readDay>>): PunchDayView {
  const { context, day, punches, shift } = snapshot;
  const last = punches[punches.length - 1]?.type ?? null;
  return {
    employeeId,
    workDate: context.work_date,
    timezone: context.timezone,
    dayStatus: day?.status ?? null,
    locked: day?.locked === true,
    punches: punches.map((row) => ({ id: row.id, at: row.at, type: row.type, source: row.source })),
    state: last === null ? "not_started" : last,
    firstIn: punches.find((row) => row.type === "in")?.at ?? null,
    lastOut: [...punches].reverse().find((row) => row.type === "out")?.at ?? null,
    workedMinutes: workedMinutes(punches, context.server_time),
    nextDirection: last === "in" ? "out" : "in",
    shift: shift
      ? { code: shift.code, name: shift.name, startsAt: shift.starts_at, endsAt: shift.ends_at, graceMinutes: typeof shift.grace_minutes === "number" ? shift.grace_minutes : null }
      : null,
    serverTime: context.server_time,
  };
}

/** Today's punch day for the caller's own employee record. */
export async function getMyPunchDay(access: Access): Promise<PunchDayView> {
  enforceAny(access, SELF_READ);
  const employeeId = ownEmployeeId(access);
  return toView(employeeId, await readDay(access, employeeId));
}

/** Record one punch for the caller at the server's current time. */
export async function recordMyPunch(access: Access, input: RecordPunchInput, requestId: string): Promise<PunchDayView> {
  enforceAny(access, SELF_WRITE);
  const employeeId = ownEmployeeId(access);
  const snapshot = await readDay(access, employeeId);
  if (snapshot.day?.locked) {
    throw new HttpError({ status: 422, code: "PERIOD_LOCKED", message: "Today's attendance is locked. Raise a regularization instead." });
  }
  assertAlternation(snapshot.punches[snapshot.punches.length - 1]?.type ?? null, input.direction);

  const workDate = snapshot.context.work_date;
  let dayId = snapshot.day?.id ?? null;
  if (!dayId) {
    dayId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, status)
                values (${dayId}, ${access.tenantId}, ${employeeId}, ${workDate}, 'A', 'pending')`,
    ]);
  }
  const sourceId = await ensureAttendanceSource(access, "web");
  const punchId = crypto.randomUUID();
  const event = {
    event_id: punchId,
    direction: input.direction,
    punch_date: workDate,
    attendance_date: workDate,
    note: input.remark ?? null,
    status: "captured",
    channel: "self_service",
  };
  await tenantTx(access, [
    sqlClient`insert into attendance_punches (id, tenant_id, attendance_day_id, punched_at, type, source, device_reference)
              values (${punchId}, ${access.tenantId}, ${dayId}, now(), ${input.direction}, 'web', null)`,
    sqlClient`insert into attendance_events (id, tenant_id, employee_id, attendance_source_id, attributes)
              values (${crypto.randomUUID()}, ${access.tenantId}, ${employeeId}, ${sourceId},
                      (${JSON.stringify(event)}::jsonb || jsonb_build_object('punched_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                        'time', to_char(now() at time zone ${snapshot.context.timezone}, 'FMHH12:MI AM'))))`,
    sqlClient`update attendance_days set updated_at = now() where id = ${dayId} and tenant_id = ${access.tenantId} and locked_at is null`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
              values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, 'attendance.self_punch',
                      'attendance_day', ${dayId}, 'Employee self-service punch',
                      ${JSON.stringify({ direction: input.direction, workDate })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
    sqlClient`insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
              values (${access.tenantId}, 'attendance.punches_received', 'attendance_day', ${dayId},
                      ${JSON.stringify({ employeeId, workDate, punches: 1 })}::jsonb)`,
  ]);
  return toView(employeeId, await readDay(access, employeeId));
}
