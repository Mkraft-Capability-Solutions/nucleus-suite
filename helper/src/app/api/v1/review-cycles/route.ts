import { workflowRecords } from "@/server/workflows/records";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createCycleSchema, createReviewCycle } from "@/server/performance/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createCycleSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A cycle code and name are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createReviewCycle(access, parsed.data, requestId);
    return ok({ type: "review-cycle", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/review-cycles/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Read the tenant-scoped work queue used by the operational forms. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "review-cycles", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
