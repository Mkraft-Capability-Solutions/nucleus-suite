import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePolicyAckState } from "./policy-acknowledgements";

describe("derivePolicyAckState", () => {
  it("treats the viewer's own acknowledgement as terminal", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: true, dueOn: "2000-01-01", audienceCount: 10, acknowledgedCount: 0 }, "2026-09-14")).toBe("acknowledged");
    expect(derivePolicyAckState({ acknowledgedByViewer: true, dueOn: null, audienceCount: 0, acknowledgedCount: 0 }, "2026-09-14")).toBe("acknowledged");
  });

  it("marks a lapsed due date overdue", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: "2026-09-13", audienceCount: 0, acknowledgedCount: 0 }, "2026-09-14")).toBe("overdue");
  });

  it("does not mark a due date that is today or later as overdue", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: "2026-09-14", audienceCount: 0, acknowledgedCount: 0 }, "2026-09-14")).toBe("published");
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: "2026-12-31", audienceCount: 4, acknowledgedCount: 1 }, "2026-09-14")).toBe("pending_acknowledgement");
  });

  it("marks incomplete coverage as pending acknowledgement", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: 12, acknowledgedCount: 3 }, "2026-09-14")).toBe("pending_acknowledgement");
  });

  it("falls back to published for full coverage or an empty audience", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: 5, acknowledgedCount: 5 }, "2026-09-14")).toBe("published");
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: 5, acknowledgedCount: 9 }, "2026-09-14")).toBe("published");
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: 0, acknowledgedCount: 0 }, "2026-09-14")).toBe("published");
  });

  it("tolerates a null due date and defaults today to the current ISO date", () => {
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: 0, acknowledgedCount: 0 })).toBe("published");
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: "1999-01-01", audienceCount: 0, acknowledgedCount: 0 })).toBe("overdue");
    expect(derivePolicyAckState({ acknowledgedByViewer: false, dueOn: "9999-01-01", audienceCount: 2, acknowledgedCount: 0 })).toBe("pending_acknowledgement");
  });
});

describe("policy acknowledgement contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/engagement/policy-acknowledgements.ts"), "utf8");
  // The queue projection is built per scope — the tenant's coverage counts are in
  // the statement only for a reader entitled to them — so the scan starts at the
  // builder rather than at the single constant it replaced.
  const region = service.slice(service.indexOf("function policyQueueSelect"));
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

  it("uses no DDL and isolates the audit trail", () => {
    expect(service).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE|CREATE INDEX|TRUNCATE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("persists acknowledgements as consent records without inventing a table", () => {
    expect(sql).toContain("insert into consent_records");
    expect(sql).toContain("'consent_type', 'policy_acknowledgement'");
    expect(sql).toContain("'engagement.policy_acknowledge'");
  });

  it("restricts the queue to POLICY document types", () => {
    expect((sql.match(/dt\.attributes->>'code' = 'POLICY'/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
