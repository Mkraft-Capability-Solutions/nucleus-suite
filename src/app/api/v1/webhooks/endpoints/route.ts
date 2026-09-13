import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createEndpointSchema, createWebhookEndpoint } from "@/server/integrations/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createEndpointSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The endpoint payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createWebhookEndpoint(access, parsed.data);
    return ok({ type: "webhook-endpoint", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/webhooks/endpoints` });
  } catch (error) {
    return fail(error, requestId);
  }
}
