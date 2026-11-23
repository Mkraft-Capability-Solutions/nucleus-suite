import { NextResponse } from "next/server";
import { canAccessCockpit, cockpitById } from "@/lib/cockpit-catalog";
import { loadPayrollControlRoom } from "@/server/cockpits/payroll-control-room";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const COCKPIT_ID = "payroll-control-room";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** S5 Payroll Control Room aggregation. Read-only; every write stays on its own resource. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const cockpit = cockpitById(COCKPIT_ID);
    if (!cockpit || !canAccessCockpit(cockpit, access.context.permissions, access.context.roles)) {
      throw new HttpError({
        status: 403,
        code: "FORBIDDEN",
        message: "This console is not available to your role.",
      });
    }

    const runId = new URL(request.url).searchParams.get("runId");
    const data = await loadPayrollControlRoom(access, { runId: runId && UUID.test(runId) ? runId : null });

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
