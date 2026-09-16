import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveJoiningState, joiningReadinessLabel } from "./joining-chain";

describe("deriveJoiningState", () => {
  it("treats a blocked chain as blocked regardless of counters", () => {
    expect(deriveJoiningState(0, 0, 0, true)).toBe("blocked");
    expect(deriveJoiningState(6, 6, 0, true)).toBe("blocked");
    expect(deriveJoiningState(6, 3, 2, true)).toBe("blocked");
  });

  it("treats an empty chain as not started", () => {
    expect(deriveJoiningState(0, 0, 0, false)).toBe("not_started");
  });

  it("marks a chain with no outstanding required task as ready", () => {
    expect(deriveJoiningState(6, 6, 0, false)).toBe("ready");
    expect(deriveJoiningState(6, 2, 0, false)).toBe("ready");
    expect(deriveJoiningState(1, 0, 0, false)).toBe("ready");
  });

  it("marks an untouched chain with outstanding required work as not started", () => {
    expect(deriveJoiningState(6, 0, 5, false)).toBe("not_started");
  });

  it("marks a partially completed chain as in progress", () => {
    expect(deriveJoiningState(6, 1, 4, false)).toBe("in_progress");
    expect(deriveJoiningState(6, 5, 1, false)).toBe("in_progress");
  });
});

describe("joiningReadinessLabel", () => {
  it("labels every state", () => {
    expect(joiningReadinessLabel("ready")).toBe("Completed");
    expect(joiningReadinessLabel("not_started")).toBe("Not started");
    expect(joiningReadinessLabel("blocked")).toBe("Blocked");
    expect(joiningReadinessLabel("in_progress")).toBe("In progress");
  });
});

describe("joining chain contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/lifecycle/joining-chain.ts"), "utf8");
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

  it("normalises both onboarding task attribute shapes", () => {
    expect(sql).toContain("task_name");
    expect(sql).toContain("'completed'");
    expect(sql).toContain("'status'");
    expect(sql).toContain("People Ops");
  });

  it("uses no DDL and isolates the audit trail", () => {
    expect(service).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((service.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
