import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { creditAllocationSchema, creditAnnualAllocation, previewAllocation } from "@/server/leave/allocation";

export const dynamic = "force-dynamic";

/** Annual entitlement preview for one employee (?employeeId=), permission leave.maintain. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = (new URL(request.url).searchParams.get("employeeId") ?? "").trim();
    const preview = await previewAllocation(access, employeeId);
    return NextResponse.json(
      { data: { type: "leave-allocation", ...preview }, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Credits the annual entitlement to the ledger, once per employee and year. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = creditAllocationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "A valid employee is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "leave.allocation_credit", key, fingerprint);
    if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "leave-allocation", id: prior.responseLocator, version: 1, attributes: { replayed: true }, requestId, self: "/api/v1/leave/allocation" });
    }
    const result = await creditAnnualAllocation(access, parsed.data, requestId);
    await storeIdempotency(access, "leave.allocation_credit", key, fingerprint, 201, result.employeeId);
    return ok({ type: "leave-allocation", id: result.employeeId, version: 1, attributes: result, requestId, self: "/api/v1/leave/allocation" });
  } catch (error) {
    return fail(error, requestId);
  }
}
