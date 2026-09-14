import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listReconciliations, runReconciliation, runReconciliationSchema } from "@/server/payroll/reconciliation";

export const dynamic = "force-dynamic";

/** The SCR-103 work queue: one row per control, with both sides of its assertion. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const { page, pageSize } = parsePagination(params);
    const { items, total } = await listReconciliations(access, {
      runId: params.get("payrollRunId"),
      status: params.get("status"),
      state: params.get("state"),
      includeSuperseded: params.get("includeSuperseded") === "true",
      page,
      pageSize,
    });
    return collection({
      type: "reconciliation-item",
      items: items.map((item) => ({ ...item, version: 1 })),
      requestId,
      self: "/api/v1/reconciliations",
      total,
      nextCursor: page * pageSize < total ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * RL-530 — evaluate the seven assertions for a run and persist the result.
 * Idempotent per run: an unchanged result is returned untouched rather than
 * duplicated, so the explanations recorded against it survive a re-run.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = runReconciliationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A payroll run is required to reconcile.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "payroll.reconciliation_run", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const result = await runReconciliation(access, parsed.data.payrollRunId, requestId);
    await storeIdempotency(access, "payroll.reconciliation_run", key, fingerprint, 201, result.resultId);
    return ok({
      type: "reconciliation",
      id: result.resultId,
      version: 1,
      attributes: { ...result },
      requestId,
      self: `/api/v1/reconciliations/${result.resultId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
