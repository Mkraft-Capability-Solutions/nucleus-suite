import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listMembers } from "@/server/access/member-access";

export const dynamic = "force-dynamic";

/** GET lists tenant members with their active roles and override counts (membership.manage). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listMembers(access);
    return ok({ type: "member-list", id: "members", version: 1, attributes: { items }, requestId, self: "/api/v1/access/members" });
  } catch (error) {
    return fail(error, requestId);
  }
}
