import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getEmployeeWorkRules } from "@/server/organization/work-rules";

export const dynamic = "force-dynamic";

/**
 * RL-05 and RL-26. The resolved rest-day applicability, rest-day pattern, wage type and OT
 * eligibility for one employee, with the level each value came from, so a disagreement about
 * why someone has no rest day can be settled from the record rather than from the code.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const rules = await getEmployeeWorkRules(access, id);
    return ok({
      type: "employee-work-rules",
      id,
      version: 1,
      attributes: rules,
      requestId,
      self: `/api/v1/people/${id}/work-rules`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
