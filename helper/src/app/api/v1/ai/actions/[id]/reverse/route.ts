import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { reverseAction } from "@/server/ai/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A legal reversal reason is required." });
    const result = await reverseAction(access, id, parsed.data.reason, requestId);
    return ok({ type: "agent-action-reversal", id: result.reversalId, version: 1, attributes: result, requestId, self: `/api/v1/ai/actions/${result.actionId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
