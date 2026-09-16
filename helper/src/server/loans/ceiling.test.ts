import { describe, expect, it } from "vitest";
import { applyLoanSchema, LOAN_DIRECTOR_PERMISSION } from "@/server/loans/service";
import { rulePack } from "@/server/payroll/rule-pack";
import { CEILING_SERVICE_BASIS_NOTE, completedServiceYears, resolveLoanCeiling } from "./ceiling";

/**
 * T-21 / RL-22 — the loan ceiling, its boundary, and the special-terms route that
 * makes an over-ceiling application recordable at all.
 */

describe("resolveLoanCeiling (RL-22)", () => {
  // The workbook's own worked example: basic 40,000 with six years gives 240,000.
  const basicSalaryMinor = 40_000_00;

  it("gives four times basic below the service band", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 4 })).toMatchObject({
      maximumMinor: 160_000_00,
      multiple: 4,
      higherApplied: false,
    });
  });

  it("gives six times basic at six years", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 6 })).toMatchObject({
      maximumMinor: 240_000_00,
      multiple: 6,
      higherApplied: true,
    });
  });

  it('applies the higher multiple at exactly five years, because RL-22 reads "five years or more"', () => {
    // The band is inclusive at its boundary, which is the only reading of "or more".
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 5 }).multiple).toBe(6);
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 4.999 }).multiple).toBe(4);
  });

  it("takes both multiples and the band from the rule pack, not from code", () => {
    const loans = rulePack().loans;
    expect(loans.ceilingMultipleOfBasic).toEqual({ standard: 4, higher: 6 });
    expect(loans.higherCeilingServiceYears).toBe(5);
    const ceiling = resolveLoanCeiling({ basicSalaryMinor, serviceYears: 10 });
    expect(ceiling.standardMultiple).toBe(loans.ceilingMultipleOfBasic?.standard);
    expect(ceiling.higherMultiple).toBe(loans.ceilingMultipleOfBasic?.higher);
    expect(ceiling.higherFromServiceYears).toBe(loans.higherCeilingServiceYears);
  });

  it("never returns a negative ceiling", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor: -1, serviceYears: 9 }).maximumMinor).toBe(0);
  });
});

describe("completedServiceYears (Q-09 is unanswered)", () => {
  const now = new Date("2026-09-15T00:00:00Z");

  it("measures elapsed time from the joining date", () => {
    expect(completedServiceYears("2020-09-15", now)).toBeCloseTo(6, 1);
    expect(completedServiceYears("2026-09-15", now)).toBe(0);
  });

  it("never goes negative for a future joining date", () => {
    expect(completedServiceYears("2027-01-01", now)).toBe(0);
  });

  it("returns zero rather than NaN for an unusable date", () => {
    expect(completedServiceYears("not-a-date", now)).toBe(0);
  });

  it("says out loud that breaks in service are not modelled", () => {
    expect(CEILING_SERVICE_BASIS_NOTE).toContain("Q-09");
  });
});

describe("applyLoanSchema special terms (W-05 / W-06)", () => {
  const base = {
    employeeId: "11111111-1111-4111-8111-111111111111",
    principalMinor: 300_000_00,
    tenureMonths: 24,
    annualRatePct: 10,
    purpose: "personal",
    guarantorEmployeeIds: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
  };

  it("defaults to no special terms, so an ordinary application is unchanged", () => {
    const parsed = applyLoanSchema.parse(base);
    expect(parsed.specialTermsRequested).toBe(false);
    expect(parsed.specialTermsReason).toBeUndefined();
  });

  it("requires a reason of at least twenty characters when special terms are sought", () => {
    expect(applyLoanSchema.safeParse({ ...base, specialTermsRequested: true }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, specialTermsRequested: true, specialTermsReason: "board said yes" }).success).toBe(false);
    expect(
      applyLoanSchema.safeParse({
        ...base,
        specialTermsRequested: true,
        specialTermsReason: "Board sanctioned higher exposure against the gratuity balance",
      }).success,
    ).toBe(true);
  });

  it("names a Director permission distinct from the payroll desk's own", () => {
    expect(LOAN_DIRECTOR_PERMISSION).toBe("loan.director.approve");
    expect(LOAN_DIRECTOR_PERMISSION).not.toBe("payroll.run");
  });
});
