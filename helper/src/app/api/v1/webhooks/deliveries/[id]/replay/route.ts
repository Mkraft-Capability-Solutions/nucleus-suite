import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { replayDelivery } from "@/server/integrations/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await replayDelivery(access, id, requestId);
    return ok({ type: "webhook-delivery", id: result.deliveryId, version: 1, attributes: result, requestId, self: `/api/v1/webhooks/deliveries` });
  } catch (error) {
    return fail(error, requestId);
  }
}
