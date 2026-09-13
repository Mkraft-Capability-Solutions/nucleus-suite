import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { assignMemberRoles, assignRolesSchema } from "@/server/admin/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = assignRolesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The assignment payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await assignMemberRoles(access, parsed.data, requestId);
    return ok({ type: "membership-roles", id: result.membershipId, version: 1, attributes: result, requestId, self: `/api/v1/memberships/roles` });
  } catch (error) {
    return fail(error, requestId);
  }
}
