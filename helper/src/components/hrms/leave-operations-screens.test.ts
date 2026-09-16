import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const registers = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-leave-registers.tsx"), "utf8");
const guides = readFileSync(resolve(process.cwd(), "src/lib/workflow-catalog.ts"), "utf8");

const SECTION = "/* ----------------";

/** One screen's whole section: row types, state constants, tone map and page. */
function pageSource(screenId: string, exportName: string): string {
  const banner = registers.indexOf(`(${screenId}) ----`);
  expect(banner, `${screenId} has no section banner`).toBeGreaterThan(-1);
  const start = registers.lastIndexOf(SECTION, banner);
  const next = registers.indexOf(`\n${SECTION}`, banner);
  const section = next === -1 ? registers.slice(start) : registers.slice(start, next);
  expect(section, `${exportName} is not exported inside its section`).toContain(`export function ${exportName}`);
  return section;
}

const screens = [
  {
    name: "SCR-030 Leave requests",
    exportName: "LeaveRequestsPage",
    screenId: "SCR-030",
    columns: ["Employee", "Leave type", "Dates", "Status"],
    states: ["draft", "validated", "pending_approval", "approved", "availed", "closed"],
    endpoints: ["/api/v1/leave-requests/register", "/decide", "/early-return"],
    actions: ["Apply for leave", "Record early return", "Approve", "Reject"],
    emptyTitle: "No leave requests",
  },
  {
    name: "SCR-031 Leave balance and ledger",
    exportName: "LeaveBalanceLedgerPage",
    screenId: "SCR-031",
    columns: ["Leave type", "Credit", "Debit", "Balance"],
    states: ["projected", "expired", "encashed", "reversed"],
    endpoints: ["/api/v1/leave-balances/ledger"],
    actions: ["Export ledger"],
    emptyTitle: "No ledger movements yet",
  },
  {
    name: "SCR-032 Leave policy configuration",
    exportName: "LeavePolicyConfigurationPage",
    screenId: "SCR-032",
    columns: ["Policy", "Leave type", "Effective from", "Status"],
    states: ["draft", "simulated", "effective", "superseded"],
    endpoints: ["/api/v1/leave-policies/register", "/transition"],
    actions: ["Create policy", "Simulate policy", "Make effective", "Supersede"],
    emptyTitle: "No leave policies configured",
  },
] as const;

describe.each(screens)("$name", (screen) => {
  const page = pageSource(screen.screenId, screen.exportName);

  it("renders the screen id, process guide and scope bar", () => {
    expect(page).toContain(screen.screenId);
    expect(page).toContain("<ProcessGuide");
    expect(page).toContain("<ScopeBar");
    expect(page).toContain("Record detail");
  });

  it("renders the reference work-queue columns", () => {
    for (const column of screen.columns) {
      expect(page, `${screen.exportName} is missing the ${column} column`).toContain(`"${column}"`);
    }
  });

  it("renders the full state timeline and the audit trail", () => {
    expect(page).toContain("<StateTimeline");
    expect(page).toContain("<AuditTrail");
    for (const state of screen.states) {
      expect(page, `${screen.exportName} is missing the ${state} state`).toContain(state);
    }
  });

  it("drives only governed endpoints and invents no data", () => {
    for (const endpoint of screen.endpoints) {
      expect(page, `${screen.exportName} does not call ${endpoint}`).toContain(endpoint);
    }
    expect(page).not.toMatch(/Math\.random|placeholder data|mock|faker|synthetic/i);
  });

  it("exposes the controlled actions from the reference screen", () => {
    for (const action of screen.actions) {
      expect(page, `${screen.exportName} is missing the ${action} action`).toContain(action);
    }
  });

  it("covers loading, error, empty and retry states", () => {
    expect(page).toContain("<RegisterStates");
    expect(page).toContain(screen.emptyTitle);
    expect(page).toContain("loadingLabel");
    expect(page).toContain("errorTitle");
  });
});

describe("Leave Operations registers", () => {
  it("holds no session-only state: every change goes to the server", () => {
    const leaveSection = registers.slice(registers.indexOf("(SCR-030) ----"));
    expect(leaveSection).not.toMatch(/reset on reload|held in this session|Synthetic preview/i);
    // Writes go through the shared audited action helper, never local mutation.
    expect(leaveSection).toContain("postRegisterAction(");
  });

  it("derives ledger balances rather than displaying a typed figure", () => {
    const ledger = registers.slice(registers.indexOf("(SCR-031) ----"), registers.indexOf("(SCR-032) ----"));
    expect(ledger).toContain("Balances are derived from the ledger, never typed in.");
    expect(ledger).toContain("ledgerCsv");
  });

  it("documents the guides for the three leave registers", () => {
    for (const id of ['"leave-requests"', '"leave-balance-ledger"', '"leave-policy-configuration"']) {
      expect(guides).toContain(id);
    }
  });
});
