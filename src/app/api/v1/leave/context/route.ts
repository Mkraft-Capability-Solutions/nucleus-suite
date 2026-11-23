import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { getLeaveContext } from "@/server/leave/workspace";

export const dynamic = "force-dynamic";

/** The caller as a leave participant: linked employee and the leave actions their role holds. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const context = await getLeaveContext(access);
    return NextResponse.json(
      { data: { type: "leave-context", ...context }, meta: { requestId }, links: { self: "/api/v1/leave/context" } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
