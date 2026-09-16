import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { letterStudioCatalogue, saveStudioDraft, saveStudioDraftSchema } from "@/server/letters/studio";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/letters/studio";

/**
 * GET /api/v1/letters/studio — the two selectors the studio opens with.
 *
 * Templates are the tenant's own `letter_templates` rows and recipients its own
 * `employees` rows; an empty list is returned as an empty list so the surface can
 * say nothing is configured rather than show a specimen. Permission is the same
 * `employee.read` the letters register already enforces — no widening.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const catalogue = await letterStudioCatalogue(access);
    return NextResponse.json(
      { data: catalogue, meta: { requestId } },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * POST /api/v1/letters/studio — store the merged letter as a draft.
 *
 * A consequential write: `Idempotency-Key` is required, and a replay of the same key
 * with the same payload returns the draft already stored instead of creating a second
 * one. The body is merged server-side, so what is stored is what the record says.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const parsed = saveStudioDraftSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A template, a recipient, an issue date (YYYY-MM-DD) and a reason (min 3 characters) are required to save a draft letter.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "letters.studio_draft", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({
        status: 409,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "This Idempotency-Key was already used with a different payload.",
      });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({
        type: "letter",
        id: prior.responseLocator,
        version: 1,
        attributes: { replayed: true },
        requestId,
        self: SELF,
      });
    }
    const result = await saveStudioDraft(access, parsed.data, requestId);
    await storeIdempotency(access, "letters.studio_draft", key, fingerprint, 201, result.id);
    return ok({ type: "letter", id: result.id, version: 1, attributes: result, requestId, self: SELF });
  } catch (error) {
    return fail(error, requestId);
  }
}
