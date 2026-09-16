import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const registers = readFileSync(resolve(process.cwd(), "src/components/hrms/attendance-punch-registers.tsx"), "utf8");

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
    name: "SCR-020 Check in and check out",
    exportName: "CheckInOutPage",
    screenId: "SCR-020",
    columns: ["Employee", "Punch", "Source", "Status"],
    states: ["queued_offline", "ingested", "computed", "rejected"],
    endpoints: ["/api/v1/attendance/punches/register"],
    actions: ["Record punch"],
    emptyTitle: "No punch events",
  },
  {
    name: "SCR-021 My attendance history",
    exportName: "MyAttendanceHistoryPage",
    screenId: "SCR-021",
    columns: ["Date", "Net hours", "Overtime", "Status"],
    states: ["computed", "exception", "locked"],
    endpoints: ["/api/v1/attendance/days/register", "/api/v1/people?search="],
    actions: ["View history", "Export"],
    emptyTitle: "No attendance days in this range",
  },
  {
    name: "SCR-022 Attendance day detail",
    exportName: "AttendanceDayDetailPage",
    screenId: "SCR-022",
    columns: ["Employee", "Date", "Net hours", "Status"],
    states: ["computed", "exception", "locked"],
    endpoints: ["/api/v1/attendance/days/register"],
    actions: ["Regularise day"],
    emptyTitle: "No attendance days computed",
  },
  {
    name: "SCR-023 Gate pass register",
    exportName: "GatePassRegisterPage",
    screenId: "SCR-023",
    columns: ["Employee", "Date", "Minutes", "Status"],
    states: ["draft", "pending_approval", "approved", "rejected", "credited"],
    endpoints: ["/api/v1/gate-passes/register", "/decide"],
    actions: ["Request gate pass", "Approve", "Reject"],
    emptyTitle: "No gate passes",
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
    expect(page).not.toMatch(/Math\.random|faker|placeholder data|synthetic/i);
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
    expect(page).toContain("emptyHint");
  });
});

describe("Attendance Operations registers", () => {
  it("keeps the punch source and the event reference in different queue cells", () => {
    const page = pageSource("SCR-020", "CheckInOutPage");
    const queueRow = page.slice(page.indexOf("<QueueRow"), page.indexOf("</QueueRow>"));
    const cells = queueRow.split("<Cell").slice(1);
    const referenceIndex = cells.findIndex((cell) => cell.includes("row.event_reference"));
    const sourceIndex = cells.findIndex((cell) => cell.includes("row.source"));
    expect(referenceIndex, "the punch reference is not rendered in the queue").toBeGreaterThan(-1);
    expect(sourceIndex, "the punch source is not rendered in the queue").toBeGreaterThan(-1);
    expect(sourceIndex, "source and reference share a cell").not.toBe(referenceIndex);
    expect(cells[sourceIndex], "the source cell repeats the event reference").not.toContain("event_reference");
  });

  it("filters punches by date and days by employee and range", () => {
    expect(pageSource("SCR-020", "CheckInOutPage")).toContain("&date=");
    const history = pageSource("SCR-021", "MyAttendanceHistoryPage");
    expect(history).toContain("employeeId=");
    expect(history).toContain("from=");
    expect(history).toContain("to=");
    // SCR-022 reads the whole permitted scope, with no employee filter.
    expect(pageSource("SCR-022", "AttendanceDayDetailPage")).not.toContain("employeeId=");
  });

  it("exports exactly the attendance days on screen", () => {
    const history = pageSource("SCR-021", "MyAttendanceHistoryPage");
    expect(history).toContain("toCsv(");
    expect(history).toContain("downloadCsv(");
    expect(history).toContain("There is nothing in the current view to export.");
  });

  it("states plainly when no gate-pass policy is configured", () => {
    const gatePasses = pageSource("SCR-023", "GatePassRegisterPage");
    expect(gatePasses).toContain("No gate-pass policy configured");
    expect(gatePasses).toContain("rejection_note");
    // Decisions go through the shared audited action helper, never local mutation.
    expect(gatePasses).toContain("postRegisterAction(");
  });
});
