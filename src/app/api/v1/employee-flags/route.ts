import { NextResponse } from "next/server";
import { listFiltersSchema, listFlags } from "@/server/employee-flags/service";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/employee-flags?company=&location=&department=&severity=&rule= — every warning and alert in the organisation (read-only). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const filters = listFiltersSchema.parse({
      company: params.get("company") || null,
      location: params.get("location") || null,
      department: params.get("department") || null,
      severity: params.get("severity") || null,
      rule: params.get("rule") || null,
    });
    return NextResponse.json({ data: await listFlags(access, filters), meta: { requestId } }, { headers: { "cache-control": "private, no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
