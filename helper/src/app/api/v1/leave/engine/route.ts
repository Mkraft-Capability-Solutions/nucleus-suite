import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { getApprovalPipeline, getBandRulesMatrix, getLeaveEngineStatus, getLeaveSchemeReadiness } from "@/server/leave/engine-console";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [engine, pipeline, matrix, readiness] = await Promise.all([
      getLeaveEngineStatus(access),
      getApprovalPipeline(access),
      getBandRulesMatrix(access),
      getLeaveSchemeReadiness(access),
    ]);
    return NextResponse.json(
      {
        data: {
          engine,
          pipeline,
          bandRules: matrix.bandRules,
          leaveTypeRules: matrix.leaveTypeRules,
          // What the accrual, cap, COFF and year-end engines actually calculate
          // against, and every value still waiting on the client.
          scheme: readiness.scheme,
          schemeGaps: readiness.gaps,
          schemeReady: readiness.ready,
        },
        meta: { requestId },
        links: { self: "/api/v1/leave/engine" },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
