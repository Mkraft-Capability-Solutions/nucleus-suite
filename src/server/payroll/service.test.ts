import { describe, expect, it } from "vitest";
import { applyLoanSchema, approveLoanSchema, repayLoanSchema } from "@/server/loans/service";
import { createRunSchema, resolveAnomalySchema, STANDARD_STRUCTURE } from "@/server/payroll/service";

const EMPLOYEE = "123e4567-e89b-12d3-a456-426614174000";
const OTHER = "123e4567-e89b-12d3-a456-426614174001";

describe("payroll schemas (OC-P4-01/02)", () => {
  it("pins the standard structure to the golden fixture lines", () => {
    expect(STANDARD_STRUCTURE).toEqual({ basic: 5_000_000, hra: 2_000_000, da: 500_000, conveyance: 160_000, special: 840_000 });
  });

  it("validates run creation periods and scopes", () => {
    expect(createRunSchema.safeParse({ period: "2026-09", scope: "regular" }).success).toBe(true);
    expect(createRunSchema.safeParse({ period: "2026-09", scope: "ot" }).success).toBe(true);
    expect(createRunSchema.safeParse({ period: "Sept 2026", scope: "regular" }).success).toBe(false);
    expect(createRunSchema.safeParse({ period: "2026-09", scope: "bonus" }).success).toBe(false);
  });

  it("bounds anomaly resolutions with mandatory reasons", () => {
    expect(resolveAnomalySchema.safeParse({ status: "overridden", resolution: "Verified bank change" }).success).toBe(true);
    expect(resolveAnomalySchema.safeParse({ status: "ignored", resolution: "x" }).success).toBe(false);
    expect(resolveAnomalySchema.safeParse({ status: "resolved", resolution: "" }).success).toBe(false);
  });
});

describe("loan schemas (OC-P4-01/02)", () => {
  it("requires two to three distinct guarantors", () => {
    const base = { employeeId: EMPLOYEE, principalMinor: 20_000_000, tenureMonths: 24, annualRatePct: 10, purpose: "Medical" };
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER, EMPLOYEE] }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER] }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER, OTHER] }).success).toBe(true);
  });

  it("bounds principal, tenure and rate", () => {
    const base = { employeeId: EMPLOYEE, tenureMonths: 24, annualRatePct: 10, purpose: "Medical", guarantorEmployeeIds: [OTHER, EMPLOYEE] };
    expect(applyLoanSchema.safeParse({ ...base, principalMinor: 0 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, tenureMonths: 0 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, tenureMonths: 85 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, annualRatePct: 37 }).success).toBe(false);
  });

  it("defaults director override off and validates repayments", () => {
    expect(approveLoanSchema.safeParse({}).data).toMatchObject({ directorOverride: false });
    expect(repayLoanSchema.safeParse({ amountMinor: 100_00 }).success).toBe(true);
    expect(repayLoanSchema.safeParse({ amountMinor: 0 }).success).toBe(false);
  });
});
