import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { databaseConfigured } from "@/lib/db";
import { getSettings } from "@/server/admin/service";
import { listTenantMemberships, resolveAuthorizationContext } from "@/server/identity/tenant-context";
import { isPlatformAdminEmail } from "@/server/platform-admin/access";
import { listNotifications } from "@/server/notifications/service";
import { ACTIVE_TENANT_COOKIE, type Access } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    if (!databaseConfigured) {
      return NextResponse.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Identity storage is not configured.", requestId } },
        { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required.", requestId } },
        { status: 401, headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }

    const memberships = await listTenantMemberships(request.headers);
    const activeTenantId = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
    const activeMembership = memberships.find((membership) => membership.tenantId === activeTenantId);
    const context = activeMembership
      ? await resolveAuthorizationContext(request.headers, activeMembership.tenantId)
      : null;

    let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
    let notifications: Awaited<ReturnType<typeof listNotifications>> = { items: [], unread: 0 };
    if (context) {
      const access: Access = { context, tenantId: context.tenantId };
      if (context.permissions.includes("tenant.read")) {
        settings = await getSettings(access).catch(() => null);
      }
      if (context.permissions.includes("employee.read")) {
        notifications = await listNotifications(access, false).catch(() => ({ items: [], unread: 0 }));
      }
    }

    return NextResponse.json(
      {
        data: {
          user: { id: session.user.id, name: session.user.name, email: session.user.email },
          platformAdmin: isPlatformAdminEmail(session.user.email),
          memberships,
          context,
          settings,
          notifications,
        },
        meta: { requestId, generatedAt: new Date().toISOString() },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
