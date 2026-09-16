import { workflowRecords } from "@/server/workflows/records";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createInterviewPlan, createInterviewPlanSchema } from "@/server/interviews/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createInterviewPlanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The interview-plan payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createInterviewPlan(access, parsed.data, requestId);
    return ok({ type: "interview-plan", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/interview-plans/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Read the tenant-scoped work queue used by the operational forms. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return await workflowRecords(access, "interview-plans", request, requestId);
  } catch (error) { return fail(error, requestId); }
}
