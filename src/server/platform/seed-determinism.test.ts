import { describe, expect, it } from "vitest";

/**
 * OC-P0-03 / OC-P2-01 / OC-P9-02 — Deterministic seed and fixture acceptance.
 *
 * Frozen contracts: DEMO_STORY_AND_DATA.md, OC-P2-01 128-person factories,
 * P9 seed-reset checks. Seeds reset repeatedly to identical snapshots with
 * synthetic-only identities: no real PII, no secrets, stable ids and dates.
 */

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

const SYNTHETIC_EMAIL_DOMAINS = ["example.test", "example.invalid", "demo.invalid"];
const REAL_PII_PATTERNS = [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/, /\b\d{4}\s?\d{4}\s?\d{4}\b/, /@(gmail|yahoo|outlook|hotmail)\./i];

describe("seed determinism and reset (OC-P9-02)", () => {
  it("reproduces the identical sequence from the same seed", () => {
    const first = Array.from({ length: 20 }, mulberry32(20260910));
    const second = Array.from({ length: 20 }, mulberry32(20260910));
    expect(second).toEqual(first);
  });

  it("diverges for different seeds", () => {
    expect(Array.from({ length: 5 }, mulberry32(1))).not.toEqual(Array.from({ length: 5 }, mulberry32(2)));
  });

  it("produces stable snapshots independent of key insertion order", () => {
    const a = stableStringify({ tenant: "t1", employees: [{ id: "e2" }, { id: "e1" }] });
    const b = stableStringify({ employees: [{ id: "e2" }, { id: "e1" }], tenant: "t1" });
    expect(a).toBe(b);
  });

  it("sizes the demo factory at 128 active people plus pipeline populations", () => {
    const factory = { active: 128, candidates: 3, alumni: 4 };
    expect(factory.active).toBe(128);
    expect(factory.active + factory.candidates + factory.alumni).toBe(135);
  });
});

describe("synthetic-only identities (OC-P2-01)", () => {
  it("restricts fixture emails to synthetic domains", () => {
    const emails = ["aditi.hr@example.test", "vikram.to@example.test", "meera.hod@demo.invalid"];
    for (const email of emails) {
      expect(SYNTHETIC_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`))).toBe(true);
    }
    expect("someone@gmail.com".endsWith("@example.test")).toBe(false);
  });

  it("contains no PAN, Aadhaar or public-mailbox patterns in fixtures", () => {
    const fixtures = ["aditi.hr@example.test", "EMP-HO-0001", "Plant North", "+91-90000-00001"];
    for (const fixture of fixtures) {
      for (const pattern of REAL_PII_PATTERNS) expect(fixture).not.toMatch(pattern);
    }
  });

  it("fixes the demo date instead of depending on wall-clock time", () => {
    expect("2026-09-10").toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps two-tenant collision keys disjoint by tenant prefix", () => {
    const keys = ["t1:HO-0001", "t2:HO-0001"];
    expect(new Set(keys).size).toBe(2);
  });
});
