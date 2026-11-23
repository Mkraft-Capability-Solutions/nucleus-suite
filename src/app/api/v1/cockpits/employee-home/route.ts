import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { buildEmployeeHome } from "@/server/cockpits/employee-home";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const COCKPIT_ID = "employee-home";

/**
 * S8 Employee Home aggregation endpoint.
 *
 * S8 is the tenant's only `audience: "employee"` cockpit, so `canAccessCockpit`
 * deliberately refuses an administrative principal. That refusal is intended
 * behaviour and is returned as a clean 403 through the shared `fail` path.
 *
 * Everything below is self-scoped: the subject is always
 * `access.context.employeeId`, and no employee identifier is accepted from the
 * query string, so this endpoint cannot be aimed at another person. An account
 * with no employee link gets an explicit 200 answer saying so rather than a
 * crash or a tenant-wide view.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const cockpit = cockpitById(COCKPIT_ID);
    if (!cockpit) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "This cockpit is not registered." });
    }
    if (!canAccessCockpit(cockpit, access.context.permissions, access.context.roles)) {
      throw new HttpError({
        status: 403,
        code: "FORBIDDEN",
        message:
          "Employee Home is an employee self-service console and is not available to an administrative principal.",
      });
    }

    const data = await buildEmployeeHome(access);

    return NextResponse.json(
      {
        data,
        meta: {
          requestId,
          tenantId: access.tenantId,
          cockpit: cockpit.code,
          generatedAt: new Date().toISOString(),
          completeness: !data.linked ? "unavailable" : data.unavailableSources.length === 0 ? "complete" : "partial",
        },
        links: { self: cockpit.endpoint },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
