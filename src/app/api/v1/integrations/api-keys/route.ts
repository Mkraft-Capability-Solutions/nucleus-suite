import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { createApiKey, createApiKeySchema, listApiKeys } from "@/server/integrations/api-keys";

export const dynamic = "force-dynamic";

/** GET the tenant's API keys (prefix only, never the secret or its hash; tenant.manage). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listApiKeys(access);
    return ok({ type: "api-key-list", id: "api-keys", version: 1, attributes: { items }, requestId, self: "/api/v1/integrations/api-keys" });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST issues a key; the secret is in this response only. A replayed Idempotency-Key cannot return it again. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const input = await parseBody(request, createApiKeySchema);
    const issued = await idempotent({
      access,
      headers: request.headers,
      operation: "integration.api_key_create",
      payload: input,
      run: async () => {
        const created = await createApiKey(access, input, requestId);
        return { locator: created.key.id, value: created as { key: { id: string }; secret: string | null } };
      },
      replay: () => {
        throw new HttpError({ status: 409, code: "ALREADY_ISSUED", message: "This key was already issued. Its secret is shown only once; revoke it and issue a new key if it was not saved." });
      },
    });
    return ok({ type: "api-key", id: issued.key.id, version: 1, attributes: issued, requestId, self: "/api/v1/integrations/api-keys" });
  } catch (error) {
    return fail(error, requestId);
  }
}
