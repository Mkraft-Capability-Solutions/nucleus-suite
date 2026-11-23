import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getConnectionActivity } from "@/server/integrations/operations";

export const dynamic = "force-dynamic";

/** GET a connection's job history (sync/test outbox events with status) and audit log (tenant.read). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const activity = await getConnectionActivity(access, id);
    return ok({ type: "integration-activity", id, version: 1, attributes: activity, requestId, self: `/api/v1/integrations/connections/${id}/activity` });
  } catch (error) {
    return fail(error, requestId);
  }
}
