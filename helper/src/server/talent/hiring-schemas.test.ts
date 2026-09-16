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

const SESSION = {
  applicationId: UUID,
  planId: UUID,
  scheduledAt: "2026-10-01T10:00:00+05:30",
  durationMinutes: 45,
  panelMembershipIds: [UUID],
  round: "technical_1",
};

const CARD = {
  sessionId: UUID,
  competencyRatings: [
    { competency: "skills", rating: 4, remark: "Reads a ring frame quickly" },
    { competency: "attitude", rating: 5 },
  ],
  overallRating: "hire",
  strengths: "Handles doffing and piecing without supervision on a full shift.",
  concerns: "Has not run the newer autoconer line and would need a week of shadowing.",
  notes: "Strong",
};

describe("interview schemas", () => {
  it("validates plans, sessions and sealed scorecards", () => {
    expect(createInterviewPlanSchema.safeParse({ requisitionId: UUID, title: "Operator panel", rounds: ["technical_1", "hr"] }).success).toBe(true);
    expect(createInterviewPlanSchema.safeParse({ requisitionId: UUID, title: "x", rounds: [] }).success).toBe(false);
    expect(scheduleSessionSchema.safeParse(SESSION).success).toBe(true);
    expect(scheduleSessionSchema.safeParse({ ...SESSION, panelMembershipIds: [] }).success).toBe(false);
    expect(submitScoreSchema.safeParse(CARD).success).toBe(true);
    expect(submitScoreSchema.safeParse({ ...CARD, overallRating: "maybe" }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...CARD, competencyRatings: [{ competency: "skills", rating: 6 }] }).success).toBe(false);
  });

  it("holds the workbook's round and mode vocabularies (TAL-03)", () => {
    expect(createInterviewPlanSchema.safeParse({ requisitionId: UUID, title: "P", rounds: ["technical"] }).success).toBe(false);
    expect(scheduleSessionSchema.safeParse({ ...SESSION, round: "technical" }).success).toBe(false);
    expect(scheduleSessionSchema.parse(SESSION).mode).toBe("in_person");
    expect(scheduleSessionSchema.safeParse({ ...SESSION, mode: "carrier_pigeon" }).success).toBe(false);
    expect(scheduleSessionSchema.safeParse({ ...SESSION, mode: "video" }).success).toBe(true);
  });

  it("requires a duration, a verdict, and both halves of the written feedback", () => {
    expect(scheduleSessionSchema.safeParse({ ...SESSION, durationMinutes: undefined }).success).toBe(false);
    expect(scheduleSessionSchema.safeParse({ ...SESSION, durationMinutes: 0 }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...CARD, overallRating: undefined }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...CARD, strengths: "Too short" }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...CARD, concerns: undefined }).success).toBe(false);
    expect(submitScoreSchema.safeParse({ ...CARD, competencyRatings: [] }).success).toBe(false);
  });

  it("refuses the same competency twice on one card", () => {
    const twice = [{ competency: "skills", rating: 4 }, { competency: "skills", rating: 2 }];
    expect(submitScoreSchema.safeParse({ ...CARD, competencyRatings: twice }).success).toBe(false);
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
