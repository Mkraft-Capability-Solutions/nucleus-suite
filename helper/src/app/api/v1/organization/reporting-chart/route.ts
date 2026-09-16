import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getReportingChart } from "@/server/organization/reporting-line";

export const dynamic = "force-dynamic";

/**
 * R-23. The chart is derived from `employees.manager_employee_id` on every read, so changing
 * an employee's reporting manager is the only maintenance the chart needs.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const department = new URL(request.url).searchParams.get("department");
    const chart = await getReportingChart(access, { department });
    return ok({
      type: "reporting-chart",
      id: "current",
      version: 1,
      attributes: chart,
      requestId,
      self: "/api/v1/organization/reporting-chart",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
