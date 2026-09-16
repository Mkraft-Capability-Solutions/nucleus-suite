import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getPayrollAccountingOverview, payrollAccountingQuerySchema } from "@/server/payroll/accounting";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payroll-accounting — the payroll accounting screen's read model:
 * mapping coverage for one legal entity on one date (RL-521, evaluated by
 * `unmappedComponents` in `src/server/payroll/gl.ts`), and the two separate
 * posting paths reported side by side and never merged.
 *
 * Read-only by design. The mapping register's own writes belong to the `ledger`
 * operational workflow (`/api/v1/operations/ledger` and
 * `/api/v1/operations/ledger/:id/:action`), which already owns the state
 * machine, the effective-date overlap guard, the maker/checker split,
 * idempotency and the audit trail. The ERP batch commands belong to
 * `POST /api/v1/vp/readiness` (`create_gl_posting`, `ack_gl_posting`).
 * Duplicating either here would create a second, unguarded way to write them,
 * so this route carries no POST and no Idempotency-Key handling.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = payrollAccountingQuerySchema.safeParse({
      legalEntityId: params.get("legalEntityId"),
      asOf: params.get("asOf"),
      batchId: params.get("batchId"),
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the legal entity, date and batch reference.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const overview = await getPayrollAccountingOverview(access, parsed.data);
    const self = `/api/v1/payroll-accounting?asOf=${encodeURIComponent(overview.asOf)}${
      overview.legalEntityId ? `&legalEntityId=${encodeURIComponent(overview.legalEntityId)}` : ""
    }`;
    return ok({
      type: "payroll-accounting-overview",
      id: overview.legalEntityId ?? "no-legal-entity",
      version: 1,
      attributes: { ...overview },
      requestId,
      self,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
