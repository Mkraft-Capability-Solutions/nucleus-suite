import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { releaseLegalHold } from "@/server/privacy/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await releaseLegalHold(access, id, requestId);
    return ok({ type: "legal-hold", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/privacy/holds` });
  } catch (error) {
    return fail(error, requestId);
  }
}
