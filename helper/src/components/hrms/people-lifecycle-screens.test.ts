import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const lifecycle = readFileSync(resolve(process.cwd(), "src/components/hrms/people-lifecycle-registers.tsx"), "utf8");
const org = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
const primitives = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");

const SECTION = "/* ----------------";

/**
 * One screen's whole section: its row types, state constants, tone mapping and
 * the exported page, delimited by the section banners in each register file.
 */
function pageSource(source: string, screenId: string, exportName: string): string {
  const banner = source.indexOf(`(${screenId}) ----`);
  expect(banner, `${screenId} has no section banner`).toBeGreaterThan(-1);
  const start = source.lastIndexOf(SECTION, banner);
  const next = source.indexOf(`\n${SECTION}`, banner);
  const section = next === -1 ? source.slice(start) : source.slice(start, next);
  expect(section, `${exportName} is not exported inside its section`).toContain(`export function ${exportName}`);
  return section;
}

/**
 * Every People & Lifecycle register renders the same governed scaffold: a scoped
 * work queue, a record detail with the screen's state timeline and audit trail,
 * and controlled actions. These assert the screen contract, not the styling.
 */
const screens = [
  {
    name: "SCR-013 Sanctioned strength board",
    source: org,
    exportName: "SanctionedStrengthBoardPage",
    screenId: "SCR-013",
    columns: ["Organisation", "Sanctioned", "Filled", "Open"],
    states: ["Within headroom", "At limit", "Over plan"],
    endpoints: ["/api/v1/organization/sanctioned-strength"],
    actions: ["Set sanctioned strength"],
    emptyTitle: "No sanctioned lines yet",
  },
  {
    name: "SCR-014 Document vault",
    source: lifecycle,
    exportName: "DocumentVaultPage",
    screenId: "SCR-014",
    columns: ["Document", "Employee", "Expiry", "Verification"],
    states: ["pending_verification", "verified", "expired", "replaced"],
    endpoints: ["/api/v1/documents/vault", "/verify"],
    actions: ["Verify document", "Upload document"],
    emptyTitle: "No documents yet",
  },
  {
    name: "SCR-060 Joining chain console",
    source: lifecycle,
    exportName: "JoiningChainConsolePage",
    screenId: "SCR-060",
    columns: ["Joiner", "Readiness", "Owner", "Status"],
    states: ["not_started", "in_progress", "blocked", "ready"],
    endpoints: ["/api/v1/onboarding/joining-chain", "/api/v1/onboarding/tasks/"],
    actions: ["Create joining chain", "Mark complete"],
    emptyTitle: "No joining cases yet",
  },
  {
    name: "SCR-061 Clearance board",
    source: lifecycle,
    exportName: "ClearanceBoardPage",
    screenId: "SCR-061",
    columns: ["Leaver", "Owner", "Blocking", "Status"],
    states: ["open", "cleared", "waived", "held"],
    endpoints: ["/api/v1/offboarding/clearance-board", "/api/v1/offboarding/items/"],
    actions: ["Clear item", "Waive item"],
    emptyTitle: "No clearance items yet",
  },
  {
    name: "SCR-064 Asset register",
    source: lifecycle,
    exportName: "AssetRegisterPage",
    screenId: "SCR-064",
    columns: ["Asset", "Holder", "Condition", "Status"],
    states: ["available", "allocated", "returned", "written_off"],
    endpoints: ["/api/v1/assets/register", "/allocate", "/return"],
    actions: ["Allocate asset", "Record return"],
    emptyTitle: "No assets yet",
  },
  {
    name: "SCR-067 Letters and issue register",
    source: lifecycle,
    exportName: "LettersIssueRegisterPage",
    screenId: "SCR-067",
    columns: ["Letter", "Employee", "Version", "Status"],
    states: ["draft", "pending_approval", "issued", "reissued"],
    endpoints: ["/api/v1/letters/register"],
    actions: ["Issue letter", "Draft letter"],
    emptyTitle: "No letter templates yet",
  },
  {
    name: "SCR-062 Policy acknowledgements",
    source: lifecycle,
    exportName: "PolicyAcknowledgementsPage",
    screenId: "SCR-062",
    columns: ["Policy", "Audience", "Acknowledged", "Status"],
    states: ["published", "pending_acknowledgement", "acknowledged", "overdue"],
    endpoints: ["/api/v1/policy-acknowledgements", "/acknowledge"],
    actions: ["Record acknowledgement", "Publish acknowledgement"],
    emptyTitle: "No published policies",
  },
  {
    name: "SCR-042 Employee home actions",
    source: lifecycle,
    exportName: "EmployeeHomeActionsPage",
    screenId: "SCR-042",
    columns: ["Action", "Context", "Updated", "Status"],
    states: ["available", "queued_offline", "completed", "needs_attention"],
    endpoints: ["/api/v1/home/actions"],
    actions: ["Start employee action"],
    emptyTitle: "Nothing needs your attention",
  },
] as const;

describe.each(screens)("$name", (screen) => {
  const page = pageSource(screen.source, screen.screenId, screen.exportName);

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
    expect(page).not.toMatch(/Math\.random|placeholder data|mock|faker/i);
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

describe("register scaffold", () => {
  it("gives every queue an accessible search, a scope count and a retry", () => {
    expect(primitives).toContain("record(s) in the current scope");
    expect(primitives).toContain("aria-label={searchLabel}");
    expect(primitives).toContain("Try again");
    expect(primitives).toContain("Scoped to your permitted entity, location and reporting line.");
  });

  it("announces loading and failure states to assistive technology", () => {
    expect(primitives).toContain('role="status"');
    expect(primitives).toContain('role="alert"');
  });

  it("never leaves a write action enabled while it is in flight", () => {
    expect(primitives).toContain("disabled={busy}");
  });

  it("surfaces the server's own error message rather than a generic one", () => {
    // The formatting moved into `apiErrorMessage`, which every register now shares
    // instead of each keeping its own copy. The guarantee is unchanged and is
    // asserted on the helper itself in client-api.test.ts: the server's message —
    // and the per-field details behind a 400 — reach the person, and the generic
    // string is only the fallback when the envelope carries nothing.
    expect(primitives).toContain("apiErrorMessage(payload, response.status");
  });
});
