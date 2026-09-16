import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { finalizeRun } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    // Consequential and irreversible: an explicit version precondition is required.
    requireVersion(request.headers);
    const result = await finalizeRun(access, id, requestId);
    return ok({ type: "payroll-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/payroll-runs/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
