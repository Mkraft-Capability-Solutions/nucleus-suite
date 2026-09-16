import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/hrms/workflow-workspace.tsx"), "utf8");
const primitives = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");
// Only the contractors console is under test; the generic workflow workspace
// above it in the same file is owned elsewhere.
const page = source.slice(source.indexOf("const CONTRACTOR_TABS"));

describe("Contract & Contingent Workforce Management", () => {
  it("names the module and its purpose", () => {
    expect(page).toContain("Contract & Contingent Workforce Management");
    expect(page).toContain(
      "Treating contractor personnel and gig associates as first-class workforce peers, with biometric gate attendance reconciliation to eliminate invoice overbilling and guarantee Principal Employer statutory compliance.",
    );
  });

  it("renders the three console tabs", () => {
    for (const label of [
      "Gate Punch vs Invoice Reconciliation",
      "Contract Worker Registry",
      "Staffing Vendor Master",
    ]) {
      expect(page, `missing the ${label} tab`).toContain(label);
    }
    expect(page).toContain("<ModuleTabs");
    expect(page).toContain("<TabPanel");
  });

  it("counts each tab from the rows actually loaded", () => {
    expect(page).toContain("rows.length");
    expect(page).toContain("workers.length");
    expect(page).toContain("agencies.length");
  });

  it("drives only governed endpoints", () => {
    for (const endpoint of [
      "/api/v1/contractors/reconciliation",
      "/api/v1/contractors/reconciliation/registry",
      "/api/v1/contractors/reconciliation/vendors",
    ]) {
      expect(page, `does not call ${endpoint}`).toContain(endpoint);
    }
    expect(page).toContain("/api/v1/contractors/reconciliation/${encodeURIComponent(row.id)}");
    expect(page).not.toMatch(/Math\.random|placeholder data|faker/i);
  });

  it("summarises the discrepancy from the rows on screen rather than a stored total", () => {
    expect(page).toContain("Invoice discrepancy detected");
    expect(page).toContain("The banner totals are summed from the rows on screen");
    expect(page).toContain("deltaHours += row.deltaHours");
    expect(page).toContain("overBilledMinor += gap");
    // The banner only appears when there are rows carrying a real variance.
    expect(page).toContain("rows.length > 0 && (discrepancy.deltaHours > 0 || discrepancy.overBilledMinor > 0)");
  });

  it("puts vendor billed hours beside gate verified hours", () => {
    for (const label of ["Vendor Billed", "Gate Verified", "Over-billed by"]) {
      expect(page, `missing the ${label} figure`).toContain(label);
    }
    expect(page).toContain("row.deltaHours > 0 ?");
    expect(page).toContain("verdictLabel(row.verdict)");
    expect(page).toContain("<StatusPill");
  });

  it("raises a dispute with a reason and refreshes afterwards", () => {
    expect(page).toContain("Issue Dispute");
    expect(page).toContain("window.prompt");
    expect(page).toContain("postRegisterAction(`/api/v1/contractors/reconciliation/${encodeURIComponent(row.id)}/dispute`, { reason: reason.trim() })");
    expect(page).toContain("refreshAll()");
    expect(page).toContain("<RegisterNotice");
  });

  it("expands the per-worker gate logs from the detail endpoint", () => {
    expect(page).toContain("Inspect ${row.workerCount} worker logs");
    expect(page).toContain("detail.workerLogs");
    expect(page).toContain('aria-expanded={expanded}');
  });

  it("prints money in major units, never a raw minor value", () => {
    expect(page).toContain("Amounts are stored in minor units");
    expect(page).toContain("const value = (Number(amountMinor) || 0) / 100;");
    expect(page).toContain('style: "currency"');
    // Every money figure on screen goes through the same formatter.
    expect(page).toContain("formatMinor(row.billedMinor, row.currency)");
    expect(page).toContain("formatMinor(row.verifiedMinor, row.currency)");
    expect(page).toContain("formatMinor(overBilledMinor, row.currency)");
    expect(page).toContain("formatMinor(discrepancy.overBilledMinor, discrepancy.currency)");
    expect(page).not.toMatch(/\{\s*row\.billedMinor\s*\}|\{\s*row\.verifiedMinor\s*\}/);
  });

  it("covers loading, error and empty states for every tab", () => {
    expect(page).toContain("<RegisterStates");
    for (const state of [
      "Reconciling gate punches against vendor invoices…",
      "Reconciliation unavailable",
      "No contractor invoices to reconcile",
      "Loading the contract worker registry…",
      "Contract worker registry unavailable",
      "No contract workers registered",
      "Loading the staffing vendor master…",
      "Staffing vendor master unavailable",
      "No staffing agencies registered",
    ]) {
      expect(page, `missing the "${state}" state`).toContain(state);
    }
  });

  it("shows headline figures without inventing them", () => {
    for (const label of ["Invoices reconciled", "Gate-verified hours", "Contract workers", "Staffing vendors"]) {
      expect(page, `missing the ${label} stat`).toContain(label);
    }
    expect(page).toContain("<ModuleStat");
    // ModuleStat renders an em dash when a source has not resolved.
    expect(primitives).toContain('{value === null ? "—" : value}');
  });

  it("exposes the header actions", () => {
    expect(page).toContain("Statutory Audit");
    expect(page).toContain('href="/statutory-compliance"');
    expect(page).toContain("Register Contract Worker");
    expect(page).toContain('href="/contractors?section=contractors/assignments"');
  });

  it("says plainly when the gate cannot prove an over-billing", () => {
    expect(page).toContain("No gate-verified hours are tied to this contract's workers for this period");
  });
});
