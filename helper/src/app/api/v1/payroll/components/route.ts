import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createPayComponent, listPayComponents, payComponentSchema } from "@/server/payroll/components-master";

export const dynamic = "force-dynamic";

/** GET /api/v1/payroll/components?asOf=YYYY-MM-DD&status=active — FRM-PAY-01 register. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const items = await listPayComponents(access, { asOf: params.get("asOf"), status: params.get("status") });
    return collection({
      type: "pay-component",
      items: items.map((item) => {
        const { id, rowVersion, ...rest } = item;
        return { id, version: rowVersion, ...rest };
      }),
      requestId,
      self: "/api/v1/payroll/components",
      nextCursor: null,
      total: items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = payComponentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A component code, name, GL debit and credit account and payslip sequence are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.component_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createPayComponent(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.component_create", key, fingerprint, 201, result.id);
    const { id, rowVersion, ...attributes } = result;
    return ok({ type: "pay-component", id, version: rowVersion, attributes, requestId, self: `/api/v1/payroll/components/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
