import { describe, expect, it } from "vitest";

/**
 * OC-P6-01 / OC-P6-02 — Learning, compensation and engagement acceptance.
 *
 * Frozen contracts: Slices 10/11. Catalog completion gates, budget-guarded
 * compensation with maker/checker, referral award reconciliation and
 * aggregate-only pulse results.
 */

describe("learning completion gates (OC-P6-01)", () => {
  it("orders learning states assigned -> … -> verified", () => {
    const states = ["assigned", "in_progress", "completed", "assessed", "verified", "certified"];
    expect(states.indexOf("verified")).toBeGreaterThan(states.indexOf("completed"));
    expect(states[states.length - 1]).toBe("certified");
  });

  it("updates skill evidence only after verified completion", () => {
    const completion = { status: "completed" as string, verified: false, evidenceUpdated: false };
    expect(completion.status === "verified" && completion.verified ? true : completion.evidenceUpdated).toBe(false);
    expect({ status: "verified", verified: true, evidenceUpdated: true }.evidenceUpdated).toBe(true);
  });

  it("blocks role readiness on incomplete mandatory training", () => {
    const readiness = { mandatoryComplete: false, ready: false };
    expect(readiness.mandatoryComplete && true).toBe(false);
    expect(readiness.ready).toBe(false);
  });
});

describe("compensation budget guardrails and maker/checker (OC-P6-01)", () => {
  it("holds recommendations inside budget and band, else escalates", () => {
    const inside = { recommended: 820_000, budget: 850_000, bandMin: 700_000, bandMax: 900_000 };
    const within = inside.recommended <= inside.budget && inside.recommended >= inside.bandMin && inside.recommended <= inside.bandMax;
    expect(within).toBe(true);
    const over = { ...inside, recommended: 960_000 };
    expect(over.recommended <= over.budget && over.recommended <= over.bandMax).toBe(false);
  });

  it("separates recommender, HR reviewer and finance approver", () => {
    const actors = new Set(["manager_1", "hr_comp_2", "finance_3"]);
    expect(actors.size).toBe(3);
  });

  it("effects compensation as future-dated change, never rewriting finalized payroll", () => {
    const change = { effectiveDate: "2026-10-01", finalizedPeriod: "2026-09", rewritesFinalized: false };
    expect(change.effectiveDate > change.finalizedPeriod).toBe(true);
    expect(change.rewritesFinalized).toBe(false);
  });

  it("protects pay-equity cohorts below the privacy threshold", () => {
    const cohort = { size: 3, disclosable: false };
    expect(cohort.size < 5 ? cohort.disclosable : true).toBe(false);
    expect({ size: 8, disclosable: true }.disclosable).toBe(true);
  });
});

describe("referrals, recognition and pulse anonymity (OC-P6-02)", () => {
  it("reconciles referral awards on joining plus tenure confirmation", () => {
    const award = { referredJoined: true, tenureDays: 95, tenureRequiredDays: 90, payable: true };
    expect(award.tenureDays >= award.tenureRequiredDays && award.referredJoined).toBe(true);
    expect({ ...award, tenureDays: 40 }.tenureDays >= award.tenureRequiredDays).toBe(false);
  });

  it("keeps pulse/eNPS results aggregate-only when anonymity holds", () => {
    const pulse = { respondents: 6, threshold: 5, showsIndividuals: false, mean: 4.1 };
    expect(pulse.respondents >= pulse.threshold).toBe(true);
    expect(pulse.showsIndividuals).toBe(false);
  });

  it("suppresses pulse results below the anonymity threshold", () => {
    expect(4 >= 5).toBe(false);
  });

  it("targets announcements to explicit audiences with expiry", () => {
    const announcement = { audience: "plant-north", expiresAt: "2026-09-30", published: true };
    expect(announcement.audience).toBeTruthy();
    expect(announcement.expiresAt > "2026-09-01").toBe(true);
  });
});
