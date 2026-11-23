import "server-only";

import { createHash } from "node:crypto";
import type { z } from "zod";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Parse a request body against a schema, or throw a 400 with per-field details. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, payload: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: parsed.error.issues[0]?.message ?? message,
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}

/**
 * Run a retryable write once per Idempotency-Key. The same key with the same payload replays the stored
 * locator (the write is not repeated); the same key with a different payload is a 409.
 */
export async function runOnce<T extends { id: string }>(
  access: Access,
  operation: string,
  key: string,
  payload: unknown,
  run: () => Promise<T>,
): Promise<{ replayed: boolean; id: string; result: T | null }> {
  const fingerprint = createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
  const prior = await checkIdempotency(access, operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) return { replayed: true, id: prior.responseLocator, result: null };
  const result = await run();
  await storeIdempotency(access, operation, key, fingerprint, 201, result.id);
  return { replayed: false, id: result.id, result };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids that are not UUIDs can never match a row: answer 404 without touching the database. */
export function requireUuid(id: string, what = "record"): string {
  if (!UUID.test(id)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: `The requested ${what} was not found.` });
  return id;
}
