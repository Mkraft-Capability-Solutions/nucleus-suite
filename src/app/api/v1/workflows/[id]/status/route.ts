import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, rejectCrossOrigin, requestIdFrom, requireVersion } from "@/server/platform/http";
import { setStatusSchema, setWorkflowStatus } from "@/server/workflows/workflow-definitions";
import { parseBody, requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

/**
 * Activate (publish the latest version), return to draft, or retire a workflow. If-Match carries the latest
 * version number; activation is refused while the dry-run trace reports issues. Repeating the same status is
 * harmless, so the call is idempotent.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "workflow");
    const expected = requireVersion(request.headers);
    const input = parseBody(setStatusSchema, await request.json().catch(() => null), "Choose a workflow status.");
    const workflow = await setWorkflowStatus(access, id, expected, input.status, requestId);
    return NextResponse.json(
      { data: { type: "workflow", ...workflow }, meta: { requestId }, links: { self: `/api/v1/workflows/${id}` } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId, etag: `"${workflow.latestVersion}"` } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
