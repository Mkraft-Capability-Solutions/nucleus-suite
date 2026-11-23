import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getMemberAccess } from "@/server/access/member-access";

export const dynamic = "force-dynamic";

/** GET one member's roles, permissions, overrides and effective page/card access (membership.manage, or self). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const detail = await getMemberAccess(access, id);
    return ok({ type: "member-access", id: detail.member.id, version: 1, attributes: detail, requestId, self: `/api/v1/access/members/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
