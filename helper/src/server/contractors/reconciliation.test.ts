import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { computeVariance, deriveVerdict } from "./reconciliation";

describe("deriveVerdict", () => {
  it("lets a stored decision win over the arithmetic", () => {
    expect(deriveVerdict(90, 2, "disputed")).toBe("disputed");
    expect(deriveVerdict(0, 2, "approved")).toBe("approved");
    // Casing and padding from the stored attribute must not change the verdict.
    expect(deriveVerdict(90, 2, " Disputed ")).toBe("disputed");
    expect(deriveVerdict(90, 2, "APPROVED")).toBe("approved");
  });

  it("asks for action once the variance passes the contract tolerance", () => {
    expect(deriveVerdict(2.01, 2, null)).toBe("action_required");
    expect(deriveVerdict(12, 2, "paid")).toBe("action_required");
  });

  it("keeps a variance at or below tolerance within tolerance", () => {
    expect(deriveVerdict(2, 2, null)).toBe("within_tolerance");
    expect(deriveVerdict(0, 2, undefined)).toBe("within_tolerance");
    expect(deriveVerdict(1.99, 2, "")).toBe("within_tolerance");
  });

  it("judges an under-billing on the same magnitude as an over-billing", () => {
    expect(deriveVerdict(-12, 2, null)).toBe("action_required");
    expect(deriveVerdict(-1.5, 2, null)).toBe("within_tolerance");
  });

  it("treats a zero or negative tolerance as zero tolerance", () => {
    expect(deriveVerdict(0.01, 0, null)).toBe("action_required");
    expect(deriveVerdict(0, 0, null)).toBe("within_tolerance");
    expect(deriveVerdict(1, -2, null)).toBe("action_required");
  });

  it("never accuses a vendor on an unusable number", () => {
    expect(deriveVerdict(Number.NaN, 2, null)).toBe("within_tolerance");
    expect(deriveVerdict(Number.POSITIVE_INFINITY, 2, null)).toBe("within_tolerance");
    expect(deriveVerdict(5, Number.NaN, null)).toBe("action_required");
    expect(deriveVerdict(Number.NaN, Number.NaN, "disputed")).toBe("disputed");
  });
});

describe("computeVariance", () => {
  it("reports the over-billed hours and their percentage", () => {
    expect(computeVariance(110, 100)).toEqual({ deltaHours: 10, variancePct: 10 });
    expect(computeVariance(103.5, 100)).toEqual({ deltaHours: 3.5, variancePct: 3.5 });
  });

  it("rounds the percentage to two decimals", () => {
    expect(computeVariance(100, 3).variancePct).toBe(3233.33);
    expect(computeVariance(10, 7).variancePct).toBe(42.86);
  });

  it("reports a negative delta when the vendor under-bills", () => {
    expect(computeVariance(90, 100)).toEqual({ deltaHours: -10, variancePct: -10 });
  });

  it("reports 0% rather than Infinity when no hours were verified", () => {
    expect(computeVariance(120, 0)).toEqual({ deltaHours: 120, variancePct: 0 });
    expect(computeVariance(0, 0)).toEqual({ deltaHours: 0, variancePct: 0 });
  });

  it("treats an unusable input as zero rather than propagating NaN", () => {
    expect(computeVariance(Number.NaN, 100)).toEqual({ deltaHours: -100, variancePct: -100 });
    expect(computeVariance(100, Number.NaN)).toEqual({ deltaHours: 100, variancePct: 0 });
    expect(computeVariance(Number.NaN, Number.NaN)).toEqual({ deltaHours: 0, variancePct: 0 });
  });
});

describe("contractor reconciliation contracts", () => {
  const sources = {
    reconciliation: readFileSync(resolve(process.cwd(), "src/server/contractors/reconciliation.ts"), "utf8"),
  };
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);

  // Only template literals that actually carry a statement are scanned, so an
  // error message such as "…from status draft" is never read as a table.
  function sqlOf(source: string): string {
    return [...source.matchAll(/`([\s\S]*?)`/g)]
      .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
      .filter((span) => /\b(select|insert\s+into|update)\b/i.test(span))
      .join("\n");
  }

  it("reads the canonical topology", () => {
    expect(known.size).toBeGreaterThan(100);
  });

  it.each(Object.entries(sources))("%s references only migrated tables", (_name, source) => {
    const sql = sqlOf(source);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["lateral", "select"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it.each(Object.entries(sources))("%s binds every SQL alias it references", (_name, source) => {
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

  it.each(Object.entries(sources))("%s uses no DDL", (_name, source) => {
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });

  it("derives the reconciliation without creating a debit-note store", () => {
    const source = sources.reconciliation;
    // The dispute is recorded on the invoice itself; there is no debit note table.
    expect(source).not.toMatch(/debit_note/i);
    expect(source).toContain("update contractor_invoices");
    // The disposition writes its own outcome onto the invoice attributes.
    expect(source).toContain("reconciliation_status: outcome");
    expect(source).toContain("variance_action: input.varianceAction");
    expect(source).toContain("approved_amount_minor: approvedAmountMinor");
    expect(source).toContain("to_char(current_date, 'YYYY-MM-DD')");
  });

  it("ties verified hours to gate attendance rather than to the invoice", () => {
    const sql = sqlOf(sources.reconciliation);
    expect(sql).toContain("attendance_entries");
    expect(sql).toContain("contract_worker_assignments");
    expect(sql).toContain("gross_minutes");
  });

  it("scopes every statement to the caller's tenant", () => {
    const sql = sqlOf(sources.reconciliation);
    for (const statement of sql.split(/\n(?=\s*select |\s*update |\s*insert into )/i)) {
      if (!/\b(select|update|insert\s+into)\b/i.test(statement)) continue;
      expect(statement, "a statement is not tenant scoped").toMatch(/tenant_id/);
    }
  });

  it("audits a dispute as an append-only contractor invoice event", () => {
    const source = sources.reconciliation;
    expect(source).toContain("reason, before, after, request_id");
    expect(source).toContain('const DISPUTE_ACTION = "contractor.invoice_dispute"');
    expect(source).toContain("${DISPUTE_ACTION}, 'contractor_invoice'");
    expect(source).toContain("entity_type = 'contractor_invoice'");
    expect(source).toContain("${uuidOrNull(requestId)}::uuid");
  });

  it("isolates the audit trail so a failure never fails the record", () => {
    expect(sources.reconciliation).toContain("auditTrail = [];");
  });

  it("guards the read and write permissions the module contract requires", () => {
    const source = sources.reconciliation;
    expect(source).toContain('enforce(access.context, "employee.read", { tenantId: access.tenantId })');
    expect(source).toContain('enforce(access.context, "employee.write", { tenantId: access.tenantId })');
    expect(source).toContain('code: "WORKFLOW_CONFLICT"');
    expect(source).toContain('status: 404, code: "NOT_FOUND"');
  });
});
