import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { listScopeMembers } from "@/server/access-scopes/service";

export const dynamic = "force-dynamic";

/** Tenant member picker for governed grants. Requires membership.manage. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const members = await listScopeMembers(access);
    return NextResponse.json({ data: members, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
