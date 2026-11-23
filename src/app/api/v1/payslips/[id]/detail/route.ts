import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { getPayslipDetail } from "@/server/payroll/payslips";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payslips/:id/detail — ordered payslip lines with labels from the pay component master.
 * Scoped like the payslip list: payroll.read sees the tenant's payslips, everyone else only their own
 * (another employee's payslip answers 404).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const detail = await getPayslipDetail(access, id);
    return ok({ type: "payslip-detail", id: detail.id, version: detail.version, attributes: { ...detail }, requestId, self: `/api/v1/payslips/${detail.id}/detail` });
  } catch (error) {
    return fail(error, requestId);
  }
}
