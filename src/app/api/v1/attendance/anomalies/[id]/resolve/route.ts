import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { resolveAnomaly, resolveAnomalySchema } from "@/server/attendance/anomaly-resolution";

export const dynamic = "force-dynamic";

const OPERATION = "attendance.anomaly_resolve";

/** POST records a review decision (RESOLVE / WAIVE / ESCALATE) on an open anomaly (attendance.write, Idempotency-Key). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
    const parsed = resolveAnomalySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Invalid anomaly resolution payload.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "attendance-anomaly", id, version: 1, attributes: { id, replayed: true }, requestId, self: `/api/v1/attendance/anomalies/${id}` });
    }
    const result = await resolveAnomaly(access, id, parsed.data, requestId);
    await storeIdempotency(access, OPERATION, key, fingerprint, 200, id);
    return ok({ type: "attendance-anomaly", id, version: 1, attributes: result, requestId, self: `/api/v1/attendance/anomalies/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
