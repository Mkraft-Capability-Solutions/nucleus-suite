import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { getRole, resetRoleUiAccess, roleUiAccessSchema, setRoleUiAccess } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PUT saves the pages and cards a role may open (role.manage, Idempotency-Key required). */
export async function PUT(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = await parseBody(request, roleUiAccessSchema);
    const role = await idempotent({
      access,
      headers: request.headers,
      operation: "access.role_ui_access",
      payload: { id, ...input },
      run: async () => {
        const updated = await setRoleUiAccess(access, id, input, requestId);
        return { locator: updated.id, value: updated };
      },
      replay: (roleId) => getRole(access, roleId),
    });
    return ok({ type: "role", id: role.id, version: 1, attributes: role, requestId, self: `/api/v1/roles/${role.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** DELETE removes the saved configuration, so the role falls back to the pages its permissions allow. */
export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const role = await resetRoleUiAccess(access, id, requestId);
    return ok({ type: "role", id: role.id, version: 1, attributes: role, requestId, self: `/api/v1/roles/${role.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
