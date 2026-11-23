import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { loadEmployeeFormReference } from "@/server/onboarding/form-reference";

export const dynamic = "force-dynamic";

/** GET the tenant master data the employee creation wizard picks from (employee.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const reference = await loadEmployeeFormReference(access);
    return ok({ type: "employee-form-reference", id: "employee-form-reference", version: 1, attributes: reference, requestId, self: "/api/v1/onboarding/form-reference" });
  } catch (error) {
    return fail(error, requestId);
  }
}
