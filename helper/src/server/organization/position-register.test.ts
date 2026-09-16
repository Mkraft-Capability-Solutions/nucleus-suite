import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePositionState } from "./service";

describe("derivePositionState", () => {
  it("marks frozen and abolished records regardless of incumbency", () => {
    expect(derivePositionState("frozen", true)).toBe("frozen");
    expect(derivePositionState("archived", false)).toBe("abolished");
    expect(derivePositionState("Inactive", true)).toBe("abolished");
  });

  it("marks incumbent posts as filled", () => {
    expect(derivePositionState("active", true)).toBe("filled");
    expect(derivePositionState("filled", false)).toBe("filled");
  });

  it("marks vacant active posts as open", () => {
    expect(derivePositionState("active", false)).toBe("open");
    expect(derivePositionState(null, false)).toBe("open");
    expect(derivePositionState(undefined, false)).toBe("open");
  });
});

describe("position register contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/organization/service.ts"), "utf8");

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const region = service.slice(service.indexOf("POSITION_STATUS_CASE"));
    const sql = [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    const region = service.slice(service.indexOf("POSITION_STATUS_CASE"));
    const sql = [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");
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
    const region = service.slice(service.indexOf("POSITION_STATUS_CASE"));
    expect(region).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
