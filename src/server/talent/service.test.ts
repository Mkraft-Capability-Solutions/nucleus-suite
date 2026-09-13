import { describe, expect, it } from "vitest";
import {
  createCandidateSchema,
  createJdSchema,
  createOfferSchema,
  createRequisitionSchema,
  disposeApplicationSchema,
  scoreApplicationSchema,
  submitApplicationSchema,
  submitResumeSchema,
} from "@/server/talent/service";
import { startOffboardingSchema, startOnboardingSchema } from "@/server/lifecycle/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("talent schemas (OC-P5-01/03)", () => {
  it("validates requisitions with a hiring manager", () => {
    expect(createRequisitionSchema.safeParse({ title: "Spinning Operator", hiringManagerEmployeeId: UUID }).success).toBe(true);
    expect(createRequisitionSchema.safeParse({ title: "", hiringManagerEmployeeId: UUID }).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ title: "X", hiringManagerEmployeeId: "nope" }).success).toBe(false);
  });

  it("requires at least one JD requirement", () => {
    const valid = { title: "JD", requirements: [{ ref: "R1", text: "Operate ring frames", mustHave: true }] };
    expect(createJdSchema.safeParse(valid).success).toBe(true);
    expect(createJdSchema.safeParse({ title: "JD", requirements: [] }).success).toBe(false);
  });

  it("requires candidate consent and names", () => {
    expect(createCandidateSchema.safeParse({ name: "Asha" }).success).toBe(true);
    expect(createCandidateSchema.safeParse({ name: "" }).success).toBe(false);
    expect(submitApplicationSchema.safeParse({ requisitionId: UUID, candidateId: UUID, extractionId: UUID, consent: true }).success).toBe(true);
    expect(submitApplicationSchema.safeParse({ requisitionId: UUID, candidateId: UUID, extractionId: UUID }).success).toBe(false);
  });

  it("bounds resume payloads", () => {
    expect(submitResumeSchema.safeParse({ contentBase64: "aGk=" }).success).toBe(true);
    expect(submitResumeSchema.safeParse({ contentBase64: "" }).success).toBe(false);
  });

  it("enforces the one-score contract at the schema layer", () => {
    const finding = { requirementRef: "R1", judgment: "strong", evidence: [{ locator: "resume:1:1", excerptHash: "abc" }], provenance: "literal" };
    const base = { jobDescriptionId: UUID, scoreValue: 72, extractionChecksum: "sha256:x", findings: [finding] };
    expect(scoreApplicationSchema.safeParse(base).success).toBe(true);
    expect(scoreApplicationSchema.safeParse({ ...base, scoreValue: 101 }).success).toBe(false);
    expect(scoreApplicationSchema.safeParse({ ...base, scoreValue: 72.5 }).success).toBe(false);
    expect(scoreApplicationSchema.safeParse({ ...base, findings: [] }).success).toBe(false);
    const noEvidence = { ...base, findings: [{ ...finding, evidence: [] }] };
    expect(scoreApplicationSchema.safeParse(noEvidence).success).toBe(false);
  });

  it("requires reasoned human dispositions and bounded offers", () => {
    expect(disposeApplicationSchema.safeParse({ resultId: UUID, decision: "advance", reason: "Strong evidence" }).success).toBe(true);
    expect(disposeApplicationSchema.safeParse({ resultId: UUID, decision: "advance", reason: "" }).success).toBe(false);
    expect(disposeApplicationSchema.safeParse({ resultId: UUID, decision: "maybe", reason: "x" }).success).toBe(false);
    const offer = { applicationId: UUID, basicMinor: 5_000_000, joiningDate: "2026-10-01" };
    expect(createOfferSchema.safeParse(offer).success).toBe(true);
    expect(createOfferSchema.safeParse({ ...offer, basicMinor: 0 }).success).toBe(false);
  });
});

describe("lifecycle schemas (OC-P5-04)", () => {
  it("validates onboarding starts and offboarding notices", () => {
    expect(startOnboardingSchema.safeParse({ employeeId: UUID }).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ employeeId: UUID, reason: "Resigned", lastWorkingDate: "2026-09-30" }).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ employeeId: UUID, reason: "", lastWorkingDate: "2026-09-30" }).success).toBe(false);
    expect(startOffboardingSchema.safeParse({ employeeId: UUID, reason: "x", lastWorkingDate: "30-09-2026" }).success).toBe(false);
  });
});
