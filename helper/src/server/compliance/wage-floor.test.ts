import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { simulateWageFloor, wageFloorInputSchema, type StatutoryRate } from "./wage-floor";

/**
 * Fixtures, not statutory truth. Every figure the engine uses is supplied by
 * the caller from a stored rule-pack row; these stand in for those rows so the
 * arithmetic can be exercised without a database.
 */
const STORED_RATES: StatutoryRate[] = [
  { code: "PF_EMPLOYER", label: "Provident fund (employer)", percent: 10, formula: null, appliesTo: "basic_da" },
  { code: "GRATUITY", label: "Gratuity provision", percent: null, formula: "base * days / month", appliesTo: "basic_da" },
];

/** The floor percentage is an argument too — this is the stored value under test. */
const STORED_FLOOR = 50;

const EMPTY_STRUCTURE = { grossMinor: 0, basicMinor: 0, dearnessMinor: 0, hraMinor: 0, specialMinor: 0 };

describe("simulateWageFloor", () => {
  it("leaves a compliant structure alone when the floor is not triggered", () => {
    const result = simulateWageFloor(
      { grossMinor: 1_000_000, basicMinor: 500_000, dearnessMinor: 100_000, hraMinor: 300_000, specialMinor: 100_000 },
      STORED_RATES,
      STORED_FLOOR,
    );
    expect(result.basicDaPercent).toBe(60);
    expect(result.floorTriggered).toBe(false);
    expect(result.declaredBaseMinor).toBe(600_000);
    expect(result.statutoryBaseMinor).toBe(600_000);
    expect(result.addBackMinor).toBe(0);
    expect(result.lines[0]).toEqual({
      component: "Provident fund (employer)",
      preCodeMinor: 60_000,
      postCodeMinor: 60_000,
      deltaMinor: 0,
    });
  });

  it("treats a structure exactly at the floor as compliant", () => {
    const result = simulateWageFloor(
      { grossMinor: 1_000_000, basicMinor: 400_000, dearnessMinor: 100_000, hraMinor: 300_000, specialMinor: 200_000 },
      STORED_RATES,
      STORED_FLOOR,
    );
    expect(result.basicDaPercent).toBe(STORED_FLOOR);
    expect(result.floorTriggered).toBe(false);
    expect(result.statutoryBaseMinor).toBe(result.declaredBaseMinor);
    expect(result.addBackMinor).toBe(0);
  });

  it("raises the statutory base and reports the add-back when the floor is triggered", () => {
    const result = simulateWageFloor(
      { grossMinor: 1_000_000, basicMinor: 300_000, dearnessMinor: 0, hraMinor: 400_000, specialMinor: 300_000 },
      STORED_RATES,
      STORED_FLOOR,
    );
    expect(result.basicDaPercent).toBe(30);
    expect(result.floorTriggered).toBe(true);
    expect(result.declaredBaseMinor).toBe(300_000);
    expect(result.statutoryBaseMinor).toBe(500_000);
    expect(result.addBackMinor).toBe(200_000);
    expect(result.lines).toEqual([
      { component: "Provident fund (employer)", preCodeMinor: 30_000, postCodeMinor: 50_000, deltaMinor: 20_000 },
      // A rate stored as a formula rather than a percentage contributes nothing
      // rather than being guessed at.
      { component: "Gratuity provision", preCodeMinor: 0, postCodeMinor: 0, deltaMinor: 0 },
    ]);
    expect(result.rateSource).toBe("PF_EMPLOYER, GRATUITY");
  });

  it("computes nothing from a zero gross rather than dividing by it", () => {
    const zero = simulateWageFloor(EMPTY_STRUCTURE, STORED_RATES, STORED_FLOOR);
    expect(zero.basicDaPercent).toBe(0);
    expect(zero.floorTriggered).toBe(false);
    expect(zero.declaredBaseMinor).toBe(0);
    expect(zero.statutoryBaseMinor).toBe(0);
    expect(zero.addBackMinor).toBe(0);

    // A base without a gross cannot be tested against a percentage of gross.
    const baseWithoutGross = simulateWageFloor({ ...EMPTY_STRUCTURE, basicMinor: 100_000 }, STORED_RATES, STORED_FLOOR);
    expect(baseWithoutGross.floorTriggered).toBe(false);
    expect(baseWithoutGross.statutoryBaseMinor).toBe(100_000);
    expect(baseWithoutGross.addBackMinor).toBe(0);
  });

  it("produces no lines and no rate source when nothing is stored", () => {
    const result = simulateWageFloor(
      { grossMinor: 1_000_000, basicMinor: 300_000, dearnessMinor: 0, hraMinor: 400_000, specialMinor: 300_000 },
      [],
      STORED_FLOOR,
    );
    expect(result.lines).toEqual([]);
    expect(result.rateSource).toBeNull();
    // The floor arithmetic still holds — only the contribution variance is absent.
    expect(result.floorTriggered).toBe(true);
    expect(result.addBackMinor).toBe(200_000);
  });

  it("rounds the reported percentage without letting it flip the trigger", () => {
    const result = simulateWageFloor({ ...EMPTY_STRUCTURE, grossMinor: 3_000_000, basicMinor: 1_000_000 }, [], STORED_FLOOR);
    expect(result.basicDaPercent).toBe(33.33);
    expect(result.floorTriggered).toBe(true);
  });

  it("falls back to the rate code when a stored row carries no label", () => {
    const result = simulateWageFloor(
      { ...EMPTY_STRUCTURE, grossMinor: 1_000_000, basicMinor: 800_000 },
      [{ code: "ESI", label: "", percent: 0, formula: null, appliesTo: null }],
      STORED_FLOOR,
    );
    expect(result.lines[0].component).toBe("ESI");
    expect(result.lines[0].preCodeMinor).toBe(0);
  });

  it("ignores an unusable floor or amount instead of producing a negative result", () => {
    const result = simulateWageFloor(
      { grossMinor: Number.NaN, basicMinor: -1, dearnessMinor: 0, hraMinor: 0, specialMinor: 0 },
      [],
      Number.NaN,
    );
    expect(result.declaredBaseMinor).toBe(0);
    expect(result.statutoryBaseMinor).toBe(0);
    expect(result.addBackMinor).toBe(0);
    expect(result.floorTriggered).toBe(false);
  });
});

describe("wageFloorInputSchema", () => {
  it("accepts five non-negative minor-unit integers", () => {
    expect(wageFloorInputSchema.safeParse({ ...EMPTY_STRUCTURE, grossMinor: 1_000_000 }).success).toBe(true);
  });

  it("rejects negatives, fractions and missing components", () => {
    expect(wageFloorInputSchema.safeParse({ ...EMPTY_STRUCTURE, grossMinor: -1 }).success).toBe(false);
    expect(wageFloorInputSchema.safeParse({ ...EMPTY_STRUCTURE, basicMinor: 10.5 }).success).toBe(false);
    expect(wageFloorInputSchema.safeParse({ grossMinor: 1 }).success).toBe(false);
    expect(wageFloorInputSchema.safeParse(null).success).toBe(false);
  });
});

describe("wage-floor register contracts", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/compliance/wage-floor.ts"), "utf8");
  const route = readFileSync(resolve(process.cwd(), "src/app/api/v1/compliance/wage-floor/route.ts"), "utf8");
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);

  // Only template literals that actually carry a statement are scanned, so an
  // error message such as "…from status draft" is never read as a table.
  function sqlOf(scanned: string): string {
    return [...scanned.matchAll(/`([\s\S]*?)`/g)]
      .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
      .filter((span) => /\b(select|insert\s+into|update)\b/i.test(span))
      .join("\n");
  }

  it("reads the canonical topology", () => {
    expect(known.size).toBeGreaterThan(100);
  });

  it("references only migrated tables", () => {
    const sql = sqlOf(source);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["lateral", "select"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables).toEqual(new Set(["rule_pack_versions", "statutory_rule_packs", "rule_pack_assignments"]));
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL alias it references", () => {
    const sql = sqlOf(source);
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral", "set"].includes(match[2])) {
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

  it("uses no DDL", () => {
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect(route).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });

  it("keeps the rate read behind a read permission", () => {
    expect(source).toContain('enforce(access.context, "employee.read"');
  });

  it("rejects an invalid simulation body the way the other routes do", () => {
    expect(route).toContain('code: "BAD_REQUEST"');
    expect(route).toContain("status: 400");
    expect(route).toContain("wageFloorInputSchema.safeParse");
  });

  it("refuses to simulate when no floor percentage is stored", () => {
    expect(route).toContain("configuration.floorPercent === null");
    expect(route).toContain("? null");
  });
});
