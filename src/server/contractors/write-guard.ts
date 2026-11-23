import "server-only";

import { createHash } from "node:crypto";
import type { z } from "zod";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Parses a JSON body with a zod schema and maps every issue to a field error (400 VALIDATION_FAILED). */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: parsed.error.issues[0]?.message ?? message,
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data as z.infer<S>;
}

/**
 * Runs a retryable write once per Idempotency-Key. A replay of the same payload returns the stored record id
 * without writing again; the same key with a different payload is rejected with 409.
 */
export async function idempotentWrite<T extends { id: string }>(
  access: Access,
  operation: string,
  key: string,
  payload: unknown,
  write: () => Promise<T>,
): Promise<{ kind: "written"; id: string; result: T } | { kind: "replayed"; id: string }> {
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const prior = await checkIdempotency(access, operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) return { kind: "replayed", id: prior.responseLocator };
  const result = await write();
  await storeIdempotency(access, operation, key, fingerprint, 201, result.id);
  return { kind: "written", id: result.id, result };
}
