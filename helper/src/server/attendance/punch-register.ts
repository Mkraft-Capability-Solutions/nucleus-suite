import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";

export type PunchState = "queued_offline" | "ingested" | "computed" | "rejected";

/**
 * Pure state mapping for one raw punch (unit-tested). A stored rejection or an
 * offline queue marker is the device's own verdict and always wins. Otherwise a
 * punch that has already been folded into an attendance entry reads as
 * computed, and a punch that has only landed reads as ingested.
 */
export function derivePunchState(
  recordStatus: string | null | undefined,
  hasAttendanceEntry: boolean,
  storedStatus?: string | null,
): PunchState {
  const stored = normalizeToken(storedStatus);
  const record = normalizeToken(recordStatus);
  for (const token of [stored, record]) {
    if (["rejected", "invalid", "discarded", "error"].includes(token)) return "rejected";
    if (["queued_offline", "queued", "offline", "pending_sync", "buffered"].includes(token)) return "queued_offline";
  }
  if (hasAttendanceEntry) return "computed";
  return "ingested";
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export type PunchDirection = "in" | "out" | "unknown";

export type PunchRow = {
  id: string;
  event_reference: string;
  employee_id: string;
  employee_code: string | null;
  employee_name: string | null;
  direction: PunchDirection;
  punch_time: string | null;
  punch_date: string | null;
  source: string;
  device: string | null;
  segment: number | null;
  note: string | null;
  geo: string | null;
  geofence_result: string | null;
  selfie_ref: string | null;
  job_code: string | null;
  offline_queued: boolean;
  status: PunchState;
};

type PunchQueryRow = Omit<PunchRow, "status"> & {
  record_status: string | null;
  stored_status: string | null;
  has_attendance_entry: boolean;
};

/**
 * `source` names the channel the punch arrived through (the attendance source
 * row), while `device` names the reader and `event_reference` the punch's own
 * business id. They are deliberately three different columns.
 */
const PUNCH_SELECT = `select e.id,
    coalesce(nullif(e.attributes->>'event_id', ''), left(e.id::text, 8)) as event_reference,
    e.employee_id,
    emp.employee_code,
    nullif(trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')), '') as employee_name,
    case lower(coalesce(e.attributes->>'direction', ''))
      when 'in' then 'in' when 'out' then 'out' else 'unknown' end as direction,
    nullif(e.attributes->>'time', '') as punch_time,
    coalesce(nullif(e.attributes->>'punch_date', ''), nullif(e.attributes->>'attendance_date', '')) as punch_date,
    coalesce(nullif(src.attributes->>'name', ''), nullif(src.attributes->>'code', ''),
             nullif(e.attributes->>'device', ''), 'Unknown') as source,
    nullif(e.attributes->>'device', '') as device,
    case when e.attributes->>'segment' ~ '^[0-9]+$' then (e.attributes->>'segment')::int end as segment,
    nullif(e.attributes->>'note', '') as note,
    -- The capture coordinates read as one "lat, long" pair, or as nothing when the
    -- channel recorded neither; a half-located punch is never shown as located.
    case when coalesce(e.attributes->>'geo_lat', '') <> '' and coalesce(e.attributes->>'geo_lng', '') <> ''
         then (e.attributes->>'geo_lat') || ', ' || (e.attributes->>'geo_lng') end as geo,
    nullif(e.attributes->>'geofence_result', '') as geofence_result,
    nullif(e.attributes->>'selfie_ref', '') as selfie_ref,
    nullif(e.attributes->>'job_code', '') as job_code,
    coalesce((e.attributes->>'offline_queued')::bool, false) as offline_queued,
    e.record_status,
    nullif(e.attributes->>'status', '') as stored_status,
    exists (select 1 from attendance_entries entry
            where entry.tenant_id = e.tenant_id and entry.employee_id = e.employee_id
              and entry.attributes->>'date' = coalesce(e.attributes->>'attendance_date', e.attributes->>'punch_date')
    ) as has_attendance_entry
  from attendance_events e
  left join employees emp on emp.tenant_id = e.tenant_id and emp.id = e.employee_id
  left join attendance_sources src on src.tenant_id = e.tenant_id and src.id = e.attendance_source_id`;

function project(rows: PunchQueryRow[]): PunchRow[] {
  return rows.map((row) => {
    const { record_status, stored_status, has_attendance_entry, ...rest } = row;
    return { ...rest, status: derivePunchState(record_status, has_attendance_entry, stored_status) };
  });
}

/** SCR-020 punch register: every raw punch visible to the caller's scope. */
export async function listPunchRegister(
  access: Access,
  args: { search: string; date: string | null },
): Promise<PunchRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const date = args.date && args.date.trim() !== "" ? args.date.trim() : null;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${PUNCH_SELECT}
       where e.tenant_id = $1
         and e.employee_id = any($2::uuid[])
         and ($4::text is null or coalesce(e.attributes->>'punch_date', e.attributes->>'attendance_date') = $4::text)
         and ($3 = '%%' or (coalesce(emp.employee_code, '') || ' ' || coalesce(emp.first_name, '') || ' '
              || coalesce(emp.last_name, '') || ' ' || coalesce(e.attributes->>'event_id', '') || ' '
              || coalesce(e.attributes->>'device', '')) ilike $3)
       order by coalesce(e.attributes->>'punch_date', e.attributes->>'attendance_date') desc nulls last,
         coalesce(e.attributes->>'time', '') desc, e.created_at desc
       limit 200`,
      [access.tenantId, scope.employeeIds, like, date],
    ),
  ]);
  return project(rows as PunchQueryRow[]);
}

/** One punch, the attendance day it was folded into, and its audit trail. */
export async function getPunchRecord(access: Access, id: string) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${PUNCH_SELECT} where e.tenant_id = $1 and e.id = $2::uuid limit 1`, [access.tenantId, id]),
  ]);
  const found = (rows as PunchQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, found.employee_id);
  const record = project([found])[0];

  const [dayRows] = await tenantTx(access, [
    sqlClient.query(
      `select entry.id, entry.employee_id, entry.record_status,
          entry.attributes->>'date' as date,
          entry.attributes->>'day_type' as day_type,
          entry.attributes->>'status' as status,
          entry.attributes->>'first_in' as first_in,
          entry.attributes->>'last_out' as last_out,
          entry.attributes->>'shift_applied' as shift_applied,
          case when entry.attributes->>'gross_minutes' ~ '^[0-9]+$'
               then (entry.attributes->>'gross_minutes')::int end as gross_minutes,
          case when entry.attributes->>'break_minutes' ~ '^[0-9]+$'
               then (entry.attributes->>'break_minutes')::int end as break_minutes
        from attendance_entries entry
        where entry.tenant_id = $1 and entry.employee_id = $2::uuid and entry.attributes->>'date' = $3::text
        order by entry.created_at limit 1`,
      [access.tenantId, found.employee_id, record.punch_date],
    ),
  ]);
  const day = ((dayRows as Array<Record<string, unknown>>)[0] ?? null) as Record<string, unknown> | null;

  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'attendance_event' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }

  return { record, day, auditTrail };
}
