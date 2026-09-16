import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveHeadroomState, reviseSanctionedStrengthSchema } from "./sanctioned-strength";

describe("deriveHeadroomState", () => {
  it("flags deployment above the sanctioned figure as over plan", () => {
    expect(deriveHeadroomState(10, 11)).toBe("over_plan");
    expect(deriveHeadroomState(0, 1)).toBe("over_plan");
    expect(deriveHeadroomState(null, 3)).toBe("over_plan");
  });

  it("flags an exactly consumed sanction as at limit", () => {
    expect(deriveHeadroomState(10, 10)).toBe("at_limit");
    expect(deriveHeadroomState(1, 1)).toBe("at_limit");
  });

  it("treats a zero sanction with zero filled as headroom, not a limit", () => {
    expect(deriveHeadroomState(0, 0)).toBe("within_headroom");
    expect(deriveHeadroomState(null, 0)).toBe("within_headroom");
  });

  it("keeps unusable filled figures within headroom", () => {
    expect(deriveHeadroomState(10, null)).toBe("within_headroom");
    expect(deriveHeadroomState(10, Number.NaN)).toBe("within_headroom");
    expect(deriveHeadroomState(null, null)).toBe("within_headroom");
    expect(deriveHeadroomState(Number.NaN, Number.NaN)).toBe("within_headroom");
  });

  it("reports remaining headroom as within headroom", () => {
    expect(deriveHeadroomState(10, 4)).toBe("within_headroom");
    expect(deriveHeadroomState(Number.NaN, 0)).toBe("within_headroom");
  });
});

describe("sanctioned strength contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/organization/sanctioned-strength.ts"), "utf8");
  const region = service.slice(service.indexOf("HEADROOM_STATUS_CASE"));
  const sql = [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.has("manpower_plan_lines")).toBe(true);
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
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("derives headroom as sanctioned minus filled minus open requisitions", () => {
    expect(region).toMatch(/n\.sanctioned - n\.filled - n\.open_requisitions/);
  });

  it("requires a validity window that does not end before it starts", () => {
    const base = { sanctioned: 12, approvalReference: "BOARD/2026/04", reason: "Annual sanction review" };
    expect(reviseSanctionedStrengthSchema.safeParse({ ...base, validFrom: "2026-04-01", validTo: "2027-03-31" }).success).toBe(true);
    expect(reviseSanctionedStrengthSchema.safeParse({ ...base, validFrom: "2026-04-01", validTo: "2026-03-31" }).success).toBe(false);
    expect(reviseSanctionedStrengthSchema.safeParse(base).success).toBe(false);
  });

  it("excludes plan lines without a sanctioned figure", () => {
    expect(region).toMatch(/attributes->>'sanctioned' is not null/);
  });

  it("keeps the SQL status case in step with the pure helper", () => {
    expect(region).toMatch(/'over_plan'/);
    expect(region).toMatch(/'at_limit'/);
    expect(region).toMatch(/'within_headroom'/);
  });
});
