import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { returnAsset } from "@/server/assets/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await returnAsset(access, id, requestId);
    return ok({ type: "asset", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/assets/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
