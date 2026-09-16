import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listAdvances, requestAdvance, requestAdvanceSchema } from "@/server/advances/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const all = await listAdvances(access, { employeeId: params.get("employeeId"), status: params.get("status") });
    const rows = all as Array<Record<string, unknown>>;
    const items = rows.slice((page - 1) * pageSize, page * pageSize);
    return collection({
      type: "salary-advance",
      items: items.map((item) => {
        const { id, ...rest } = item as { id: string } & Record<string, unknown>;
        return { id, version: 1, ...rest };
      }),
      requestId,
      self: "/api/v1/salary-advances",
      nextCursor: page * pageSize < rows.length ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
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
    const parsed = requestAdvanceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The advance payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "advance.request", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await requestAdvance(access, parsed.data, requestId);
    await storeIdempotency(access, "advance.request", key, fingerprint, 201, result.id);
    return ok({ type: "salary-advance", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/salary-advances/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
