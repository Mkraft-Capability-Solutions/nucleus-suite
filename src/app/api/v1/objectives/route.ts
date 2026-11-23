import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { createObjective } from "@/server/performance/service";
import { parseObjectivePayload } from "@/server/performance/objective-payload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const input = parseObjectivePayload(await request.json().catch(() => null));
    const result = await createObjective(access, input);
    return ok({ type: "objective", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/objectives/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
