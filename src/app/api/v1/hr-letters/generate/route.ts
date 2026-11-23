import { createHash } from "node:crypto";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { generateHrLetter, generateLetterSchema } from "@/server/letters/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = generateLetterSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The letter generation payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    // Retry-safe when the caller sends an Idempotency-Key: a replay returns the letter created
    // by the first request instead of generating a second one.
    const key = request.headers.get("idempotency-key")?.trim() || null;
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    if (key) {
      const prior = await checkIdempotency(access, "hr-letter.generate", key, fingerprint);
      if (prior.outcome === "conflict") {
        throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
      }
      if (prior.outcome === "replay" && prior.responseLocator) {
        const id = prior.responseLocator;
        return ok({ type: "hr-letter", id, version: 1, attributes: { id, replayed: true }, requestId, self: `/api/v1/hr-letters/${id}` });
      }
    }
    const result = await generateHrLetter(access, parsed.data, requestId);
    if (key) await storeIdempotency(access, "hr-letter.generate", key, fingerprint, 200, result.id);
    return ok({ type: "hr-letter", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/hr-letters/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
