import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { requestGatePass, requestGatePassSchema } from "@/server/attendance/service";
import { listGatePassRegister } from "@/server/attendance/gate-pass-register";

export const dynamic = "force-dynamic";

const OPERATION = "attendance.gate_pass_request";

/**
 * GET lists gate passes in the caller's attendance scope (attendance.read). Errors are returned, never an empty list.
 * POST requests a gate pass through the attendance service, which validates the employee, the duration and the
 * monthly personal-pass ceiling (attendance.write, Idempotency-Key required). Nothing is fabricated on failure.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const rows = await listGatePassRegister(access, new URL(request.url).searchParams.get("search") ?? "");
    return collection({
      type: "gate-pass",
      items: rows.map(({ type, ...row }) => ({ ...row, pass_type: type, version: 1 })),
      requestId,
      self: "/api/v1/gate-passes",
      nextCursor: null,
      total: rows.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = requestGatePassSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The gate pass payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, OPERATION, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "gate-pass", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: "/api/v1/gate-passes" });
    }
    const result = await requestGatePass(access, parsed.data, requestId);
    await storeIdempotency(access, OPERATION, key, fingerprint, 201, result.id);
    return ok({ type: "gate-pass", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/gate-passes/register/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
