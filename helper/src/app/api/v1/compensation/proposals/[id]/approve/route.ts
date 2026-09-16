import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { approveCompProposal } from "@/server/compensation/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await approveCompProposal(access, id, requestId);
    return ok({ type: "compensation-proposal", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/compensation/proposals` });
  } catch (error) {
    return fail(error, requestId);
  }
}
