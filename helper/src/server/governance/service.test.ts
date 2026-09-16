import { describe, expect, it } from "vitest";
import { correctRunSchema } from "@/server/payroll/service";
import { createDelegationSchema } from "@/server/delegation/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("payroll correction schemas", () => {
  it("requires a reason and at least one signed adjustment line", () => {
    const valid = {
      reason: "Bank rejected disbursement for one employee",
      adjustments: [{ employeeId: UUID, component: "basic", amountMinor: -50_000, reversesLineId: UUID }],
    };
    expect(correctRunSchema.safeParse(valid).success).toBe(true);
    expect(correctRunSchema.safeParse({ reason: "", adjustments: valid.adjustments }).success).toBe(false);
    expect(correctRunSchema.safeParse({ reason: "x", adjustments: [] }).success).toBe(false);
    expect(correctRunSchema.safeParse({ reason: "x", adjustments: [{ employeeId: UUID, component: "", amountMinor: 0 }] }).success).toBe(false);
  });
});

describe("delegation schemas", () => {
  it("bounds delegation windows to named workflows with expiries", () => {
    const valid = {
      delegateMembershipId: UUID,
      scopes: ["leave.approve"],
      validFrom: "2026-09-01T00:00:00+05:30",
      validTo: "2026-09-10T00:00:00+05:30",
      reason: "HOD on leave",
    };
    expect(createDelegationSchema.safeParse(valid).success).toBe(true);
    expect(createDelegationSchema.safeParse({ ...valid, scopes: [] }).success).toBe(false);
    expect(createDelegationSchema.safeParse({ ...valid, validTo: "2026-08-01T00:00:00+05:30" }).success).toBe(false);
    expect(createDelegationSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
  });
});
