import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listGlAccounts, upsertGlAccount, upsertGlAccountSchema } from "@/server/payroll/gl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const items = await listGlAccounts(access, { legalEntityId: params.get("legalEntityId") });
    return collection({
      type: "gl-account",
      items: items.map((item) => {
        const { id, ...rest } = item;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/gl-accounts",
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
    const parsed = upsertGlAccountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A legal entity, account code, name, type and start date are required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.gl_account_upsert", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await upsertGlAccount(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.gl_account_upsert", key, fingerprint, 201, result.id);
    return ok({ type: "gl-account", id: result.id, version: 1, attributes: { ...result }, requestId, self: `/api/v1/gl-accounts/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
