import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { traceStoredWorkflow } from "@/server/workflows/workflow-definitions";
import { requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

/** Dry run: the execution path of the latest stored version and every structural issue. No side effects. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "workflow");
    const trace = await traceStoredWorkflow(access, id);
    return ok({ type: "workflow-trace", id, version: trace.version, attributes: trace, requestId, self: `/api/v1/workflows/${id}/trace` });
  } catch (error) {
    return fail(error, requestId);
  }
}
