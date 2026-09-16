import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveClearanceState, deriveSettlementReadiness, waiveClearanceSchema } from "./clearance-board";
import { clearClearanceItemSchema } from "./service";

describe("deriveClearanceState", () => {
  it("maps settled statuses case-insensitively and trims", () => {
    expect(deriveClearanceState("Cleared")).toBe("cleared");
    expect(deriveClearanceState("  CLEARED ")).toBe("cleared");
    expect(deriveClearanceState("waived")).toBe("waived");
    expect(deriveClearanceState(" Waived")).toBe("waived");
    expect(deriveClearanceState("Held")).toBe("held");
  });

  it("treats anything else as open", () => {
    expect(deriveClearanceState("Open")).toBe("open");
    expect(deriveClearanceState("pending")).toBe("open");
    expect(deriveClearanceState("")).toBe("open");
    expect(deriveClearanceState("   ")).toBe("open");
    expect(deriveClearanceState(null)).toBe("open");
    expect(deriveClearanceState(undefined)).toBe("open");
  });
});

describe("deriveSettlementReadiness", () => {
  it("is settleable when there are no items at all", () => {
    expect(deriveSettlementReadiness([])).toEqual({ blockingOpen: 0, settleable: true });
  });

  it("counts only blocking items that are open or held", () => {
    const readiness = deriveSettlementReadiness([
      { blocking: true, status: "open" },
      { blocking: true, status: "held" },
      { blocking: true, status: "cleared" },
      { blocking: true, status: "waived" },
      { blocking: false, status: "open" },
      { blocking: false, status: "held" },
    ]);
    expect(readiness).toEqual({ blockingOpen: 2, settleable: false });
  });

  it("is settleable once every blocking item is cleared or waived", () => {
    expect(
      deriveSettlementReadiness([
        { blocking: true, status: "cleared" },
        { blocking: true, status: "waived" },
        { blocking: false, status: "open" },
      ]),
    ).toEqual({ blockingOpen: 0, settleable: true });
  });
});

describe("waiveClearanceSchema", () => {
  it("requires a trimmed reason between 20 and 500 characters", () => {
    expect(waiveClearanceSchema.safeParse({ reason: "  asset written off by facilities  " }).success).toBe(true);
    // The workbook holds a waiver to twenty characters; a three-word note is not enough.
    expect(waiveClearanceSchema.safeParse({ reason: "  asset written off  " }).success).toBe(false);
    expect(waiveClearanceSchema.safeParse({ reason: "ab" }).success).toBe(false);
    expect(waiveClearanceSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(waiveClearanceSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(waiveClearanceSchema.safeParse({}).success).toBe(false);
  });
});

describe("clearClearanceItemSchema", () => {
  it("defaults the recovery to nothing and needs a description only when one is raised", () => {
    const parsed = clearClearanceItemSchema.parse({});
    expect(parsed.recoveryAmountMinor).toBe(0);
    expect(clearClearanceItemSchema.safeParse({ recoveryAmountMinor: 150000 }).success).toBe(false);
    expect(clearClearanceItemSchema.safeParse({ recoveryAmountMinor: 150000, recoveryDescription: "Laptop" }).success).toBe(false);
    expect(clearClearanceItemSchema.safeParse({ recoveryAmountMinor: 150000, recoveryDescription: "Laptop not returned" }).success).toBe(true);
    expect(clearClearanceItemSchema.safeParse({ recoveryAmountMinor: -1 }).success).toBe(false);
  });
});

describe("clearance board contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/lifecycle/clearance-board.ts"), "utf8");
  // Doc comments also use backticks: strip comments before harvesting SQL spans.
  const code = service.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sql = [...code.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    // SQL string literals (audit action names, date masks) are values, not aliases.
    const sql = code
      .match(/`([\s\S]*?)`/g)
      ?.join("\n")
      .replace(/\$\{[^}]*\}/g, "")
      .replace(/'[^']*'/g, "''") ?? "";
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

  it("resolves the owner through the employee code, not a uuid", () => {
    expect(sql).toContain("holder.employee_code = item.attributes->>'owner'");
  });

  it("writes the waiver audit event with a before and after image", () => {
    expect(service).toContain("lifecycle.clearance_waive");
    expect(service).toContain("'clearance_item'");
    expect(sql).toContain("reason, before, after, request_id");
    expect(service).toContain("WORKFLOW_CONFLICT");
  });

  it("uses no DDL and isolates the audit trail", () => {
    expect(service).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((service.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
