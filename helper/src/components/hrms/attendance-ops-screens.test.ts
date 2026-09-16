import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const registers = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-ops-registers.tsx"), "utf8");

const SECTION = "/* ----------------";

/** One screen's whole section: row type, state constants, tone map and page. */
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
    name: "SCR-024 Overtime register",
    exportName: "OvertimeRegisterPage",
    screenId: "SCR-024",
    columns: ["Employee", "Date", "Overtime", "Run"],
    states: ["pending_approval", "approved", "tagged_to_run", "paid"],
    endpoints: ["/api/v1/overtime/register", "/approve", "/tag-run"],
    headerAction: "Approve overtime",
    actions: ["Approve overtime", "Tag payroll run"],
    emptyTitle: "No overtime recorded",
    emptyHint: "Overtime appears here once the time-office engine credits payable minutes",
  },
  {
    name: "SCR-025 Attendance exception queue",
    exportName: "AttendanceExceptionQueuePage",
    screenId: "SCR-025",
    columns: ["Exception", "Employee", "Age", "Status"],
    states: ["open", "proposed", "resolved", "rejected"],
    endpoints: ["/api/v1/attendance/exceptions/register", "/accept", "/resolve"],
    headerAction: "Accept proposal",
    actions: ["Accept proposal", "Resolve exception"],
    emptyTitle: "No attendance exceptions",
    emptyHint: "Unpaired punches, missing days and device failures appear here as the time-office engine detects them.",
  },
  {
    name: "SCR-026 Attendance recompute monitor",
    exportName: "AttendanceRecomputeMonitorPage",
    screenId: "SCR-026",
    columns: ["Job", "Scope", "Delta", "Status"],
    states: ["queued", "running", "completed", "blocked"],
    endpoints: ["/api/v1/attendance/recompute/register"],
    headerAction: "Queue recompute",
    actions: ["Queue recompute", "Employee scope", "From date", "To date"],
    emptyTitle: "No recompute jobs yet",
    emptyHint: "A recompute is recorded here when one is queued from this console or by the time-office engine.",
  },
  {
    name: "SCR-027 Team history",
    exportName: "TeamHistoryPage",
    screenId: "SCR-027",
    columns: ["Team member", "Attendance", "Leave", "Overtime"],
    states: ["ready", "scheduled", "expired"],
    endpoints: ["/api/v1/reports/team-history/register"],
    headerAction: "Run report",
    actions: ["Run report", "Export history"],
    emptyTitle: "No team history in this range",
    emptyHint: "Widen the date range or clear the search.",
  },
] as const;

describe.each(screens)("$name", (screen) => {
  const page = pageSource(screen.screenId, screen.exportName);

  it("renders the screen id, process guide, scope bar and record detail", () => {
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
    expect(page).not.toMatch(/Math\.random|faker|placeholder data|synthetic/i);
  });

  it("exposes the header action and the controlled actions", () => {
    expect(page, `${screen.exportName} is missing the ${screen.headerAction} header action`).toContain(screen.headerAction);
    for (const action of screen.actions) {
      expect(page, `${screen.exportName} is missing the ${action} action`).toContain(action);
    }
  });

  it("covers loading, error, empty and retry states honestly", () => {
    expect(page).toContain("<RegisterStates");
    expect(page).toContain("loadingLabel");
    expect(page).toContain("errorTitle");
    expect(page).toContain(screen.emptyTitle);
    expect(page, `${screen.exportName} is missing its empty-state hint`).toContain(screen.emptyHint);
  });
});

describe("Attendance Operations registers", () => {
  it("keeps the exception reference and the age in different cells", () => {
    const page = pageSource("SCR-025", "AttendanceExceptionQueuePage");
    const rowStart = page.indexOf("<QueueRow");
    const rowEnd = page.indexOf("</QueueRow>");
    expect(rowStart).toBeGreaterThan(-1);
    expect(rowEnd).toBeGreaterThan(rowStart);
    const cells = page.slice(rowStart, rowEnd).split("<Cell").slice(1);
    const referenceCell = cells.findIndex((cell) => cell.includes("exception_reference"));
    const ageCell = cells.findIndex((cell) => cell.includes("age_days"));
    expect(referenceCell, "the Exception cell must render exception_reference").toBeGreaterThan(-1);
    expect(ageCell, "the Age cell must render age_days").toBeGreaterThan(-1);
    // The reference screen repeats the same id in both columns; this one must not.
    expect(ageCell).not.toBe(referenceCell);
    expect(cells[referenceCell]).not.toContain("age_days");
    expect(cells[ageCell]).not.toContain("exception_reference");
  });

  it("falls back to Not tagged when overtime carries no pay run", () => {
    const page = pageSource("SCR-024", "OvertimeRegisterPage");
    expect(page).toMatch(/row\.pay_run \|\| "Not tagged"/);
  });

  it("sends every change to the server through the audited action helper", () => {
    for (const [screenId, exportName] of [
      ["SCR-024", "OvertimeRegisterPage"],
      ["SCR-025", "AttendanceExceptionQueuePage"],
      ["SCR-026", "AttendanceRecomputeMonitorPage"],
    ] as const) {
      expect(pageSource(screenId, exportName)).toContain("postRegisterAction(");
    }
  });

  it("exports the team history rows on screen rather than refetching them", () => {
    const page = pageSource("SCR-027", "TeamHistoryPage");
    expect(page).toContain("toCsv(");
    expect(page).toContain("downloadCsv(");
    expect(page).toContain("queue.map((row) =>");
  });
});
