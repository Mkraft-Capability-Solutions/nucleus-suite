import { NextResponse } from "next/server";
import { parseFilters } from "@/server/dashboards/compose";
import { boardFilterOptions, buildBoard, isBoardId } from "@/server/dashboards";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/dashboards/{s1…s10}?location=&department=&months= — one dashboard, computed from the
 * organisation's own records. GET /api/v1/dashboards/filters — the boards the caller may open and
 * the locations and departments for the filter row.
 */
export async function GET(request: Request, { params }: { params: Promise<{ board: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { board } = await params;
    const headers = { "cache-control": "private, no-store", "x-request-id": requestId };
    if (board === "filters") return NextResponse.json({ data: await boardFilterOptions(access), meta: { requestId } }, { headers });
    if (!isBoardId(board)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "There is no such dashboard." });
    const data = await buildBoard(access, board, parseFilters(new URL(request.url).searchParams));
    return NextResponse.json({ data, meta: { requestId } }, { headers });
  } catch (error) {
    return fail(error, requestId);
  }
}
