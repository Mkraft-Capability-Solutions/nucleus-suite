import { NextResponse } from "next/server";
import { z } from "zod";
import { toSnapshot } from "@/lib/entitlements/resolve";
import { buildEntitlementTree } from "@/lib/entitlements/tree";
import { requirePlatformAdmin } from "@/server/platform-admin/access";
import { getPlatformTenant } from "@/server/platform-admin/service";
import {
  applyEntitlementChanges,
  entitlementChangesSchema,
  entitlementsForTenantAsPlatform,
} from "@/server/entitlements/service";
import { uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ tenantId: string }> };

async function tenantIdFrom(params: Params["params"]) {
  const { tenantId } = await params;
  if (!z.uuid().safeParse(tenantId).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Company identifier is invalid." });
  return tenantId;
}

const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });

/** Full module → sub-module → feature tree for one organisation, with its settings. */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const tenantId = await tenantIdFrom(params);
    const tenant = await getPlatformTenant(admin, tenantId);
    const resolved = await entitlementsForTenantAsPlatform(admin.userId, tenantId);
    return NextResponse.json(
      { data: { tenant, tree: buildEntitlementTree(resolved), snapshot: toSnapshot(resolved) }, meta: { requestId } },
      { headers: headers(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Enable or disable any module, sub-module or feature, and edit settings, for one organisation. */
export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const tenantId = await tenantIdFrom(params);
    await getPlatformTenant(admin, tenantId);
    const parsed = entitlementChangesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Send a list of changes: { changes: [{ key, enabled?, config? }] }." });
    }
    const resolved = await applyEntitlementChanges({
      tenantId,
      actorUserId: admin.userId,
      authority: "platform",
      changes: parsed.data.changes,
      reason: parsed.data.reason,
      requestId: uuidOrNull(requestId),
    });
    return NextResponse.json(
      { data: { tree: buildEntitlementTree(resolved), snapshot: toSnapshot(resolved) }, meta: { requestId } },
      { headers: headers(requestId) },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
