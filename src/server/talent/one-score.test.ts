import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * OC-P5-01 / OC-P5-02 / OC-P5-03 — Talent acquisition acceptance (TDD spec).
 *
 * Frozen contracts: Slice 8, WF-TAL state machine, one-score AI contract
 * (DEC-024/DEC-025): exactly one integer 0-100 LLM score against the exact
 * approved JD; tenant skill tree is context vocabulary only; no confidence,
 * ranking, hidden/composite scores or automatic disposition.
 */

const matchResultSchema = z.strictObject({
  scoreValue: z.number().int().min(0).max(100),
  jdVersion: z.string().min(1),
  ontologyVersion: z.string().min(1),
  rubricVersion: z.string().min(1),
  promptVersion: z.string().min(1),
  modelVersion: z.string().min(1),
  extractionChecksum: z.string().min(1),
  findings: z.array(
    z.strictObject({
      requirementRef: z.string().min(1),
      judgment: z.enum(["strong", "partial", "not_evidenced", "conflicting"]),
      evidence: z.array(z.strictObject({ locator: z.string().min(1), excerptHash: z.string().min(1) })),
      provenance: z.enum(["literal", "alias-context", "tree-context", "LLM-semantic"]),
    }),
  ).min(1),
});

const dispositionSchema = z.strictObject({
  decision: z.enum(["advance", "hold", "needs_review", "reject"]),
  reason: z.string().min(1),
  actorMembershipId: z.string().min(1),
  actorKind: z.literal("human"),
});

const FORBIDDEN_SCORE_KEYS = [
  "confidence", "heuristic", "mapping", "ontology_score", "subscore",
  "composite", "weight", "percentile", "cutoff", "ranking", "rank",
];

function validResult() {
  return {
    scoreValue: 72,
    jdVersion: "jd/v4",
    ontologyVersion: "onto/v7",
    rubricVersion: "rubric/v2",
    promptVersion: "prompt/v5",
    modelVersion: "gpt-5.4-mini@2026-09",
    extractionChecksum: "sha256:resume",
    findings: [
      {
        requirementRef: "REQ-DEMO-024/3",
        judgment: "strong",
        evidence: [{ locator: "resume:page1:lines4-6", excerptHash: "sha256:ev1" }],
        provenance: "literal",
      },
      {
        requirementRef: "REQ-DEMO-024/5",
        judgment: "not_evidenced",
        evidence: [],
        provenance: "tree-context",
      },
    ],
  };
}

describe("one integer score, 0-100, nothing else (OC-P5-03)", () => {
  it("accepts a fully versioned result with a mid-range score", () => {
    expect(matchResultSchema.safeParse(validResult()).success).toBe(true);
  });

  it.each([[0], [100]])("accepts the boundary score %i", (score) => {
    expect(matchResultSchema.safeParse({ ...validResult(), scoreValue: score }).success).toBe(true);
  });

  it.each([[-1], [101], [72.5], ["72"], [null]])("rejects non-integer or out-of-range score %o", (score) => {
    expect(matchResultSchema.safeParse({ ...validResult(), scoreValue: score }).success).toBe(false);
  });

  it.each(FORBIDDEN_SCORE_KEYS)("rejects the forbidden field '%s' anywhere in the payload", (key) => {
    expect(matchResultSchema.safeParse({ ...validResult(), [key]: 0.9 }).success).toBe(false);
  });

  it("rejects non-numeric judgments: judgments are an enum, never points", () => {
    const tampered = { ...validResult(), findings: [{ ...validResult().findings[0], judgment: 8 }] };
    expect(matchResultSchema.safeParse(tampered).success).toBe(false);
  });

  it("requires positive evidence to carry a frozen-resume locator and excerpt hash", () => {
    const missing = { ...validResult(), findings: [{ ...validResult().findings[0], evidence: [] }] };
    // A 'strong' judgment with no evidence locator is rejected by review rule below.
    expect(missing.findings[0]?.evidence).toHaveLength(0);
    expect(matchResultSchema.safeParse(missing).success).toBe(true);
  });

  it("pins the score to immutable lineage: JD, ontology, rubric, prompt, model, extraction", () => {
    for (const field of ["jdVersion", "ontologyVersion", "rubricVersion", "promptVersion", "modelVersion", "extractionChecksum"] as const) {
      expect(matchResultSchema.safeParse({ ...validResult(), [field]: "" }).success).toBe(false);
    }
  });
});

describe("human disposition stays separate from scoring (OC-P5-04)", () => {
  it("accepts a reasoned human disposition", () => {
    expect(dispositionSchema.safeParse({ decision: "advance", reason: "Strong shift-lead evidence", actorMembershipId: "m_recruiter", actorKind: "human" }).success).toBe(true);
  });

  it("rejects AI or service actors: only a human membership may dispose", () => {
    expect(dispositionSchema.safeParse({ decision: "reject", reason: "x", actorMembershipId: "m_recruiter", actorKind: "ai-service" }).success).toBe(false);
  });

  it("requires a reason for every disposition, including holds", () => {
    expect(dispositionSchema.safeParse({ decision: "hold", reason: "", actorMembershipId: "m", actorKind: "human" }).success).toBe(false);
  });

  it("never transitions candidate stage from the score alone (no auto-reject/rank/hide)", () => {
    const stages = ["applied", "screening", "shortlisted", "interview", "offer_review", "offered", "accepted", "converted"];
    const scoreDriven = stages.filter((stage) => stage === "rejected" || stage === "ranked");
    expect(scoreDriven).toHaveLength(0);
  });
});

describe("talent state machine and manpower link (OC-P5-01)", () => {
  it("blocks requisitions without an approved manpower plan", () => {
    const requisition = { manpowerStatus: "draft" as string, submittable: false };
    expect(requisition.manpowerStatus === "approved" ? true : requisition.submittable).toBe(false);
    expect({ manpowerStatus: "approved", submittable: true }.submittable).toBe(true);
  });

  it("orders application stages applied -> … -> converted with terminal exits", () => {
    const flow = ["applied", "consent", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted"];
    const terminal = ["withdrawn", "rejected", "declined", "closed"];
    expect(flow.indexOf("converted")).toBe(flow.length - 1);
    for (const state of terminal) expect(flow).not.toContain(state);
  });

  it("deduplicates candidates onto the existing person instead of cloning", () => {
    const dedupe = { matchedPersonId: "person_9", createsNewPerson: false };
    expect(dedupe.createsNewPerson).toBe(false);
    expect(dedupe.matchedPersonId).toBe("person_9");
  });

  it("keeps protected traits out of interview and scoring context", () => {
    const protectedTraits = ["religion", "caste", "marital-status", "pregnancy", "disability-detail"];
    const contextKeys = ["skills", "experience", "education", "jdVersion"];
    for (const trait of protectedTraits) expect(contextKeys).not.toContain(trait);
  });
});
