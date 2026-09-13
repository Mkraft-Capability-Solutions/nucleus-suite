import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { grantPermissionsSchema, grantRolePermissions } from "@/server/admin/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = grantPermissionsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Permission keys are required." });
    const result = await grantRolePermissions(access, id, parsed.data, requestId);
    return ok({ type: "role", id: result.roleId, version: 1, attributes: result, requestId, self: `/api/v1/roles` });
  } catch (error) {
    return fail(error, requestId);
  }
}
