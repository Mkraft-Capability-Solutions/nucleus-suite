import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { confirmEmployment, confirmEmploymentSchema } from "@/server/lifecycle/service";

export const dynamic = "force-dynamic";

/**
 * R-24. Confirmation is a transition on the employment record, refused while any joining
 * chain item the template marks as blocking confirmation is still outstanding.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = confirmEmploymentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The confirmation payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "lifecycle.confirm", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await confirmEmployment(access, parsed.data, requestId);
    await storeIdempotency(access, "lifecycle.confirm", key, fingerprint, 200, result.employmentId);
    return ok({
      type: "employment-confirmation",
      id: result.employmentId,
      version: 1,
      attributes: result,
      requestId,
      self: "/api/v1/onboarding/confirmations",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
