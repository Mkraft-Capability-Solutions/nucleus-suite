import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listEarlyReturns } from "@/server/leave/engine-console";
import { ownScope } from "@/server/leave/workspace";
import { planEmployeeReturn, returnPlanFormSchema } from "@/server/leave/form-actions";
import { issueDetails, runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listEarlyReturns(access, ownScope(access));
    return collection({
      type: "early-return",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave/early-returns",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * "Plan employee return" form (action launcher): attaches the return plan to
 * the employee's approved leave covering the return date; a return before the
 * last approved day is recorded as an early return with its ledger re-credit.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = returnPlanFormSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The return plan is invalid.", details: issueDetails(parsed.error.issues) });
    }
    const outcome = await runIdempotent(access, "leave.return_plan", key, parsed.data, () => planEmployeeReturn(access, parsed.data, requestId));
    const attributes = outcome.attributes;
    return ok({ type: "early-return", id: outcome.id, version: 1, attributes, requestId, self: `/api/v1/leave-requests/register/${outcome.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
