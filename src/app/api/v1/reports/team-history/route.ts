import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { getTeamHistory } from "@/server/vp/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const search = new URL(request.url).searchParams;
    const start = new Date();
    const fallbackTo = start.toISOString().slice(0, 10);
    start.setUTCDate(start.getUTCDate() - 30);
    const result = await getTeamHistory(access, { from: search.get("from") ?? start.toISOString().slice(0, 10), to: search.get("to") ?? fallbackTo, employeeId: search.get("employeeId") });
    return NextResponse.json({ data: result, meta: { requestId, generatedAt: new Date().toISOString() } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
