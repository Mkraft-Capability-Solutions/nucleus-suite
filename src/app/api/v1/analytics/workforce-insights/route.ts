import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { insightsQuerySchema, loadWorkforceInsights } from "@/server/analytics/workforce-insights";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/analytics/workforce-insights?period=current_quarter&department=Finance
 *
 * Read-only aggregate for the Analytics studio. employee.read is required; the workforce and payroll
 * sections additionally require attendance.read / payroll.read and report `forbidden` without them.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = insightsQuerySchema.safeParse({
      period: params.get("period") ?? undefined,
      department: params.get("department") || undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "VALIDATION_FAILED",
        message: parsed.error.issues[0]?.message ?? "The analytics filters are invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const payload = await loadWorkforceInsights(access, parsed.data);
    return NextResponse.json(
      { data: payload, meta: { requestId, generatedAt: payload.generatedAt } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}
