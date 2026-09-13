import { describe, expect, it } from "vitest";
import {
  createBandSchema,
  createBudgetSchema,
  createCycleSchema,
  proposeCompSchema,
} from "@/server/compensation/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

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
    const valid = { cycleId: UUID, employeeId: UUID, newBasicMinor: 5500000, effectiveDate: "2026-10-01", justification: "Market correction" };
    expect(proposeCompSchema.safeParse(valid).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...valid, effectiveDate: "10-2026" }).success).toBe(false);
    expect(proposeCompSchema.safeParse({ ...valid, justification: "" }).success).toBe(false);
  });
});
