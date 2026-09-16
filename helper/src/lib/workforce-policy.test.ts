import { describe, expect, it } from "vitest";
import {
  gatePassAdmissible,
  gatePassAllowance,
  holidayMultiplierFor,
  isGraceExempt,
  resolveWorkforcePolicy,
  workforcePolicyDefaults,
} from "./workforce-policy";

describe("workforce policy defaults", () => {
  it("carries the statutory and company rules the workforce surfaces depend on", () => {
    expect(workforcePolicyDefaults.gatePass.monthlyCeilingMinutes).toBe(240);
    expect(workforcePolicyDefaults.gatePass.maxRequestsPerMonth).toBe(2);
    expect(workforcePolicyDefaults.lateness.graceMinutes).toBe(15);
    expect(workforcePolicyDefaults.lateness.forgivenInstancesPerMonth).toBe(3);
    expect(workforcePolicyDefaults.lateness.penalty).toBe("half_day");
    expect(workforcePolicyDefaults.loan.ceilingMultipleOfBasic).toBe(4);
    expect(workforcePolicyDefaults.loan.requiredGuarantors).toBe(2);
    expect(workforcePolicyDefaults.loan.maxActiveLoansPerEmployee).toBe(1);
    expect(workforcePolicyDefaults.settlement.gratuityEligibilityYears).toBe(4.8);
    expect(workforcePolicyDefaults.settlement.gratuityDaysPerYear).toBe(15);
    expect(workforcePolicyDefaults.settlement.gratuityDivisor).toBe(26);
    expect(workforcePolicyDefaults.overtime.hourlyRateDivisor).toBe(208);
    expect(workforcePolicyDefaults.earnedWage.maxEarnedPercent).toBe(50);
  });
});

describe("resolveWorkforcePolicy", () => {
  it("returns the defaults when there are no tenant overrides", () => {
    expect(resolveWorkforcePolicy(null)).toBe(workforcePolicyDefaults);
    expect(resolveWorkforcePolicy(undefined)).toBe(workforcePolicyDefaults);
  });

  it("overrides a single value without restating the rest of its section", () => {
    const policy = resolveWorkforcePolicy({ gatePass: { monthlyCeilingMinutes: 300 } });
    expect(policy.gatePass.monthlyCeilingMinutes).toBe(300);
    expect(policy.gatePass.maxRequestsPerMonth).toBe(2);
    expect(policy.gatePass.creditsNetAttendance).toBe(true);
  });

  it("leaves untouched sections at their defaults", () => {
    const policy = resolveWorkforcePolicy({ loan: { ceilingMultipleOfBasic: 6 } });
    expect(policy.loan.ceilingMultipleOfBasic).toBe(6);
    expect(policy.loan.requiredGuarantors).toBe(2);
    expect(policy.lateness).toEqual(workforcePolicyDefaults.lateness);
  });
});

describe("gatePassAllowance", () => {
  it("reports the remaining minutes and requests", () => {
    expect(gatePassAllowance(60, 1)).toEqual({ remainingMinutes: 180, remainingRequests: 1, exhausted: false });
  });

  it("is exhausted once the minute ceiling is consumed", () => {
    expect(gatePassAllowance(240, 1).exhausted).toBe(true);
  });

  it("is exhausted once the request limit is consumed, even with minutes left", () => {
    const allowance = gatePassAllowance(30, 2);
    expect(allowance.remainingMinutes).toBe(210);
    expect(allowance.exhausted).toBe(true);
  });

  it("never reports a negative remainder", () => {
    expect(gatePassAllowance(400, 5)).toEqual({ remainingMinutes: 0, remainingRequests: 0, exhausted: true });
  });
});

describe("gatePassAdmissible", () => {
  it("admits a request inside both limits", () => {
    expect(gatePassAdmissible(60, 1, 45).admissible).toBe(true);
  });

  it("admits a request landing exactly on the ceiling", () => {
    expect(gatePassAdmissible(180, 1, 60).admissible).toBe(true);
  });

  it("rejects a request that would cross the ceiling, and says by how much", () => {
    const result = gatePassAdmissible(180, 1, 90);
    expect(result.admissible).toBe(false);
    expect(result.reason).toContain("30 minutes");
  });

  it("checks the request count before the minute ceiling", () => {
    const result = gatePassAdmissible(0, 2, 15);
    expect(result.admissible).toBe(false);
    expect(result.reason).toContain("2 gate passes");
  });

  it("honours a tenant override of the ceiling", () => {
    expect(gatePassAdmissible(240, 1, 60, { monthlyCeilingMinutes: 360, maxRequestsPerMonth: 4, creditsNetAttendance: true }).admissible).toBe(true);
  });
});

describe("holidayMultiplierFor", () => {
  it("pays the full statutory rate on national, state and festival closures", () => {
    expect(holidayMultiplierFor("national")).toBe(2);
    expect(holidayMultiplierFor("state")).toBe(2);
    expect(holidayMultiplierFor("festival")).toBe(2);
  });

  it("treats an optional holiday as an ordinary working day", () => {
    expect(holidayMultiplierFor("optional")).toBe(1);
  });

  it("falls back to the statutory rate for an unrecognised type rather than underpaying", () => {
    expect(holidayMultiplierFor("something-new")).toBe(2);
    expect(holidayMultiplierFor("")).toBe(2);
  });

  it("honours a tenant override of a single holiday type", () => {
    const policy = resolveWorkforcePolicy({
      holiday: { multiplierByHolidayType: { national: 2, state: 2, festival: 1.5, optional: 1 } },
    });
    expect(holidayMultiplierFor("festival", policy.holiday)).toBe(1.5);
    expect(holidayMultiplierFor("national", policy.holiday)).toBe(2);
    expect(policy.holiday.statutoryHolidayMultiplier).toBe(2);
  });
});

describe("isGraceExempt", () => {
  it("matches an exempt designation regardless of case and padding", () => {
    expect(isGraceExempt("Assistant Manager")).toBe(true);
    expect(isGraceExempt("  assistant manager  ")).toBe(true);
  });

  it("does not exempt a title that merely contains an exempt word", () => {
    expect(isGraceExempt("Manager Trainee")).toBe(false);
    expect(isGraceExempt("Assistant Manager Support")).toBe(false);
    expect(isGraceExempt("Deputy Manager")).toBe(false);
  });

  it("does not exempt an ordinary designation", () => {
    expect(isGraceExempt("Line Assembler")).toBe(false);
    expect(isGraceExempt("Senior Developer")).toBe(false);
  });
});
