import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, parsePagination, requestIdFrom } from "@/server/platform/http";
import { queryAccessEvents } from "@/server/ops/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await queryAccessEvents(access, { subjectId: params.get("subjectId"), page, pageSize });
    return NextResponse.json({ data: { items, total }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
