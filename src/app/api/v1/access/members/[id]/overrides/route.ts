import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { clearMemberOverrides, clearOverridesSchema, getMemberAccess, setMemberOverrides, setOverridesSchema } from "@/server/access/member-access";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST sets time-boxed page/card overrides for one member (membership.manage, reason, Idempotency-Key). */
export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = await parseBody(request, setOverridesSchema);
    const detail = await idempotent({
      access,
      headers: request.headers,
      operation: "access.member_override",
      payload: { id, ...input },
      run: async () => {
        const updated = await setMemberOverrides(access, id, input, requestId);
        return { locator: updated.member.id, value: updated };
      },
      replay: (memberId) => getMemberAccess(access, memberId),
    });
    return ok({ type: "member-access", id: detail.member.id, version: 1, attributes: detail, requestId, self: `/api/v1/access/members/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** DELETE revokes the given overrides, or all of them when no items are sent (membership.manage, reason). */
export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = await parseBody(request, clearOverridesSchema);
    const detail = await clearMemberOverrides(access, id, input, requestId);
    return ok({ type: "member-access", id: detail.member.id, version: 1, attributes: detail, requestId, self: `/api/v1/access/members/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
