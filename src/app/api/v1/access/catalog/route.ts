import { UI_CARDS, UI_PAGES } from "@/lib/access/ui-access-catalog";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listPermissionCatalog } from "@/server/access/role-admin";

export const dynamic = "force-dynamic";

/** GET returns the grantable pages, cards and action permissions (role.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const permissions = await listPermissionCatalog(access);
    return ok({ type: "access-catalog", id: "catalog", version: 1, attributes: { pages: UI_PAGES, cards: UI_CARDS, permissions }, requestId, self: "/api/v1/access/catalog" });
  } catch (error) {
    return fail(error, requestId);
  }
}
