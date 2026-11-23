import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { lockBenefitSelection, lockBenefitSelectionSchema } from "@/server/compensation/summary";

export const dynamic = "force-dynamic";

/** POST /api/v1/benefits/selections — lock the caller's flex-benefit selections (employee.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = lockBenefitSelectionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Check the selected benefits.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "benefit.selection_lock", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "benefit-selection", id: prior.responseLocator, version: 1, attributes: { replayed: true }, requestId, self: "/api/v1/benefits/selections" });
    }
    const result = await lockBenefitSelection(access, parsed.data, requestId);
    await storeIdempotency(access, "benefit.selection_lock", key, fingerprint, 201, result.employeeId);
    return ok({ type: "benefit-selection", id: result.employeeId, version: 1, attributes: { ...result }, requestId, self: "/api/v1/benefits/selections" });
  } catch (error) {
    return fail(error, requestId);
  }
}
