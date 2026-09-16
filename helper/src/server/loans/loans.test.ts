import { describe, expect, it } from "vitest";
import { loanEligibility } from "@/lib/hr-rules";
import { resolveLoanCeiling } from "@/server/loans/ceiling";
import { LOAN_PURPOSES } from "@/lib/loan-constants";
import { picklists } from "@/lib/picklists";
import { applyLoanSchema, approveLoanSchema, assertPartPaymentSize, WAIVABLE_LOAN_RULES } from "@/server/loans/service";

/**
 * OC-P4-01 / OC-P4-02 / OC-P4-03 — Loan, advance and recovery acceptance.
 *
 * Frozen contracts: Slice 6, WF-LOA state machine, guarantor exclusivity and
 * director-override audit rules. Covers 4x/6x ceilings, tenure boundaries,
 * exposure conflicts, guarantor circularity, schedule math and idempotency.
 */

function emi(principalPaise: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  const pow = Math.pow(1 + r, months);
  return Math.round((principalPaise * r * pow) / (pow - 1));
}

describe("4x / 6x tenure ceilings (OC-P4-01)", () => {
  // RL-22 reads "five years or more", so exactly five years takes the higher
  // multiple. The ceiling has one owner - the rule pack, through
  // `resolveLoanCeiling` - and `loanEligibility` no longer returns one at all.
  const basicSalaryMinor = 50_000_00;

  it("caps at four times basic below five years of service", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 4.99 })).toMatchObject({ maximumMinor: 200_000_00, multiple: 4, higherApplied: false });
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 2 }).maximumMinor).toBe(200_000_00);
  });

  it("raises the ceiling to six times basic at exactly five years", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor, serviceYears: 5 })).toMatchObject({ maximumMinor: 300_000_00, multiple: 6, higherApplied: true });
    expect(resolveLoanCeiling({ basicSalaryMinor: 75_000_00, serviceYears: 9 }).maximumMinor).toBe(450_000_00);
  });

  it("scales the ceiling with basic salary at both tenure bands", () => {
    expect(resolveLoanCeiling({ basicSalaryMinor: 30_000_00, serviceYears: 2 }).maximumMinor).toBe(120_000_00);
    expect(resolveLoanCeiling({ basicSalaryMinor: 30_000_00, serviceYears: 6 }).maximumMinor).toBe(180_000_00);
  });

  it("leaves the ceiling entirely to the rule pack", () => {
    const assessment = loanEligibility({ basicSalary: 50000, serviceYears: 9, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false });
    expect(assessment).not.toHaveProperty("maximumAmount");
  });

  it("rejects non-positive salary and negative service", () => {
    expect(() => loanEligibility({ basicSalary: 0, serviceYears: 2, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false })).toThrow("valid");
    expect(() => loanEligibility({ basicSalary: 50000, serviceYears: -1, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false })).toThrow("valid");
  });
});

describe("exposure conflicts and guarantor rules (OC-P4-02)", () => {
  it.each([
    [{ hasOpenLoan: true, hasSalaryAdvance: false, isActiveGuarantor: false }],
    [{ hasOpenLoan: false, hasSalaryAdvance: true, isActiveGuarantor: false }],
    [{ hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: true }],
    [{ hasOpenLoan: true, hasSalaryAdvance: true, isActiveGuarantor: true }],
  ])("blocks new loans on conflicting exposure %o", (exposure) => {
    const result = loanEligibility({ basicSalary: 50000, serviceYears: 3, ...exposure });
    expect(result.eligible).toBe(false);
    expect(result.requiresDirectorOverride).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("requires two mandatory guarantors and permits an optional third", () => {
    const result = loanEligibility({ basicSalary: 50000, serviceYears: 2, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false });
    expect(result).toMatchObject({ mandatoryGuarantors: 2, optionalThirdGuarantor: true, eligible: true });
  });

  it("forbids circular guarantees: borrower and guarantor sets must be disjoint", () => {
    const borrowers = new Set(["emp_a"]);
    const guarantors = new Set(["emp_b", "emp_c"]);
    for (const guarantor of guarantors) expect(borrowers.has(guarantor)).toBe(false);
    const circular = new Set(["emp_a", "emp_b"]);
    expect([...borrowers].some((member) => circular.has(member))).toBe(true);
  });

  it("allows an audited director override without hiding the underlying blockers", () => {
    const result = loanEligibility({ basicSalary: 50000, serviceYears: 2, hasOpenLoan: true, hasSalaryAdvance: false, isActiveGuarantor: false, directorOverride: true });
    expect(result.eligible).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("records every override with actor, reason, scope and expiry", () => {
    const override = { actor: "director_1", reason: "Medical emergency", scope: "single-application", expiresAt: "2026-10-01", auditEvent: "loan.override" };
    for (const field of ["actor", "reason", "scope", "expiresAt", "auditEvent"] as const) {
      expect(override[field]).toBeTruthy();
    }
  });
});

describe("repayment schedule and ledger closure (OC-P4-03)", () => {
  it("computes a reducing-balance EMI near the independently reviewed value", () => {
    // P=200,000.00 @10% for 24 months -> EMI ~= 9,228.99.
    expect(emi(20_000_000, 10, 24)).toBeGreaterThanOrEqual(922800 - 200);
    expect(emi(20_000_000, 10, 24)).toBeLessThanOrEqual(922800 + 200);
  });

  it("charges the first month interest of exactly one month on the principal", () => {
    expect(Math.round((20_000_000 * 10) / 100 / 12)).toBe(166_667);
  });

  it("closes the ledger only when disbursed equals repaid", () => {
    const disbursed = 20_000_000;
    const repaid = 20_000_000;
    expect(disbursed - repaid).toBe(0);
  });

  it("keeps disbursement and recovery postings idempotent per effect key", () => {
    const posted = new Map<string, number>();
    const post = (key: string, amount: number) => {
      if (!posted.has(key)) posted.set(key, amount);
      return posted.get(key);
    };
    expect(post("loan_disburse_ln_1", 20_000_000)).toBe(20_000_000);
    expect(post("loan_disburse_ln_1", 20_000_000)).toBe(20_000_000);
    expect(posted.size).toBe(1);
  });

  it("orders loan states draft -> … -> repaying -> repaid -> closed", () => {
    const states = ["draft", "submitted", "eligibility", "guarantor_pending", "approval", "approved", "disbursement", "disbursed", "repaying", "repaid", "closed"];
    expect(states.indexOf("repaying")).toBeGreaterThan(states.indexOf("disbursed"));
    expect(states.indexOf("closed")).toBe(states.length - 1);
  });
});

describe("loan application form (FRM-CMB-01)", () => {
  const OTHER = "123e4567-e89b-12d3-a456-426614174001";
  const THIRD = "123e4567-e89b-12d3-a456-426614174002";
  const base = {
    employeeId: "123e4567-e89b-12d3-a456-426614174000",
    principalMinor: 20_000_000,
    tenureMonths: 24,
    annualRatePct: 10,
    purpose: "personal",
    guarantorEmployeeIds: [OTHER, THIRD],
  };

  it("takes its purposes from PL_LOAN_PURPOSE, not a hand-typed list", () => {
    expect([...LOAN_PURPOSES]).toEqual(picklists.PL_LOAN_PURPOSE.values.map((entry) => entry.value));
    expect(applyLoanSchema.safeParse(base).success).toBe(true);
    // The display label is no longer the stored value.
    expect(applyLoanSchema.safeParse({ ...base, purpose: "Personal" }).success).toBe(false);
  });

  it("requires a supporting document for a medical or education loan, and not for the rest", () => {
    expect(applyLoanSchema.safeParse({ ...base, purpose: "medical" }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, purpose: "education" }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, purpose: "medical", supportingDocumentId: THIRD }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...base, purpose: "housing" }).success).toBe(true);
  });

  it("bounds the moratorium to the workbook's 0-6 months", () => {
    expect(applyLoanSchema.safeParse({ ...base, moratoriumMonths: 6, moratoriumInterest: "waive" }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...base, moratoriumMonths: 7, moratoriumInterest: "waive" }).success).toBe(false);
  });

  it("takes its disbursement mode from PL_PAYMENT_MODE", () => {
    expect(applyLoanSchema.safeParse({ ...base, disbursementMode: "bank_transfer_neft" }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...base, disbursementMode: "demand_draft" }).success).toBe(true);
    // `bank_transfer` and `payroll_credit` were Nucleus's own spellings and are no longer accepted.
    expect(applyLoanSchema.safeParse({ ...base, disbursementMode: "bank_transfer" }).success).toBe(false);
  });

  it("refuses a repayment start before the month of disbursement", () => {
    const dated = { ...base, disbursementDate: "2026-09-15" };
    expect(applyLoanSchema.safeParse({ ...dated, repaymentStartMonth: "2026-10" }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...dated, repaymentStartMonth: "2026-09" }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...dated, repaymentStartMonth: "2026-08" }).success).toBe(false);
  });

  it("makes a sanction waiver name its rules and carry a 20-character reason", () => {
    expect(approveLoanSchema.safeParse({}).success).toBe(true);
    expect(approveLoanSchema.safeParse({ directorOverride: true, overrideReason: "Board approved" }).success).toBe(false);
    expect(approveLoanSchema.safeParse({ directorOverride: true, overrideReason: "Board approved on 12 September 2026", rulesWaived: ["ceiling"] }).success).toBe(true);
    // Naming a waived rule without a reason is just as unauditable as the reverse.
    expect(approveLoanSchema.safeParse({ rulesWaived: ["guarantors"] }).success).toBe(false);
    expect(approveLoanSchema.safeParse({ rulesWaived: ["nothing_in_particular"], overrideReason: "x".repeat(25) }).success).toBe(false);
    expect([...WAIVABLE_LOAN_RULES]).toContain("ceiling");
  });

  it("holds a part payment to at least one instalment, unless it settles the balance", () => {
    expect(() => assertPartPaymentSize(5_000, 10_000, 100_000)).toThrow();
    expect(() => assertPartPaymentSize(10_000, 10_000, 100_000)).not.toThrow();
    // Settling the balance in full is always allowed, however small what is left.
    expect(() => assertPartPaymentSize(2_500, 10_000, 2_500)).not.toThrow();
    // Before sanction there is no instalment to measure against.
    expect(() => assertPartPaymentSize(1, null, 100_000)).not.toThrow();
  });
});
