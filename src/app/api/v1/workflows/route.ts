import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { CONDITION_OPERATORS, createWorkflow, createWorkflowSchema, listWorkflows, MAX_STEPS, STEP_TYPES, SUBJECT_TYPES } from "@/server/workflows/workflow-definitions";
import { parseBody, runOnce } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

/** GET lists the tenant's workflow definitions with the latest version's steps; POST creates one. Both need tenant.manage. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listWorkflows(access);
    return NextResponse.json(
      {
        data: items.map((item) => ({ type: "workflow", ...item })),
        meta: { requestId, stepTypes: STEP_TYPES, operators: CONDITION_OPERATORS, subjectTypes: SUBJECT_TYPES, maxSteps: MAX_STEPS },
        links: { self: "/api/v1/workflows" },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseBody(createWorkflowSchema, await request.json().catch(() => null), "Check the workflow details.");
    const outcome = await runOnce(access, "workflow.create", key, input, () => createWorkflow(access, input, requestId));
    return ok({ type: "workflow", id: outcome.id, version: 1, attributes: { id: outcome.id, replayed: outcome.replayed }, requestId, self: `/api/v1/workflows/${outcome.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
