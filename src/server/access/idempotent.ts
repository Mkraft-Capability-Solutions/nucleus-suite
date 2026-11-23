import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { checkIdempotency, storeIdempotency, type Access } from "@/server/platform/access";
import { HttpError, requireIdempotencyKey } from "@/server/platform/http";

/**
 * Idempotent write wrapper for the admin routes: the Idempotency-Key header is
 * required; a replay with the same payload returns the stored resource instead
 * of writing twice; the same key with a different payload is a 409.
 */
export async function idempotent<T>(args: {
  access: Access;
  headers: Headers;
  operation: string;
  payload: unknown;
  run: () => Promise<{ locator: string; value: T }>;
  replay: (locator: string) => Promise<T>;
}): Promise<T> {
  const key = requireIdempotencyKey(args.headers);
  const fingerprint = createHash("sha256").update(JSON.stringify(args.payload ?? null)).digest("hex");
  const prior = await checkIdempotency(args.access, args.operation, key, fingerprint);
  if (prior.outcome === "conflict") {
    throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
  }
  if (prior.outcome === "replay" && prior.responseLocator) return args.replay(prior.responseLocator);
  const { locator, value } = await args.run();
  await storeIdempotency(args.access, args.operation, key, fingerprint, 200, locator);
  return value;
}

/** Parse a JSON body with a zod schema; failures become a 400 with field details. */
export async function parseBody<S extends z.ZodTypeAny>(request: Request, schema: S, fallback: unknown = null): Promise<z.infer<S>> {
  const raw: unknown = await request.json().catch(() => fallback);
  const parsed = schema.safeParse(raw);
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
