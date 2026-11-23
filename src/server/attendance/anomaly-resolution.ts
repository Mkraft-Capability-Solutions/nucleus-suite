import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible } from "@/server/attendance/service";

/**
 * Review decision on one attendance anomaly (`attendance_exceptions`): resolve, waive as a false positive, or
 * escalate. Only an open anomaly can be decided; the update is guarded on that state and the audit row is written
 * in the same statement, so an unknown id is a 404 and a repeated decision is a 409 — never a silent success.
 */

export const ANOMALY_ACTIONS = ["RESOLVE", "WAIVE", "ESCALATE"] as const;
export type AnomalyAction = (typeof ANOMALY_ACTIONS)[number];

export const resolveAnomalySchema = z.object({
  action: z.string().trim().toUpperCase().pipe(z.enum(ANOMALY_ACTIONS)),
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters.").max(500),
});
export type ResolveAnomaly = z.infer<typeof resolveAnomalySchema>;

const CLOSED_STATES = new Set(["resolved", "waived", "escalated", "closed", "rejected"]);

/** Pure mapping (unit-tested) from a review action to the stored state. */
export function anomalyStatusFor(action: AnomalyAction): "resolved" | "waived" | "escalated" {
  switch (action) {
    case "RESOLVE": return "resolved";
    case "WAIVE": return "waived";
    case "ESCALATE": return "escalated";
    default: {
      const unreachable: never = action;
      throw new Error(`Unknown anomaly action ${String(unreachable)}`);
    }
  }
}

/** Pure check (unit-tested): an anomaly is still open unless its stored state is a closed one. */
export function isAnomalyOpen(status: string | null | undefined): boolean {
  return !CLOSED_STATES.has((status ?? "").trim().toLowerCase());
}

export async function resolveAnomaly(access: Access, id: string, input: ResolveAnomaly, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, coalesce(nullif(trim(attributes->>'status'), ''), record_status, 'open') as status
      from attendance_exceptions where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const found = (rows as Array<{ id: string; employee_id: string | null; status: string }>)[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (found.employee_id) await assertAttendanceEmployeeVisible(access, found.employee_id);
  if (access.context.employeeId && found.employee_id === access.context.employeeId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "You cannot review an anomaly raised on your own attendance." });
  }
  if (!isAnomalyOpen(found.status)) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `This anomaly is already ${found.status}.` });
  }
  const status = anomalyStatusFor(input.action);
  const patch = {
    status,
    resolution_action: input.action,
    resolution_reason: input.reason,
    resolved_by: access.context.actorUserId,
    resolved_at: new Date().toISOString(),
  };
  const [moved] = await tenantTx(access, [
    sqlClient`with moved as (
        update attendance_exceptions
        set record_status = ${status}, attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}
          and coalesce(nullif(trim(attributes->>'status'), ''), record_status, 'open') = ${found.status}
        returning id
      )
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.anomaly_${status}`}, 'attendance_exception', moved.id::text, ${input.reason},
        ${JSON.stringify(patch)}::jsonb, ${uuidOrNull(requestId)}::uuid
      from moved
      returning entity_id`,
  ]);
  if ((moved as unknown[]).length === 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The anomaly changed while you were reviewing it. Refresh and retry." });
  }
  return { id, action: input.action, status, reason: input.reason };
}
