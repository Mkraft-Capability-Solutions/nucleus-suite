import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, enforce, requireAccess, storeIdempotency, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

const dismissAnomalySchema = z.object({
  reason: z.string().trim().min(15, "Give a reason of at least 15 characters.").max(500),
});

/**
 * POST /api/v1/payroll-anomalies/:id/dismiss — mark an open finding as ignored (payroll.run).
 *
 * Fixed: the update is guarded to an open finding of this tenant and its row count is checked, so a
 * wrong or stale id returns 404 / 409 instead of a fabricated success, and the audit event is written
 * only when a row actually changed. A reason is mandatory and an Idempotency-Key is required.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "payroll.run", { tenantId: access.tenantId });
    const { id } = await params;
    if (!uuidOrNull(id)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    const key = requireIdempotencyKey(request.headers);
    const parsed = dismissAnomalySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "Invalid anomaly dismissal payload.", details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })) });
    }
    const reason = parsed.data.reason;
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, reason })).digest("hex");
    const prior = await checkIdempotency(access, "payroll.anomaly_dismiss", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay") {
      return ok({ type: "payroll-anomaly", id, version: 1, attributes: { id, status: "ignored", reason, replayed: true }, requestId, self: `/api/v1/payroll-anomalies/${id}` });
    }

    const [existingRows] = await tenantTx(access, [
      sqlClient`select id, status from payroll_anomalies where tenant_id = ${access.tenantId} and id = ${id}::uuid limit 1`,
    ]);
    const existing = (existingRows as Array<{ id: string; status: string }>)[0];
    if (!existing) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    if (!["open", "assigned", "escalated"].includes(existing.status)) {
      throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `This finding is already ${existing.status} and cannot be dismissed.` });
    }

    const [updated] = await tenantTx(access, [
      sqlClient`
        update payroll_anomalies
        set status = 'ignored',
            attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
              status: "ignored",
              dismissed_by: access.context.actorUserId,
              dismissed_at: new Date().toISOString(),
              dismiss_reason: reason,
            })}::jsonb,
            updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid and status in ('open', 'assigned', 'escalated')
        returning id
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'payroll.anomaly_dismiss', 'payroll_anomaly', ${id}, ${reason},
          ${JSON.stringify({ status: "ignored", reason })}::jsonb, ${uuidOrNull(requestId)}::uuid
        where exists (select 1 from payroll_anomalies where tenant_id = ${access.tenantId} and id = ${id}::uuid and status = 'ignored')
      `,
    ]);
    if ((updated as unknown[]).length === 0) {
      throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The finding changed while it was being dismissed. Refresh and retry." });
    }
    await storeIdempotency(access, "payroll.anomaly_dismiss", key, fingerprint, 200, id);
    return ok({ type: "payroll-anomaly", id, version: 1, attributes: { id, status: "ignored", reason }, requestId, self: `/api/v1/payroll-anomalies/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
