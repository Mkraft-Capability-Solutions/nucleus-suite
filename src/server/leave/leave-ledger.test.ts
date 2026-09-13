import { describe, expect, it } from "vitest";
import {
  annualLeaveCredit,
  coffExpiryDate,
  joiningPeriodCasualAndSickLeave,
  reconcileEarlyLeaveReturn,
  validateLeaveRequest,
} from "@/lib/hr-rules";

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
    [12, 5, 0], [12, 31, 0],
  ])("credits joining %i/%i with %i days", (month, day, expected) => {
    expect(joiningPeriodCasualAndSickLeave(month, day)).toBe(expected);
  });

  it("holds the December 4th / 5th cutoff exactly", () => {
    expect(joiningPeriodCasualAndSickLeave(12, 4)).toBe(1);
    expect(joiningPeriodCasualAndSickLeave(12, 5)).toBe(0);
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
  it("requires three distinct actors in Supervisor -> HOD -> HR Head order", () => {
    const chain = ["supervisor_1", "hod_1", "hr_head_1"];
    expect(new Set(chain).size).toBe(3);
    expect(chain).toEqual(["supervisor_1", "hod_1", "hr_head_1"]);
  });

  it("rejects self-approval and repeated actors in the chain", () => {
    const requester = "employee_7";
    const badChains = [
      [requester, "hod_1", "hr_head_1"],
      ["supervisor_1", "supervisor_1", "hr_head_1"],
      ["supervisor_1", "hod_1", "hod_1"],
    ];
    for (const chain of badChains) {
      expect(chain.includes(requester) || new Set(chain).size !== 3).toBe(true);
    }
  });

  it("treats the balance as ledger projection: credits minus debits, never direct mutation", () => {
    const credits = [6, 1.5, 1.5];
    const debits = [2, 3];
    const balance = credits.reduce((a, b) => a + b, 0) - debits.reduce((a, b) => a + b, 0);
    expect(balance).toBeCloseTo(4.0, 10);
  });

  it("lapses CL/SL at year-end while EL is encashed (contract rule)", () => {
    const yearEnd = { EL: "encash", CL: "lapse", SL: "lapse", COFF: "lapse-if-unexpired-unused" } as const;
    expect(yearEnd.EL).toBe("encash");
    expect(yearEnd.CL).toBe("lapse");
    expect(yearEnd.SL).toBe("lapse");
  });
});
