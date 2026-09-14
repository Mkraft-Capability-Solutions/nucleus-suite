import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { getTeamHistoryRecord, historyRange } from "@/server/attendance/team-history-register";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference." });
    }
    const search = new URL(request.url).searchParams;
    const range = historyRange(search.get("from"), search.get("to"));
    const detail = await getTeamHistoryRecord(access, id, range);
    return NextResponse.json(
      {
        data: {
          type: "team-history",
          ...detail.record,
          range: detail.range,
          days: detail.days,
          auditTrail: detail.auditTrail,
        },
        meta: { requestId },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
