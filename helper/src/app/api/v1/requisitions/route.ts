import { workflowRecords } from "@/server/workflows/records";
import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createRequisition, createRequisitionSchema } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = createRequisitionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The requisition payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "talent.requisition_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createRequisition(access, parsed.data, requestId);
    await storeIdempotency(access, "talent.requisition_create", key, fingerprint, 201, result.id);
    return ok({ type: "requisition", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/requisitions/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Read the tenant-scoped work queue used by the operational forms. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "requisitions", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
