import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { disburseFnf, disburseFnfSchema } from "@/server/fnf/service";

export const dynamic = "force-dynamic";

/** POST /api/v1/fnf-settlements/:id/disburse — money-moving, so an Idempotency-Key is required. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = disburseFnfSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The disbursement payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "fnf.disburse", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay") {
      return ok({ type: "fnf-disbursement", id, version: 1, attributes: { id, status: "disbursed", replayed: true }, requestId, self: `/api/v1/fnf-settlements/${id}/disburse` });
    }
    const result = await disburseFnf(access, id, parsed.data, requestId);
    await storeIdempotency(access, "fnf.disburse", key, fingerprint, 200, result.id);
    return ok({ type: "fnf-disbursement", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/fnf-settlements/${id}/disburse` });
  } catch (error) {
    return fail(error, requestId);
  }
}
