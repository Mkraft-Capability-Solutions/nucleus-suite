import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createHoldSchema, createLegalHold } from "@/server/privacy/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createHoldSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A hold reason is required." });
    const result = await createLegalHold(access, parsed.data);
    return ok({ type: "legal-hold", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/privacy/holds` });
  } catch (error) {
    return fail(error, requestId);
  }
}
