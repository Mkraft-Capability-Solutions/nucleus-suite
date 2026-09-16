import { describe, expect, it } from "vitest";
import {
  assertCurrentVersion,
  collection,
  decodeCursor,
  encodeCursor,
  fail,
  HttpError,
  moneyView,
  ok,
  parsePagination,
  requestIdFrom,
  requireIdempotencyKey,
  requireVersion,
} from "@/server/platform/http";

describe("request ids and envelopes", () => {
  it("honours an incoming x-request-id and generates a uuid otherwise", () => {
    expect(requestIdFrom(new Headers({ "x-request-id": "req-1" }))).toBe("req-1");
    expect(requestIdFrom(new Headers())).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("builds a conforming success envelope", async () => {
    const response = ok({ type: "leave-request", id: "lr_1", version: 2, attributes: { status: "approved" }, requestId: "r1", self: "/api/v1/leave-requests/lr_1" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { type: string; version: number }; meta: { requestId: string } };
    expect(body.data.type).toBe("leave-request");
    expect(body.meta.requestId).toBe("r1");
  });

  it("builds collections with opaque next cursors", async () => {
    const response = collection({ type: "employee", items: [{ id: "e1", version: 1 }], requestId: "r2", self: "/api/v1/people", nextCursor: "opaque" });
    const body = (await response.json()) as { meta: { nextCursor: string } };
    expect(body.meta.nextCursor).toBe("opaque");
  });

  it("maps HttpError to the frozen error envelope and unknowns to 500", async () => {
    const known = fail(new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Stale." }), "r3");
    expect(known.status).toBe(409);
    expect(((await known.json()) as { error: { code: string } }).error.code).toBe("VERSION_CONFLICT");
    const unknown = fail(new Error("boom"), "r4");
    expect(unknown.status).toBe(500);
  });
});

describe("pagination, cursors and preconditions", () => {
  it("defaults, clamps and sanitizes pagination", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ page: 1, pageSize: 25 });
    expect(parsePagination(new URLSearchParams({ pageSize: "500" })).pageSize).toBe(100);
    expect(parsePagination(new URLSearchParams({ page: "0", pageSize: "-3" }))).toEqual({ page: 1, pageSize: 1 });
  });

  it("round-trips opaque cursors and rejects garbage", () => {
    const cursor = encodeCursor({ tenant: "t", last: "e9" });
    expect(cursor).not.toContain("e9");
    expect(decodeCursor(cursor)).toEqual({ tenant: "t", last: "e9" });
    expect(decodeCursor(null)).toBeNull();
    expect(() => decodeCursor("!!!not-base64!!!")).toThrow(HttpError);
  });

  it("requires If-Match and detects stale versions", () => {
    expect(requireVersion(new Headers({ "if-match": '"7"' }))).toBe(7);
    expect(() => requireVersion(new Headers())).toThrow(HttpError);
    expect(() => assertCurrentVersion(6, 7)).toThrow(HttpError);
    expect(() => assertCurrentVersion(7, 7)).not.toThrow();
  });

  it("requires Idempotency-Key for consequential posts", () => {
    expect(requireIdempotencyKey(new Headers({ "idempotency-key": "k1" }))).toBe("k1");
    expect(() => requireIdempotencyKey(new Headers())).toThrow(HttpError);
  });

  it("renders minor-unit money as exact decimal strings", () => {
    expect(moneyView(7_800_000, "INR")).toEqual({ amount: "78000.00", currency: "INR" });
    expect(moneyView(-50_000, "INR").amount).toBe("-500.00");
    expect(() => moneyView(10.5, "INR")).toThrow(HttpError);
  });
});
