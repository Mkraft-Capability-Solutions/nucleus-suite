import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { readNucleusIntelligence } from "@/server/cockpits/nucleus-intelligence";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

/**
 * S10 Nucleus Intelligence aggregation endpoint. Read-only.
 *
 * This is a governance surface, so its permission rule is enforced twice over:
 * `canAccessCockpit` requires one of the cockpit's declared permissions
 * (`tenant.read` / `tenant.manage`) AND an administrative principal before the
 * handler reads anything, and every read inside
 * `readNucleusIntelligence` re-enforces `tenant.read` through the authorization
 * layer. A principal who reaches this URL directly, with navigation bypassed,
 * is refused here with a 403 rather than served the data.
 */
export const dynamic = "force-dynamic";

const COCKPIT_ID = "nucleus-intelligence";

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

    const data = await readNucleusIntelligence(access);

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
