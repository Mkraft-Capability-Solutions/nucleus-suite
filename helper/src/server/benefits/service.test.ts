import { describe, expect, it } from "vitest";
import {
  claimBenefitSchema,
  createBenefitOptionSchema,
  createBenefitPlanSchema,
  enrollBenefitSchema,
} from "@/server/benefits/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("benefits schemas", () => {
  it("validates plan creation", () => {
    expect(createBenefitPlanSchema.safeParse({ code: "MEDICLAIM-26", name: "Group Mediclaim", coverageMinor: 50000000 }).success).toBe(true);
    expect(createBenefitPlanSchema.safeParse({ code: "", name: "X", coverageMinor: 0 }).success).toBe(false);
  });

  it("validates option creation with defaults", () => {
    const parsed = createBenefitOptionSchema.safeParse({ planCode: "MEDICLAIM-26", code: "SELF", employeeShareMinor: 0 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Standard");
    expect(createBenefitOptionSchema.safeParse({ planCode: "P", code: "C", employeeShareMinor: -5 }).success).toBe(false);
  });

  it("validates enrollment and claims", () => {
    expect(enrollBenefitSchema.safeParse({ employeeId: UUID, optionCode: "SELF" }).success).toBe(true);
    expect(enrollBenefitSchema.safeParse({ employeeId: "nope", optionCode: "SELF" }).success).toBe(false);
    expect(claimBenefitSchema.safeParse({ enrollmentId: UUID, amountMinor: 2500000, diagnosis: "Hospitalization" }).success).toBe(true);
    expect(claimBenefitSchema.safeParse({ enrollmentId: UUID, amountMinor: 0, diagnosis: "" }).success).toBe(false);
  });
});
