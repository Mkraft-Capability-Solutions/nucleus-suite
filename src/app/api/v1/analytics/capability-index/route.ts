import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { computeMci, computeMciSchema } from "@/server/analytics/service";

export const dynamic = "force-dynamic";

/** POST computes and stores one MCI run for an employee (employee.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = computeMciSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "VALIDATION_FAILED",
        message: "MCI inputs must be 0-100 across all five dimensions.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "analytics.mci_compute", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "capability-index-run", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/analytics/capability-index/${prior.responseLocator}` });
    }
    const result = await computeMci(access, parsed.data, requestId);
    await storeIdempotency(access, "analytics.mci_compute", key, fingerprint, 201, result.id);
    return ok({ type: "capability-index-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/analytics/capability-index/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
