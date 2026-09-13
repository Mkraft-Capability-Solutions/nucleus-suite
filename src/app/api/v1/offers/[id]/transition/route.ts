import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { transitionOffer } from "@/server/talent/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["send", "accept", "decline"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An offer action (send, accept, decline) is required." });
    const result = await transitionOffer(access, id, parsed.data.action, requestId);
    return ok({ type: "offer", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/offers/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
