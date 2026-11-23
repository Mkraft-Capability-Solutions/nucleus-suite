import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { buildZodSchemaForModule } from "@/lib/validations/universal";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/** Validate a module record body against the registry-derived schema (partial for PATCH). */
export function parseModulePayload(moduleId: string, body: unknown, partial: boolean): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "The request body must be a JSON object." });
  }
  const schema = buildZodSchemaForModule(moduleId);
  const validator = partial && schema instanceof z.ZodObject ? schema.partial() : schema;
  const parsed = validator.safeParse(body);
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "VALIDATION_FAILED",
      message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data as Record<string, unknown>;
}

export function fingerprintOf(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Idempotent write wrapper. Same key + same body replays the stored record id; same key + other body is 409.
 * `run` returns the created/updated record id, which is stored as the response locator.
 */
export async function idempotent<T extends { id: string }>(
  access: Access,
  operation: string,
  key: string,
  payload: unknown,
  run: () => Promise<T>,
  replay: (id: string) => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  const fingerprint = fingerprintOf(payload);
  const prior = await checkIdempotency(access, operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) {
    return { result: await replay(prior.responseLocator), replayed: true };
  }
  const result = await run();
  await storeIdempotency(access, operation, key, fingerprint, 200, result.id);
  return { result, replayed: false };
}
