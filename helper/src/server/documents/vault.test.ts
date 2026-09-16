import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveDocumentState, normaliseVerification, verifyDocumentSchema } from "./vault";

describe("normaliseVerification", () => {
  it("folds the legacy scan vocabulary onto the vault vocabulary", () => {
    expect(normaliseVerification("available")).toBe("verified");
    expect(normaliseVerification("quarantined")).toBe("pending");
    expect(normaliseVerification("pending_scan")).toBe("pending");
  });

  it("keeps the workbook's rejected decision distinct from a pending one", () => {
    expect(normaliseVerification("rejected")).toBe("rejected");
    expect(deriveDocumentState("rejected", "2020-01-01", "2026-01-01")).toBe("rejected");
    expect(deriveDocumentState("replaced", null, "2026-01-01")).toBe("replaced");
  });

  it("requires a longer reason when a document is rejected", () => {
    expect(verifyDocumentSchema.safeParse({ decision: "rejected", reason: "Blurred" }).success).toBe(false);
    expect(verifyDocumentSchema.safeParse({ decision: "rejected", reason: "Blurred scan, page 2 unreadable" }).success).toBe(true);
    expect(verifyDocumentSchema.safeParse({ decision: "verified", reason: "OK." }).success).toBe(true);
  });

  it("passes through the vault vocabulary", () => {
    expect(normaliseVerification("verified")).toBe("verified");
    expect(normaliseVerification("replaced")).toBe("replaced");
    expect(normaliseVerification("pending")).toBe("pending");
    expect(normaliseVerification(" Verified ")).toBe("verified");
  });

  it("treats missing or unknown verdicts as pending", () => {
    expect(normaliseVerification(null)).toBe("pending");
    expect(normaliseVerification(undefined)).toBe("pending");
    expect(normaliseVerification("")).toBe("pending");
    expect(normaliseVerification("something-else")).toBe("pending");
  });
});

describe("deriveDocumentState", () => {
  const today = "2026-09-14";

  it("puts replacement ahead of every other signal", () => {
    expect(deriveDocumentState("replaced", "2020-01-01", today)).toBe("replaced");
    expect(deriveDocumentState("replaced", null, today)).toBe("replaced");
  });

  it("puts expiry ahead of an earlier verification", () => {
    expect(deriveDocumentState("verified", "2026-09-13", today)).toBe("expired");
    expect(deriveDocumentState("pending", "2000-12-31", today)).toBe("expired");
  });

  it("does not expire on the expiry date itself", () => {
    expect(deriveDocumentState("verified", today, today)).toBe("verified");
    expect(deriveDocumentState("verified", "2030-01-01", today)).toBe("verified");
  });

  it("falls back to pending verification", () => {
    expect(deriveDocumentState("pending", null, today)).toBe("pending_verification");
    expect(deriveDocumentState(null, null, today)).toBe("pending_verification");
    expect(deriveDocumentState(undefined, undefined, today)).toBe("pending_verification");
    expect(deriveDocumentState("", "", today)).toBe("pending_verification");
  });

  it("defaults today to the current date", () => {
    expect(deriveDocumentState("verified", "1999-01-01")).toBe("expired");
    expect(deriveDocumentState("verified", "9999-01-01")).toBe("verified");
  });
});

describe("document vault contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/documents/vault.ts"), "utf8");
  const region = service.slice(service.indexOf("EXPIRY_LATERAL"));
  const sql = [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.has("documents")).toBe(true);
    expect(tables.has("document_expiries")).toBe(true);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral"].includes(match[2])) {
        bound.add(match[2]);
      }
    }
    for (const match of sql.matchAll(/\)\s+([a-z_]+)\s+on\b/g)) bound.add(match[1]);
    const referenced = new Set<string>();
    for (const match of sql.matchAll(/\b([a-z_]+)\.[a-z_]+/g)) referenced.add(match[1]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const alias of referenced) {
      expect(bound.has(alias), `alias ${alias} is referenced but never bound`).toBe(true);
    }
  });

  it("uses no DDL and isolates the audit trail", () => {
    expect(region).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("reads both the legacy scan verdict and the vault verification", () => {
    expect(region).toMatch(/attributes->>'verification'/);
    expect(region).toMatch(/attributes->>'scan'/);
  });
});
