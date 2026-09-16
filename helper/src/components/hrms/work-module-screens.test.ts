import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/hrms/work-pages.tsx"), "utf8");
const primitives = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");

/** The shared rule-pack banner both consoles render above their tabs. */
const banner = source.slice(source.indexOf("function EngineBanner"), source.indexOf("const ATTENDANCE_TABS"));
const attendance = source.slice(
  source.indexOf("const ATTENDANCE_TABS"),
  source.indexOf("/* Leave — Leave & Accrual Engine console"),
);
const leave = source.slice(source.indexOf("const LEAVE_TABS"), source.indexOf("/* Payroll — live runs"));

describe("Leave & Time-Office Engine", () => {
  it("names the engine console and what it governs", () => {
    expect(attendance).toContain("Leave & Time-Office Engine");
    expect(attendance).toContain(
      "Cross midnight punch pairing, break exceptions, gate-pass quota validation, and multi-plant category rules.",
    );
  });

  it("renders the four engine tabs in the module shell", () => {
    for (const label of [
      "Monthly Timesheet & Calendar",
      "Gate Pass Quota & Ledger",
      "Time-Office Recompute Ledger",
      "Worker Categories & Plant Calendars",
    ]) {
      expect(attendance, `missing the ${label} tab`).toContain(label);
    }
    expect(attendance).toContain("<ModuleTabs");
    expect(attendance).toContain("<TabPanel");
  });

  it("renders the rule-pack banner and the three engine stats", () => {
    expect(attendance).toContain("<EngineBanner");
    expect(attendance).toContain("Attendance rule pack");
    for (const label of ["Current Session", "Active Shift Assignment", "Monthly Gate Pass Quota"]) {
      expect(attendance, `missing the ${label} card`).toContain(label);
    }
    expect(attendance).toContain("<ModuleStat");
    // ModuleStat renders an em dash rather than a fake zero while a source is loading.
    expect(primitives).toContain('{value === null ? "—" : value}');
  });

  it("drives only the governed attendance endpoints", () => {
    for (const endpoint of [
      "/api/v1/attendance/engine?year=",
      "/api/v1/attendance/session?employeeId=",
      "/api/v1/attendance/timesheet?employeeId=",
      "/api/v1/attendance/anomalies?limit=20",
      "/api/v1/attendance/team-summary?from=",
      "/api/v1/attendance/days?employeeId=",
      "/api/v1/attendance/punches",
      "/api/v1/regularizations",
    ]) {
      expect(attendance, `does not call ${endpoint}`).toContain(endpoint);
    }
    // The employee select is fed by the shared people hook in this module.
    expect(source).toContain("/api/v1/people?search=&page=1&pageSize=100");
    expect(attendance).toContain("usePeople()");
  });

  it("draws a real month grid with navigation and honest blank days", () => {
    expect(source).toContain(
      'const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;',
    );
    expect(attendance).toContain("WEEKDAY_LABELS.map");
    expect(attendance).toContain("grid-cols-7");
    expect(attendance).toContain("monthGrid.blanks");
    expect(attendance).toContain("shiftPeriod");
    expect(attendance).toContain('aria-label="Previous month"');
    expect(attendance).toContain('aria-label="Next month"');
    // A day with no record reads as empty, never as an absence.
    expect(attendance).toContain('const recorded = status !== "not_recorded"');
    expect(attendance).toContain("Not recorded");
  });

  it("keeps the recompute ledger, punch and regularization workflows", () => {
    for (const kept of [
      "Team scope & range",
      "Record Punches",
      "Request Regularization",
      "Day Rows",
      "Record punch in/out",
      "Submit regularization",
    ]) {
      expect(attendance, `dropped the ${kept} feature`).toContain(kept);
    }
  });

  it("surfaces worker categories and plant calendars from the engine", () => {
    for (const column of [
      "Wage type",
      "Rest day pattern",
      "OT eligibility",
      "Leave eligible",
      "Statutory set",
    ]) {
      expect(attendance, `missing the ${column} column`).toContain(column);
    }
    expect(attendance).toContain("Plant calendars");
    expect(attendance).toContain("holidayCount");
  });

  it("flags anomalies only when the engine reported some", () => {
    expect(attendance).toContain("potential anomalies flagged for HR review");
    expect(attendance).toContain("anomalies.length === 0 ? null");
  });

  it("covers loading, error and empty states without inventing figures", () => {
    expect(attendance).toContain("<RegisterStates");
    expect(attendance).toContain("<RegisterNotice");
    expect(attendance).toContain("Loading the monthly timesheet…");
    expect(attendance).toContain("Timesheet unavailable");
    expect(attendance).toContain("No calendar days for this period");
    expect(attendance).toContain("Engine configuration unavailable");
    expect(attendance).toContain("No worker categories or plant calendars configured");
    expect(attendance).not.toMatch(/Math\.random|faker|placeholder data/i);
  });

  it("states plainly when a source has nothing configured", () => {
    expect(attendance).toContain("Not checked in");
    expect(attendance).toContain("No shift assigned");
    expect(attendance).toContain("No gate-pass policy configured");
  });
});

describe("Leave & Accrual Engine", () => {
  it("names the engine console and what it governs", () => {
    expect(leave).toContain("Leave & Accrual Engine");
    expect(leave).toContain(
      "3 level approval workflows, comp off 60-day auto-lapse clocks, sandwich rule logic, and early return re-credit ledger.",
    );
  });

  it("renders the five engine tabs in the module shell", () => {
    for (const label of [
      "Balances & Apply Leave",
      "3-Level Approval Pipeline",
      "Comp-Off 60-Day Expiry Clock",
      "Early Return Re-Credit",
      "Band Rules & Sandwich Matrix",
    ]) {
      expect(leave, `missing the ${label} tab`).toContain(label);
    }
    expect(leave).toContain("<ModuleTabs");
    expect(leave).toContain("<TabPanel");
  });

  it("renders the rule-pack banner from the engine endpoint", () => {
    expect(leave).toContain("<EngineBanner");
    expect(leave).toContain("Leave rule pack");
  });

  it("drives only the governed leave endpoints", () => {
    for (const endpoint of [
      "/api/v1/leave/engine",
      "/api/v1/leave/comp-off-clock",
      "/api/v1/leave/early-returns",
      "/api/v1/leave/balance-cards?employeeId=",
      "/api/v1/leave-requests?page=1&pageSize=100",
      "/api/v1/leave-requests",
      "/decide",
    ]) {
      expect(leave, `does not call ${endpoint}`).toContain(endpoint);
    }
    // The consequential POST still carries its idempotency key via the shared helper.
    expect(source).toContain('headers["Idempotency-Key"] = crypto.randomUUID()');
    expect(leave).toContain('href="/leave-requests"');
  });

  it("drives the balance cards off the endpoint instead of a fixed key list", () => {
    expect(leave).toContain("balanceCards.map");
    expect(leave).toContain("accrualNote");
    expect(leave).toContain("allocated");
    expect(leave).not.toContain('["EL", "CL", "SL", "COFF"]');
    expect(leave).not.toContain('["EL","CL","SL","COFF"]');
  });

  it("keeps the apply-for-leave form and the approval desk working", () => {
    for (const kept of ["Request Leave", "Submit request", "Approval Desk", "Approve", "Reject"]) {
      expect(leave, `dropped the ${kept} feature`).toContain(kept);
    }
  });

  it("steps the three-level pipeline out of the engine payload", () => {
    expect(leave).toContain("pipelineStages");
    expect(leave).toContain("totalPending");
    expect(leave).toContain("Approval chain");
    expect(leave).toContain("waiting");
  });

  it("reads the comp-off clock honestly in both directions", () => {
    for (const column of ["Credit id", "Earned on", "Expires on", "Days remaining", "Days to expiry"]) {
      expect(leave, `missing the ${column} column`).toContain(column);
    }
    expect(leave).toContain("compOffTone");
    expect(source).toContain("Expired ${String(Math.abs(daysToExpiry))} days ago");
    expect(source).toContain('if (status === "lapsed") return "danger"');
  });

  it("renders the sandwich matrix from cannotCombineWith", () => {
    for (const column of ["Policy", "Band", "Annual days", "Frequency", "Credit date", "Cannot combine with"]) {
      expect(leave, `missing the ${column} column`).toContain(column);
    }
    expect(leave).toContain("stringList(rule.cannotCombineWith)");
    expect(leave).toContain("No combination restriction");
  });

  it("covers loading, error and empty states without inventing figures", () => {
    expect(leave).toContain("<RegisterStates");
    expect(leave).toContain("<RegisterNotice");
    expect(leave).toContain("Loading the comp-off expiry clock…");
    expect(leave).toContain("Comp-off clock unavailable");
    expect(leave).toContain("No comp-off grants on record");
    expect(leave).toContain("Leave balances unavailable");
    // Early returns are empty in live data, so the empty state is the normal render.
    expect(leave).toContain("Loading early return re-credits…");
    expect(leave).toContain("Early return ledger unavailable");
    expect(leave).toContain("No early return has been recorded yet");
    expect(leave).toContain(
      "When an employee comes back before their approved end date, the unused days are re-credited here.",
    );
    expect(leave).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});

describe("shared rule-pack banner", () => {
  it("says so rather than inventing rule text when no pack is configured", () => {
    expect(banner).toContain("missingText");
    expect(banner).toContain("stringList(engine.rules)");
    expect(banner).toContain("This pack stores no readable rule lines, so none are shown.");
    expect(attendance).toContain("No attendance rule pack is configured");
    expect(leave).toContain("No leave rule pack is configured");
    expect(banner).not.toMatch(/Math\.random|faker|placeholder data/i);
  });
});
