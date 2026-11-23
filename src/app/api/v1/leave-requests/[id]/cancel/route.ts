import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { cancelLeaveRequest, cancelLeaveSchema } from "@/server/leave/request-guards";
import { issueDetails, runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

/** Applicant or HR withdraws a pending request or cancels approved leave before it starts. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    const key = requireIdempotencyKey(request.headers);
    const parsed = cancelLeaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "A reason of at least 3 characters is required.", details: issueDetails(parsed.error.issues) });
    }
    const outcome = await runIdempotent(access, "leave.cancel", key, { id, ...parsed.data }, () => cancelLeaveRequest(access, id, parsed.data, requestId));
    const attributes = outcome.attributes;
    return ok({ type: "leave-request", id, version: 1, attributes, requestId, self: `/api/v1/leave-requests/register/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
