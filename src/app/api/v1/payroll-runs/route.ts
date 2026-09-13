import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createRun, createRunSchema, listRuns } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listRuns(access, { period: params.get("period"), page, pageSize });
    return collection({
      type: "payroll-run",
      items: (items as Array<Record<string, unknown>>).map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/payroll-runs",
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
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
    const parsed = createRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A period (YYYY-MM) and scope are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.run_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await createRun(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.run_create", key, fingerprint, 201, result.id);
    return ok({ type: "payroll-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/payroll-runs/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
