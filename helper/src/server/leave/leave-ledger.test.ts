import { describe, expect, it } from "vitest";
import {
  annualLeaveCredit,
  coffExpiryDate,
  joiningPeriodCasualAndSickLeave,
  reconcileEarlyLeaveReturn,
  validateLeaveRequest,
} from "@/lib/hr-rules";
import { APPROVAL_LEVELS } from "./approval-chain";
import { buildLeaveScheme } from "./configuration";
import { PIPELINE_STAGES, buildPipeline } from "./engine-console";
import { foldLedgerBalances } from "./ledger";
import { approvalStepLabel } from "./request-register";
import { yearEndTreatment } from "./scheme";

/**
 * OC-P3-01 / OC-P3-02 / OC-P3-03 — Leave golden fixtures and boundaries.
 *
 * Frozen contracts: Slice 4, WF-LEA ledger rules, OC-P3-01..03 fixtures.
 * Accrual bands, caps, COFF expiry, early return, approval chain and
 * year-end treatment. The leave engine must reproduce every row.
 */

describe("joining-period CL/SL bands (OC-P3-01)", () => {
  it.each([
    [1, 1, 6], [1, 31, 6],
    [2, 10, 5], [3, 31, 5],
    [4, 1, 4], [5, 20, 4],
    [6, 1, 3], [7, 31, 3],
    [8, 5, 2], [9, 30, 2],
    [10, 1, 1], [11, 30, 1],
    [12, 4, 1],
  ])("credits joining %i/%i with %i days", (month, day, expected) => {
    expect(joiningPeriodCasualAndSickLeave(month, day)).toBe(expected);
  });

  it("holds the December 4th cutoff exactly and refuses beyond it", () => {
    expect(joiningPeriodCasualAndSickLeave(12, 4)).toBe(1);
    // Q-02. The source's table stops at "up to 4th Dec - 1 each"; returning 0
    // here was an assumption, and T-14 says the answer must be the client's.
    expect(() => joiningPeriodCasualAndSickLeave(12, 5)).toThrow(/Q-02/);
    expect(() => joiningPeriodCasualAndSickLeave(12, 31)).toThrow(/Q-02/);
  });

  it("credits the client's answer once the table is configured past the cutoff", () => {
    const configured = [...[
      { fromMonth: 1, toMonth: 11, cutoffDay: null, days: 1 },
      { fromMonth: 12, toMonth: 12, cutoffDay: 31, days: 2 },
    ]];
    expect(joiningPeriodCasualAndSickLeave(12, 20, configured)).toBe(2);
  });

  it.each([[0, 1], [13, 1], [1, 0], [1, 32], [6, 99]])("rejects invalid joining date %i/%i", (month, day) => {
    expect(() => joiningPeriodCasualAndSickLeave(month, day)).toThrow("valid calendar");
  });
});

describe("annual credit and six-month EL boundary (OC-P3-01)", () => {
  it("credits AGM+ annual-cycle employees 18 EL, 6 CL, 6 SL with no monthly accrual", () => {
    expect(annualLeaveCredit({ designationLevel: "AGM+", completedSixMonths: true })).toEqual({ EL: 18, CL: 6, SL: 6, monthlyEL: 0 });
  });

  it("accrues 1.5 EL monthly for established below-AGM annual employees", () => {
    expect(annualLeaveCredit({ designationLevel: "below-AGM", completedSixMonths: true })).toEqual({ EL: 0, CL: 6, SL: 6, monthlyEL: 1.5 });
  });

  it("withholds monthly EL before six months of service", () => {
    expect(annualLeaveCredit({ designationLevel: "below-AGM", completedSixMonths: false }).monthlyEL).toBe(0);
  });

  it("releases 9 EL once a mid-year joiner completes six months", () => {
    expect(annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 4, joinDay: 15, completedSixMonths: true }).EL).toBe(9);
    expect(annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 4, joinDay: 15, completedSixMonths: false }).EL).toBe(0);
  });

  it.each([["DET", 5], ["GET", 5]])("grants trainee %s joining Feb with %i CL", (trainee, expected) => {
    const credit = annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 2, joinDay: 10, completedSixMonths: false, traineeType: trainee as "DET" });
    expect(credit.CL).toBe(expected);
  });

  it("withholds CL for non-trainee categories while keeping the SL band", () => {
    const credit = annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 2, joinDay: 10, completedSixMonths: false, traineeType: "other" });
    expect(credit.CL).toBe(0);
    expect(credit.SL).toBe(5);
  });
});

describe("combination and monthly caps (OC-P3-02)", () => {
  it("blocks CL combined with EL", () => {
    expect(validateLeaveRequest({ requestedTypes: ["CL", "EL"], clDaysThisMonth: 1, elDaysThisMonth: 1 }).valid).toBe(false);
  });

  it("blocks CL combined with SL", () => {
    expect(validateLeaveRequest({ requestedTypes: ["CL", "SL"], clDaysThisMonth: 1, elDaysThisMonth: 0 }).valid).toBe(false);
  });

  it("accepts EL-only and SL-only requests inside caps", () => {
    expect(validateLeaveRequest({ requestedTypes: ["EL"], clDaysThisMonth: 0, elDaysThisMonth: 10 }).valid).toBe(true);
    expect(validateLeaveRequest({ requestedTypes: ["SL"], clDaysThisMonth: 0, elDaysThisMonth: 0 }).valid).toBe(true);
  });

  it("holds exactly 2 CL days but rejects the third", () => {
    expect(validateLeaveRequest({ requestedTypes: ["CL"], clDaysThisMonth: 2, elDaysThisMonth: 0 }).valid).toBe(true);
    const over = validateLeaveRequest({ requestedTypes: ["CL"], clDaysThisMonth: 3, elDaysThisMonth: 0 });
    expect(over.valid).toBe(false);
    expect(over.errors.join(" ")).toContain("2 days");
  });

  it("holds exactly 10 EL days but rejects the eleventh", () => {
    expect(validateLeaveRequest({ requestedTypes: ["EL"], clDaysThisMonth: 0, elDaysThisMonth: 10 }).valid).toBe(true);
    const over = validateLeaveRequest({ requestedTypes: ["EL"], clDaysThisMonth: 0, elDaysThisMonth: 11 });
    expect(over.valid).toBe(false);
    expect(over.errors.join(" ")).toContain("10 days");
  });

  it("reports both cap violations together", () => {
    expect(validateLeaveRequest({ requestedTypes: ["EL"], clDaysThisMonth: 3, elDaysThisMonth: 11 }).errors).toHaveLength(2);
  });
});

describe("COFF 60-day expiry (OC-P3-02)", () => {
  it("expires COFF earned 2026-01-01 at the end of 2026-03-02", () => {
    expect(coffExpiryDate(new Date("2026-01-01T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-03-02");
  });

  it("keeps day 60 usable and lapses day 61", () => {
    const expiry = coffExpiryDate(new Date("2026-01-01T00:00:00Z"));
    const day60 = new Date("2026-03-02T00:00:00Z");
    const day61 = new Date("2026-03-03T00:00:00Z");
    expect(day60.getTime() <= expiry.getTime()).toBe(true);
    expect(day61.getTime() <= expiry.getTime()).toBe(false);
  });

  it("rejects an invalid earned-on date", () => {
    expect(() => coffExpiryDate(new Date("invalid"))).toThrow("valid");
  });
});

describe("early return reconciliation (OC-P3-01 demo: 10 approved, 7 taken)", () => {
  it("restores 3 present days and credits 3 leave days for the demo scenario", () => {
    expect(reconcileEarlyLeaveReturn({ approvedDays: 10, actualLeaveDays: 7 })).toEqual({ presentDaysRestored: 3, leaveDaysCreditedBack: 3 });
  });

  it.each([
    [4, 2, 2], [5, 5, 0], [1, 1, 0], [2, 3, 0],
  ])("reconciles approved=%i actual=%i to %i credited back", (approved, actual, expected) => {
    expect(reconcileEarlyLeaveReturn({ approvedDays: approved, actualLeaveDays: actual }).leaveDaysCreditedBack).toBe(expected);
  });

  it("rejects negative day counts", () => {
    expect(() => reconcileEarlyLeaveReturn({ approvedDays: -1, actualLeaveDays: 0 })).toThrow("non-negative");
  });
});

describe("three-stage approval chain and ledger invariants (OC-P3-03)", () => {
  it("walks Supervisor -> HOD -> HR Head in that order, with no fourth step", () => {
    expect([...APPROVAL_LEVELS]).toEqual(["supervisor", "hod", "hr_head"]);
    expect(PIPELINE_STAGES.map(approvalStepLabel)).toEqual(["Pending supervisor", "Pending HOD", "Pending HR"]);
  });

  it("keeps every step in the pipeline even when nothing is waiting on it", () => {
    const pipeline = buildPipeline([{ status: "pending_hod", total: 2 }]);
    expect(pipeline.stages.map((stage) => [stage.stage, stage.count])).toEqual([
      ["pending_supervisor", 0],
      ["pending_hod", 2],
      ["pending_hr", 0],
    ]);
    expect(pipeline.totalPending).toBe(2);
  });

  it("projects the balance from the movements, never from a stored number", () => {
    const balances = foldLedgerBalances([
      { leaveType: "CL", kind: "accrual", days: 6 },
      { leaveType: "EL", kind: "accrual", days: 1.5 },
      { leaveType: "EL", kind: "accrual", days: 1.5 },
      { leaveType: "CL", kind: "debit", days: 2 },
      { leaveType: "EL", kind: "debit", days: 3 },
    ]);
    expect(balances.CL.balance).toBe(4);
    expect(balances.EL.balance).toBe(0);
  });

  it("lapses CL and SL at year end while EL is encashed, from the configured scheme", () => {
    const scheme = buildLeaveScheme([], { seniorGradeRank: 7, coffLapseDayBasis: "calendar" });
    expect(yearEndTreatment(scheme, "EL")).toBe("encash");
    expect(yearEndTreatment(scheme, "CL")).toBe("lapse");
    expect(yearEndTreatment(scheme, "SL")).toBe("lapse");
  });
});
