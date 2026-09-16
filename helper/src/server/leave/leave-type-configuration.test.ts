import { describe, expect, it } from "vitest";
import { leaveTypeConfigurationSchema } from "./policy-register";

/** A complete, valid configuration; each test varies one thing from it. */
const base = {
  leaveType: "EL",
  name: "Earned leave",
  applicableClasses: ["staff_monthly"],
  applicableBands: ["Band A"],
  annualDays: 18,
  prorationRule: "Standard joining slab",
  approvalChainId: "STD-CHAIN",
  effectiveFrom: "2026-04-01",
  maxCarryForward: 30,
};

describe("leave type configuration (FRM-LVE-01)", () => {
  it("applies the workbook's stated defaults and accepts a complete configuration", () => {
    const parsed = leaveTypeConfigurationSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.unit).toBe("days");
    expect(parsed.data.accrualMethod).toBe("monthly_accrual");
    expect(parsed.data.accrualDay).toBe("period_end");
    expect(parsed.data.sandwichRule).toBe("exclude_holidays_and_rest_days");
    expect(parsed.data.minDays).toBe(0.5);
    expect(parsed.data.advanceNoticeDays).toBe(1);
    expect(parsed.data.backdateDays).toBe(7);
    expect(parsed.data.status).toBe("active");
  });

  it("requires at least one worker class and one leave band", () => {
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, applicableClasses: [] }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, applicableBands: [] }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, applicableClasses: ["director"] }).success).toBe(false);
  });

  it("enforces the conditional balance fields", () => {
    // Carry forward defaults to yes, so the maximum is mandatory.
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, maxCarryForward: undefined }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, carryForward: false, maxCarryForward: undefined }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, allowNegative: true }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, allowNegative: true, negativeLimit: 5 }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, isEncashable: true }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, isEncashable: true, encashmentCap: 15 }).success).toBe(true);
  });

  it("keeps the bounded pairs the workbook states in order", () => {
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, minDays: 2, maxDays: 1 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, minDays: 1, maxDays: 10 }).success).toBe(true);
    // Accrual stops at the ceiling, so a ceiling below the annual entitlement is meaningless.
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, maxAccumulation: 10 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, maxAccumulation: 36 }).success).toBe(true);
  });

  it("refuses a type that excludes or requires itself", () => {
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, prerequisiteType: "EL" }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, excludedWith: ["CL", "EL"] }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, excludedWith: ["CL"], prerequisiteType: "SL" }).success).toBe(true);
  });

  it("takes every vocabulary from the picklist registry", () => {
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, unit: "hours" }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, unit: "shifts" }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, sandwichRule: "include_both" }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, sandwichRule: "ignore" }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, genderRestriction: "female" }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, accrualMethod: "per_days_worked" }).success).toBe(true);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, accrualMethod: "weekly" }).success).toBe(false);
  });

  it("bounds the day counts the workbook bounds", () => {
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, annualDays: 400 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, eligibilityWaitDays: 400 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, advanceNoticeDays: 91 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, backdateDays: 91 }).success).toBe(false);
    expect(leaveTypeConfigurationSchema.safeParse({ ...base, effectiveFrom: "01-04-2026" }).success).toBe(false);
  });
});
