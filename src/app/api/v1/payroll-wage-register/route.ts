import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listWageRegister, wageRegisterQuerySchema } from "@/server/payroll/wage-register";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/payroll-wage-register?period=YYYY-MM — operational attendance and pay per employee.
 * employee.read; pay fields are masked on the server unless the caller may read compensation.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const parsed = wageRegisterQuerySchema.safeParse({ period: params.get("period") ?? new Date().toISOString().slice(0, 7), search: params.get("search") ?? "" });
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Check the period and search.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await listWageRegister(access, { ...parsed.data, page, pageSize });
    return ok({
      type: "wage-register",
      id: result.period,
      version: 1,
      attributes: { ...result, page, pageSize, hasMore: page * pageSize < result.total },
      requestId,
      self: `/api/v1/payroll-wage-register?period=${result.period}&page=${page}&pageSize=${pageSize}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
