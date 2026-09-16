import { requireAccess } from "@/server/platform/access";
import { collection, fail, parsePagination, requestIdFrom } from "@/server/platform/http";
import { queryAudit } from "@/server/ops/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await queryAudit(access, {
      action: params.get("action") ?? undefined,
      entityType: params.get("entityType") ?? undefined,
      entityId: params.get("entityId") ?? undefined,
      actorUserId: params.get("actorUserId") ?? undefined,
      since: params.get("since") ?? undefined,
      page,
      pageSize,
    });
    return collection({      type: "audit-event",
      items: (items as Array<Record<string, unknown>>).map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/ops/audit-events",
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
