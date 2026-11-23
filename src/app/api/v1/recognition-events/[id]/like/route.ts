import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { setRecognitionLike } from "@/server/engagement/recognition-feed";
import { parseBody, requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

const likeSchema = z.object({ op: z.enum(["like", "withdraw"]).default("like") });

/**
 * Like (or withdraw a like on) a recognition. One like per person: repeating the same op is a no-op, so the
 * request is naturally idempotent and a retry can never inflate the count. 404 when the recognition is unknown.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "recognition");
    const input = parseBody(likeSchema, (await request.json().catch(() => null)) ?? {}, "The like payload is invalid.");
    const result = await setRecognitionLike(access, id, input.op, requestId);
    return ok({ type: "recognition-like", id, version: 1, attributes: result, requestId, self: `/api/v1/recognition-events/${id}/like` });
  } catch (error) {
    return fail(error, requestId);
  }
}
