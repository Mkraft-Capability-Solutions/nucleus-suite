import "server-only";

import { createHash } from "node:crypto";
import type { z } from "zod";
import { checkIdempotency, requireAccess, storeIdempotency, type Access } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";

/**
 * Shared plumbing for the compliance workspace routes: schema validation with field-level details, an
 * Idempotency-Key per retryable write (stored with the response locator so a retry replays instead of
 * writing twice), and the RFC-style error envelope from `fail`.
 */

export function invalid(error: z.ZodError, message: string): HttpError {
  return new HttpError({
    status: 400,
    code: "VALIDATION_FAILED",
    message: error.issues[0]?.message ? `${message} ${error.issues[0].message}` : message,
    details: error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
  });
}

export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, input: unknown, message: string): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw invalid(parsed.error, message);
  return parsed.data;
}

export async function readRoute<T extends Record<string, unknown>>(
  request: Request,
  type: string,
  load: (access: Access, params: URLSearchParams) => Promise<T>,
) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const url = new URL(request.url);
    const attributes = await load(access, url.searchParams);
    return ok({ type, id: type, version: 1, attributes, requestId, self: url.pathname });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * One retryable write: same key + same payload replays the stored locator, same key + different payload
 * is a 409, and the handler runs only once per key.
 */
export async function idempotentWrite<S extends z.ZodTypeAny, R extends { id: string }>(
  request: Request,
  args: {
    operation: string;
    type: string;
    schema: S;
    message: string;
    handle: (access: Access, input: z.infer<S>, requestId: string) => Promise<R>;
  },
) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseOrThrow(args.schema, await request.json().catch(() => null), args.message);
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const prior = await checkIdempotency(access, args.operation, key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    const self = new URL(request.url).pathname;
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: args.type, id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self });
    }
    const result = await args.handle(access, input, requestId);
    await storeIdempotency(access, args.operation, key, fingerprint, 200, result.id);
    return ok({ type: args.type, id: result.id, version: 1, attributes: result, requestId, self });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Integer minor units from a database bigint / numeric, or null when absent. */
export function minorOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function isoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" && value.length > 0 ? value : null;
}
