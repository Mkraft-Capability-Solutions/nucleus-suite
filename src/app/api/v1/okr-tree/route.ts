import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  createCascadingObjective,
  linkObjective,
  loadObjectiveTree,
  okrTreeWriteSchema,
} from "@/server/performance/okr";

export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const bodySchema = okrTreeWriteSchema;

const SELF = "/api/v1/okr-tree";

/**
 * GET /api/v1/okr-tree — the derived OKR cascade.
 *
 * Every progress figure here is computed from key-result attainment and the
 * declared weights; `objectives.attributes.progress_pct` is returned only as
 * `storedProgressPct` so a stale literal can be shown as the discrepancy it is.
 * Health is `undetermined` unless the tenant has configured RAG thresholds.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const tree = await loadObjectiveTree(access);
    return ok({ type: "okr-tree", id: access.tenantId, version: 1, attributes: tree, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST /api/v1/okr-tree — declare a place in the cascade.
 *
 * `mode: "create"` creates an objective with its key results, its weight and its
 * parent in one audited act. `mode: "link"` re-parents or re-weights an existing
 * objective and is refused with 422 when the new parent would close a loop.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The OKR cascade payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const operation = parsed.data.mode === "create" ? "okr.objective_create" : "okr.objective_link";
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, operation, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "objective", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: SELF });
    }

    const result =
      parsed.data.mode === "create"
        ? await createCascadingObjective(access, parsed.data, requestId)
        : await linkObjective(access, parsed.data, requestId);
    await storeIdempotency(access, operation, key, fingerprint, 201, result.id);
    return ok({ type: "objective", id: result.id, version: 1, attributes: result, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
