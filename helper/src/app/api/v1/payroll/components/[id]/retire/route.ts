import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { transitionPayComponent } from "@/server/payroll/components-master";

export const dynamic = "force-dynamic";

/** POST /api/v1/payroll/components/:id/retire — PL_ACTIVE_STATUS -> inactive. Refused while another active component derives from it. If-Match required. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const claimedVersion = requireVersion(request.headers);
    const result = await transitionPayComponent(access, id, "retire", claimedVersion, requestId);
    const { id: componentId, rowVersion, ...attributes } = result;
    return ok({ type: "pay-component", id: componentId, version: rowVersion, attributes, requestId, self: `/api/v1/payroll/components/${componentId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
