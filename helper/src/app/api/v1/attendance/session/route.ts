import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { HttpError, fail, requestIdFrom } from "@/server/platform/http";
import {
  getActiveShiftAssignment,
  getCurrentSession,
  getGatePassQuota,
} from "@/server/attendance/engine-console";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD = /^\d{4}-\d{2}$/;

/** Live session strip: open session, active shift and this month's gate-pass quota. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const employeeId = (params.get("employeeId") ?? "").trim();
    const period = (params.get("period") ?? "").trim();
    if (!UUID.test(employeeId)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A valid employeeId is required.",
        details: [{ field: "employeeId", issue: "must be a uuid" }],
      });
    }
    if (!PERIOD.test(period)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A valid period is required.",
        details: [{ field: "period", issue: "must be YYYY-MM" }],
      });
    }
    const [session, shift, gatePassQuota] = await Promise.all([
      getCurrentSession(access, employeeId),
      getActiveShiftAssignment(access, employeeId),
      getGatePassQuota(access, employeeId, period),
    ]);
    return NextResponse.json(
      { data: { session, shift, gatePassQuota }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
