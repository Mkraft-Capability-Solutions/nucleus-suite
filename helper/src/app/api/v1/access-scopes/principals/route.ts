import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listPrincipalGrants, listScopeLookups, principalGrantSchema, savePrincipalGrant } from "@/server/access-scopes/service";

export const dynamic = "force-dynamic";

/**
 * User, Role and Scope Grant (FRM-PLT-03): every saved principal record keyed by
 * membership id, with the entity, location and payroll-group references the form offers.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [principals, lookups] = await Promise.all([listPrincipalGrants(access), listScopeLookups(access)]);
    return ok({ type: "principal-grants", id: "principals", version: 1, attributes: { principals, lookups }, requestId, self: "/api/v1/access-scopes/principals" });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Save one principal's record without granting new roles: the edit path of the form. */
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = principalGrantSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The principal grant payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const record = await savePrincipalGrant(access, parsed.data, requestId);
    return ok({ type: "principal-grant", id: parsed.data.membershipId, version: 1, attributes: record, requestId, self: "/api/v1/access-scopes/principals" });
  } catch (error) {
    return fail(error, requestId);
  }
}
