import "server-only";

import { createHash } from "node:crypto";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Zod issues as RFC-style field details. */
export function issueDetails(issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>) {
  return issues.map((issue) => ({ field: issue.path.map(String).join("."), issue: issue.message }));
}

/** `attributes` is the write result, or `{ replayed: true }` when the key was already served. */
export type IdempotentOutcome<T> = { id: string; replayed: boolean; attributes: T | { id: string; replayed: true } };

/**
 * Runs a retryable leave write once per Idempotency-Key: a replay of the same
 * payload returns the stored record id without writing again, and the same key
 * with a different payload is a 409.
 */
export async function runIdempotent<T extends { id: string }>(
  access: Access,
  operation: string,
  key: string,
  payload: unknown,
  write: () => Promise<T>,
): Promise<IdempotentOutcome<T>> {
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const prior = await checkIdempotency(access, operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) {
    return { id: prior.responseLocator, replayed: true, attributes: { id: prior.responseLocator, replayed: true } };
  }
  const result = await write();
  await storeIdempotency(access, operation, key, fingerprint, 201, result.id);
  return { id: result.id, replayed: false, attributes: result };
}
