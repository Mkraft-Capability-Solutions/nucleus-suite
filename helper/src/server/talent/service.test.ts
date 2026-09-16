import { describe, expect, it } from "vitest";
import {
  approveRequisitionSchema,
  createCandidateSchema,
  createJdSchema,
  createOfferSchema,
  createRequisitionSchema,
  disposeApplicationSchema,
  scoreApplicationSchema,
  submitApplicationSchema,
  submitResumeSchema,
  requiredByIsReachable,
  transitionOfferSchema,
} from "@/server/talent/service";
import { startOffboardingSchema, startOnboardingSchema } from "@/server/lifecycle/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

const REQUISITION = {
  title: "Spinning Operator",
  hiringManagerEmployeeId: UUID,
  designation: "Operator",
  locationCode: "Plant North",
  workerClass: "workman_permanent",
  requiredBy: "2027-01-31",
  ctcMinMinor: 3_00_000_00,
  ctcMaxMinor: 4_50_000_00,
  justification: "Third shift restart needs a full spinning crew from November.",
  qualificationRequired: "ITI or 10th with mill-floor experience",
  experienceMinYears: 1,
  experienceMaxYears: 5,
};

const CANDIDATE = {
  name: "Asha Verma",
  email: "asha@example.test",
  phone: "+919800000002",
  source: "job_portal",
  totalExperienceYears: 6,
};

describe("talent schemas (OC-P5-01/03)", () => {
  it("validates requisitions with a hiring manager", () => {
    expect(createRequisitionSchema.safeParse(REQUISITION).success).toBe(true);
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, title: "" }).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, hiringManagerEmployeeId: "nope" }).success).toBe(false);
  });

  it("requires at least one JD requirement", () => {
    const valid = { title: "JD", requirements: [{ ref: "R1", text: "Operate ring frames", mustHave: true }] };
    expect(createJdSchema.safeParse(valid).success).toBe(true);
    expect(createJdSchema.safeParse({ title: "JD", requirements: [] }).success).toBe(false);
  });

  it("requires candidate consent and names", () => {
    expect(createCandidateSchema.safeParse(CANDIDATE).success).toBe(true);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, name: "" }).success).toBe(false);
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
    const offer = {
      applicationId: UUID, designationCode: "Spinning Operator", band: "E3", locationCode: "Plant North",
      workerClass: "workman_permanent", employmentType: "permanent",
      offeredCtcMinor: 7_000_000, basicMinor: 5_000_000, joiningDate: "2026-10-01",
      letterTemplateId: "OFFER-WORKMAN-v1",
    };
    expect(createOfferSchema.safeParse(offer).success).toBe(true);
    expect(createOfferSchema.safeParse({ ...offer, basicMinor: 0 }).success).toBe(false);
  });
});

describe("TAL-04 offer terms", () => {
  const offer = {
    applicationId: UUID, designationCode: "Spinning Operator", band: "E3", locationCode: "Plant North",
    workerClass: "workman_permanent", employmentType: "permanent",
    offeredCtcMinor: 7_000_000, basicMinor: 5_000_000, joiningDate: "2026-10-01",
    letterTemplateId: "OFFER-WORKMAN-v1",
  };

  it("requires the terms the letter quotes", () => {
    for (const field of ["designationCode", "band", "locationCode", "workerClass", "employmentType", "offeredCtcMinor", "letterTemplateId"]) {
      const { [field]: _dropped, ...without } = offer as Record<string, unknown>;
      expect(createOfferSchema.safeParse(without).success, field).toBe(false);
    }
  });

  it("defaults the retention terms the workbook defaults to zero", () => {
    const parsed = createOfferSchema.parse(offer);
    expect(parsed.joiningBonusMinor).toBe(0);
    expect(parsed.clawbackMonths).toBe(0);
  });

  it("rejects a CTC below the basic it contains", () => {
    expect(createOfferSchema.safeParse({ ...offer, offeredCtcMinor: 4_000_000 }).success).toBe(false);
    expect(createOfferSchema.safeParse({ ...offer, offeredCtcMinor: 5_000_000 }).success).toBe(true);
  });

  it("holds the workbook's vocabularies for class, type and channel", () => {
    expect(createOfferSchema.safeParse({ ...offer, workerClass: "gig" }).success).toBe(false);
    expect(createOfferSchema.safeParse({ ...offer, employmentType: "freelance" }).success).toBe(false);
    expect(transitionOfferSchema.safeParse({ action: "send", releaseChannel: "carrier_pigeon" }).success).toBe(false);
  });

  it("demands a release channel on release and a reason on decline", () => {
    expect(transitionOfferSchema.safeParse({ action: "send" }).success).toBe(false);
    expect(transitionOfferSchema.safeParse({ action: "send", releaseChannel: "email" }).success).toBe(true);
    expect(transitionOfferSchema.safeParse({ action: "decline" }).success).toBe(false);
    expect(transitionOfferSchema.safeParse({ action: "decline", declineReason: "counter_offer_accepted" }).success).toBe(true);
    // Negotiating and lapsing are responses in their own right, not decline variants.
    expect(transitionOfferSchema.safeParse({ action: "negotiate" }).success).toBe(true);
    expect(transitionOfferSchema.safeParse({ action: "lapse" }).success).toBe(true);
  });
});

describe("lifecycle schemas (OC-P5-04)", () => {
  it("validates onboarding starts and offboarding notices", () => {
    expect(startOnboardingSchema.safeParse({ employeeId: UUID }).success).toBe(true);
    // The exit notice fields themselves belong to the lifecycle worker; this only holds the
    // shape the talent flow hands over: an employee, a reason category and a last working day.
    const exit = {
      employeeId: UUID,
      exitReasonCategory: "better_opportunity",
      reason: "Leaving for a supervisory role at another mill from October.",
      lastWorkingDate: "2026-09-30",
    };
    expect(startOffboardingSchema.safeParse(exit).success).toBe(true);
    expect(startOffboardingSchema.safeParse({ ...exit, reason: "" }).success).toBe(false);
    expect(startOffboardingSchema.safeParse({ ...exit, lastWorkingDate: "30-09-2026" }).success).toBe(false);
  });
});

describe("TAL-02 candidate record and application", () => {
  it("insists on both contact points in the workbook's formats", () => {
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, email: undefined }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, phone: undefined }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, phone: "98000" }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, phone: "+91 98000 00002" }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, email: "asha@" }).success).toBe(false);
  });

  it("ties the source channel to its attribution", () => {
    const referral = { ...CANDIDATE, source: "employee_referral" };
    expect(createCandidateSchema.safeParse(referral).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...referral, referrerEmployeeId: UUID }).success).toBe(true);
    const agency = { ...CANDIDATE, source: "recruitment_agency" };
    expect(createCandidateSchema.safeParse(agency).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...agency, agencyId: UUID }).success).toBe(true);
    // A free-text channel is no longer accepted: the workbook names a closed vocabulary.
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, source: "referral" }).success).toBe(false);
  });

  it("bounds experience and notice period", () => {
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, totalExperienceYears: undefined }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, totalExperienceYears: 51 }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, totalExperienceYears: 0 }).success).toBe(true);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, noticePeriodDays: 181 }).success).toBe(false);
    expect(createCandidateSchema.safeParse({ ...CANDIDATE, noticePeriodDays: 90 }).success).toBe(true);
  });

  it("requires a rejection category only on a rejection", () => {
    const base = { resultId: UUID, reason: "Evidence does not cover ring-frame work" };
    expect(disposeApplicationSchema.safeParse({ ...base, decision: "reject" }).success).toBe(false);
    expect(disposeApplicationSchema.safeParse({ ...base, decision: "reject", rejectionReason: "skill_mismatch" }).success).toBe(true);
    expect(disposeApplicationSchema.safeParse({ ...base, decision: "hold", rejectionReason: "skill_mismatch" }).success).toBe(false);
    expect(disposeApplicationSchema.safeParse({ ...base, decision: "hold" }).success).toBe(true);
  });

  it("carries no second score under any name", () => {
    const finding = { requirementRef: "R1", judgment: "strong", evidence: [{ locator: "resume:1:1", excerptHash: "abc" }], provenance: "literal" };
    const base = { jobDescriptionId: UUID, scoreValue: 72, extractionChecksum: "sha256:x", findings: [finding] };
    const parsed = scoreApplicationSchema.parse(base);
    expect(Object.keys(parsed).filter((key) => /score|rank|weight|confidence/i.test(key))).toEqual(["scoreValue"]);
  });
});

describe("TAL-01 manpower requisition", () => {
  it("requires the sanction key, the terms and the window", () => {
    for (const field of [
      "designation", "locationCode", "workerClass", "requiredBy",
      "ctcMinMinor", "ctcMaxMinor", "qualificationRequired", "experienceMinYears", "experienceMaxYears",
    ]) {
      const { [field]: _dropped, ...without } = REQUISITION as Record<string, unknown>;
      expect(createRequisitionSchema.safeParse(without).success, field).toBe(false);
    }
  });

  it("keeps both ranges the right way round", () => {
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, ctcMaxMinor: 1_00_000_00 }).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, experienceMaxYears: 0 }).success).toBe(false);
    // Equal ends are a single-point range, not an inverted one.
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, ctcMaxMinor: REQUISITION.ctcMinMinor }).success).toBe(true);
  });

  it("asks an addition to justify itself and a replacement to name its seat", () => {
    const { justification: _drop, ...bare } = REQUISITION;
    expect(createRequisitionSchema.safeParse(bare).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ ...bare, justification: "Too short" }).success).toBe(false);
    const replacement = { ...bare, requisitionType: "replacement" };
    expect(createRequisitionSchema.safeParse(replacement).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ ...replacement, againstPositionCode: "SPN-OP-07" }).success).toBe(true);
  });

  it("defaults employment type to permanent and holds the class vocabulary", () => {
    expect(createRequisitionSchema.parse(REQUISITION).employmentType).toBe("permanent");
    expect(createRequisitionSchema.parse(REQUISITION).skills).toEqual([]);
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, employmentType: "gig" }).success).toBe(false);
    expect(createRequisitionSchema.safeParse({ ...REQUISITION, workerClass: "freelance" }).success).toBe(false);
  });

  it("refuses a required-by date that has already passed", () => {
    const today = new Date("2026-09-14T00:00:00Z");
    expect(requiredByIsReachable("2026-09-14", today)).toBe(true);
    expect(requiredByIsReachable("2026-12-01", today)).toBe(true);
    expect(requiredByIsReachable("2026-09-13", today)).toBe(false);
  });

  it("names the recruiter who owns the opening at approval", () => {
    expect(approveRequisitionSchema.safeParse({ override: false }).success).toBe(false);
    expect(approveRequisitionSchema.safeParse({ override: false, recruiterEmployeeId: UUID }).success).toBe(true);
  });
});
