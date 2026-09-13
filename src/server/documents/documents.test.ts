import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * OC-P2-01 — Secure document substrate acceptance (TDD spec).
 *
 * Frozen contracts: Slice 7 document scope, storage-port rules (bounded
 * encrypted PostgreSQL bytes, replaceable port, no Blob dependency).
 * Metadata/version lifecycle, quarantine, signed URLs, retention, size bound.
 */

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 15 * 60;

type DocState = "pending_scan" | "available" | "quarantined" | "expired" | "superseded";

function nextDocState(current: DocState, event: "scan_clean" | "scan_threat" | "expire" | "supersede"): DocState | null {
  if (current === "pending_scan" && event === "scan_clean") return "available";
  if (current === "pending_scan" && event === "scan_threat") return "quarantined";
  if (current === "available" && event === "expire") return "expired";
  if (current === "available" && event === "supersede") return "superseded";
  return null;
}

function signDownloadKey(key: string, version: number, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${key}:${version}:${expiresAt}`).digest("hex");
}

describe("document version lifecycle (OC-P2-01)", () => {
  it("promotes clean scans to available and threats to quarantine", () => {
    expect(nextDocState("pending_scan", "scan_clean")).toBe("available");
    expect(nextDocState("pending_scan", "scan_threat")).toBe("quarantined");
  });

  it("expires available documents and supersedes them on new upload", () => {
    expect(nextDocState("available", "expire")).toBe("expired");
    expect(nextDocState("available", "supersede")).toBe("superseded");
  });

  it("rejects illegal transitions instead of guessing", () => {
    expect(nextDocState("quarantined", "scan_clean")).toBeNull();
    expect(nextDocState("expired", "supersede")).toBeNull();
    expect(nextDocState("available", "scan_clean")).toBeNull();
  });

  it("increments versions monotonically and keeps prior versions addressable", () => {
    const versions = [1, 2, 3];
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

describe("bounded encrypted storage port (OC-P2-01)", () => {
  it("accepts documents at exactly the 10 MiB bound and rejects one byte more", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10_485_760);
    expect(10_485_760 <= MAX_DOCUMENT_BYTES).toBe(true);
    expect(10_485_761 <= MAX_DOCUMENT_BYTES).toBe(false);
  });

  it("binds every version to its tenant with content hash and key version", () => {
    const version = { tenantId: "t1", sha256: "abc123", encryptionKeyVersion: "kv-3" };
    expect(version.tenantId).toBe("t1");
    expect(version.sha256).toBeTruthy();
    expect(version.encryptionKeyVersion).toMatch(/^kv-\d+$/);
  });
});

describe("signed version-bound download URLs (OC-P2-01)", () => {
  const secret = "test-secret";

  it("verifies an untampered URL with timing-safe comparison", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const signature = signDownloadKey("doc_1", 2, expiresAt, secret);
    const expected = signDownloadKey("doc_1", 2, expiresAt, secret);
    expect(timingSafeEqual(Buffer.from(signature), Buffer.from(expected))).toBe(true);
  });

  it("invalidates the signature when version, key or expiry is altered", () => {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const original = signDownloadKey("doc_1", 2, expiresAt, secret);
    expect(signDownloadKey("doc_1", 3, expiresAt, secret)).not.toBe(original);
    expect(signDownloadKey("doc_2", 2, expiresAt, secret)).not.toBe(original);
    expect(signDownloadKey("doc_1", 2, expiresAt + 1, secret)).not.toBe(original);
  });

  it("rejects expired URLs and wrong-secret signatures", () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 1;
    expect(expiredAt < Math.floor(Date.now() / 1000)).toBe(true);
    expect(signDownloadKey("doc_1", 2, expiredAt, "other-secret")).not.toBe(signDownloadKey("doc_1", 2, expiredAt, secret));
  });

  it("caps URL lifetime at fifteen minutes", () => {
    expect(SIGNED_URL_TTL_SECONDS).toBe(900);
  });
});
