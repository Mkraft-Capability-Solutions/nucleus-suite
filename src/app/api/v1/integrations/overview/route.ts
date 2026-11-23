import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getIntegrationsOverview } from "@/server/integrations/operations";

export const dynamic = "force-dynamic";

/** GET connections with last sync/test/error, event-outbox health, webhook endpoints and domains (tenant.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const overview = await getIntegrationsOverview(access);
    return ok({ type: "integrations-overview", id: access.tenantId, version: 1, attributes: overview, requestId, self: "/api/v1/integrations/overview" });
  } catch (error) {
    return fail(error, requestId);
  }
}
