import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveLetterState, letterReferenceFor, letterTemplateName } from "./service";

describe("deriveLetterState", () => {
  it("always reports templates as live", () => {
    expect(deriveLetterState("template", {})).toBe("template_active");
    expect(deriveLetterState("template", { status: "draft", issuedOn: null, supersededBy: "x" })).toBe("template_active");
  });

  it("reports superseded issues as reissued before anything else", () => {
    expect(deriveLetterState("issue", { supersededBy: "a1", status: "draft", issuedOn: "2026-01-01" })).toBe("reissued");
    expect(deriveLetterState("issue", { supersededBy: "   " })).not.toBe("reissued");
  });

  it("honours an explicit status regardless of case or spacing", () => {
    expect(deriveLetterState("issue", { status: "Pending Approval" })).toBe("pending_approval");
    expect(deriveLetterState("issue", { status: " DRAFT ", issuedOn: "2026-01-01" })).toBe("draft");
    expect(deriveLetterState("issue", { status: "issued" })).toBe("issued");
    expect(deriveLetterState("issue", { status: "pending-approval" })).toBe("pending_approval");
  });

  it("ignores an unrecognised status and falls through to the date and approval gate", () => {
    expect(deriveLetterState("issue", { status: "archived", issuedOn: "2026-02-02" })).toBe("issued");
    expect(deriveLetterState("issue", { status: "archived", approvalRequired: true })).toBe("pending_approval");
  });

  it("derives issued from the issue date and pending approval from the template gate", () => {
    expect(deriveLetterState("issue", { issuedOn: "2026-03-03" })).toBe("issued");
    expect(deriveLetterState("issue", { issuedOn: "  ", approvalRequired: true })).toBe("pending_approval");
    expect(deriveLetterState("issue", { approvalRequired: false })).toBe("draft");
  });

  it("defaults to draft for null and undefined inputs", () => {
    expect(deriveLetterState("issue", {})).toBe("draft");
    expect(deriveLetterState("issue", { approvalRequired: undefined, issuedOn: null, supersededBy: null, status: null })).toBe("draft");
  });
});

describe("letterTemplateName", () => {
  it("prefers the excel shape, then the legacy shape, then a fallback", () => {
    expect(letterTemplateName({ template_name: "Offer Letter", name: "legacy" })).toBe("Offer Letter");
    expect(letterTemplateName({ name: "Standard Appointment Letter" })).toBe("Standard Appointment Letter");
    expect(letterTemplateName({})).toBe("Letter template");
    expect(letterTemplateName({ template_name: "   ", name: "" })).toBe("Letter template");
    expect(letterTemplateName({ template_name: 42, name: null })).toBe("Letter template");
  });
});

describe("letterReferenceFor", () => {
  it("derives a stable reference from the effective year and the new row id", () => {
    expect(letterReferenceFor("0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0", "2026-09-14")).toBe("LTR-2026-0F1E2D");
  });
});

describe("letters register contract", () => {
  const service = readFileSync(resolve(process.cwd(), "src/server/letters/service.ts"), "utf8");
  const region = service.slice(service.indexOf("LETTER_ISSUE_STATUS_CASE"));

  function regionSql(): string {
    return [...region.matchAll(/`([\s\S]*?)`/g)].map((span) => span[1].replace(/\$\{[^}]*\}/g, "")).join("\n");
  }

  it("references only migrated tables", () => {
    const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
    const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
    expect(known.size).toBeGreaterThan(100);
    const sql = regionSql();
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["latest", "lateral", "status"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.has("letter_templates")).toBe(true);
    expect(tables.has("generated_letters")).toBe(true);
    expect(tables.has("employees")).toBe(true);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it("binds every SQL table alias it references", () => {
    const sql = regionSql();
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

  it("resolves the issue holder through both the column and the attribute fallback", () => {
    expect(region).toContain("coalesce(gl.employee_id, (gl.attributes->>'employee_id')::uuid)");
  });

  it("uses no DDL and isolates the audit trail", () => {
    expect(region).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
    expect((region.match(/try \{/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
});
