import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { createRole, createRoleSchema, getRole, listRoles } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

/** GET lists the tenant's roles with their actions and page/card configuration (role.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listRoles(access);
    return ok({ type: "role-list", id: "roles", version: 1, attributes: { items }, requestId, self: "/api/v1/roles" });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST creates a role (role.manage, Idempotency-Key required), optionally copying another role's actions. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const input = await parseBody(request, createRoleSchema);
    const role = await idempotent({
      access,
      headers: request.headers,
      operation: "access.role_create",
      payload: input,
      run: async () => {
        const created = await createRole(access, input, requestId);
        return { locator: created.id, value: created };
      },
      replay: (id) => getRole(access, id),
    });
    return ok({ type: "role", id: role.id, version: 1, attributes: role, requestId, self: `/api/v1/roles/${role.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
