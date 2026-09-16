import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { reactionSchema, setPostReaction } from "@/server/engagement/experience";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Set or withdraw the caller's reaction on a post. One reaction per person per
 * post: repeating the same command is a no-op and `op: "withdraw"` reverses it,
 * so a retried or double-clicked request can never inflate the count. The
 * subject is always the caller — no body field can react on someone's behalf.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    requireIdempotencyKey(request.headers);
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The post reference is invalid.", details: [{ field: "id", issue: "Expected a UUID." }] });
    }
    const parsed = reactionSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The reaction payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await setPostReaction(access, id, parsed.data, requestId);
    return ok({
      type: "post-reaction",
      id,
      version: 1,
      attributes: { ...result },
      requestId,
      self: `/api/v1/social-feed/${id}/reactions`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
