import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { provisionInboundSecret, provisionSecretSchema } from "@/server/integrations/inbound";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = provisionSecretSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A connection id and secret are required." });
    const result = await provisionInboundSecret(access, parsed.data, requestId);
    return ok({ type: "integration-secret", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/webhooks/inbound` });
  } catch (error) {
    return fail(error, requestId);
  }
}
