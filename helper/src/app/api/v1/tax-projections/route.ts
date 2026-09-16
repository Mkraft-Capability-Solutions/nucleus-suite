import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { listDeclarations, projectTax } from "@/server/payroll/tax";

export const dynamic = "force-dynamic";

/**
 * SCR-054 - tax projection read model.
 *
 * Read-only by design. Declarations are created, edited and transitioned through
 * the `taxDeclarations` operational workflow (`/api/v1/operations/taxDeclarations`),
 * which already owns validation, idempotency, optimistic concurrency, history and
 * audit. This endpoint returns only what that workflow cannot: the projection
 * computed against the employee's salary structure and the statutory rule pack,
 * with every figure the pack cannot support returned as `null` alongside the rules
 * that block it.
 *
 * `?declarationId=` or `?employeeId=&financialYear=` returns one projection.
 * Without a selector it returns the declaration work queue, joined to employees
 * so the queue can show who the declaration belongs to, which regime it elects
 * and why its projected TDS is not a number.
 */
export const taxProjectionQuerySchema = z.object({
  declarationId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  financialYear: z.string().trim().min(4).max(20).optional(),
  status: z.string().trim().min(1).max(40).optional(),
  search: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = taxProjectionQuerySchema.safeParse({
      declarationId: params.get("declarationId") ?? undefined,
      employeeId: params.get("employeeId") ?? undefined,
      financialYear: params.get("financialYear") ?? undefined,
      status: params.get("status") ?? undefined,
      search: params.get("search") ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the query parameters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "query", issue: issue.message })),
      });
    }
    const { declarationId, employeeId, financialYear } = parsed.data;

    if (!declarationId && !(employeeId && financialYear)) {
      const { page, pageSize } = parsePagination(params);
      const { items, nextCursor } = await listDeclarations(access, {
        employeeId: employeeId ?? null,
        financialYear: financialYear ?? null,
        status: parsed.data.status ?? null,
        search: parsed.data.search ?? null,
        page,
        pageSize,
      });
      return collection({
        type: "tax-declaration",
        items,
        requestId,
        self: "/api/v1/tax-projections",
        nextCursor,
        total: items.length,
      });
    }

    const projection = await projectTax(
      access,
      declarationId ? { declarationId } : { employeeId: employeeId as string, financialYear: financialYear as string },
    );
    const self = declarationId
      ? `/api/v1/tax-projections?declarationId=${encodeURIComponent(declarationId)}`
      : `/api/v1/tax-projections?employeeId=${encodeURIComponent(employeeId ?? "")}&financialYear=${encodeURIComponent(financialYear ?? "")}`;
    return ok({
      type: "tax-projection",
      id: projection.declarationId ?? `${projection.employee.id}:${projection.financialYear.label}`,
      version: projection.version ?? 1,
      attributes: projection as unknown as Record<string, unknown>,
      requestId,
      self,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
