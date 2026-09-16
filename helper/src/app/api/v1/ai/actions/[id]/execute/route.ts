import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { executeAction } from "@/server/ai/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({}).passthrough();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The execution payload is invalid." });
    const result = await executeAction(access, id, key, requestId);
    return ok({ type: "agent-action-outcome", id: result.outcomeId, version: 1, attributes: result, requestId, self: `/api/v1/ai/actions/${result.actionId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
