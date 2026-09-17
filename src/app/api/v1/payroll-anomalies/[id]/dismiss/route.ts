import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

const dismissAnomalySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = dismissAnomalySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid anomaly dismissal payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const reason = parsed.data.reason || "Dismissed from HR Ops Console";

    await tenantTx(access, [
      sqlClient`
        update payroll_anomalies
        set status = 'ignored',
            attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
              status: 'ignored',
              dismissed_by: access.context.actorUserId,
              dismissed_at: new Date().toISOString(),
              dismiss_reason: reason,
            })}::jsonb,
            updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'payroll.anomaly_dismiss', 'payroll_anomaly', ${id}, ${reason},
          ${JSON.stringify({ status: 'ignored', reason })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "payroll-anomaly",
      id,
      version: 1,
      attributes: {
        id,
        status: "ignored",
        reason,
      },
      requestId,
      self: `/api/v1/payroll-anomalies/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
