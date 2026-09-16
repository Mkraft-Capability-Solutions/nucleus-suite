import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { getPayComponent, payComponentSchema, updatePayComponent } from "@/server/payroll/components-master";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await getPayComponent(access, id);
    const { id: componentId, rowVersion, ...attributes } = result;
    return ok({ type: "pay-component", id: componentId, version: rowVersion, attributes, requestId, self: `/api/v1/payroll/components/${componentId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * PATCH carries the whole form (the master is one record, not a partial), with
 * If-Match on the row version. A calculation change on a component a finalized
 * run used comes back as 409 COMPONENT_VERSION_REQUIRED until it is dated after
 * that run's period; the service then appends a version instead of mutating.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const claimedVersion = requireVersion(request.headers);
    const parsed = payComponentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A component code, name, GL debit and credit account and payslip sequence are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await updatePayComponent(access, id, parsed.data, claimedVersion, requestId);
    const { id: componentId, rowVersion, ...attributes } = result;
    return ok({ type: "pay-component", id: componentId, version: rowVersion, attributes, requestId, self: `/api/v1/payroll/components/${componentId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
