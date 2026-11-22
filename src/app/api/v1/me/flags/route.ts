import { NextResponse } from "next/server";
import { myFlags } from "@/server/employee-flags/service";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/me/flags — warnings and alerts on the signed-in person's record and their direct reports'. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await myFlags(access), meta: { requestId } }, { headers: { "cache-control": "private, no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
