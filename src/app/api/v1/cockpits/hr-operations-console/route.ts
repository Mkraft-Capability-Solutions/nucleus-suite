import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { buildHrOperationsConsole } from "@/server/cockpits/hr-operations-console";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";

/**
 * S2 · HR Operations Console aggregation endpoint.
 *
 * Read-only. The cockpit registry is the authority on who may open this
 * console, so the same `canAccessCockpit` rule that hides the tile from the
 * launcher is enforced here: a principal who cannot see the cockpit cannot
 * fetch its data either.
 */

export const dynamic = "force-dynamic";

const COCKPIT_ID = "hr-operations-console";

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
        message: "You do not have access to the HR Operations Console.",
      });
    }

    const payload = await buildHrOperationsConsole(access);

    return NextResponse.json(
      {
        data: {
          cockpit: { id: cockpit.id, code: cockpit.code, label: cockpit.label, description: cockpit.description },
          ...payload,
        },
        meta: {
          requestId,
          tenantId: access.tenantId,
          generatedAt: payload.generatedAt,
          completeness: payload.unavailableSources.length > 0 ? "partial" : "complete",
        },
        links: { self: cockpit.endpoint },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
