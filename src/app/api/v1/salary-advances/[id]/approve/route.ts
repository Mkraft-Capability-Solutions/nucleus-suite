import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { approveAdvance } from "@/server/advances/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await approveAdvance(access, id, requestId);
    return ok({ type: "salary-advance", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/salary-advances/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
