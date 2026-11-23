import { requireAccess } from "@/server/platform/access";
import { collection, fail, requestIdFrom } from "@/server/platform/http";
import { listLeaveActivity } from "@/server/leave/workspace";

export const dynamic = "force-dynamic";

/** Recent leave audit events the caller may see. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listLeaveActivity(access);
    return collection({
      type: "leave-activity",
      items: rows.map((row) => ({ ...row, version: 1 })),
      requestId,
      self: "/api/v1/leave/activity",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
