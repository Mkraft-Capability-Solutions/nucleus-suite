import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { requestConnectionJob } from "@/server/integrations/operations";

export const dynamic = "force-dynamic";

/** POST queues a connection sync as an outbox event (Idempotency-Key required; a replay returns the same job). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const { id } = await params;
    const job = await requestConnectionJob(access, id, "sync", key, requestId);
    return ok({ type: "integration-job", id: job.id, version: 1, attributes: job, requestId, self: `/api/v1/integrations/connections/${id}/activity` });
  } catch (error) {
    return fail(error, requestId);
  }
}
