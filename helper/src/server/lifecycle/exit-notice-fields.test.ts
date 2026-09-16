import { describe, expect, it } from "vitest";
import { startOffboardingSchema } from "./service";

/** FRM-LCY-03 field rules that hold without a database. */
describe("startOffboardingSchema (FRM-LCY-03)", () => {
  const base = {
    employeeId: "123e4567-e89b-12d3-a456-426614174000",
    exitReasonCategory: "better_opportunity",
    reason: "Moving to a competitor in the same city",
    lastWorkingDate: "2026-10-31",
  };

  it("defaults to a resignation that keeps the person rehireable and starts no clearance", () => {
    const parsed = startOffboardingSchema.parse(base);
    expect(parsed.exitType).toBe("resignation");
    expect(parsed.rehireEligible).toBe("yes");
    expect(parsed.noticeWaivedDays).toBe(0);
    expect(parsed.isGardenLeave).toBe(false);
    expect(parsed.managerAccepted).toBe(false);
    expect(parsed.hrAccepted).toBe(false);
  });

  it("takes the exit type and reason category from the workbook vocabularies", () => {
    expect(startOffboardingSchema.safeParse({ ...base, exitType: "death_in_service" }).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ ...base, exitType: "quit" }).success).toBe(false);
    expect(startOffboardingSchema.safeParse({ ...base, exitReasonCategory: "bored" }).success).toBe(false);
  });

  it("holds the reason detail to twenty characters", () => {
    expect(startOffboardingSchema.safeParse({ ...base, reason: "Better offer" }).success).toBe(false);
  });

  it("requires a reason for a notice waiver and for an ineligible rehire", () => {
    expect(startOffboardingSchema.safeParse({ ...base, noticeWaivedDays: 30 }).success).toBe(false);
    expect(startOffboardingSchema.safeParse({ ...base, noticeWaivedDays: 30, noticeWaiverReason: "Released early at the client's request" }).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ ...base, rehireEligible: "no" }).success).toBe(false);
    expect(startOffboardingSchema.safeParse({ ...base, rehireEligible: "no", rehireReason: "Terminated for a proven safety breach" }).success).toBe(true);
    // "With approval" is still not plain eligibility, so it needs the reason too.
    expect(startOffboardingSchema.safeParse({ ...base, rehireEligible: "with_approval" }).success).toBe(false);
  });

  it("keeps the exit interview on or before the last working day", () => {
    expect(startOffboardingSchema.safeParse({ ...base, exitInterviewDate: "2026-10-30" }).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ ...base, exitInterviewDate: "2026-11-02" }).success).toBe(false);
  });
});
