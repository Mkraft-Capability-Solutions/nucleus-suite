import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { attachEvidence, attachEvidenceSchema } from "@/server/compliance/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = attachEvidenceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The evidence payload is invalid." });
    const result = await attachEvidence(access, parsed.data, requestId);
    return ok({ type: "compliance-evidence", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/compliance/obligations` });
  } catch (error) {
    return fail(error, requestId);
  }
}
