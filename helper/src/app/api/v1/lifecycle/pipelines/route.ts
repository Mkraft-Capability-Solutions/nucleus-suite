import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listPipelines } from "@/server/lifecycle/pipelines";

/**
 * Stored workflow pipelines and the lifecycle trigger chains derived from them.
 *
 * GET only. There is deliberately no POST: Nucleus has no runtime that executes
 * a pipeline definition (see the header of `src/server/lifecycle/pipelines.ts`),
 * so a write endpoint here would let an administrator "configure" an automation
 * that can never fire. A mutation belongs with an executor, and carries its
 * `Idempotency-Key` and `If-Match` at that point.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const pipelines = await listPipelines(access);
    return collection({
      type: "lifecycle-pipeline",
      items: pipelines,
      requestId,
      self: "/api/v1/lifecycle/pipelines",
      nextCursor: null,
      total: pipelines.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
