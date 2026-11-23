import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible } from "@/server/attendance/service";

/**
 * Weekly timesheet submission. The hours are never taken from the client and never defaulted: they are the sum of
 * the net minutes the attendance engine stored for the employee's days in the week. The submission is stored as an
 * `attendance_entries` row of kind `weekly_timesheet` under the employee's attendance policy, one per employee-week.
 */

export const submitTimesheetSchema = z.object({
  employeeId: z.string().uuid().optional(),
  weekStart: z.iso.date(),
  notes: z.string().trim().max(1000).optional(),
});
export type SubmitTimesheet = z.infer<typeof submitTimesheetSchema>;

/** Pure week window (unit-tested): the seven ISO dates starting at `weekStart`. */
export function weekWindow(weekStart: string): { from: string; to: string } {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: weekStart, to: end.toISOString().slice(0, 10) };
}

/** Pure total (unit-tested): whole minutes summed from stored values; unrecorded days add nothing. */
export function sumStoredMinutes(values: Array<string | null>): { minutes: number; recordedDays: number } {
  let minutes = 0;
  let recordedDays = 0;
  for (const value of values) {
    if (value !== null && /^[0-9]{1,5}$/.test(value.trim())) {
      minutes += Number(value.trim());
      recordedDays += 1;
    }
  }
  return { minutes, recordedDays };
}

export async function submitWeeklyTimesheet(access: Access, input: SubmitTimesheet, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const employeeId = input.employeeId ?? access.context.employeeId ?? null;
  if (!employeeId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Your account is not linked to an employee record, so there is no timesheet to submit." });
  }
  await assertAttendanceEmployeeVisible(access, employeeId);
  const week = weekWindow(input.weekStart);
  if (week.from > new Date().toISOString().slice(0, 10)) {
    throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "A timesheet cannot be submitted for a future week.", details: [{ field: "weekStart", issue: "future" }] });
  }
  const [dayRows, existingRows, policyRows] = await tenantTx(access, [
    sqlClient`select coalesce(attributes->>'net_minutes', attributes->>'gross_minutes') as minutes
      from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'date' >= ${week.from} and attributes->>'date' <= ${week.to}
        and coalesce(attributes->>'submission_type', '') = ''`,
    sqlClient`select id from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'submission_type' = 'weekly_timesheet' and attributes->>'week_start' = ${week.from}
        and coalesce(attributes->>'status', '') <> 'rejected'
      limit 1`,
    sqlClient`select ap.id from attendance_policies ap
      left join attendance_policy_assignments apa on apa.tenant_id = ap.tenant_id and apa.attendance_policy_id = ap.id and apa.employee_id = ${employeeId}
      where ap.tenant_id = ${access.tenantId} and ap.record_status = 'active'
      order by (apa.id is not null) desc, (upper(coalesce(ap.attributes->>'code', '')) = 'STD') desc, ap.created_at asc
      limit 1`,
  ]);
  if ((existingRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "A timesheet for this week has already been submitted.", details: [{ field: "weekStart", issue: "duplicate" }] });
  }
  const policyId = (policyRows as Array<{ id: string }>)[0]?.id;
  if (!policyId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No attendance policy is configured for this tenant, so the timesheet cannot be filed yet." });
  }
  const total = sumStoredMinutes((dayRows as Array<{ minutes: string | null }>).map((row) => row.minutes));
  if (total.recordedDays === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "There are no computed attendance days in this week to submit." });
  }
  const id = randomUUID();
  const attributes = {
    submission_type: "weekly_timesheet",
    week_start: week.from,
    week_end: week.to,
    total_minutes: total.minutes,
    recorded_days: total.recordedDays,
    notes: input.notes ?? null,
    status: "submitted",
    submitted_at: new Date().toISOString(),
    submitted_by: access.context.actorUserId,
  };
  await tenantTx(access, [
    sqlClient`insert into attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${policyId}, ${employeeId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.timesheet_submit', 'timesheet', ${id}, 'Weekly timesheet submitted for approval',
        ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, employeeId, ...attributes };
}
