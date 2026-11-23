import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getLoanEligibility, loanEligibilityQuerySchema } from "@/server/payroll/loan-register";

export const dynamic = "force-dynamic";

/** GET /api/v1/loans/eligibility?employeeId= — ceiling and blocking reasons for a loan application (payroll.run). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = loanEligibilityQuerySchema.safeParse({ employeeId: new URL(request.url).searchParams.get("employeeId") });
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employeeId is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await getLoanEligibility(access, parsed.data.employeeId);
    return ok({ type: "loan-eligibility", id: result.employeeId, version: 1, attributes: { ...result }, requestId, self: `/api/v1/loans/eligibility?employeeId=${result.employeeId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
