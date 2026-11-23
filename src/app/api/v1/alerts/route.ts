import { NextResponse } from "next/server";
import { listAlerts, listAlertsSchema } from "@/server/alerts/service";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** GET /api/v1/alerts?severity=&status=&company=&page=&pageSize= — compliance alerts in the caller's scope. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const pick = (name: string) => params.get(name) || undefined;
    const parsed = listAlertsSchema.safeParse({ severity: pick("severity"), status: pick("status"), company: pick("company"), page: pick("page"), pageSize: pick("pageSize") });
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "Check the filters.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    return NextResponse.json({ data: await listAlerts(access, parsed.data), meta: { requestId } }, { headers: { "cache-control": "private, no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
