import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  loadStatutoryRegister,
  recordFilingOutcome,
  recordFilingOutcomeSchema,
} from "@/server/compliance/statutory-register";

/**
 * SCR-072 — Tax & statutory.
 *
 * GET  reads the filing register with its due-date banding, the generated form
 *      each filing points at, and the recorded filing outcomes.
 * POST records a filing outcome — filed-on date, acknowledgement, evidence,
 *      late-filing reason and the amount remitted to the authority.
 *
 * Filings themselves are created and transitioned through the generic
 * operational routes (`/api/v1/operations/filings...`); this route never
 * duplicates that workflow. It also never contacts an authority: POST stores a
 * record of something a person already did elsewhere.
 */
export const dynamic = "force-dynamic";

/** Top-level exported request contract, re-exported from the service module. */
export const statutoryFilingOutcomeSchema = recordFilingOutcomeSchema;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const register = await loadStatutoryRegister(access);
    // A composed read model, like `GET /api/v1/reconciliations/:id`: the filing
    // rows only mean something beside their due-date banding, the remitted-amount
    // summary and the note about what this system does and does not do. It is a
    // single bounded working view, not a paged archive, so there is no cursor.
    return ok({
      type: "statutory-register",
      id: "statutory-register",
      version: 1,
      attributes: { ...register, count: register.items.length, nextCursor: null },
      requestId,
      self: new URL(request.url).pathname,
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
    const parsed = statutoryFilingOutcomeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the filing outcome fields.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "statutory.filing_outcome", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This Idempotency-Key was already used with a different payload.",
      });
    }
    const result = await recordFilingOutcome(access, parsed.data, requestId);
    await storeIdempotency(access, "statutory.filing_outcome", key, fingerprint, 200, result.id);
    return ok({
      type: "statutory-filing-outcome",
      id: result.id,
      version: 1,
      attributes: result,
      requestId,
      self: new URL(request.url).pathname,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
