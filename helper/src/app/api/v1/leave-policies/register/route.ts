import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import {
  createLeaveTypeConfiguration,
  leaveTypeConfigurationSchema,
  listLeavePolicies,
} from "@/server/leave/policy-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listLeavePolicies(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "leave-policy",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave-policies/register",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** FRM-LVE-01: configure a leave type and open its first accrual-rule version. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = leaveTypeConfigurationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The leave type configuration is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createLeaveTypeConfiguration(access, parsed.data, requestId);
    return ok({ type: "leave-policy", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave-policies/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
