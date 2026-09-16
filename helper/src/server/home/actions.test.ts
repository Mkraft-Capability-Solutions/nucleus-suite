import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveHomeActionState, sortHomeActions, type HomeActionRow, type HomeActionState } from "./actions";

function row(id: string, status: HomeActionState, updatedAt: string | null): HomeActionRow {
  return {
    id,
    action: `Action ${id}`,
    context: "context",
    source: "onboarding",
    updated_at: updatedAt,
    due_on: null,
    status,
    href: "/joining-chain-console",
  };
}

describe("deriveHomeActionState", () => {
  it("treats completion as terminal even when blocked or overdue", () => {
    expect(deriveHomeActionState({ completed: true, blocked: true, dueOn: "2000-01-01" }, "2026-09-14")).toBe("completed");
    expect(deriveHomeActionState({ completed: true, blocked: false, dueOn: null }, "2026-09-14")).toBe("completed");
  });

  it("flags blocking items for attention", () => {
    expect(deriveHomeActionState({ completed: false, blocked: true, dueOn: null }, "2026-09-14")).toBe("needs_attention");
  });

  it("flags a lapsed due date for attention", () => {
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: "2026-09-13" }, "2026-09-14")).toBe("needs_attention");
  });

  it("leaves a due date of today or later available", () => {
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: "2026-09-14" }, "2026-09-14")).toBe("available");
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: "2027-01-01" }, "2026-09-14")).toBe("available");
  });

  it("tolerates a null due date and defaults today to the current ISO date", () => {
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: null })).toBe("available");
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: "1999-01-01" })).toBe("needs_attention");
    expect(deriveHomeActionState({ completed: false, blocked: false, dueOn: "9999-01-01" })).toBe("available");
  });
});

describe("sortHomeActions", () => {
  it("orders needs_attention before available before completed", () => {
    const sorted = sortHomeActions([
      row("done", "completed", "2026-09-10"),
      row("open", "available", "2026-09-10"),
      row("urgent", "needs_attention", "2026-09-10"),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["urgent", "open", "done"]);
    expect(sorted.map((entry) => entry.status)).toEqual(["needs_attention", "available", "completed"]);
  });

  it("orders newest first inside a status group and treats a missing timestamp as oldest", () => {
    const sorted = sortHomeActions([
      row("older", "available", "2026-01-01"),
      row("unknown", "available", null),
      row("newer", "available", "2026-09-01"),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["newer", "older", "unknown"]);
  });

  it("places queued_offline between available and completed and does not mutate its input", () => {
    const input = [row("done", "completed", null), row("queued", "queued_offline", null), row("open", "available", null)];
    const sorted = sortHomeActions(input);
    expect(sorted.map((entry) => entry.id)).toEqual(["open", "queued", "done"]);
    expect(input.map((entry) => entry.id)).toEqual(["done", "queued", "open"]);
  });

  it("returns an empty list unchanged", () => {
    expect(sortHomeActions([])).toEqual([]);
  });
});

describe("home actions contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/home/actions.ts"), "utf8");
  const region = service.slice(service.indexOf("HOME_EMPLOYEE_SELECT"));
  const sql = [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/\b(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    // Quoted literals (audit action names, jsonb keys) are not alias references.
    const aliasSql = sql.replace(/'[^']*'/g, "''");
    const bound = new Set<string>();
    for (const match of aliasSql.matchAll(/\b(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral"].includes(match[2])) {
        bound.add(match[2]);
      }
    }
    for (const match of aliasSql.matchAll(/\)\s+([a-z_]+)\s+on\b/g)) bound.add(match[1]);
    const referenced = new Set<string>();
    for (const match of aliasSql.matchAll(/\b([a-z_]+)\.[a-z_]+/g)) referenced.add(match[1]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const alias of referenced) {
      expect(bound.has(alias), `alias ${alias} is referenced but never bound`).toBe(true);
    }
  });

  it("uses no DDL and isolates every source behind its own try/catch", () => {
    expect(service).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE INDEX|TRUNCATE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("reuses the policy consent model instead of duplicating its SQL", () => {
    expect(service).toContain("listUnacknowledgedPoliciesForEmployee");
    expect(sql).not.toContain("consent_records");
  });

  it("reads the signed-in employee from an active membership link", () => {
    expect(sql).toContain("from memberships mem");
    expect(sql).toContain("mem.status = 'active'");
    expect(sql).toContain("mem.employee_id is not null");
  });
});
