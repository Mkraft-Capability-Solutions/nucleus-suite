import { NextResponse } from "next/server";

/**
 * Shared HTTP contract helpers for all `/api/v1` route handlers.
 * Implements API_STANDARDS_AND_CONTRACTS.md: success/error envelopes,
 * pagination clamps, ETag preconditions, money views and request ids.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly details: Array<{ field: string; issue: string }>;

  constructor(args: { status: number; code: string; message: string; retryable?: boolean; details?: Array<{ field: string; issue: string }> }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.retryable = args.retryable ?? false;
    this.details = args.details ?? [];
  }
}

export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get("x-request-id")?.trim();
  return incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
}

export function ok<T extends Record<string, unknown>>(args: {
  type: string;
  id: string;
  version: number;
  attributes: T;
  requestId: string;
  self: string;
}): NextResponse {
  return NextResponse.json(
    {
      data: { type: args.type, id: args.id, version: args.version, ...args.attributes },
      meta: { requestId: args.requestId },
      links: { self: args.self },
    },
    { headers: { "cache-control": "no-store", "x-request-id": args.requestId } },
  );
}

export function collection<T>(args: {
  type: string;
  items: Array<{ id: string; version: number } & T>;
  requestId: string;
  self: string;
  nextCursor: string | null;
  total?: number;
}): NextResponse {
  return NextResponse.json(
    {
      data: args.items.map((item) => ({ type: args.type, ...item })),
      meta: { requestId: args.requestId, nextCursor: args.nextCursor, ...(args.total !== undefined ? { total: args.total } : {}) },
      links: { self: args.self },
    },
    { headers: { "cache-control": "no-store", "x-request-id": args.requestId } },
  );
}

export function fail(error: unknown, requestId: string): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          status: error.status,
          requestId,
          retryable: error.retryable,
          details: error.details,
        },
      },
      { status: error.status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  }
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        status: 500,
        requestId,
        retryable: false,
        details: [],
      },
    },
    { status: 500, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}

export function parsePagination(searchParams: URLSearchParams): { page: number; pageSize: number } {
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawSize = Number(searchParams.get("pageSize") ?? "25");
  const page = Number.isFinite(rawPage) ? Math.max(Math.trunc(rawPage), 1) : 1;
  const pageSize = Number.isFinite(rawSize) ? Math.min(Math.max(Math.trunc(rawSize), 1), 100) : 25;
  return { page, pageSize };
}

/** Encode an opaque cursor that never exposes raw row ids. */
export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null): Record<string, unknown> | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The pagination cursor is invalid." });
  }
}

/**
 * Enforce If-Match on consequential transitions. Returns the claimed version.
 * Missing header -> 428-equivalent 400 contract error; stale -> 409 VERSION_CONFLICT.
 */
export function requireVersion(headers: Headers): number {
  const raw = headers.get("if-match")?.trim();
  if (!raw) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "This action requires an If-Match version precondition." });
  }
  const version = Number(raw.replace(/^"|"$/g, ""));
  if (!Number.isInteger(version) || version < 1) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The If-Match version is invalid." });
  }
  return version;
}

export function assertCurrentVersion(claimed: number, current: number): void {
  if (claimed !== current) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The record changed since it was read. Refresh and retry." });
  }
}

/** Render integer minor units as an exact decimal-string money view. */
export function moneyView(amountMinor: number, currency: string): { amount: string; currency: string } {
  if (!Number.isInteger(amountMinor)) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Money must be computed in integer minor units." });
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  return { amount: `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`, currency };
}

export function requireIdempotencyKey(headers: Headers): string {
  const key = headers.get("idempotency-key")?.trim();
  if (!key) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "This operation requires an Idempotency-Key header." });
  }
  return key;
}

export function rejectCrossOrigin(request: Request): void {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Cross-origin request rejected." });
  }
}
