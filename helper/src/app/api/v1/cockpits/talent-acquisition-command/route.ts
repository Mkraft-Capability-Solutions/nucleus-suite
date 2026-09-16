import { NextResponse } from "next/server";
import { cockpitById, canAccessCockpit } from "@/lib/cockpit-catalog";
import { loadTalentAcquisitionCommand } from "@/server/cockpits/talent-acquisition-command";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const COCKPIT_ID = "talent-acquisition-command";

/** S4 aggregation endpoint. Read-only; the cockpit's own audience rule is enforced here. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const cockpit = cockpitById(COCKPIT_ID);
    if (!cockpit || !canAccessCockpit(cockpit, access.context.permissions, access.context.roles)) {
      throw new HttpError({
        status: 403,
        code: "FORBIDDEN",
        message: "This action is not permitted for the current role.",
      });
    }

    const data = await loadTalentAcquisitionCommand(access);

    return NextResponse.json(
      {
        data,
        meta: {
          requestId,
          tenantId: access.tenantId,
          cockpit: cockpit.code,
          generatedAt: new Date().toISOString(),
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
