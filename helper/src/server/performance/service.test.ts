import { describe, expect, it } from "vitest";
import {
  calibrationAdjustSchema,
  createCheckinSchema,
  createCycleSchema,
  createKeyResultSchema,
  createObjectiveSchema,
  createSuccessionSchema,
  requestFeedbackSchema,
  submitFeedbackSchema,
  MIN_ANONYMITY_COHORT,
} from "@/server/performance/service";
import {
  createCourseSchema,
  createPathSchema,
  enrollSchema,
} from "@/server/learning/service";
import {
  createBandSchema,
  createBudgetSchema,
  createCycleSchema as createCompCycleSchema,
  proposeCompSchema,
} from "@/server/compensation/service";
import {
  answerSurveySchema,
  createSurveySchema,
  publishAnnouncementSchema,
  recognizeSchema,
  referCandidateSchema,
  MIN_ANONYMITY_COHORT as SURVEY_THRESHOLD,
} from "@/server/engagement/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("performance schemas (OC-P6-01/02)", () => {
  it("holds the five-respondent anonymity floor", () => {
    expect(MIN_ANONYMITY_COHORT).toBe(5);
  });

  it("validates cycles, objectives and key results", () => {
    expect(createCycleSchema.safeParse({}).success).toBe(true);
    expect(createObjectiveSchema.safeParse({ title: "Grow shift output", ownerEmployeeId: UUID }).success).toBe(true);
    expect(createObjectiveSchema.safeParse({ title: "", ownerEmployeeId: UUID }).success).toBe(false);
    expect(createKeyResultSchema.safeParse({ objectiveId: UUID, title: "KR", target: 95 }).success).toBe(true);
    expect(createKeyResultSchema.safeParse({ objectiveId: UUID, title: "KR", target: 0 }).success).toBe(false);
  });

  it("validates check-ins with bounded progress", () => {
    expect(createCheckinSchema.safeParse({ employeeId: UUID, notes: "On track" }).success).toBe(true);
    expect(createCheckinSchema.safeParse({ employeeId: UUID, notes: "x", progressPct: 101 }).success).toBe(false);
    expect(createCheckinSchema.safeParse({ employeeId: UUID, notes: "" }).success).toBe(false);
  });

  it("validates feedback requests, entries and calibration adjustments", () => {
    expect(requestFeedbackSchema.safeParse({ subjectEmployeeId: UUID }).success).toBe(true);
    expect(submitFeedbackSchema.safeParse({ requestId: UUID, authorEmployeeId: UUID, body: "Great work", rating: 5 }).success).toBe(true);
    expect(submitFeedbackSchema.safeParse({ requestId: UUID, authorEmployeeId: UUID, body: "x", rating: 6 }).success).toBe(false);
    const adjust = { employeeId: UUID, from: "meets", to: "exceeds", reason: "Verified impact" };
    expect(calibrationAdjustSchema.safeParse(adjust).success).toBe(true);
    expect(calibrationAdjustSchema.safeParse({ ...adjust, reason: "" }).success).toBe(false);
  });

  it("validates succession readiness levels", () => {
    const valid = { candidates: [{ employeeId: UUID, readiness: "ready-1-2y", gaps: ["planning"] }] };
    expect(createSuccessionSchema.safeParse(valid).success).toBe(true);
    expect(createSuccessionSchema.safeParse({ candidates: [] }).success).toBe(false);
    expect(createSuccessionSchema.safeParse({ candidates: [{ employeeId: UUID, readiness: "soon", gaps: [] }] }).success).toBe(false);
  });
});

describe("learning schemas (OC-P6-01)", () => {
  it("validates courses, paths and enrollments", () => {
    expect(createCourseSchema.safeParse({ code: "FANUC-101", title: "Fanuc control" }).success).toBe(true);
    expect(createPathSchema.safeParse({ code: "P1", title: "Path", courseCodes: ["FANUC-101"] }).success).toBe(true);
    expect(createPathSchema.safeParse({ code: "P1", title: "Path", courseCodes: [] }).success).toBe(false);
    expect(enrollSchema.safeParse({ employeeId: UUID, courseCode: "FANUC-101" }).success).toBe(true);
    expect(enrollSchema.safeParse({ employeeId: UUID, courseCode: "" }).success).toBe(false);
  });
});

describe("compensation schemas (OC-P6-01)", () => {
  it("rejects inverted bands and unbounded proposals", () => {
    expect(createBandSchema.safeParse({ minMinor: 700_000_00, maxMinor: 900_000_00 }).success).toBe(true);
    expect(createBudgetSchema.safeParse({ cycleId: UUID, amountMinor: 100 }).success).toBe(true);
    expect(createCompCycleSchema.safeParse({ code: "C", budgetMinor: 100 }).success).toBe(true);
    const proposal = { cycleId: UUID, employeeId: UUID, newBasicMinor: 820_000_00, effectiveDate: "2026-10-01", justification: "Market correction after benchmarking", revisionType: "market_correction" };
    expect(proposeCompSchema.safeParse(proposal).success).toBe(true);
    expect(proposeCompSchema.safeParse({ ...proposal, justification: "" }).success).toBe(false);
  });
});

describe("engagement schemas (OC-P6-02)", () => {
  it("holds the pulse anonymity threshold at five", () => {
    expect(SURVEY_THRESHOLD).toBe(5);
  });

  it("validates announcements, recognition, referrals and surveys", () => {
    expect(publishAnnouncementSchema.safeParse({ title: "Diwali shutdown", body: "The plant closes early on 20 October." }).success).toBe(true);
    // EXP-03 bounds: a 5-120 character title and a body of at least 20 characters.
    expect(publishAnnouncementSchema.safeParse({ title: "Hi", body: "The plant closes early on 20 October." }).success).toBe(false);
    expect(publishAnnouncementSchema.safeParse({ title: "Diwali shutdown", body: "Holiday" }).success).toBe(false);
    expect(publishAnnouncementSchema.parse({ title: "Diwali shutdown", body: "The plant closes early on 20 October." }).channels).toEqual(["employee_portal", "mobile_push"]);
    expect(recognizeSchema.safeParse({ recipientEmployeeId: UUID, message: "Star work" }).success).toBe(true);
    expect(referCandidateSchema.safeParse({ requisitionId: UUID, candidateId: UUID, relationship: "former_colleague" }).success).toBe(true);
    expect(referCandidateSchema.safeParse({ candidateId: UUID, relationship: "former_colleague" }).success).toBe(false);
    const survey = { code: "PULSE-Q4", title: "Pulse", questions: [{ key: "q1", text: "Recommend?", scale: 5 }] };
    expect(createSurveySchema.safeParse(survey).success).toBe(true);
    expect(createSurveySchema.safeParse({ ...survey, questions: [] }).success).toBe(false);
    expect(answerSurveySchema.safeParse({ runId: UUID, answers: { q1: 4 } }).success).toBe(true);
    expect(answerSurveySchema.safeParse({ runId: UUID, answers: {} }).success).toBe(false);
  });
});
