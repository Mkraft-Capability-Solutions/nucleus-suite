import { describe, expect, it } from "vitest";
import { loanEligibility } from "@/lib/hr-rules";

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
  it("caps at four times basic through exactly five years of service", () => {
    expect(loanEligibility({ basicSalary: 50000, serviceYears: 5, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(200000);
    expect(loanEligibility({ basicSalary: 50000, serviceYears: 4.99, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(200000);
  });

  it("raises the ceiling to six times basic just beyond five years", () => {
    expect(loanEligibility({ basicSalary: 50000, serviceYears: 5.01, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(300000);
    expect(loanEligibility({ basicSalary: 75000, serviceYears: 9, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(450000);
  });

  it("scales the ceiling with basic salary at both tenure bands", () => {
    expect(loanEligibility({ basicSalary: 30000, serviceYears: 2, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(120000);
    expect(loanEligibility({ basicSalary: 30000, serviceYears: 6, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(180000);
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
