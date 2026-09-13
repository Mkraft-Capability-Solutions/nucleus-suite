import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getAdvance } from "@/server/advances/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const advance = await getAdvance(access, id);
    return ok({ type: "salary-advance", id: advance.id, version: 1, attributes: advance, requestId, self: `/api/v1/salary-advances/${advance.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
