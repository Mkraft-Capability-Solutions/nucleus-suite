import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import {
  listRoleDataScopes,
  listScopeDimensionValues,
  roleDataScopeSchema,
  saveRoleDataScope,
} from "@/server/access-scopes/data-scopes";

export const dynamic = "force-dynamic";

/** Role & Data Scope Setup (F-SEC-01): every active role with the scope RL-24 applies to it. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [items, dimensionValues] = await Promise.all([
      listRoleDataScopes(access),
      listScopeDimensionValues(access),
    ]);
    return collection({
      type: "role-data-scope",
      // The values the role's dimension can take travel with the row: the setup screen has
      // no other source for the tenant's own site list.
      items: items.map((item) => ({
        ...item,
        id: item.roleCode,
        version: 1,
        availableValues: dimensionValues[item.scopeDimension],
      })),
      requestId,
      self: "/api/v1/organization/data-scopes",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Set one role's scope dimension, its values, and the two structure-visibility flags. */
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = roleDataScopeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The data scope payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const scope = await saveRoleDataScope(access, parsed.data, requestId);
    return ok({
      type: "role-data-scope",
      id: scope.roleCode,
      version: 1,
      attributes: scope,
      requestId,
      self: "/api/v1/organization/data-scopes",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
