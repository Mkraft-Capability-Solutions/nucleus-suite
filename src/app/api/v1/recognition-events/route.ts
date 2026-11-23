import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, parsePagination, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { recognizeEmployee, recognizeSchema } from "@/server/engagement/service";
import { listRecognitionFeed } from "@/server/engagement/recognition-feed";
import { parseBody, runOnce } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

/** GET the tenant's peer-recognition feed (employee.read, paginated); POST records a recognition (employee.write, Idempotency-Key). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams);
    const { items, hasMore } = await listRecognitionFeed(access, { page, pageSize });
    return collection({
      type: "recognition-event",
      items,
      requestId,
      self: `/api/v1/recognition-events?page=${page}&pageSize=${pageSize}`,
      nextCursor: hasMore ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
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
    const input = parseBody(recognizeSchema, await request.json().catch(() => null), "The recognition payload is invalid.");
    const outcome = await runOnce(access, "engage.recognize", key, input, () => recognizeEmployee(access, input, requestId));
    return ok({ type: "recognition-event", id: outcome.id, version: 1, attributes: { id: outcome.id, replayed: outcome.replayed }, requestId, self: `/api/v1/recognition-events` });
  } catch (error) {
    return fail(error, requestId);
  }
}
