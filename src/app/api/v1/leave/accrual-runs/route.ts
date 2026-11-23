import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { accrualRunSchema, queueAccrualRun } from "@/server/leave/allocation";

export const dynamic = "force-dynamic";

/** Queues the monthly EL accrual job for a period (YYYY-MM), permission leave.maintain. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = accrualRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "A period is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "leave.accrual_run", key, fingerprint);
    if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "leave-accrual-run", id: prior.responseLocator, version: 1, attributes: { period: parsed.data.period, status: "queued", replayed: true }, requestId, self: "/api/v1/leave/accrual-runs" });
    }
    const result = await queueAccrualRun(access, parsed.data, requestId);
    await storeIdempotency(access, "leave.accrual_run", key, fingerprint, 201, result.id);
    return ok({ type: "leave-accrual-run", id: result.id, version: 1, attributes: result, requestId, self: "/api/v1/leave/accrual-runs" });
  } catch (error) {
    return fail(error, requestId);
  }
}
