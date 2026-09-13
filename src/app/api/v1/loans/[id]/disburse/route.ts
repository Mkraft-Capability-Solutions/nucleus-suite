import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { disburseLoan } from "@/server/loans/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    requireVersion(request.headers);
    const result = await disburseLoan(access, id, requestId);
    return ok({ type: "loan", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/loans/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
