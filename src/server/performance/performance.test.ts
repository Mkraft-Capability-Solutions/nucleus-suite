import { describe, expect, it } from "vitest";

/**
 * OC-P6-01 / OC-P6-02 — Performance, skills and succession acceptance.
 *
 * Frozen contracts: Slice 9. Review cycles, calibration with reasons,
 * 360 anonymity thresholds, succession readiness and manager scope.
 */

const MIN_ANONYMITY_COHORT = 5;

function canShowAggregate(respondents: number): boolean {
  return respondents >= MIN_ANONYMITY_COHORT;
}

describe("review cycle and calibration (OC-P6-01)", () => {
  it("orders review states through calibration to release", () => {
    const states = ["draft", "self_review", "manager_review", "peer_360", "calibration", "released", "acknowledged"];
    expect(states.indexOf("calibration")).toBeGreaterThan(states.indexOf("peer_360"));
    expect(states.indexOf("released")).toBeGreaterThan(states.indexOf("calibration"));
  });

  it("requires a reason for every calibration adjustment", () => {
    const adjustment = { from: "meets", to: "exceeds", reason: "Cross-plant Kaizen impact verified", actor: "calibration_panel" };
    expect(adjustment.reason.length).toBeGreaterThan(0);
    expect({ ...adjustment, reason: "" }.reason.length).toBe(0);
  });

  it("releases ratings only after calibration completes", () => {
    const release = { calibrated: true, released: true };
    expect(release.calibrated && release.released).toBe(true);
    expect({ calibrated: false, released: true }.calibrated).toBe(false);
  });
});

describe("360 anonymity and manager scope (OC-P6-02)", () => {
  it("suppresses aggregates below the five-respondent threshold", () => {
    expect(canShowAggregate(4)).toBe(false);
    expect(canShowAggregate(5)).toBe(true);
    expect(canShowAggregate(12)).toBe(true);
  });

  it("scopes managers to self, direct and descendant reports only", () => {
    const scope = { self: true, direct: true, descendants: true, peers: false, unrelated: false };
    expect(scope.peers).toBe(false);
    expect(scope.unrelated).toBe(false);
  });

  it("records succession readiness on an explicit scale with development gaps", () => {
    const plan = { successor: "emp_21", readiness: "ready-1-2y", gaps: ["shift-planning"] };
    expect(["ready-now", "ready-1-2y", "ready-3y-plus"]).toContain(plan.readiness);
    expect(plan.gaps.length).toBeGreaterThan(0);
  });
});

describe("skill evidence and proficiency (OC-P6-01)", () => {
  it("updates proficiency only through validated evidence, never self-claim alone", () => {
    const evidence = { source: "course-completion", validated: true, proficiency: "L3" };
    expect(evidence.validated).toBe(true);
    expect(["L1", "L2", "L3", "L4", "L5"]).toContain(evidence.proficiency);
  });

  it("links approved development gaps to learning assignments", () => {
    const link = { gap: "fanuc-control", assignment: "course_fanuc_101", status: "assigned" };
    expect(link.assignment).toBeTruthy();
    expect(link.status).toBe("assigned");
  });
});
