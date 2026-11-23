import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { parseBody } from "@/server/access/idempotent";
import { revokeApiKey, revokeApiKeySchema } from "@/server/integrations/api-keys";

export const dynamic = "force-dynamic";

/** POST revokes an API key with a reason (tenant.manage). Revoking twice is a 409. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = await parseBody(request, revokeApiKeySchema);
    const key = await revokeApiKey(access, id, input.reason, requestId);
    return ok({ type: "api-key", id: key.id, version: 1, attributes: key, requestId, self: "/api/v1/integrations/api-keys" });
  } catch (error) {
    return fail(error, requestId);
  }
}
