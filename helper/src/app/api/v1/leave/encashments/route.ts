import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { requestEncashmentSchema } from "@/server/leave/encashment-rules";
import { listEncashments, requestEncashment } from "@/server/leave/encashment";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const rows = await listEncashments(access, { employeeId: params.get("employeeId"), status: params.get("status") });
    return collection({
      type: "leave-encashment",
      items: rows.map(({ id, ...rest }) => ({ id, version: 1, ...rest })),
      requestId,
      self: "/api/v1/leave/encashments",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** FRM-LVE-04: the request. The balance, rate basis and amount are derived server-side. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = requestEncashmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The encashment payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "leave.encashment_request", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await requestEncashment(access, parsed.data, requestId);
    await storeIdempotency(access, "leave.encashment_request", key, fingerprint, 201, result.id);
    return ok({ type: "leave-encashment", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/leave/encashments/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
