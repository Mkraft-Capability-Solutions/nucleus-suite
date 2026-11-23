import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { leaveBalanceSummary } from "@/server/leave/balance-summary";

export const dynamic = "force-dynamic";

/** One person's leave position per type: stored balance, approved since, pending, taken this year. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    if (!z.string().uuid().safeParse(employeeId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employeeId is required." });
    }
    const data = await leaveBalanceSummary(access, employeeId as string);
    return NextResponse.json({ data, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
