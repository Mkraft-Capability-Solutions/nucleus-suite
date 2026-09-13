import { describe, expect, it } from "vitest";
import { requestAdvanceSchema } from "@/server/advances/service";
import { upsertInputSchema } from "@/server/payroll/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("salary advance schemas", () => {
  it("requires a positive amount with a payroll month and reason", () => {
    const valid = { employeeId: UUID, amountMinor: 20_000_00, period: "2026-09", reason: "Medical emergency" };
    expect(requestAdvanceSchema.safeParse(valid).success).toBe(true);
    expect(requestAdvanceSchema.safeParse({ ...valid, amountMinor: 0 }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, period: "Sept" }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
  });
});

describe("payroll input schemas", () => {
  it("accepts known components with signed minor-unit amounts", () => {
    const valid = { employeeId: UUID, period: "2026-09", component: "tds", amountMinor: 5_000_00, note: "Declaration shortfall" };
    expect(upsertInputSchema.safeParse(valid).success).toBe(true);
    expect(upsertInputSchema.safeParse({ ...valid, component: "lottery" }).success).toBe(false);
    expect(upsertInputSchema.safeParse({ ...valid, amountMinor: 10.5 }).success).toBe(false);
  });
});
