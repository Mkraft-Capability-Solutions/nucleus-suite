import { describe, expect, it } from "vitest";
import {
  applyAnonymityFloor,
  applyGrowthActionSchema,
  assertBandingConfigured,
  assessSinglePointOfFailure,
  BANDING_NOT_CONFIGURED_REASON,
  classifyRating,
  CRITICAL_ROLE_NOT_RECORDED,
  describeCoachingOrigin,
  isReadiness,
  NINE_BOX_CELLS,
  nineBoxBoundariesSchema,
  nineBoxCellKey,
  readinessSchema,
  READINESS_VOCABULARY,
  recordCoachingNoteSchema,
  recordPlacementSchema,
  recordSuccessionCandidateSchema,
  summariseBench,
  SPOF_DERIVED_CRITERION,
  type BenchCandidate,
} from "@/server/performance/calibration";
import { MIN_ANONYMITY_COHORT } from "@/server/performance/service";
import { HttpError } from "@/server/platform/http";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("nine-box grid shape", () => {
  it("has exactly nine cells named only by their two bands", () => {
    expect(NINE_BOX_CELLS).toHaveLength(9);
    expect(new Set(NINE_BOX_CELLS.map((cell) => cell.key)).size).toBe(9);
    expect(NINE_BOX_CELLS.map((cell) => cell.label)).toContain("High performance · High potential");
    // No editorial label ("Star", "Enigma", …) is attached to anybody by this code.
    expect(NINE_BOX_CELLS.every((cell) => cell.label.includes("performance") && cell.label.includes("potential"))).toBe(true);
  });

  it("keys a cell from its performance and potential bands", () => {
    expect(nineBoxCellKey("high", "low")).toBe("high-performance/low-potential");
    expect(nineBoxCellKey("high", "low")).not.toBe(nineBoxCellKey("low", "high"));
  });
});

describe("banding is refused when no boundaries are configured", () => {
  it("returns an undetermined classification with the reason stated", () => {
    const result = classifyRating(4.6, null);
    expect(result.determined).toBe(false);
    expect(result.determined === false && result.reason).toBe(BANDING_NOT_CONFIGURED_REASON);
  });

  it("throws rather than guessing a cut-off", () => {
    expect(() => assertBandingConfigured(null)).toThrow(HttpError);
    try {
      assertBandingConfigured(null);
    } catch (error) {
      expect((error as HttpError).status).toBe(422);
      expect((error as HttpError).code).toBe("POLICY_VIOLATION");
      expect((error as HttpError).details[0].field).toBe("settings.performance.nine_box");
    }
  });

  it("bands only once cut-offs exist", () => {
    const boundaries = { ratingScaleMax: 5, mediumAtOrAbove: 3, highAtOrAbove: 4.5 };
    expect(assertBandingConfigured(boundaries)).toBe(boundaries);
    const high = classifyRating(4.6, boundaries);
    expect(high.determined && high.band).toBe("high");
    const medium = classifyRating(3, boundaries);
    expect(medium.determined && medium.band).toBe("medium");
    const low = classifyRating(2.9, boundaries);
    expect(low.determined && low.band).toBe("low");
    expect(classifyRating(null, boundaries).determined).toBe(false);
  });

  it("refuses boundary configuration that is not ordered or is off-scale", () => {
    expect(nineBoxBoundariesSchema.safeParse({ ratingScaleMax: 5, mediumAtOrAbove: 3, highAtOrAbove: 4.5 }).success).toBe(true);
    expect(nineBoxBoundariesSchema.safeParse({ ratingScaleMax: 5, mediumAtOrAbove: 4.5, highAtOrAbove: 3 }).success).toBe(false);
    expect(nineBoxBoundariesSchema.safeParse({ ratingScaleMax: 5, mediumAtOrAbove: 3, highAtOrAbove: 9 }).success).toBe(false);
    expect(nineBoxBoundariesSchema.safeParse({ ratingScaleMax: null, mediumAtOrAbove: null, highAtOrAbove: null }).success).toBe(false);
  });
});

describe("placement payloads", () => {
  it("needs an explicit human band pair and a rationale", () => {
    const base = { calibrationSessionId: UUID_A, employeeId: UUID_B, performanceBand: "high", potentialBand: "medium", rationale: "Ran the line through the shutdown." };
    expect(recordPlacementSchema.safeParse(base).success).toBe(true);
    expect(recordPlacementSchema.safeParse({ ...base, rationale: "" }).success).toBe(false);
    expect(recordPlacementSchema.safeParse({ ...base, performanceBand: "stellar" }).success).toBe(false);
    expect(recordPlacementSchema.safeParse({ ...base, adjustmentReason: "Moved after peer evidence." }).success).toBe(true);
  });
});

describe("anonymity floor on review evidence", () => {
  it("withholds an aggregate built from fewer than the minimum cohort", () => {
    const [thin, thick, unknown] = applyAnonymityFloor([
      { respondentCount: MIN_ANONYMITY_COHORT - 1, reviewRating: 4.4 },
      { respondentCount: MIN_ANONYMITY_COHORT, reviewRating: 3.8 },
      { respondentCount: null, reviewRating: null },
    ]);
    expect(thin.anonymised).toBe(true);
    expect(thin.reviewRating).toBeNull();
    expect(thin.anonymityNote).toContain(String(MIN_ANONYMITY_COHORT));
    expect(thick.anonymised).toBe(false);
    expect(thick.reviewRating).toBe(3.8);
    expect(unknown.anonymised).toBe(false);
  });
});

describe("coaching note provenance", () => {
  it("refuses a model-generated note with no run id, and a human note carrying one", () => {
    const base = { managerEmployeeId: UUID_A, subjectEmployeeId: UUID_B, note: "Pair on the shutdown plan." };
    expect(recordCoachingNoteSchema.safeParse(base).success).toBe(true);
    expect(recordCoachingNoteSchema.safeParse({ ...base, origin: "model-generated" }).success).toBe(false);
    expect(recordCoachingNoteSchema.safeParse({ ...base, origin: "model-generated", aiRunId: UUID_C }).success).toBe(true);
    expect(recordCoachingNoteSchema.safeParse({ ...base, origin: "human", aiRunId: UUID_C }).success).toBe(false);
    expect(recordCoachingNoteSchema.safeParse({ ...base, note: "" }).success).toBe(false);
  });

  it("defaults to a human author and never describes generated text as written by one", () => {
    const parsed = recordCoachingNoteSchema.parse({ managerEmployeeId: UUID_A, subjectEmployeeId: UUID_B, note: "Delegate the daily huddle." });
    expect(parsed.origin).toBe("human");
    expect(describeCoachingOrigin({ origin: "human", aiRunId: null })).toBe("Written by a person.");
    const generated = describeCoachingOrigin({ origin: "model-generated", aiRunId: UUID_C });
    expect(generated).toContain(UUID_C);
    expect(generated).toContain("not written by a person");
  });

  it("needs a real action to track", () => {
    expect(applyGrowthActionSchema.safeParse({ coachingNoteId: UUID_A, action: "Shadow the shutdown review" }).success).toBe(true);
    expect(applyGrowthActionSchema.safeParse({ coachingNoteId: UUID_A, action: "" }).success).toBe(false);
    expect(applyGrowthActionSchema.safeParse({ coachingNoteId: UUID_A, action: "x", dueDate: "31-12-2026" }).success).toBe(false);
    expect(applyGrowthActionSchema.safeParse({ coachingNoteId: UUID_A, action: "x", dueDate: "2026-12-31" }).success).toBe(true);
  });
});

describe("succession readiness vocabulary", () => {
  it("accepts only the recorded vocabulary and never a percentage", () => {
    expect(READINESS_VOCABULARY).toEqual(["ready-now", "ready-1-2y", "ready-3y-plus"]);
    for (const value of READINESS_VOCABULARY) expect(readinessSchema.safeParse(value).success).toBe(true);
    expect(readinessSchema.safeParse("ready-soon").success).toBe(false);
    expect(readinessSchema.safeParse("88%").success).toBe(false);
    expect(readinessSchema.safeParse(88).success).toBe(false);
    expect(readinessSchema.safeParse("").success).toBe(false);
    expect(isReadiness("ready-now")).toBe(true);
    expect(isReadiness("ready-in-a-bit")).toBe(false);
  });

  it("validates a recorded bench candidate", () => {
    const base = { successionPlanId: UUID_A, employeeId: UUID_B, readiness: "ready-now", rationale: "Covered the role for two quarters." };
    expect(recordSuccessionCandidateSchema.safeParse(base).success).toBe(true);
    expect(recordSuccessionCandidateSchema.safeParse({ ...base, readiness: "ready-ish" }).success).toBe(false);
    expect(recordSuccessionCandidateSchema.safeParse({ ...base, rationale: "" }).success).toBe(false);
    expect(recordSuccessionCandidateSchema.parse(base).gaps).toEqual([]);
  });

  it("summarises a bench as counts with the derivation stated, not as a score", () => {
    const candidates: BenchCandidate[] = [
      { employeeId: UUID_A, readiness: "ready-now", gaps: [] },
      { employeeId: UUID_B, readiness: "ready-1-2y", gaps: ["Commercial exposure"] },
      { employeeId: UUID_C, readiness: null, gaps: [] },
    ];
    const summary = summariseBench(candidates);
    expect(summary.candidateCount).toBe(3);
    expect(summary.assessedCount).toBe(2);
    expect(summary.unassessedCount).toBe(1);
    expect(summary.readyNowCount).toBe(1);
    expect(summary.counts["ready-3y-plus"]).toBe(0);
    expect(summary.derivation).toContain("No readiness percentage is published");
    expect(Object.keys(summary)).not.toContain("readinessPct");
  });
});

describe("single point of failure", () => {
  it("prefers a recorded flag and its criterion", () => {
    const assessment = assessSinglePointOfFailure({
      recordedSpof: true,
      recordedCriterion: "Only licensed boiler operator on site.",
      candidates: [{ employeeId: UUID_A, readiness: "ready-now", gaps: [] }],
    });
    expect(assessment.source).toBe("recorded");
    expect(assessment.flagged).toBe(true);
    expect(assessment.criterion).toBe("Only licensed boiler operator on site.");
  });

  it("derives cover only from recorded readiness, and states the rule", () => {
    const flagged = assessSinglePointOfFailure({
      recordedSpof: null,
      recordedCriterion: null,
      candidates: [{ employeeId: UUID_A, readiness: "ready-3y-plus", gaps: [] }],
    });
    expect(flagged.source).toBe("derived-coverage");
    expect(flagged.flagged).toBe(true);
    expect(flagged.criterion).toBe(SPOF_DERIVED_CRITERION);

    const covered = assessSinglePointOfFailure({
      recordedSpof: null,
      recordedCriterion: null,
      candidates: [{ employeeId: UUID_A, readiness: "ready-now", gaps: [] }],
    });
    expect(covered.flagged).toBe(false);
  });

  it("reports an empty bench as not assessed rather than as risk", () => {
    const assessment = assessSinglePointOfFailure({ recordedSpof: null, recordedCriterion: null, candidates: [] });
    expect(assessment.source).toBe("not-assessed");
    expect(assessment.flagged).toBeNull();
  });

  it("keeps criticality a recorded fact", () => {
    expect(CRITICAL_ROLE_NOT_RECORDED).toContain("No criticality criterion is defined");
  });
});
