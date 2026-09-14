import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listTalentPlacements, recordPlacementSchema, recordTalentPlacement } from "@/server/performance/calibration";

export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const bodySchema = recordPlacementSchema;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function selfFor(calibrationSessionId: string | null): string {
  return calibrationSessionId ? `/api/v1/talent-placements?calibrationSessionId=${encodeURIComponent(calibrationSessionId)}` : "/api/v1/talent-placements";
}

/**
 * GET /api/v1/talent-placements?calibrationSessionId=… — the 9-box grid.
 *
 * Nobody is auto-placed. The grid contains exactly the people a facilitator
 * recorded, and `bandingConfigured` says whether automatic banding from a rating
 * is even possible for this tenant. Review evidence carried alongside a
 * placement is withheld below the five-respondent anonymity floor.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const sessionId = new URL(request.url).searchParams.get("calibrationSessionId");
    if (sessionId && !UUID_PATTERN.test(sessionId)) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The calibration session reference is invalid.",
        details: [{ field: "calibrationSessionId", issue: "Provide the calibration session id." }],
      });
    }
    const grid = await listTalentPlacements(access, sessionId);
    return ok({ type: "nine-box-grid", id: sessionId ?? access.tenantId, version: 1, attributes: grid, requestId, self: selfFor(sessionId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST /api/v1/talent-placements — record one human 9-box placement.
 *
 * Placement is an explicit act: the caller states both bands and why. Moving
 * somebody out of a cell already recorded in the session additionally requires
 * an adjustment reason, and both are written to the audit trail.
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
        message: "The talent placement payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "talent.placement", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({
        type: "talent-placement",
        id: prior.responseLocator,
        version: 1,
        attributes: { id: prior.responseLocator, replayed: true },
        requestId,
        self: selfFor(parsed.data.calibrationSessionId),
      });
    }
    const result = await recordTalentPlacement(access, parsed.data, requestId);
    await storeIdempotency(access, "talent.placement", key, fingerprint, 201, result.id);
    return ok({ type: "talent-placement", id: result.id, version: 1, attributes: result, requestId, self: selfFor(parsed.data.calibrationSessionId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
