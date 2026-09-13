import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  IdentityError,
  listTenantMemberships,
  resolveAuthorizationContext,
} from "@/server/identity/tenant-context";
import { recordAudit } from "@/server/platform/access";
import { requestIdFrom } from "@/server/platform/http";

const ACTIVE_TENANT_COOKIE = "mkraft_active_tenant";
const bodySchema = z.object({ tenantId: z.uuid() });
const headers = { "cache-control": "no-store" };

function failure(error: unknown) {
  if (error instanceof IdentityError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  return NextResponse.json({ error: "Identity context is temporarily unavailable" }, { status: 503, headers });
}

export async function GET(request: Request) {
  try {
    const activeTenantId = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
    const memberships = await listTenantMemberships(request.headers);
    const context = activeTenantId
      ? await resolveAuthorizationContext(request.headers, activeTenantId)
      : undefined;
    return NextResponse.json({ memberships, context }, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403, headers });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid tenant is required" }, { status: 400, headers });
  }

  try {
    const context = await resolveAuthorizationContext(request.headers, parsed.data.tenantId);
    const response = NextResponse.json({ context }, { headers });
    response.cookies.set(ACTIVE_TENANT_COOKIE, context.tenantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    await recordAudit(
      { context, tenantId: context.tenantId },
      { action: "tenant.switch", entityType: "tenant", entityId: context.tenantId, reason: "Active tenant selected", requestId: requestIdFrom(request.headers) },
    );
    return response;
  } catch (error) {
    return failure(error);
  }
}
