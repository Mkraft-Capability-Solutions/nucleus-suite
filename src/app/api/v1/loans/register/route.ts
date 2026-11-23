import { requireAccess } from "@/server/platform/access";
import { fail, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listLoanRegister } from "@/server/payroll/loan-register";

export const dynamic = "force-dynamic";

/** GET /api/v1/loans/register — loans with borrower, guarantors, instalment and recoveries, plus guarantor locks (payroll.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { page, pageSize } = parsePagination(new URL(request.url).searchParams);
    const result = await listLoanRegister(access, { page, pageSize });
    return ok({
      type: "loan-register",
      id: "loan-register",
      version: 1,
      attributes: { ...result, page, pageSize, hasMore: page * pageSize < result.total },
      requestId,
      self: `/api/v1/loans/register?page=${page}&pageSize=${pageSize}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
