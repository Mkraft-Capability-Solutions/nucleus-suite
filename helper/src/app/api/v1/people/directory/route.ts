import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import {
  getPeopleCoreSummary,
  listDirectoryAudit,
  listLegalEntities,
  listLocations,
  listPeopleDirectory,
} from "@/server/organization/directory";

export const dynamic = "force-dynamic";

/**
 * People Core reads one composed payload so the tab shell can switch without a
 * round trip per tab. Each section is isolated: one unavailable source degrades
 * to null instead of failing the page.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const search = new URL(request.url).searchParams.get("search") ?? "";
    const [directory, summary] = await Promise.all([
      listPeopleDirectory(access, search),
      getPeopleCoreSummary(access),
    ]);
    const [legalEntities, locations, auditTrail] = await Promise.all([
      listLegalEntities(access).catch(() => null),
      listLocations(access).catch(() => null),
      listDirectoryAudit(access).catch(() => null),
    ]);
    return NextResponse.json(
      {
        data: { directory, summary, legalEntities, locations, auditTrail },
        meta: { requestId, total: directory.length },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
