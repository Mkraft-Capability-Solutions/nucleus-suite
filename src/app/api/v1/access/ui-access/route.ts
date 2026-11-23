import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getOwnUiAccess } from "@/server/access/member-access";

export const dynamic = "force-dynamic";

/** GET the signed-in member's effective pages and cards (roles + overrides), for navigation. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const own = await getOwnUiAccess(access);
    return ok({
      type: "ui-access",
      id: own.member.id,
      version: 1,
      attributes: { superAdmin: own.superAdmin, roles: own.roles.map((role) => role.code), access: own.access },
      requestId,
      self: "/api/v1/access/ui-access",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
