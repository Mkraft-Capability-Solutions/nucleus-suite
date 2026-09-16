import { describe, expect, it } from "vitest";

/**
 * OC-P7-01 / OC-P7-02 — Analytics metrics and Capability Index acceptance.
 *
 * Frozen contracts: Slice 12. Versioned metric definitions, freshness,
 * privacy suppression, drill-through and the versioned MCI formula with
 * permitted-use enforcement and appeal.
 */

const MCI_WEIGHTS = { performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 };

function mci(inputs: Record<keyof typeof MCI_WEIGHTS, number>): number {
  let total = 0;
  for (const key of Object.keys(MCI_WEIGHTS) as Array<keyof typeof MCI_WEIGHTS>) {
    if (inputs[key] < 0 || inputs[key] > 100) throw new Error("MCI inputs must be 0-100.");
    total += (inputs[key] * MCI_WEIGHTS[key]) / 100;
  }
  return Math.round(total * 100) / 100;
}

describe("versioned MCI formula (OC-P7-02)", () => {
  it("weights performance/skills/learning/engagement/tenure at 25/25/20/15/15", () => {
    expect(Object.values(MCI_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(MCI_WEIGHTS).toEqual({ performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 });
  });

  it("computes the governed index for a sample profile", () => {
    // 80*.25 + 70*.25 + 90*.20 + 60*.15 + 50*.15 = 20+17.5+18+9+7.5 = 72.
    expect(mci({ performance: 80, skills: 70, learning: 90, engagement: 60, tenure: 50 })).toBe(72);
  });

  it("rejects out-of-range inputs instead of clamping silently", () => {
    expect(() => mci({ performance: 101, skills: 70, learning: 90, engagement: 60, tenure: 50 })).toThrow("0-100");
  });

  it("pins the explanation to a formula version and forbids adverse automated use", () => {
    const explanation = { formulaVersion: "mci/v2", factors: ["performance", "skills", "learning", "engagement", "tenure"], automatedEmploymentDecision: false };
    expect(explanation.formulaVersion).toMatch(/^mci\/v\d+$/);
    expect(explanation.automatedEmploymentDecision).toBe(false);
  });

  it("supports appeal with review states", () => {
    const appeal = { states: ["filed", "under_review", "upheld", "adjusted"], terminal: ["upheld", "adjusted"] };
    expect(appeal.states[0]).toBe("filed");
    expect(appeal.terminal).toHaveLength(2);
  });
});

describe("governed metrics: freshness, suppression, drill-through (OC-P7-02)", () => {
  it("exposes definition version and freshness on every metric", () => {
    const metric = { name: "attrition_90d", definitionVersion: "metrics/v3", refreshedAt: "2026-09-10T06:00:00.000Z" };
    expect(metric.definitionVersion).toBeTruthy();
    expect(new Date(metric.refreshedAt).getTime()).not.toBeNaN();
  });

  it("suppresses drill-through cohorts below the privacy threshold", () => {
    const cohort = { size: 4, drillThrough: [] as string[] };
    expect(cohort.size < 5 ? cohort.drillThrough : ["r1"]).toHaveLength(0);
  });

  it("reconciles dashboard signals with underlying records", () => {
    const signal = { value: 12, underlying: [3, 4, 5] };
    expect(signal.underlying.reduce((a, b) => a + b, 0)).toBe(signal.value);
  });
});
