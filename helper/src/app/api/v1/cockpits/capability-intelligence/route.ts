import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { readCapabilityIntelligence } from "@/server/cockpits/capability-intelligence";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

/**
 * S9 Capability Intelligence aggregation endpoint. Read-only: the cockpit
 * shows recorded learning and capability figures and issues no commands.
 *
 * The cockpit's own permission rule is enforced here, not only in navigation.
 * Hiding a console from a menu is a presentation choice; refusing the data is
 * the control.
 */
export const dynamic = "force-dynamic";

const COCKPIT_ID = "capability-intelligence";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const cockpit = cockpitById(COCKPIT_ID);
    if (!cockpit || !canAccessCockpit(cockpit, access.context.permissions, access.context.roles)) {
      throw new HttpError({
        status: 403,
        code: "FORBIDDEN",
        message: "This cockpit is not permitted for the current role.",
      });
    }

    const data = await readCapabilityIntelligence(access);

    return NextResponse.json(
      {
        data,
        meta: {
          requestId,
          tenantId: access.tenantId,
          cockpit: cockpit.code,
          generatedAt: data.generatedAt,
          completeness: data.unavailableSources.length > 0 ? "partial" : "complete",
        },
        links: { self: cockpit.endpoint },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
