import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { recordEvidence, recordEvidenceSchema } from "@/server/skills/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = recordEvidenceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The evidence payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await recordEvidence(access, parsed.data, requestId);
    return ok({ type: "skill-evidence", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/skill-evidence` });
  } catch (error) {
    return fail(error, requestId);
  }
}
