import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { getRole, updateRolePermissions, updateRolePermissionsSchema } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function apply(request: Request, params: Params["params"], input: z.infer<typeof updateRolePermissionsSchema>, requestId: string) {
  const access = await requireAccess(request);
  const { id } = await params;
  const role = await idempotent({
    access,
    headers: request.headers,
    operation: "access.role_permissions",
    payload: { id, ...input },
    run: async () => {
      const updated = await updateRolePermissions(access, id, input, requestId);
      return { locator: updated.id, value: updated };
    },
    replay: (roleId) => getRole(access, roleId),
  });
  return ok({ type: "role", id: role.id, version: 1, attributes: role, requestId, self: `/api/v1/roles/${role.id}` });
}

/** PUT grants and revokes action permissions on a role (role.manage, Idempotency-Key required). */
export async function PUT(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const input = await parseBody(request, updateRolePermissionsSchema);
    return await apply(request, params, input, requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}

const legacyGrantSchema = z.object({ permissionKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(50) });

/** POST is the earlier grant-only form ({ permissionKeys }); unknown keys are rejected, never created. */
export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const legacy = await parseBody(request, legacyGrantSchema);
    return await apply(request, params, updateRolePermissionsSchema.parse({ grant: legacy.permissionKeys, revoke: [] }), requestId);
  } catch (error) {
    return fail(error, requestId);
  }
}
