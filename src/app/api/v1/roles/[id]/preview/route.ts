import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { previewRole } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

/** GET computes what a member holding only this role sees: pages, cards and allowed actions (role.read). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const preview = await previewRole(access, id);
    return ok({ type: "role-preview", id: preview.role.id, version: 1, attributes: preview, requestId, self: `/api/v1/roles/${id}/preview` });
  } catch (error) {
    return fail(error, requestId);
  }
}
