import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listAnomalies, logFinding, logFindingSchema } from "@/server/payroll/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const runId = new URL(request.url).searchParams.get("runId");
    if (!runId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A runId query parameter is required." });
    const anomalies = await listAnomalies(access, runId);
    return NextResponse.json({ data: anomalies, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST /api/v1/payroll-anomalies — log a manual pre-payroll audit finding against a mutable run
 * (payroll.run, FRM-PAY-04). Restores the write the workflow catalog already declares; the body is
 * validated against `logFindingSchema` and a payload that is not a payroll finding (for example an
 * attendance-signal review) is refused with the failing fields rather than silently accepted.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = logFindingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A payroll finding needs a payroll run, an employee and a rule code.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.anomaly_log", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "payroll-anomaly", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/payroll-anomalies/${prior.responseLocator}` });
    }
    const result = await logFinding(access, parsed.data, requestId);
    await storeIdempotency(access, "payroll.anomaly_log", key, fingerprint, 201, result.id);
    return ok({ type: "payroll-anomaly", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/payroll-anomalies/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
