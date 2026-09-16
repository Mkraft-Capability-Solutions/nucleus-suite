import { describe, expect, it } from "vitest";
import {
  decideEncashmentSchema,
  encashableDays,
  encashmentPolicyGaps,
  encashmentRefusal,
  estimateEncashment,
  parseEncashmentPolicy,
  picklistValueForLeaveCode,
  requestEncashmentSchema,
  tagEncashmentSchema,
} from "./encashment-rules";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("FRM-LVE-04 request schema", () => {
  const valid = { employeeId: UUID, leaveType: "earned_leave", daysToEncash: 5 };

  it("takes the leave type from PL_LEAVE_TYPE and days in halves", () => {
    expect(requestEncashmentSchema.safeParse(valid).success).toBe(true);
    expect(requestEncashmentSchema.safeParse({ ...valid, daysToEncash: 2.5 }).success).toBe(true);
    expect(requestEncashmentSchema.safeParse({ ...valid, daysToEncash: 2.3 }).success).toBe(false);
    expect(requestEncashmentSchema.safeParse({ ...valid, daysToEncash: 0 }).success).toBe(false);
    expect(requestEncashmentSchema.safeParse({ ...valid, leaveType: "EL" }).success).toBe(false);
  });

  it("keeps the reason optional and within its 200-character field", () => {
    expect(requestEncashmentSchema.safeParse({ ...valid, reason: "x".repeat(200) }).success).toBe(true);
    expect(requestEncashmentSchema.safeParse({ ...valid, reason: "x".repeat(201) }).success).toBe(false);
  });

  it("never accepts the derived fields as input", () => {
    const parsed = requestEncashmentSchema.parse({ ...valid, currentBalance: 99, estimatedAmount: 1 });
    expect(parsed).not.toHaveProperty("currentBalance");
    expect(parsed).not.toHaveProperty("estimatedAmount");
  });
});

describe("FRM-LVE-04 approval and payroll schemas", () => {
  it("requires remarks on anything but an approval (PL_DECISION)", () => {
    expect(decideEncashmentSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(decideEncashmentSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(decideEncashmentSchema.safeParse({ decision: "reject", remarks: "Balance needed for planned leave" }).success).toBe(true);
    expect(decideEncashmentSchema.safeParse({ decision: "approved" }).success).toBe(false);
  });

  it("tags only to a run reference", () => {
    expect(tagEncashmentSchema.safeParse({ runId: UUID }).success).toBe(true);
    expect(tagEncashmentSchema.safeParse({ runId: "2026-09" }).success).toBe(false);
  });
});

describe("encashable ceiling", () => {
  it("is the balance less what is already in flight when nothing else is stated", () => {
    const result = encashableDays({ balance: 12, annualCap: null, encashedThisYear: 0, pendingDays: 2, retentionFloorDays: null });
    expect(result.encashable).toBe(10);
    expect(result.limitedBy).toBe("balance");
    expect(result.unstated).toEqual(["retention_floor_days", "encashment_cap"]);
  });

  it("holds the retention floor and what remains of the annual cap", () => {
    expect(encashableDays({ balance: 12, annualCap: null, encashedThisYear: 0, pendingDays: 0, retentionFloorDays: 5 })).toMatchObject({ encashable: 7, limitedBy: "retention_floor" });
    expect(encashableDays({ balance: 12, annualCap: 10, encashedThisYear: 6, pendingDays: 0, retentionFloorDays: null })).toMatchObject({ encashable: 4, limitedBy: "annual_cap" });
    expect(encashableDays({ balance: 12, annualCap: 10, encashedThisYear: 3, pendingDays: 0, retentionFloorDays: 5 })).toMatchObject({ encashable: 7, limitedBy: "retention_floor" });
  });

  it("never goes below zero and refuses a request beyond it", () => {
    const ceiling = encashableDays({ balance: 2, annualCap: 10, encashedThisYear: 10, pendingDays: 0, retentionFloorDays: null });
    expect(ceiling.encashable).toBe(0);
    expect(encashmentRefusal(1, ceiling)).toContain("annual encashment cap");
    expect(encashmentRefusal(0, ceiling)).toBeNull();
  });
});

describe("encashment policy", () => {
  it("reports both unsupplied rules by name when nothing is configured", () => {
    const policy = parseEncashmentPolicy(undefined);
    expect(policy).toEqual({ rateBasis: null, monthDaysDivisor: null, retentionFloorDays: {} });
    expect(encashmentPolicyGaps(policy).map((gap) => gap.rule)).toEqual(["PL_ENCASHMENT_BASIS", "PL_ENCASHMENT_MONTH_DAYS"]);
  });

  it("leaves the estimate null, with the missing rules named, rather than pricing at zero", () => {
    const estimate = estimateEncashment({ days: 4, policy: parseEncashmentPolicy({}), monthlyWagesMinor: { basic: 30_000_00, da: 5_000_00, gross: 50_000_00 } });
    expect(estimate.amountMinor).toBeNull();
    expect(estimate.rateBasis).toBeNull();
    expect(estimate.blockedBy).toEqual(["PL_ENCASHMENT_BASIS", "PL_ENCASHMENT_MONTH_DAYS"]);
  });

  it("prices on the settlement arithmetic once the basis and divisor are supplied", () => {
    const policy = parseEncashmentPolicy({ rateBasis: "basic_da", monthDaysDivisor: 30, retentionFloorDays: { el: 5 } });
    expect(policy.retentionFloorDays).toEqual({ EL: 5 });
    const estimate = estimateEncashment({ days: 4, policy, monthlyWagesMinor: { basic: 30_000_00, da: 6_000_00, gross: 50_000_00 } });
    expect(estimate.perDayMinor).toBe(1_200_00);
    expect(estimate.amountMinor).toBe(4_800_00);
    expect(estimate.rateBasis).toBe("basic_da");
    expect(estimate.blockedBy).toEqual([]);
  });

  it("ignores a malformed bag instead of half-applying it", () => {
    expect(parseEncashmentPolicy({ rateBasis: "net", monthDaysDivisor: 30 })).toEqual({ rateBasis: null, monthDaysDivisor: null, retentionFloorDays: {} });
  });
});

describe("leave type vocabulary", () => {
  it("reads an engine code back as its PL_LEAVE_TYPE value", () => {
    expect(picklistValueForLeaveCode("EL")).toBe("earned_leave");
    expect(picklistValueForLeaveCode("coff")).toBe("compensatory_off");
    expect(picklistValueForLeaveCode("Marriage leave")).toBe("marriage_leave");
    expect(picklistValueForLeaveCode("XYZ")).toBeNull();
  });
});
