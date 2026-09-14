import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { transitionPayslip, transitionPayslipSchema } from "@/server/payroll/payslips";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const key = requireIdempotencyKey(request.headers);
    const parsed = transitionPayslipSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "An action of publish, view or archive is required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify({ id, ...parsed.data })).digest("hex");
    const prior = await checkIdempotency(access, "payroll.payslip_transition", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await transitionPayslip(access, id, parsed.data.action, requestId);
    await storeIdempotency(access, "payroll.payslip_transition", key, fingerprint, 200, result.id);
    return ok({
      type: "payslip",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: `/api/v1/payslips/${result.id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
