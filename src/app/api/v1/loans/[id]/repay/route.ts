import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { repayLoan, repayLoanSchema } from "@/server/loans/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/loans/:id/repay — record a repayment (payroll.run). A money-moving write, so an
 * Idempotency-Key is required: a retried request with the same key and body is answered from the
 * stored outcome instead of reducing the balance twice.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = repayLoanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A positive repayment amount is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "loan.repay", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay") {
      return ok({ type: "loan", id, version: 1, attributes: { id, replayed: true }, requestId, self: `/api/v1/loans/${id}` });
    }
    const result = await repayLoan(access, id, parsed.data, requestId);
    await storeIdempotency(access, "loan.repay", key, fingerprint, 200, result.id);
    return ok({ type: "loan", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/loans/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
