import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listBatches, prepareBatch, prepareBatchSchema } from "@/server/payroll/disbursement";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listBatches(access, { runId: params.get("payrollRunId"), state: params.get("state"), page, pageSize });
    return collection({
      type: "disbursement-batch",
      items: items.map(({ id, ...rest }) => ({ id, version: 1, ...rest })),
      requestId,
      self: "/api/v1/disbursements",
      total,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = prepareBatchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A payroll run, bank file format, disbursing account and value date are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.disbursement_prepare", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await prepareBatch(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.disbursement_prepare", key, fingerprint, 201, result.batchId);
    return ok({
      type: "disbursement-batch",
      id: result.batchId,
      version: 1,
      attributes: { ...result },
      requestId,
      self: `/api/v1/disbursements/${result.batchId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
