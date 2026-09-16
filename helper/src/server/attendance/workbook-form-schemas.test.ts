import { describe, expect, it } from "vitest";
import { decideRegularizationSchema, requestRegularizationSchema } from "./regularizations";
import { decideGatePassSchema, overrideAttendanceDaySchema, recordGateScanSchema } from "./service";
import { resolveExceptionSchema } from "./exception-register";
import { approveOvertimeSchema } from "./overtime-register";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("regularisation request (FRM-TIM-05)", () => {
  const base = {
    employeeId: UUID,
    date: "2026-09-10",
    kind: "missing_punch",
    reason: "Forgot to punch out at the gate",
    claimedIn: "09:00 AM",
    claimedOut: "06:00 PM",
  };

  it("takes its type from PL_REGULARISATION_TYPE", () => {
    expect(requestRegularizationSchema.safeParse({ ...base, kind: "late_waiver", claimedIn: undefined, claimedOut: undefined }).success).toBe(true);
    expect(requestRegularizationSchema.safeParse({ ...base, kind: "break-correct" }).success).toBe(false);
  });

  it("requires both requested times only for a punch correction", () => {
    expect(requestRegularizationSchema.safeParse({ ...base, claimedOut: undefined }).success).toBe(false);
    expect(requestRegularizationSchema.safeParse({ ...base, kind: "device_failure", claimedIn: undefined }).success).toBe(false);
    // On duty and work from home have no punch pair to correct.
    expect(requestRegularizationSchema.safeParse({ ...base, kind: "on_duty", claimedIn: undefined, claimedOut: undefined }).success).toBe(true);
  });

  it("holds the reason to the workbook's 15-character floor", () => {
    expect(requestRegularizationSchema.safeParse({ ...base, reason: "Forgot punch" }).success).toBe(false);
  });

  it("makes decision remarks mandatory only on a rejection", () => {
    expect(decideRegularizationSchema.safeParse({ approve: true }).success).toBe(true);
    expect(decideRegularizationSchema.safeParse({ approve: false }).success).toBe(false);
    expect(decideRegularizationSchema.safeParse({ approve: false, decisionRemarks: "Short" }).success).toBe(false);
    expect(decideRegularizationSchema.safeParse({ approve: false, decisionRemarks: "No supporting evidence" }).success).toBe(true);
  });
});

describe("gate pass decision and gate scan (FRM-TIM-06)", () => {
  it("makes the decision remark mandatory only on a rejection", () => {
    expect(decideGatePassSchema.safeParse({ approve: true }).success).toBe(true);
    expect(decideGatePassSchema.safeParse({ approve: false }).success).toBe(false);
    expect(decideGatePassSchema.safeParse({ approve: false, decisionRemarks: "Ceiling used" }).success).toBe(true);
  });

  it("requires at least one scan timestamp", () => {
    expect(recordGateScanSchema.safeParse({}).success).toBe(false);
    expect(recordGateScanSchema.safeParse({ actualOut: "2026-09-10T14:05:00+05:30" }).success).toBe(true);
    expect(recordGateScanSchema.safeParse({ actualIn: "2026-09-10T16:01:00+05:30" }).success).toBe(true);
    expect(recordGateScanSchema.safeParse({ actualOut: "14:05" }).success).toBe(false);
  });
});

describe("attendance day override (FRM-TIM-04)", () => {
  it("must change something and always carries a reason of at least 10 characters", () => {
    expect(overrideAttendanceDaySchema.safeParse({ reason: "Shift was swapped at short notice" }).success).toBe(false);
    expect(overrideAttendanceDaySchema.safeParse({ overrideShiftCode: "B", reason: "Too short" }).success).toBe(false);
    expect(overrideAttendanceDaySchema.safeParse({ overrideShiftCode: "B", reason: "Shift was swapped at short notice" }).success).toBe(true);
    expect(overrideAttendanceDaySchema.safeParse({ overrideStatus: "on_duty", reason: "Attended the vendor audit" }).success).toBe(true);
    expect(overrideAttendanceDaySchema.safeParse({ overrideStatus: "present_ish", reason: "Attended the vendor audit" }).success).toBe(false);
  });
});

describe("exception resolution (FRM-TIM-08)", () => {
  const base = { action: "reject", reason: "Punch evidence contradicts the claim" };

  it("takes its action from PL_EXCEPTION_ACTION", () => {
    expect(resolveExceptionSchema.safeParse(base).success).toBe(true);
    expect(resolveExceptionSchema.safeParse({ ...base, action: "ignore" }).success).toBe(false);
  });

  it("requires the amended value when amending", () => {
    expect(resolveExceptionSchema.safeParse({ ...base, action: "amend" }).success).toBe(false);
    expect(resolveExceptionSchema.safeParse({ ...base, action: "amend", amendedValue: "18:05" }).success).toBe(true);
  });

  it("requires a bulk apply to name the exceptions it covers", () => {
    expect(resolveExceptionSchema.safeParse({ ...base, bulkApply: true }).success).toBe(false);
    expect(resolveExceptionSchema.safeParse({ ...base, bulkApply: true, bulkIds: [] }).success).toBe(false);
    expect(resolveExceptionSchema.safeParse({ ...base, bulkApply: true, bulkIds: [UUID] }).success).toBe(true);
  });

  it("holds the reason to the workbook's 10-character floor", () => {
    expect(resolveExceptionSchema.safeParse({ ...base, reason: "Bad data" }).success).toBe(false);
  });
});

describe("overtime approval (FRM-TIM-07)", () => {
  it("accepts an approval that leaves the raw minutes standing", () => {
    expect(approveOvertimeSchema.safeParse({ reason: "Verified against the punch trail" }).success).toBe(true);
  });

  it("requires a reduction reason whenever payable minutes are stated", () => {
    expect(approveOvertimeSchema.safeParse({ reason: "Checked", payableMinutes: 90 }).success).toBe(false);
    expect(approveOvertimeSchema.safeParse({ reason: "Checked", payableMinutes: 90, reductionReason: "Too short" }).success).toBe(false);
    expect(approveOvertimeSchema.safeParse({ reason: "Checked", payableMinutes: 90, reductionReason: "Meal break not deducted by the device" }).success).toBe(true);
    expect(approveOvertimeSchema.safeParse({ reason: "Checked", payableMinutes: 90.5, reductionReason: "Meal break not deducted by the device" }).success).toBe(false);
  });
});
