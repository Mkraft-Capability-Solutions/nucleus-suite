import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listAnomalies } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const runId = new URL(request.url).searchParams.get("runId");
    if (!runId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A runId query parameter is required." });
    const anomalies = await listAnomalies(access, runId);
    return NextResponse.json({ data: anomalies, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
