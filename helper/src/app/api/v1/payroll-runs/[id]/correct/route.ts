import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { correctRun, correctRunSchema } from "@/server/payroll/service";
import { checkIdempotency, storeIdempotency } from "@/server/platform/access";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = correctRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A reason and non-zero adjustments are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "payroll.correct", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await correctRun(access, id, parsed.data, requestId);
    await storeIdempotency(access, "payroll.correct", key, fingerprint, 201, result.correctionId);
    return ok({ type: "payroll-run", id: result.correctionId, version: 1, attributes: result, requestId, self: `/api/v1/payroll-runs/${result.correctionId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
