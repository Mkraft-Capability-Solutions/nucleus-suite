import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { settleFullAndFinal } from "@/server/lifecycle/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await settleFullAndFinal(access, id, requestId);
    return ok({ type: "full-final-settlement", id: result.settlementId, version: 1, attributes: result, requestId, self: `/api/v1/offboarding/cases/${result.caseId}/settle` });
  } catch (error) {
    return fail(error, requestId);
  }
}
