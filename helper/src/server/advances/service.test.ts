import { describe, expect, it } from "vitest";
import { decideAdvanceSchema, isRecoveryPeriodAllowed, payAdvanceSchema, requestAdvanceSchema } from "@/server/advances/service";
import { upsertInputSchema } from "@/server/payroll/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("salary advance schemas (FRM-CMB-02)", () => {
  const valid = { employeeId: UUID, amountMinor: 20_000_00, period: "2026-09", reason: "Medical emergency" };

  it("requires a positive amount with a payroll month and reason", () => {
    expect(requestAdvanceSchema.safeParse(valid).success).toBe(true);
    expect(requestAdvanceSchema.safeParse({ ...valid, amountMinor: 0 }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, period: "Sept" }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
  });

  it("holds the reason to the workbook's 10-character minimum and 200-character field", () => {
    expect(requestAdvanceSchema.safeParse({ ...valid, reason: "Medical" }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, reason: "x".repeat(200) }).success).toBe(true);
    expect(requestAdvanceSchema.safeParse({ ...valid, reason: "x".repeat(201) }).success).toBe(false);
  });

  it("bounds instalments to 1-3 and defaults to one", () => {
    expect(requestAdvanceSchema.parse(valid).instalments).toBe(1);
    expect(requestAdvanceSchema.safeParse({ ...valid, instalments: 3 }).success).toBe(true);
    expect(requestAdvanceSchema.safeParse({ ...valid, instalments: 4 }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, instalments: 0 }).success).toBe(false);
    expect(requestAdvanceSchema.safeParse({ ...valid, instalments: 1.5 }).success).toBe(false);
  });

  it("allows recovery only in the current or the next period, across a year end", () => {
    const december = new Date(Date.UTC(2026, 11, 15));
    expect(isRecoveryPeriodAllowed("2026-12", december)).toBe(true);
    expect(isRecoveryPeriodAllowed("2027-01", december)).toBe(true);
    expect(isRecoveryPeriodAllowed("2027-02", december)).toBe(false);
    expect(isRecoveryPeriodAllowed("2026-11", december)).toBe(false);
  });

  it("requires remarks on anything but an approval (PL_DECISION)", () => {
    expect(decideAdvanceSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(decideAdvanceSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(decideAdvanceSchema.safeParse({ decision: "reject", remarks: "Ceiling already used" }).success).toBe(true);
    expect(decideAdvanceSchema.safeParse({ decision: "return_for_correction", remarks: "Attach the bill" }).success).toBe(true);
    expect(decideAdvanceSchema.safeParse({ decision: "escalate", remarks: "x" }).success).toBe(false);
  });

  it("takes the disbursement and recovery runs as run ids, or neither", () => {
    expect(payAdvanceSchema.safeParse({}).success).toBe(true);
    expect(payAdvanceSchema.safeParse({ disbursementRunId: UUID, recoveryRunId: UUID }).success).toBe(true);
    expect(payAdvanceSchema.safeParse({ recoveryRunId: "next-run" }).success).toBe(false);
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
