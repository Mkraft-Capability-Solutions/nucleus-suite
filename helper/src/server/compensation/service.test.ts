import { describe, expect, it } from "vitest";
import {
  createBandSchema,
  createBudgetSchema,
  createCycleSchema,
  proposeCompSchema,
} from "@/server/compensation/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const validProposal = {
  cycleId: UUID,
  employeeId: UUID,
  newBasicMinor: 5500000,
  effectiveDate: "2026-10-01",
  justification: "Market correction after the annual benchmark",
  revisionType: "market_correction",
};

describe("compensation schemas", () => {
  it("validates band creation with defaults", () => {
    const parsed = createBandSchema.safeParse({ minMinor: 2500000, maxMinor: 5000000 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.gradeCode).toBe("E3");
      expect(parsed.data.currency).toBe("INR");
    }
    expect(createBandSchema.safeParse({ minMinor: 5000000, maxMinor: 5000000 }).success).toBe(true);
    expect(createBandSchema.safeParse({ minMinor: -1, maxMinor: 5 }).success).toBe(false);
  });

  it("validates cycles and budgets", () => {
    expect(createCycleSchema.safeParse({ budgetMinor: 100000000 }).success).toBe(true);
    expect(createCycleSchema.safeParse({ budgetMinor: 0 }).success).toBe(false);
    expect(createBudgetSchema.safeParse({ cycleId: UUID, amountMinor: 5000000 }).success).toBe(true);
    expect(createBudgetSchema.safeParse({ cycleId: "nope", amountMinor: 5 }).success).toBe(false);
  });

  it("validates compensation proposals", () => {
    expect(proposeCompSchema.safeParse(validProposal).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...validProposal, effectiveDate: "10-2026" }).success).toBe(false);
    expect(proposeCompSchema.safeParse({ ...validProposal, justification: "" }).success).toBe(false);
  });
});

describe("salary structure revision (FRM-PAY-02)", () => {
  it("requires a revision type from PL_REVISION_TYPE", () => {
    expect(proposeCompSchema.safeParse({ ...validProposal, revisionType: undefined }).success).toBe(false);
    expect(proposeCompSchema.safeParse({ ...validProposal, revisionType: "promotion" }).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...validProposal, revisionType: "Promotion" }).success).toBe(false);
  });

  it("holds the revision reason to the workbook's 10-character minimum and Char(300) field", () => {
    expect(proposeCompSchema.safeParse({ ...validProposal, justification: "Increment" }).success).toBe(false);
    expect(proposeCompSchema.safeParse({ ...validProposal, justification: "x".repeat(300) }).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...validProposal, justification: "x".repeat(301) }).success).toBe(false);
  });

  it("bounds variable pay to 0-50 percent and makes its frequency explicit", () => {
    expect(proposeCompSchema.safeParse({ ...validProposal, variablePercent: 50, variableFrequency: "annual" }).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...validProposal, variablePercent: 51, variableFrequency: "annual" }).success).toBe(false);
    // Variable pay without a frequency is unpayable; there is no default to fall back on.
    expect(proposeCompSchema.safeParse({ ...validProposal, variablePercent: 10 }).success).toBe(false);
    expect(proposeCompSchema.safeParse({ ...validProposal, variablePercent: 0 }).success).toBe(true);
  });

  it("refuses a negative balancing figure and carries the allowance table", () => {
    expect(proposeCompSchema.safeParse({ ...validProposal, specialAllowanceMinor: -1 }).success).toBe(false);
    expect(
      proposeCompSchema.safeParse({
        ...validProposal,
        annualCtcMinor: 120_000_000,
        dearnessMinor: 500_000,
        houseRentMinor: 2_000_000,
        conveyanceMinor: 160_000,
        specialAllowanceMinor: 840_000,
        otherAllowances: [{ componentCode: "shift_allowance", amountMinor: 250_000, taxable: true }],
        employerNpsMinor: 550_000,
        insurancePremiumMinor: 120_000,
        retentionBonusMinor: 10_000_000,
      }).success,
    ).toBe(true);
  });

  it("queues the revision letter unless the proposer says otherwise", () => {
    expect(proposeCompSchema.parse(validProposal).issueLetter).toBe(true);
    expect(proposeCompSchema.parse({ ...validProposal, issueLetter: false }).issueLetter).toBe(false);
  });
});
