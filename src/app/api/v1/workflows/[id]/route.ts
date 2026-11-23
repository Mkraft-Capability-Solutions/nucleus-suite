import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, rejectCrossOrigin, requestIdFrom, requireVersion } from "@/server/platform/http";
import { getWorkflow, saveStepsSchema, saveWorkflowSteps, type WorkflowView } from "@/server/workflows/workflow-definitions";
import { parseBody, requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function respond(workflow: WorkflowView, requestId: string) {
  return NextResponse.json(
    { data: { type: "workflow", ...workflow }, meta: { requestId }, links: { self: `/api/v1/workflows/${workflow.id}` } },
    { headers: { "cache-control": "no-store", "x-request-id": requestId, etag: `"${workflow.latestVersion}"` } },
  );
}

/** GET one workflow (ETag = latest version). PUT saves the full step list as a new version; If-Match is required. */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "workflow");
    return respond(await getWorkflow(access, id), requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "workflow");
    const expected = requireVersion(request.headers);
    const input = parseBody(saveStepsSchema, await request.json().catch(() => null), "Check the workflow steps.");
    return respond(await saveWorkflowSteps(access, id, expected, input, requestId), requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}
