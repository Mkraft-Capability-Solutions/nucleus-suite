import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { confirmationContext, submitConfirmationReview, submitConfirmationReviewSchema } from "@/server/lifecycle/confirmation";

export const dynamic = "force-dynamic";

/** FRM-LCY-02 read-only panel: employee, probation end, and the reviews with their approval status. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = (new URL(request.url).searchParams.get("employeeId") ?? "").trim();
    if (!z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employeeId is required.", details: [{ field: "employeeId", issue: "must be a uuid" }] });
    }
    const context = await confirmationContext(access, employeeId);
    return ok({
      type: "confirmation-context",
      id: employeeId,
      version: 1,
      attributes: context,
      requestId,
      self: `/api/v1/onboarding/confirmation-reviews?employeeId=${employeeId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** FRM-LCY-02 manager section: recommendation, rating, assessment and any extension. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = submitConfirmationReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The confirmation review payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "lifecycle.confirmation_review", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await submitConfirmationReview(access, parsed.data, requestId);
    await storeIdempotency(access, "lifecycle.confirmation_review", key, fingerprint, 201, result.id);
    return ok({ type: "confirmation-review", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/confirmation-reviews/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
