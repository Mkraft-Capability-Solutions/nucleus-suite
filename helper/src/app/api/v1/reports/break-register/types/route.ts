import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { breakTypeOptions } from "@/server/attendance/break-register";

export const dynamic = "force-dynamic";

/** EN_BREAK_TYPE for the break register's filter — configuration, not a coded list. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json(
      { data: { type: "attendance-break-type", values: await breakTypeOptions(access) }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
