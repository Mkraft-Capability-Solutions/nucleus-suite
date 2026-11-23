import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError, requireIdempotencyKey } from "@/server/platform/http";

/** Parses a request body with a zod schema and turns issues into a 400 with per-field details. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}

/**
 * Runs a retryable write once per Idempotency-Key. A replay with the same payload returns the stored record
 * id instead of writing again; the same key with a different payload is a 409.
 */
export async function idempotentWrite<T extends { id: string }>(
  access: Access,
  headers: Headers,
  operation: string,
  payload: unknown,
  run: () => Promise<T>,
): Promise<T | { id: string; replayed: true }> {
  const key = requireIdempotencyKey(headers);
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const prior = await checkIdempotency(access, operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) return { id: prior.responseLocator, replayed: true };
  const result = await run();
  await storeIdempotency(access, operation, key, fingerprint, 201, result.id);
  return result;
}
