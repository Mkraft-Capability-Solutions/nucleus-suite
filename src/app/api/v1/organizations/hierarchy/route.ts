import { NextResponse } from "next/server";
import { getHierarchy } from "@/server/organization/active-entity";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** Nested company tree limited to the companies the caller may work in (plus their ancestors, not selectable). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await getHierarchy(access), meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
