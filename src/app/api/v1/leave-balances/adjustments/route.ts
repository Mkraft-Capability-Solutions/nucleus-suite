import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { adjustLeaveBalance, balanceAdjustmentSchema } from "@/server/leave/allocation";
import { issueDetails, runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

/** HR +/- balance adjustment as a ledger entry with a reason; never below zero. Permission leave.maintain. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = balanceAdjustmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The adjustment is invalid.", details: issueDetails(parsed.error.issues) });
    }
    const outcome = await runIdempotent(access, "leave.balance_adjust", key, parsed.data, () => adjustLeaveBalance(access, parsed.data, requestId));
    const attributes = outcome.attributes;
    return ok({ type: "leave-adjustment", id: outcome.id, version: 1, attributes, requestId, self: `/api/v1/leave-balances/ledger/${outcome.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
