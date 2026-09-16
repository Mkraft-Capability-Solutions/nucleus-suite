import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { decideConfirmationReview, decideConfirmationReviewSchema } from "@/server/lifecycle/confirmation";

export const dynamic = "force-dynamic";

/**
 * FRM-LCY-02 HR section and approval. An approval routes on the recommendation:
 * confirm (the R-24 transition, salary revision and letter), extend, or terminate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const { id } = await params;
    const parsed = decideConfirmationReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A decision is required, with remarks on anything but an approval.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "lifecycle.confirmation_review_decide", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await decideConfirmationReview(access, id, parsed.data, requestId);
    await storeIdempotency(access, "lifecycle.confirmation_review_decide", key, fingerprint, 200, result.id);
    return ok({ type: "confirmation-review", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/onboarding/confirmation-reviews/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
