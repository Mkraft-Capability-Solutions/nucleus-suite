import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { subscribeWebhook } from "@/server/integrations/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ endpointId: z.string().uuid(), events: z.array(z.string().trim().min(1).max(80)).min(1).max(30) });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An endpoint id and events are required." });
    const result = await subscribeWebhook(access, parsed.data.endpointId, parsed.data.events);
    return ok({ type: "webhook-subscription", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/webhooks/subscriptions` });
  } catch (error) {
    return fail(error, requestId);
  }
}
