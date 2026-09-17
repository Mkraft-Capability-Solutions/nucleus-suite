import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const resolveAnomalySchema = z.object({
  action: z.enum(["RESOLVE", "WAIVE", "ESCALATE", "resolve", "waive", "escalate"]).default("RESOLVE"),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = resolveAnomalySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid anomaly resolution payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const action = parsed.data.action.toUpperCase();
    const reason = parsed.data.reason ?? `Biometric anomaly ${action.toLowerCase()}d by supervisor`;
    const newStatus = action === "RESOLVE" ? "resolved" : action === "WAIVE" ? "waived" : "escalated";

    await tenantTx(access, [
      sqlClient`
        update attendance_exceptions
        set record_status = ${newStatus},
            attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
              status: newStatus,
              resolution_action: action,
              resolution_reason: reason,
              resolved_by: access.context.actorUserId,
              resolved_at: new Date().toISOString(),
            })}::jsonb,
            updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'attendance.anomaly_resolve', 'attendance_exception', ${id}, ${reason},
          ${JSON.stringify({ action, status: newStatus, reason })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "attendance-anomaly",
      id,
      version: 1,
      attributes: {
        id,
        action,
        status: newStatus,
        reason,
      },
      requestId,
      self: `/api/v1/attendance/anomalies/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
