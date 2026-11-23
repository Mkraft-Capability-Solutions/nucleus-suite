import { NextResponse } from "next/server";
import { getRules, saveRules, saveRulesSchema } from "@/server/employee-flags/service";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const headers = (requestId: string) => ({ "cache-control": "private, no-store", "x-request-id": requestId });

/** GET /api/v1/employee-flags/rules — the organisation's flag rules (stored values over the defaults). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await getRules(access), meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** PUT /api/v1/employee-flags/rules — administrators set which rules are on and when they fire. */
export async function PUT(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const input = await parseJsonBody(request, saveRulesSchema, "flag rules");
    return NextResponse.json({ data: await saveRules(access, input, requestId), meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
