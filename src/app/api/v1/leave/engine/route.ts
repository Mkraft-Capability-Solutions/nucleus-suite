import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { getApprovalPipeline, getBandRulesMatrix, getLeaveEngineStatus } from "@/server/leave/engine-console";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [engine, pipeline, matrix] = await Promise.all([
      getLeaveEngineStatus(access),
      getApprovalPipeline(access),
      getBandRulesMatrix(access),
    ]);
    return NextResponse.json(
      {
        data: {
          engine,
          pipeline,
          bandRules: matrix.bandRules,
          leaveTypeRules: matrix.leaveTypeRules,
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
