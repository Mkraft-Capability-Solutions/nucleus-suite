import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveDirectoryStatus, displayOrCode, verifiedPercent } from "./directory";

describe("deriveDirectoryStatus", () => {
  it("maps every stored employee status", () => {
    expect(deriveDirectoryStatus("active")).toBe("active");
    expect(deriveDirectoryStatus("on_leave")).toBe("on_leave");
    expect(deriveDirectoryStatus("on leave")).toBe("on_leave");
    expect(deriveDirectoryStatus("separated")).toBe("separated");
    expect(deriveDirectoryStatus("exited")).toBe("separated");
    expect(deriveDirectoryStatus("relieved")).toBe("separated");
    expect(deriveDirectoryStatus("archived")).toBe("archived");
    expect(deriveDirectoryStatus("inactive")).toBe("archived");
  });

  it("treats an unknown or absent status as active rather than hiding the record", () => {
    expect(deriveDirectoryStatus("")).toBe("active");
    expect(deriveDirectoryStatus(null)).toBe("active");
    expect(deriveDirectoryStatus(undefined)).toBe("active");
    expect(deriveDirectoryStatus("  ACTIVE  ")).toBe("active");
  });
});

describe("displayOrCode", () => {
  it("prefers the resolved name over the stored code", () => {
    expect(displayOrCode("Executive Office", "OU-100")).toBe("Executive Office");
  });

  it("falls back to the stored value for records created in the app", () => {
    expect(displayOrCode(null, "Human Resources")).toBe("Human Resources");
    expect(displayOrCode("", "OU-100")).toBe("OU-100");
    expect(displayOrCode("   ", "OU-100")).toBe("OU-100");
  });

  it("renders a dash when neither side has a value", () => {
    expect(displayOrCode(null, null)).toBe("—");
    expect(displayOrCode("", "")).toBe("—");
    expect(displayOrCode(undefined, undefined)).toBe("—");
  });
});

describe("verifiedPercent", () => {
  it("rounds to a whole percentage", () => {
    expect(verifiedPercent(3, 3)).toBe(100);
    expect(verifiedPercent(4, 1)).toBe(25);
    expect(verifiedPercent(3, 1)).toBe(33);
  });

  it("returns null rather than NaN when there is nothing to measure", () => {
    expect(verifiedPercent(0, 0)).toBeNull();
    expect(verifiedPercent(null, 2)).toBeNull();
    expect(verifiedPercent(5, null)).toBeNull();
  });
});

describe("people directory contract", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/organization/directory.ts"), "utf8");
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);

  // Only template literals carrying a statement are scanned, so prose is never
  // mistaken for SQL.
  const sql = [...source.matchAll(/`([\s\S]*?)`/g)]
    .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
    .filter((span) => /\b(select|insert\s+into|update)\b/i.test(span))
    .join("\n");

  it("references only migrated tables", () => {
    expect(known.size).toBeGreaterThan(100);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["lateral", "select"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL alias it references", () => {
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral", "set"].includes(match[2])) {
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

  it("uses no DDL and isolates every optional stat", () => {
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    // sanctioned strength, documents and audit each degrade independently.
    expect((source.match(/} catch \{/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("never projects the encrypted registration number", () => {
    expect(source).not.toContain("registration_ciphertext");
    expect(source).not.toContain("registration_blind_index");
  });
});
