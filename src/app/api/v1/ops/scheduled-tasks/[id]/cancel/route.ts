import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { cancelScheduledTask } from "@/server/ops/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await cancelScheduledTask(access, id, requestId);
    return ok({ type: "scheduled-task", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ops/scheduled-tasks` });
  } catch (error) {
    return fail(error, requestId);
  }
}
