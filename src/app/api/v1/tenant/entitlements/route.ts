import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toSnapshot } from "@/lib/entitlements/resolve";
import { buildEntitlementTree } from "@/lib/entitlements/tree";
import { DEFAULT_CONSOLE, personaForRoles } from "@/lib/personas";
import { listTenantMemberships } from "@/server/identity/tenant-context";
import { isPlatformAdminEmail } from "@/server/platform-admin/access";
import {
  applyEntitlementChanges,
  entitlementChangesSchema,
  entitlementsFor,
} from "@/server/entitlements/service";
import { enforce, requireAccess, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });

/**
 * The active organisation's plan for the signed-in member: which modules, sub-modules and features
 * are on, their settings, and the member's persona. The workspace navigation is built from this.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [resolved, memberships, session] = await Promise.all([
      entitlementsFor(access),
      listTenantMemberships(request.headers),
      auth.api.getSession({ headers: request.headers }),
    ]);
    const platformAdmin = isPlatformAdminEmail(session?.user?.email);
    const persona = personaForRoles(access.context.roles, { platformAdmin });
    const tenant = memberships.find((membership) => membership.tenantId === access.tenantId);
    const canManage = access.context.permissions.includes("tenant.manage");
    const detail = new URL(request.url).searchParams.get("detail") === "tree";
    return NextResponse.json(
      {
        data: {
          tenant: tenant ? { id: tenant.tenantId, name: tenant.tenantName, slug: tenant.tenantSlug } : { id: access.tenantId },
          memberships: memberships.map((membership) => ({ id: membership.tenantId, name: membership.tenantName, slug: membership.tenantSlug })),
          persona,
          defaultConsole: DEFAULT_CONSOLE[persona],
          roleCodes: access.context.roles,
          platformAdmin,
          canManage,
          snapshot: toSnapshot(resolved),
          ...(detail ? { tree: buildEntitlementTree(resolved) } : {}),
        },
        meta: { requestId },
      },
      { headers: headers(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Organisation administrators (tenant.manage) switch features and edit settings inside the
 * sub-modules their plan includes. Modules and sub-modules are changed by the platform operator.
 */
export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
    const parsed = entitlementChangesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Send a list of changes: { changes: [{ key, enabled?, config? }] }." });
    }
    const resolved = await applyEntitlementChanges({
      tenantId: access.tenantId,
      actorUserId: access.context.actorUserId,
      membershipId: access.context.membershipId,
      authority: "tenant",
      changes: parsed.data.changes,
      reason: parsed.data.reason,
      requestId: uuidOrNull(requestId),
    });
    return NextResponse.json(
      { data: { snapshot: toSnapshot(resolved), tree: buildEntitlementTree(resolved) }, meta: { requestId } },
      { headers: headers(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
