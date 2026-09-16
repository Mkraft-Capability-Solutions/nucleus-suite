import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signInboundPayload, verifyInboundSignature } from "@/server/integrations/inbound";

const SECRET = "0123456789abcdef0123456789abcdef";
const TIMESTAMP = new Date("2026-09-10T10:00:00.000Z").toISOString();
const BODY = JSON.stringify({ event: "biometric.punch", device: "gate-1" });

describe("inbound webhook verification", () => {
  it("accepts a fresh correctly-signed delivery", () => {
    const signature = signInboundPayload(SECRET, TIMESTAMP, "n-1", BODY);
    expect(verifyInboundSignature({ secret: SECRET, timestamp: TIMESTAMP, nonce: "n-1", body: BODY, signature, nowMs: Date.parse(TIMESTAMP) + 1000, seenNonces: new Set() })).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets, stale timestamps and replayed nonces", () => {
    const signature = signInboundPayload(SECRET, TIMESTAMP, "n-2", BODY);
    const base = { secret: SECRET, timestamp: TIMESTAMP, nonce: "n-2", body: BODY, signature, nowMs: Date.parse(TIMESTAMP) + 1000, seenNonces: new Set<string>() };
    expect(verifyInboundSignature({ ...base, body: `${BODY} ` })).toBe(false);
    expect(verifyInboundSignature({ ...base, secret: "other-secret-value-00000000000000" })).toBe(false);
    expect(verifyInboundSignature({ ...base, nowMs: Date.parse(TIMESTAMP) + 6 * 60 * 1000 })).toBe(false);
    expect(verifyInboundSignature({ ...base, seenNonces: new Set(["n-2"]) })).toBe(false);
    expect(createHmac("sha256", SECRET).update("x").digest("hex")).not.toBe(signature);
  });
});
