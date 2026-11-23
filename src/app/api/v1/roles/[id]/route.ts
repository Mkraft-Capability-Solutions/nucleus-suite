import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getRole } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const role = await getRole(access, id);
    return ok({ type: "role", id: role.id, version: 1, attributes: role, requestId, self: `/api/v1/roles/${role.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
