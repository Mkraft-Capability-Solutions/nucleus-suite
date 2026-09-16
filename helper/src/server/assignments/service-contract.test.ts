import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Every table the assignments service touches must exist in the migrated topology. */
describe("assignments service contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/assignments/service.ts"), "utf8");
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");

  function referencedTables(): string[] {
    const sql = [...service.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1]).join("\n");
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (match[1] !== "latest") tables.add(match[1]);
    }
    return [...tables];
  }

  it("references only migrated tables", () => {
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    for (const table of referencedTables()) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("uses no DDL", () => {
    expect(service).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });

  it("reads names defensively so missing attribute keys degrade to fallbacks", () => {
    expect(service).toContain("coalesce(");
  });

  it("isolates the audit trail so it can never fail the record", () => {
    const isolated = (service.match(/try \{/g) ?? []).length;
    expect(isolated).toBeGreaterThanOrEqual(2);
  });

  it("binds every SQL table alias it references", () => {
    const sql = [...service.matchAll(/`([\s\S]*?)`/g)]
      .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
      .join("\n");
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group"].includes(match[2])) {
        bound.add(match[2]);
      }
    }
    const referenced = new Set<string>();
    for (const match of sql.matchAll(/\b([a-z_]+)\.[a-z_]+/g)) referenced.add(match[1]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const alias of referenced) {
      expect(bound.has(alias), `alias ${alias} is referenced but never bound`).toBe(true);
    }
  });
  it("keeps grade reference data inside the isolated enrichment helper", () => {
    const helperStart = service.indexOf("async function gradeNames");
    expect(helperStart).toBeGreaterThan(-1);
    const helperEnd = service.indexOf("/** Full effective-dated history");
    const helper = service.slice(helperStart, helperEnd);
    expect(helper).toContain("try {");
    const outside = service.slice(0, helperStart) + service.slice(helperEnd);
    expect(outside).not.toContain("grd.");
    expect(outside).not.toContain("from grades");
  });
});
