import { NextResponse } from "next/server";
import { getCareer, recordMove, recordMoveSchema } from "@/server/organization/job-history";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ employee: string }> };
const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });

/** The employee's career in the group: history entries, the company structure and the derived view. */
export async function GET(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { employee } = await params;
    return NextResponse.json({ data: await getCareer(access, decodeURIComponent(employee)), meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Records a move (promotion, transfer, move to a group company, ...). */
export async function POST(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { employee } = await params;
    const input = await parseJsonBody(request, recordMoveSchema, "move");
    const result = await recordMove(access, decodeURIComponent(employee), input, requestId);
    return NextResponse.json({ data: result, meta: { requestId } }, { status: 201, headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
