import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { buildManagerCockpit } from "@/server/cockpits/manager-cockpit";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const COCKPIT_ID = "manager-cockpit";

/**
 * S7 Manager Cockpit aggregation endpoint.
 *
 * The cockpit's permission AND its audience are both enforced here through the
 * registry, so a principal who may not open the console cannot read its data
 * through the API either. A refusal is a clean 403 through the shared `fail`
 * path, never a thrown error.
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
        message: "This cockpit is not available to the current role.",
      });
    }

    const data = await buildManagerCockpit(access);

    return NextResponse.json(
      {
        data,
        meta: {
          requestId,
          tenantId: access.tenantId,
          cockpit: cockpit.code,
          generatedAt: new Date().toISOString(),
          completeness: data.unavailableSources.length === 0 ? "complete" : "partial",
        },
        links: { self: cockpit.endpoint },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
