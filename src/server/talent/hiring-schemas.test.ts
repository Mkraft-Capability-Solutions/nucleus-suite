import { describe, expect, it } from "vitest";
import {
  claimBenefitSchema,
  createBenefitOptionSchema,
  createBenefitPlanSchema,
  enrollBenefitSchema,
} from "@/server/benefits/service";
import {
  createInterviewPlanSchema,
  createPostingSchema,
  scheduleSessionSchema,
  submitScoreSchema,
} from "@/server/interviews/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("interview schemas", () => {
  it("validates plans, sessions and sealed scorecards", () => {
    expect(createInterviewPlanSchema.safeParse({ requisitionId: UUID, title: "Operator panel", rounds: ["technical", "hr"] }).success).toBe(true);
    expect(createInterviewPlanSchema.safeParse({ requisitionId: UUID, title: "x", rounds: [] }).success).toBe(false);
    expect(scheduleSessionSchema.safeParse({ applicationId: UUID, planId: UUID, scheduledAt: "2026-10-01T10:00:00+05:30", panelMembershipIds: [UUID] }).success).toBe(true);
    expect(scheduleSessionSchema.safeParse({ applicationId: UUID, planId: UUID, scheduledAt: "2026-10-01T10:00:00+05:30", panelMembershipIds: [] }).success).toBe(false);
    const score = { sessionId: UUID, ratings: { skills: 4, attitude: 5 }, recommendation: "hire", notes: "Strong" };
    expect(submitScoreSchema.safeParse(score).success).toBe(true);
    expect(submitScoreSchema.safeParse({ ...score, recommendation: "maybe" }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...score, ratings: { skills: 6 } }).success).toBe(false);
  });
});

describe("posting schemas", () => {
  it("validates job postings with channels and windows", () => {
    const valid = { jobDescriptionId: UUID, requisitionId: UUID, channels: ["careers-page"], opensOn: "2026-09-01", closesOn: "2026-09-30" };
    expect(createPostingSchema.safeParse(valid).success).toBe(true);
    expect(createPostingSchema.safeParse({ ...valid, channels: [] }).success).toBe(false);
    expect(createPostingSchema.safeParse({ ...valid, closesOn: "2026-08-01" }).success).toBe(false);
  });
});

describe("benefit schemas", () => {
  it("validates plans, options, enrollments and claims", () => {
    expect(createBenefitPlanSchema.safeParse({ code: "MEDICLAIM-26", name: "Mediclaim", coverageMinor: 500_000_00 }).success).toBe(true);
    expect(createBenefitOptionSchema.safeParse({ planCode: "MEDICLAIM-26", code: "SELF", employeeShareMinor: 12_000_00 }).success).toBe(true);
    expect(enrollBenefitSchema.safeParse({ employeeId: UUID, optionCode: "SELF" }).success).toBe(true);
    expect(claimBenefitSchema.safeParse({ enrollmentId: UUID, amountMinor: 45_000_00, diagnosis: "Fracture" }).success).toBe(true);
    expect(claimBenefitSchema.safeParse({ enrollmentId: UUID, amountMinor: 0, diagnosis: "x" }).success).toBe(false);
  });
});
