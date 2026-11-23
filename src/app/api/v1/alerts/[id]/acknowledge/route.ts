import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { acknowledgeAlert } from "@/server/alerts/service";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** PATCH /api/v1/alerts/:id/acknowledge — record who acknowledged the alert and when. Idempotency-Key optional. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const key = request.headers.get("idempotency-key")?.trim() || null;
    const fingerprint = createHash("sha256").update(`ack:${id}`).digest("hex");
    if (key) {
      const prior = await checkIdempotency(access, "alerts.acknowledge", key, fingerprint);
      if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const alert = await acknowledgeAlert(access, id, requestId);
    if (key) await storeIdempotency(access, "alerts.acknowledge", key, fingerprint, 200, alert.id);
    return NextResponse.json({ data: alert, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
