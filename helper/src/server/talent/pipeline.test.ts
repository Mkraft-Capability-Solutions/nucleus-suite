import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ADVERSE_IMPACT_INPUTS,
  ADVERSE_IMPACT_AVAILABLE_INPUTS,
  BOARD_COLUMNS,
  PIPELINE_STAGE_FLOW,
  PIPELINE_TERMINAL_STAGES,
  adverseImpactReadiness,
  boardColumnOf,
  buildBoard,
  canAdvance,
  nextStageOf,
  parseReferralAwardScheme,
  planReferralAward,
  type PipelineCard,
  type ReferralAwardScheme,
  type ReferralProgressInput,
} from "./pipeline";

function card(overrides: Partial<PipelineCard> & { applicationId: string; stage: string }): PipelineCard {
  return {
    candidateId: `cand-${overrides.applicationId}`,
    candidateName: `Candidate ${overrides.applicationId}`,
    requisitionId: "req-1",
    requisitionCode: "REQ-2026-001",
    roleTitle: "Spinning Operator",
    department: "Weaving",
    stageLabel: overrides.stage,
    nextStage: nextStageOf(overrides.stage),
    nextStageLabel: nextStageOf(overrides.stage),
    terminal: (PIPELINE_TERMINAL_STAGES as readonly string[]).includes(overrides.stage),
    matchScore: null,
    scoreBasis: null,
    skills: [],
    experienceYears: null,
    source: "referral",
    appliedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("stage grouping onto the board (SCR-090)", () => {
  // The stage order is the hiring contract. pipeline.ts mirrors a literal that
  // service.ts does not export; if the service ever changes its flow, this fails
  // rather than letting the board quietly place cards in the wrong column.
  it("mirrors the stage order held in the talent service", () => {
    const source = readFileSync(join(resolve(process.cwd()), "src/server/talent/service.ts"), "utf8");
    const flow = /const STAGE_FLOW = \[([^\]]*)\]/.exec(source);
    const terminal = /const TERMINAL_STAGES = \[([^\]]*)\]/.exec(source);
    const parse = (match: RegExpExecArray | null): string[] =>
      (match?.[1] ?? "").split(",").map((entry) => entry.trim().replace(/^"|"$/g, "")).filter(Boolean);
    expect(parse(flow)).toEqual([...PIPELINE_STAGE_FLOW]);
    expect(parse(terminal)).toEqual([...PIPELINE_TERMINAL_STAGES]);
  });

  it("assigns every non-terminal stage to exactly one column", () => {
    for (const stage of PIPELINE_STAGE_FLOW) {
      const owners = BOARD_COLUMNS.filter((column) => column.stages.includes(stage));
      expect(owners, `stage ${stage} must belong to one column`).toHaveLength(1);
    }
  });

  it("places the four reference columns over the nine contract stages as documented", () => {
    expect(BOARD_COLUMNS.map((column) => column.id)).toEqual([
      "sourced_applied", "assisted_screening", "interview_scoring", "offer_preboard",
    ]);
    expect(boardColumnOf("applied")).toBe("sourced_applied");
    expect(boardColumnOf("screening")).toBe("assisted_screening");
    expect(boardColumnOf("shortlisted")).toBe("assisted_screening");
    expect(boardColumnOf("interview")).toBe("interview_scoring");
    expect(boardColumnOf("background")).toBe("interview_scoring");
    for (const stage of ["offer_review", "offered", "accepted", "converted"]) {
      expect(boardColumnOf(stage)).toBe("offer_preboard");
    }
  });

  it("gives a terminal stage no column, so an ended application is never shown as work in progress", () => {
    for (const stage of PIPELINE_TERMINAL_STAGES) {
      expect(boardColumnOf(stage)).toBeNull();
    }
  });

  it("separates closed and unrecognised stages instead of dropping them", () => {
    const board = buildBoard([
      card({ applicationId: "a", stage: "applied" }),
      card({ applicationId: "b", stage: "rejected" }),
      card({ applicationId: "c", stage: "teleported" }),
    ]);
    expect(board.columns[0]!.cards.map((entry) => entry.applicationId)).toEqual(["a"]);
    expect(board.closed.map((entry) => entry.applicationId)).toEqual(["b"]);
    expect(board.unmapped.map((entry) => entry.applicationId)).toEqual(["c"]);
    expect(board.totals).toEqual({ active: 1, closed: 1, scored: 0, unscored: 3 });
  });
});

describe("one-step advance contract (SCR-090)", () => {
  // advanceApplication throws 409 unless toIndex === fromIndex + 1, so the board
  // may offer exactly one forward move per card and no free placement.
  it("offers only the immediately following stage", () => {
    expect(nextStageOf("applied")).toBe("screening");
    expect(nextStageOf("screening")).toBe("shortlisted");
    expect(nextStageOf("offer_review")).toBe("offered");
    for (let index = 0; index < PIPELINE_STAGE_FLOW.length - 1; index += 1) {
      expect(nextStageOf(PIPELINE_STAGE_FLOW[index]!)).toBe(PIPELINE_STAGE_FLOW[index + 1]);
    }
  });

  it("never skips a stage", () => {
    for (const stage of PIPELINE_STAGE_FLOW) {
      const next = nextStageOf(stage);
      if (next === null) continue;
      const from = PIPELINE_STAGE_FLOW.indexOf(stage);
      const to = PIPELINE_STAGE_FLOW.indexOf(next);
      expect(to - from).toBe(1);
    }
  });

  it("offers no move out of a terminal stage or off the end of the flow", () => {
    expect(nextStageOf("converted")).toBeNull();
    expect(canAdvance("converted")).toBe(false);
    for (const stage of PIPELINE_TERMINAL_STAGES) {
      expect(nextStageOf(stage)).toBeNull();
      expect(canAdvance(stage)).toBe(false);
    }
    expect(nextStageOf("not-a-stage")).toBeNull();
  });
});

describe("no ordered comparison of candidates (SCR-090)", () => {
  // "No automatic rejection; the assistive score helps, humans decide." A board
  // that reordered cards by score would be that comparison in another shape.
  it("preserves the order it is given and does not reorder by score", () => {
    const board = buildBoard([
      card({ applicationId: "low", stage: "screening", matchScore: 11 }),
      card({ applicationId: "high", stage: "screening", matchScore: 98 }),
      card({ applicationId: "none", stage: "screening", matchScore: null }),
      card({ applicationId: "mid", stage: "screening", matchScore: 55 }),
    ]);
    expect(board.columns[1]!.cards.map((entry) => entry.applicationId)).toEqual(["low", "high", "none", "mid"]);
  });

  it("emits exactly one numeric score per card and no second derived figure", () => {
    const board = buildBoard([card({ applicationId: "a", stage: "screening", matchScore: 72 })]);
    const entry = board.columns[1]!.cards[0]!;
    const numericKeys = Object.entries(entry)
      .filter(([, value]) => typeof value === "number")
      .map(([key]) => key);
    expect(numericKeys).toEqual(["matchScore"]);
  });

  it("carries no aggregate score on a column or on the board", () => {
    const board = buildBoard([
      card({ applicationId: "a", stage: "screening", matchScore: 90 }),
      card({ applicationId: "b", stage: "screening", matchScore: 10 }),
    ]);
    // Totals count applications, never sum or average a score.
    expect(board.totals).toEqual({ active: 2, closed: 0, scored: 2, unscored: 0 });
    for (const column of board.columns) {
      expect(Object.keys(column)).toEqual(["id", "label", "caption", "stages", "cards"]);
    }
  });

  it("keeps an unscored card in its column rather than hiding or demoting it", () => {
    const board = buildBoard([
      card({ applicationId: "unscored", stage: "interview", matchScore: null }),
      card({ applicationId: "scored", stage: "interview", matchScore: 64 }),
    ]);
    expect(board.columns[2]!.cards.map((entry) => entry.applicationId)).toEqual(["unscored", "scored"]);
    expect(board.totals.unscored).toBe(1);
  });
});

const scheme: ReferralAwardScheme = {
  code: "REF-STD",
  currency: "INR",
  joiningAmountMinor: 1_000_00,
  confirmationAmountMinor: 2_000_00,
  confirmationTenureDays: 120,
};

function progress(overrides: Partial<ReferralProgressInput> = {}): ReferralProgressInput {
  return {
    scheme,
    joinedOn: null,
    confirmedOn: null,
    confirmationCaptured: true,
    tenureDays: null,
    disbursedMilestones: [],
    ...overrides,
  };
}

describe("referral award two-part maturation, RL-471 (SCR-090)", () => {
  it("states two legs: a part on joining and the balance on confirmation", () => {
    const plan = planReferralAward(progress());
    expect(plan.milestones.map((milestone) => milestone.key)).toEqual(["joining", "confirmation"]);
    expect(plan.milestones.map((milestone) => milestone.amountMinor)).toEqual([1_000_00, 2_000_00]);
  });

  it("matures the joining leg only once the referred candidate is an employee", () => {
    const before = planReferralAward(progress());
    expect(before.milestones[0]!.state).toBe("pending");
    expect(before.eligibleMinor).toBe(0);

    const after = planReferralAward(progress({ joinedOn: "2026-01-05", tenureDays: 10 }));
    expect(after.milestones[0]!.state).toBe("earned");
    expect(after.eligibleMinor).toBe(1_000_00);
    expect(after.nextMilestone?.key).toBe("joining");
  });

  it("holds the balance until confirmation is recorded AND the tenure is complete", () => {
    const tenureShort = planReferralAward(
      progress({ joinedOn: "2026-01-05", confirmedOn: "2026-02-01", tenureDays: 30 }),
    );
    expect(tenureShort.milestones[1]!.state).toBe("pending");
    expect(tenureShort.milestones[1]!.blockedBy).toContain("30 of the 120 days");

    const unconfirmed = planReferralAward(
      progress({ joinedOn: "2026-01-05", confirmedOn: null, tenureDays: 400 }),
    );
    expect(unconfirmed.milestones[1]!.state).toBe("pending");
    expect(unconfirmed.milestones[1]!.blockedBy).toContain("Confirmation has not been recorded");

    const both = planReferralAward(
      progress({ joinedOn: "2026-01-05", confirmedOn: "2026-06-01", tenureDays: 150 }),
    );
    expect(both.milestones[1]!.state).toBe("earned");
    expect(both.eligibleMinor).toBe(3_000_00);
  });

  it("separates what has been disbursed from what is merely eligible", () => {
    const plan = planReferralAward(
      progress({ joinedOn: "2026-01-05", confirmedOn: "2026-06-01", tenureDays: 150, disbursedMilestones: ["joining"] }),
    );
    expect(plan.milestones[0]!.state).toBe("disbursed");
    expect(plan.disbursedMinor).toBe(1_000_00);
    expect(plan.eligibleMinor).toBe(3_000_00);
    expect(plan.nextMilestone?.key).toBe("confirmation");
  });

  it("reports no outstanding milestone once both legs are paid", () => {
    const plan = planReferralAward(
      progress({
        joinedOn: "2026-01-05", confirmedOn: "2026-06-01", tenureDays: 150,
        disbursedMilestones: ["joining", "confirmation"],
      }),
    );
    expect(plan.nextMilestone).toBeNull();
    expect(plan.disbursedMinor).toBe(3_000_00);
  });

  it("names the gap when this deployment captures no confirmation event at all", () => {
    const plan = planReferralAward(
      progress({ joinedOn: "2026-01-05", tenureDays: 400, confirmationCaptured: false }),
    );
    expect(plan.milestones[1]!.state).toBe("pending");
    expect(plan.milestones[1]!.blockedBy).toContain("no confirmation date");
    expect(plan.missing.join(" ")).toContain("no confirmation date");
  });
});

describe("referral award with no configured scheme (RL-470, SCR-090)", () => {
  // The workbook marks the award amount and its split as per-programme Config and
  // no scheme master is seeded. An amount invented here would be paid to a person.
  it("reports no amount at all rather than a zero or a default", () => {
    const plan = planReferralAward(progress({ scheme: null, joinedOn: "2026-01-05", tenureDays: 400 }));
    expect(plan.configured).toBe(false);
    expect(plan.currency).toBeNull();
    expect(plan.schemeCode).toBeNull();
    expect(plan.eligibleMinor).toBeNull();
    expect(plan.disbursedMinor).toBeNull();
    for (const milestone of plan.milestones) {
      expect(milestone.amountMinor).toBeNull();
      expect(milestone.state).toBe("not_configured");
    }
  });

  it("names exactly what is missing and what must happen next", () => {
    const plan = planReferralAward(progress({ scheme: null }));
    expect(plan.missing[0]).toContain("Referral award scheme");
    expect(plan.nextMilestone?.requirement).toContain("Configure the referral award scheme");
  });

  it("still matures in two legs once a scheme exists, so the shape does not change", () => {
    const unconfigured = planReferralAward(progress({ scheme: null }));
    const configured = planReferralAward(progress());
    expect(unconfigured.milestones.map((milestone) => milestone.key))
      .toEqual(configured.milestones.map((milestone) => milestone.key));
  });

  it("rejects a partial scheme rather than filling the blanks", () => {
    expect(parseReferralAwardScheme(null)).toBeNull();
    expect(parseReferralAwardScheme({ code: "REF-STD", currency: "INR" })).toBeNull();
    expect(parseReferralAwardScheme({ ...scheme, currency: "rupees" })).toBeNull();
    expect(parseReferralAwardScheme(scheme)).toEqual(scheme);
  });
});

describe("adverse impact readiness (SCR-090)", () => {
  it("holds nothing available in this product, so no ratio can be computed", () => {
    const readiness = adverseImpactReadiness(ADVERSE_IMPACT_AVAILABLE_INPUTS);
    expect(ADVERSE_IMPACT_AVAILABLE_INPUTS).toEqual([]);
    expect(readiness.computable).toBe(false);
    expect(readiness.missing).toHaveLength(ADVERSE_IMPACT_INPUTS.length);
    expect(readiness.statement).toContain("cannot be computed");
    expect(readiness.statement).not.toMatch(/\d/);
  });

  it("names each missing input with what it would actually require", () => {
    const readiness = adverseImpactReadiness([]);
    expect(readiness.missing.map((entry) => entry.key)).toEqual([
      "protected_attribute_set", "consent_bound_capture", "stage_selection_rates", "reference_group",
    ]);
    for (const entry of readiness.missing) {
      expect(entry.requirement.length).toBeGreaterThan(40);
    }
    expect(readiness.missing.find((entry) => entry.key === "consent_bound_capture")!.requirement).toContain("consent");
  });

  it("is a real check, not a hardcoded refusal", () => {
    const readiness = adverseImpactReadiness(ADVERSE_IMPACT_INPUTS.map((input) => input.key));
    expect(readiness.computable).toBe(true);
    expect(readiness.missing).toEqual([]);

    const partial = adverseImpactReadiness(["protected_attribute_set"]);
    expect(partial.computable).toBe(false);
    expect(partial.available).toEqual(["protected_attribute_set"]);
    expect(partial.missing).toHaveLength(3);
  });
});
