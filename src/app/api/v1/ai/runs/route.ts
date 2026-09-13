import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { startRun, startRunSchema } from "@/server/ai/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = startRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A workflow code is required to start a run." });
    const result = await startRun(access, parsed.data);
    return ok({ type: "ai-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/ai/runs/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
