import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { decideLeave } from "@/server/leave/service";
import { runIdempotent } from "@/server/leave/idempotent-write";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ approve: z.boolean(), comment: z.string().trim().max(1000).optional() });

/**
 * Decides the current approval step. Idempotency-Key is required: a retried
 * approval must not advance the chain a second level.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    const key = requireIdempotencyKey(request.headers);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A decision (approve true/false) is required." });
    if (!parsed.data.approve && (parsed.data.comment ?? "").length < 3) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "A rejection needs a reason of at least 3 characters.", details: [{ field: "comment", issue: "required_for_rejection" }] });
    }
    const outcome = await runIdempotent(access, "leave.decide", key, { id, ...parsed.data }, () => decideLeave(access, id, parsed.data.approve, parsed.data.comment, requestId));
    const attributes = outcome.attributes;
    return ok({ type: "leave-request", id, version: 1, attributes, requestId, self: `/api/v1/leave-requests/register/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
