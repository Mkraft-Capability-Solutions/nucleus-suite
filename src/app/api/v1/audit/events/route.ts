import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listAuditEvents, parseAuditScope } from "@/server/access/audit-log";

export const dynamic = "force-dynamic";

/** GET a cursor-paginated page of the tenant audit trail (audit.read). ?scope=access|security|settings|integrations&search=&cursor=&limit= */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const page = await listAuditEvents(access, {
      scope: parseAuditScope(params.get("scope")),
      search: params.get("search") ?? "",
      cursor: params.get("cursor"),
      limit: Number(params.get("limit") ?? "25"),
    });
    return ok({ type: "audit-page", id: "audit-events", version: 1, attributes: page, requestId, self: "/api/v1/audit/events" });
  } catch (error) {
    return fail(error, requestId);
  }
}
