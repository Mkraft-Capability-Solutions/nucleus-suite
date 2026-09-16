import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  cancelAvailability,
  canCancelLeave,
  isCancellableStatus,
  LEAVE_CANCEL_REASON_MIN,
} from "./leave-cancellation";
import { isAnswerable, scalePoints, unansweredQuestions, type SurveyRun } from "./survey-answer-panel";
import { canAccessNavigationItem, navigationCatalog } from "@/lib/navigation-catalog";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const workPages = read("src/components/hrms/work-pages.tsx");
const experience = read("src/components/hrms/employee-experience-page.tsx");
const surveyPanel = read("src/components/hrms/survey-answer-panel.tsx");
const leaveService = read("src/server/leave/service.ts");
const payslipService = read("src/server/payroll/payslips.ts");

const ME = "11111111-1111-4111-8111-111111111111";
const SOMEBODY_ELSE = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-09-15";

function request(overrides: Partial<Parameters<typeof cancelAvailability>[0]> = {}) {
  return {
    status: "approved",
    startsOn: "2026-09-20",
    employeeId: ME,
    viewerEmployeeId: ME as string | null,
    today: TODAY,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* 1 · Comp-off claims post to the employee-initiated route            */
/* ------------------------------------------------------------------ */

describe("comp-off claim routing", () => {
  it("posts the employee's claim to the claims route, not the HR grant route", () => {
    expect(workPages).toContain('postJson("/api/v1/coff-grants/claims"');
    // The grant route enforces attendance.write; nothing employee-facing may target it.
    expect(workPages).not.toContain('postJson("/api/v1/coff-grants"');
  });

  it("targets the route that exposes claimCoff, whose self-claim needs only leave.read", () => {
    const claimsRoute = read("src/app/api/v1/coff-grants/claims/route.ts");
    expect(claimsRoute).toContain("claimCoff");
    const claim = leaveService.slice(leaveService.indexOf("export async function claimCoff"));
    expect(claim.slice(0, 600)).toContain('enforce(access.context, "leave.read"');
  });

  it("does not claim the balance was credited: a claim is pending until decided", () => {
    expect(workPages).toContain("Nothing is credited until an approver decides it.");
    expect(workPages).not.toContain("Compensatory off credited to the leave ledger.");
  });
});

/* ------------------------------------------------------------------ */
/* 2 · Which leave requests may offer a Cancel action                  */
/* ------------------------------------------------------------------ */

describe("leave cancellation availability", () => {
  it("offers withdrawal on a future-dated approved request of the viewer's own", () => {
    expect(canCancelLeave(request())).toBe(true);
  });

  it.each(["draft", "validated", "pending_approval", "pending", "approved", "availed"])(
    "offers withdrawal for status %s, which cancelLeave still acts on",
    (status) => {
      expect(cancelAvailability(request({ status }))).toEqual({ offer: true });
    },
  );

  it.each(["cancelled", "rejected", "CANCELLED", " Rejected "])(
    "withholds withdrawal for the terminal status %s, which cancelLeave refuses with 409",
    (status) => {
      expect(cancelAvailability(request({ status }))).toEqual({ offer: false, reason: "terminal-status" });
    },
  );

  it("withholds withdrawal on somebody else's request", () => {
    expect(cancelAvailability(request({ employeeId: SOMEBODY_ELSE }))).toEqual({
      offer: false,
      reason: "not-applicant",
    });
  });

  it("withholds withdrawal when the session is not linked to an employee", () => {
    expect(cancelAvailability(request({ viewerEmployeeId: null }))).toEqual({
      offer: false,
      reason: "not-applicant",
    });
    expect(cancelAvailability(request({ viewerEmployeeId: "" }))).toEqual({
      offer: false,
      reason: "not-applicant",
    });
  });

  it.each(["2026-09-15", "2026-09-14", "2025-01-01"])(
    "withholds withdrawal once the absence has begun on %s",
    (startsOn) => {
      expect(cancelAvailability(request({ startsOn }))).toEqual({ offer: false, reason: "already-begun" });
    },
  );

  it("offers withdrawal from the day after today onward", () => {
    expect(canCancelLeave(request({ startsOn: "2026-09-16" }))).toBe(true);
  });

  it("withholds withdrawal when the start date is unusable", () => {
    expect(cancelAvailability(request({ startsOn: "—" }))).toEqual({ offer: false, reason: "unknown-start-date" });
  });

  it("treats an empty status as not cancellable rather than guessing", () => {
    expect(isCancellableStatus("")).toBe(false);
    expect(isCancellableStatus("   ")).toBe(false);
  });

  it("matches cancelLeave: approved is cancellable and only cancelled/rejected are refused", () => {
    const service = leaveService.slice(leaveService.indexOf("export async function cancelLeave"));
    expect(service).toContain('["cancelled", "rejected"].includes(request.status)');
    expect(service).toContain("request.starts_on <= today");
    expect(leaveService).toContain("reason: z.string().trim().min(10).max(300)");
    expect(LEAVE_CANCEL_REASON_MIN).toBe(10);
  });
});

describe("leave cancellation wiring", () => {
  it("sends Idempotency-Key and an If-Match when the record carries a version", () => {
    expect(workPages).toContain("/cancel");
    expect(workPages).toContain('headers["Idempotency-Key"]');
    expect(workPages).toContain('headers["If-Match"]');
    expect(workPages).toContain("request.version === null ? undefined : { version: request.version }");
  });

  it("surfaces the refusal in a role=alert region and the success in role=status", () => {
    expect(workPages).toContain('role="alert"');
    expect(workPages).toContain('role="status"');
  });

  it("enforces the reason floor before spending a request", () => {
    expect(workPages).toContain("LEAVE_CANCEL_REASON_MIN");
  });

  it("gives the withdrawal controls a 40px touch target", () => {
    const controls = workPages.slice(
      workPages.indexOf("function cancelControls"),
      workPages.indexOf("function decisionButtons"),
    );
    expect(controls).not.toContain("h-8");
    expect(controls.match(/h-10/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });
});

/* ------------------------------------------------------------------ */
/* 3 · Pulse survey answering                                          */
/* ------------------------------------------------------------------ */

const run: SurveyRun = {
  id: "33333333-3333-4333-8333-333333333333",
  code: "PULSE-Q3",
  title: "Quarterly pulse",
  audience: "all",
  questions: [
    { key: "clarity", text: "I know what is expected of me.", scale: 5 },
    { key: "support", text: "I get the support I need.", scale: 7 },
  ],
};

describe("survey answering", () => {
  it("reports every unanswered question rather than sending a partial response", () => {
    expect(unansweredQuestions(run, {}).map((q) => q.key)).toEqual(["clarity", "support"]);
    expect(unansweredQuestions(run, { clarity: 4 }).map((q) => q.key)).toEqual(["support"]);
    expect(unansweredQuestions(run, { clarity: 4, support: 6 })).toEqual([]);
  });

  it("rejects values outside the question's own scale", () => {
    expect(unansweredQuestions(run, { clarity: 6, support: 6 }).map((q) => q.key)).toEqual(["clarity"]);
    expect(unansweredQuestions(run, { clarity: 0, support: 6 }).map((q) => q.key)).toEqual(["clarity"]);
    expect(unansweredQuestions(run, { clarity: 2.5, support: 6 }).map((q) => q.key)).toEqual(["clarity"]);
    expect(unansweredQuestions(run, { clarity: 5, support: 8 }).map((q) => q.key)).toEqual(["support"]);
  });

  it("derives the scale from the run instead of a hard-coded 1-5", () => {
    expect(scalePoints(5)).toEqual([1, 2, 3, 4, 5]);
    expect(scalePoints(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(scalePoints(10)).toHaveLength(10);
    // Out-of-contract values fall back to the schema's own default of 5.
    expect(scalePoints(0)).toEqual([1, 2, 3, 4, 5]);
    expect(scalePoints(99)).toEqual([1, 2, 3, 4, 5]);
    expect(scalePoints(Number.NaN)).toEqual([1, 2, 3, 4, 5]);
  });

  it("treats a run with no questions as unanswerable rather than inventing questions", () => {
    expect(isAnswerable(run)).toBe(true);
    expect(isAnswerable({ ...run, questions: [] })).toBe(false);
    expect(surveyPanel).not.toMatch(/const (SAMPLE|DEMO|FIXTURE|PLACEHOLDER)_QUESTIONS/);
  });

  it("renders an honest empty state when nothing is open", () => {
    expect(surveyPanel).toContain("No survey is open right now");
  });

  it("states the anonymity default in the copy, because it changes how people answer", () => {
    expect(surveyPanel).toContain("Anonymous by default");
    expect(surveyPanel).toContain("useState(true)");
    expect(surveyPanel).toContain("anonymous");
  });

  it("posts to the existing endpoint with an Idempotency-Key", () => {
    expect(surveyPanel).toContain('"/api/v1/survey-responses"');
    expect(surveyPanel).toContain('"Idempotency-Key"');
  });

  it("uses role=alert for refusals and role=status for the confirmation", () => {
    expect(surveyPanel).toContain('role="alert"');
    expect(surveyPanel).toContain('role="status"');
  });

  it("sits alongside the wellbeing check-in without replacing it", () => {
    expect(experience).toContain("<SurveyAnswerPanel />");
    expect(experience).toContain("<WellbeingTab revision={revision} refresh={refresh} />");
  });

  it("reads the run list through a permission an employee actually holds", () => {
    const route = read("src/app/api/v1/survey-runs/route.ts");
    expect(route).toContain("listOpenSurveyRuns");
    const service = read("src/server/engagement/service.ts");
    const listing = service.slice(service.indexOf("export async function listOpenSurveyRuns"));
    expect(listing.slice(0, 400)).toContain('enforce(access.context, "employee.read"');
  });
});

/* ------------------------------------------------------------------ */
/* 4 · Payslips reachable by the employee whose payslips they are      */
/* ------------------------------------------------------------------ */

describe("payslips navigation", () => {
  const payslips = navigationCatalog.find((item) => item.id === "payslips");

  it("is in the catalog", () => {
    expect(payslips).toBeDefined();
  });

  it("only opens the nav because the service self-scopes a caller without payroll.read", () => {
    expect(payslipService).toContain('return permissions.includes("payroll.read") ? "all" : "self";');
    expect(payslipService).toContain('const employeeFilter = scope === "self" ? selfEmployeeId : filters.employeeId;');
    expect(payslipService).toContain('if (scope === "self" && row.employee_id !== selfEmployeeId)');
    // No employee link means refused, not unscoped.
    expect(payslipService).toContain('code: "EMPLOYEE_LINK_REQUIRED"');
  });

  it("lets an employee holding only employee.read reach their own payslips", () => {
    expect(canAccessNavigationItem(payslips!, ["employee.read"], ["employee"])).toBe(true);
  });

  it("still admits a payroll reader", () => {
    expect(canAccessNavigationItem(payslips!, ["payroll.read"], ["payroll_admin"])).toBe(true);
  });

  it("does not admit a principal holding neither permission", () => {
    expect(canAccessNavigationItem(payslips!, ["attendance.read"], [])).toBe(false);
  });

  // The catalogue moved from a denylist to an allowlist: an unset `audience`
  // used to mean "everyone" and now means "administrators only". The intent of
  // this assertion is unchanged — payslips must be reachable by both personas —
  // so it now reads the explicit mark that carries that meaning, and proves it
  // by behaviour on both sides rather than by the field alone.
  it("stays visible to both audiences rather than being pinned to one", () => {
    expect(payslips!.audience).toBe("both");
    expect(canAccessNavigationItem(payslips!, ["employee.read"], ["employee"])).toBe(true);
    expect(canAccessNavigationItem(payslips!, ["payroll.read", "tenant.manage"], ["owner"])).toBe(true);
  });
});
