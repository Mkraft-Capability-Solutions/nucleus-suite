import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { decideLeaveFromForm, leaveDecisionFormSchema } from "@/server/leave/form-actions";
import { issueDetails, runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

/**
 * "Decide leave request" form (action launcher): resolves the one pending
 * request of the named employee (or `requestId`) and decides it through the
 * leave approval chain. Permission leave.approve; no self-approval.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = leaveDecisionFormSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The decision is invalid.", details: issueDetails(parsed.error.issues) });
    }
    const outcome = await runIdempotent(access, "leave.decide_form", key, parsed.data, () => decideLeaveFromForm(access, parsed.data, requestId));
    const attributes = outcome.attributes;
    return ok({ type: "leave-request", id: outcome.id, version: 1, attributes, requestId, self: `/api/v1/leave-requests/register/${outcome.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
