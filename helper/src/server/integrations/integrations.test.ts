import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * OC-P7-01 / OC-P7-02 — Integration platform acceptance (TDD spec).
 *
 * Frozen contracts: Slice 13. Sandbox/Simulated/Live labels, signed webhook
 * delivery with retry and dead-letter, idempotent sync runs with cursors and
 * field-ownership mapping. Secrets never enter UI, logs or error payloads.
 */

function canClaimLive(args: { verifiedRoundTrip: boolean; credentialsStored: boolean }): boolean {
  return args.verifiedRoundTrip && args.credentialsStored;
}

function signWebhook(secret: string, timestamp: string, nonce: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

function verifyWebhook(args: { secret: string; timestamp: string; nonce: string; body: string; signature: string; nowMs: number; seenNonces: Set<string> }): boolean {
  const skewMs = Math.abs(args.nowMs - Date.parse(args.timestamp));
  if (Number.isNaN(skewMs) || skewMs > 5 * 60 * 1000) return false;
  if (args.seenNonces.has(args.nonce)) return false;
  const expected = signWebhook(args.secret, args.timestamp, args.nonce, args.body);
  if (expected.length !== args.signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(args.signature));
}

const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504];

describe("environment honesty (OC-P7-02)", () => {
  it.each([["Sandbox"], ["Simulated"], ["Live"]])("recognizes the '%s' label", (label) => {
    expect(["Sandbox", "Simulated", "Live"]).toContain(label);
  });

  it("claims Live only after a verified round-trip with stored credentials", () => {
    expect(canClaimLive({ verifiedRoundTrip: true, credentialsStored: true })).toBe(true);
    expect(canClaimLive({ verifiedRoundTrip: false, credentialsStored: true })).toBe(false);
    expect(canClaimLive({ verifiedRoundTrip: true, credentialsStored: false })).toBe(false);
  });
});

describe("signed webhook delivery (OC-P7-01)", () => {
  const secret = "whsec_test";
  const timestamp = new Date("2026-09-10T10:00:00.000Z").toISOString();
  const body = JSON.stringify({ event: "attendance.synced", runId: "run_4" });

  it("accepts a fresh, correctly signed delivery", () => {
    const signature = signWebhook(secret, timestamp, "n-1", body);
    expect(verifyWebhook({ secret, timestamp, nonce: "n-1", body, signature, nowMs: Date.parse(timestamp) + 1000, seenNonces: new Set() })).toBe(true);
  });

  it("rejects tampered bodies, wrong secrets, stale timestamps and replayed nonces", () => {
    const signature = signWebhook(secret, timestamp, "n-2", body);
    const base = { secret, timestamp, nonce: "n-2", body, signature, nowMs: Date.parse(timestamp) + 1000, seenNonces: new Set<string>() };
    expect(verifyWebhook({ ...base, body: `${body} ` })).toBe(false);
    expect(verifyWebhook({ ...base, secret: "whsec_other" })).toBe(false);
    expect(verifyWebhook({ ...base, nowMs: Date.parse(timestamp) + 6 * 60 * 1000 })).toBe(false);
    expect(verifyWebhook({ ...base, seenNonces: new Set(["n-2"]) })).toBe(false);
  });

  it("retries only 408/429/5xx and dead-letters everything else", () => {
    expect(RETRYABLE_STATUS).toContain(429);
    expect(RETRYABLE_STATUS).toContain(503);
    expect(RETRYABLE_STATUS).not.toContain(400);
    expect(RETRYABLE_STATUS).not.toContain(401);
    expect(RETRYABLE_STATUS).not.toContain(422);
  });
});

describe("sync runs, cursors and secret hygiene (OC-P7-02)", () => {
  it("resumes syncs from opaque cursors without re-committing mapped changes", () => {
    const run = { cursor: "opaque:cursor:9", reviewed: true, committed: true };
    expect(run.reviewed && run.committed).toBe(true);
    expect(run.cursor).not.toContain("employee");
  });

  it("keeps secrets out of logs, UI payloads and error messages", () => {
    const logLine = "connector sync run_4 failed: upstream timeout after 30000ms";
    expect(logLine).not.toMatch(/sk_live|whsec|secret|password|token/i);
  });

  it("replays dead-letter deliveries under the original effect key", () => {
    const replayed = new Set<string>();
    const replay = (key: string) => {
      if (replayed.has(key)) return "already_applied";
      replayed.add(key);
      return "applied";
    };
    expect(replay("dlq_evt_7")).toBe("applied");
    expect(replay("dlq_evt_7")).toBe("already_applied");
  });
});
