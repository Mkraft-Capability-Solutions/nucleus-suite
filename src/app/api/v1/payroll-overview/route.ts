import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getPayrollOverview } from "@/server/payroll/overview";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payroll-overview — the caller's own pay overview (latest payslip and its lines,
 * payslip history, next pay date, salary-advance allowance and history) plus, for holders of
 * payroll.read, the latest run's pre-payroll audit summary. Never cached.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const overview = await getPayrollOverview(access);
    return ok({ type: "payroll-overview", id: overview.employee?.id ?? "no-employee", version: 1, attributes: { ...overview }, requestId, self: "/api/v1/payroll-overview" });
  } catch (error) {
    return fail(error, requestId);
  }
}
