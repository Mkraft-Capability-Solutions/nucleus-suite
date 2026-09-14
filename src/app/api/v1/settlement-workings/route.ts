import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { computeSettlementWorking, getSettlementDetail, listSettlements } from "@/server/payroll/settlement";

/**
 * GET /api/v1/settlement-workings — the full and final settlement working (SCR-056).
 *
 * Read-only, in three shapes:
 *   ?employeeId=&lastWorkingDate=[&payrollRunId=]  the computed working for one leaver
 *   ?settlementId=                                  one proposal with its working, finalize gates and audit trail
 *   (neither)                                       the work queue, with real blocking-item counts,
 *                                                   optionally narrowed by ?status= and ?filterEmployeeId=
 *
 * Every write stays on the generic /api/v1/operations/settlements routes: this endpoint
 * proposes figures, it never records or settles them.
 */
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const self = "/api/v1/settlement-workings";

    const settlementId = params.get("settlementId");
    if (settlementId) {
      const detail = await getSettlementDetail(access, settlementId);
      return ok({ type: "settlement-working", id: detail.record.id, version: detail.record.version, attributes: { ...detail }, requestId, self });
    }

    const employeeId = params.get("employeeId");
    const lastWorkingDate = params.get("lastWorkingDate");
    if (employeeId || lastWorkingDate) {
      const details: Array<{ field: string; issue: string }> = [];
      if (!employeeId) details.push({ field: "employeeId", issue: "An employee reference is required." });
      if (!lastWorkingDate) details.push({ field: "lastWorkingDate", issue: "A last working date (YYYY-MM-DD) is required." });
      else if (!ISO_DATE.test(lastWorkingDate)) details.push({ field: "lastWorkingDate", issue: "Expected YYYY-MM-DD." });
      if (details.length > 0) {
        throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An employee and a last working date are required to compute a settlement working.", details });
      }
      const working = await computeSettlementWorking(access, {
        employeeId: employeeId as string,
        lastWorkingDate: lastWorkingDate as string,
        payrollRunId: params.get("payrollRunId"),
      });
      return ok({ type: "settlement-working", id: working.employee.id, version: 1, attributes: { ...working }, requestId, self });
    }

    const { page, pageSize } = parsePagination(params);
    const { items, nextCursor } = await listSettlements(access, { status: params.get("status"), employeeId: params.get("filterEmployeeId"), page, pageSize });
    return collection({ type: "settlement-working", items, requestId, self, nextCursor });
  } catch (error) {
    return fail(error, requestId);
  }
}
