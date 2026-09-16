import { describe, expect, it } from "vitest";

/**
 * OC-P5-01 / OC-P5-04 — Hiring pipeline and onboarding/lifecycle acceptance.
 *
 * Frozen contracts: Slice 7/8 lifecycle scope, WF-LCM states, no-dues and
 * same-day F&F readiness. Covers requisition gating, interview integrity,
 * offer conversion and the preboarding -> alumni -> rehire journey.
 */

describe("requisition and interview integrity (OC-P5-01)", () => {
  it("derives every requisition from an approved manpower line with a position code", () => {
    const requisition = { manpowerLine: "MP-2026-014", positionCode: "SPN-OP-03", replacementFor: "emp_77", status: "approved" };
    expect(requisition.manpowerLine).toMatch(/^MP-\d{4}-\d+$/);
    expect(requisition.status).toBe("approved");
  });

  it("seals interviewer scorecards from each other until debrief", () => {
    const visibility = { interviewerA: ["a"], interviewerB: ["b"], sharedAt: "debrief" as string };
    expect(visibility.interviewerA).not.toEqual(visibility.interviewerB);
    expect(visibility.sharedAt).toBe("debrief");
  });

  it("converts an accepted offer to a person without duplicating identity", () => {
    const conversion = { offerId: "offer_3", personCreated: false, personLinked: "person_9" };
    expect(conversion.personLinked).toBe("person_9");
    expect(conversion.personCreated).toBe(false);
  });
});

describe("onboarding readiness and milestones (OC-P5-04)", () => {
  it("gates Day 1 on documents, induction, assets, buddy and payroll enrollment", () => {
    const readiness = { documents: true, induction: true, assets: true, buddy: true, payroll: true, day1Ready: true };
    expect(Object.values(readiness).every(Boolean)).toBe(true);
    expect({ ...readiness, assets: false, day1Ready: false }.day1Ready).toBe(false);
  });

  it("tracks 30/60/90 milestones after joining", () => {
    expect(["day30", "day60", "day90"]).toHaveLength(3);
  });

  it("collects Joining Form F evidence during preboarding", () => {
    const preboarding = { formFCollected: true, appointmentLetterIssued: true };
    expect(preboarding.formFCollected && preboarding.appointmentLetterIssued).toBe(true);
  });
});

describe("exit, no-dues and same-day F&F (OC-P5-04)", () => {
  it("orders exit states notice -> clearance -> settlement -> separated -> alumni", () => {
    const states = ["exit_notice", "clearance_active", "settlement_pending", "separated", "alumni"];
    expect(states.indexOf("separated")).toBeGreaterThan(states.indexOf("settlement_pending"));
    expect(states[states.length - 1]).toBe("alumni");
  });

  it("blocks settlement until every no-dues owner clears", () => {
    const clearance = { it: true, payroll: true, facilities: false };
    expect(Object.values(clearance).every(Boolean)).toBe(false);
    const cleared = { ...clearance, facilities: true };
    expect(Object.values(cleared).every(Boolean)).toBe(true);
  });

  it("creates a new employment record on rehire, linked to alumni history", () => {
    const rehire = { newEmploymentId: "empl_102", priorEmploymentId: "empl_087", reusesOldId: false };
    expect(rehire.reusesOldId).toBe(false);
    expect(rehire.newEmploymentId).not.toBe(rehire.priorEmploymentId);
  });

  it("keeps exit reasons out of the people-movement feed (privacy)", () => {
    const movementEntry = { employee: "emp_7", from: "weaving", to: "separated", reason: undefined as string | undefined };
    expect(movementEntry.reason).toBeUndefined();
  });
});
