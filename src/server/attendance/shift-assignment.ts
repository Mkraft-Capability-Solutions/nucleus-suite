import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";

/**
 * Shift master catalogue and manual shift assignments (roster overrides). The catalogue is the tenant's `shifts`
 * rows; an assignment always points at one of them by `shift_id` (the column is NOT NULL). There is no fallback
 * employee: the caller names the employee, and that employee must be inside the caller's attendance scope.
 */

export type ShiftOption = {
  id: string;
  code: string;
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  crossesMidnight: boolean;
};

/** Pure check (unit-tested): a shift crosses midnight when its HH:MM end is not after its start. */
export function crossesMidnight(startsAt: string | null, endsAt: string | null): boolean {
  const clock = /^([01]?\d|2[0-3]):[0-5]\d/;
  if (!startsAt || !endsAt || !clock.test(startsAt) || !clock.test(endsAt)) return false;
  const minutes = (value: string) => {
    const [h = "0", m = "0"] = value.split(":");
    return Number(h) * 60 + Number(m.slice(0, 2));
  };
  return minutes(endsAt) <= minutes(startsAt);
}

export async function listShiftCatalog(access: Access): Promise<ShiftOption[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, trim(attributes->>'code') as code, nullif(trim(attributes->>'name'), '') as name,
        coalesce(nullif(attributes->>'start_time', ''), nullif(attributes->>'starts_at', '')) as starts_at,
        coalesce(nullif(attributes->>'end_time', ''), nullif(attributes->>'ends_at', '')) as ends_at
      from shifts
      where tenant_id = ${access.tenantId} and record_status = 'active'
        and coalesce(trim(attributes->>'code'), '') <> '' and length(trim(attributes->>'code')) <= 24
      order by 2 asc
      limit 100`,
  ]);
  return (rows as Array<{ id: string; code: string; name: string | null; starts_at: string | null; ends_at: string | null }>).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    crossesMidnight: crossesMidnight(row.starts_at, row.ends_at),
  }));
}

export const createShiftAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  shiftCode: z.string().trim().min(1).max(24),
  effectiveDate: z.iso.date(),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
});
export type CreateShiftAssignment = z.infer<typeof createShiftAssignmentSchema>;

export async function listShiftAssignments(access: Access, employeeId: string | null) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  if (employeeId) await assertAttendanceEmployeeVisible(access, employeeId);
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select sa.id, sa.employee_id, sa.shift_id, sa.record_status, sa.created_at::text as created_at,
          coalesce(nullif(sa.attributes->>'shift_code', ''), s.attributes->>'code') as shift_code,
          coalesce(nullif(sa.attributes->>'effective_from', ''), nullif(sa.attributes->>'effective_date', '')) as effective_date,
          nullif(sa.attributes->>'reason', '') as reason
        from shift_assignments sa
        left join shifts s on s.tenant_id = sa.tenant_id and s.id = sa.shift_id
        where sa.tenant_id = $1 and sa.employee_id = any($2::uuid[]) and ($3::uuid is null or sa.employee_id = $3::uuid)
        order by sa.created_at desc
        limit 50`,
      [access.tenantId, scope.employeeIds, employeeId],
    ),
  ]);
  return rows as Array<{ id: string; employee_id: string; shift_id: string; record_status: string; created_at: string; shift_code: string | null; effective_date: string | null; reason: string | null }>;
}

export async function createShiftAssignment(access: Access, input: CreateShiftAssignment, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const [shiftRows] = await tenantTx(access, [
    sqlClient`select id from shifts where tenant_id = ${access.tenantId} and record_status = 'active'
      and upper(trim(attributes->>'code')) = upper(${input.shiftCode}) limit 1`,
  ]);
  const shiftId = (shiftRows as Array<{ id: string }>)[0]?.id;
  if (!shiftId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Shift ${input.shiftCode} is not in this tenant's shift master.`, details: [{ field: "shiftCode", issue: "unknown" }] });
  }
  const id = randomUUID();
  const attributes = {
    shift_code: input.shiftCode.toUpperCase(),
    effective_from: input.effectiveDate,
    reason: input.reason,
    active: true,
    kind: "manual_override",
    assigned_by: access.context.actorUserId,
  };
  await tenantTx(access, [
    sqlClient`insert into shift_assignments (id, tenant_id, employee_id, shift_id, record_status, attributes, version)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${shiftId}, 'active', ${JSON.stringify(attributes)}::jsonb, 1)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.shift_override', 'shift_assignment', ${id}, ${input.reason}, ${JSON.stringify({ ...attributes, employee_id: input.employeeId })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, employeeId: input.employeeId, shiftId, shiftCode: attributes.shift_code, effectiveDate: input.effectiveDate, reason: input.reason };
}
