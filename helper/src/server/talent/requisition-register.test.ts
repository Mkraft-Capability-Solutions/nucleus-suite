import { describe, expect, it } from "vitest";

import type { EstablishmentLine } from "./establishment";
import {
  REQUISITION_DISPLAY_STATES,
  REQUISITION_STATE_PROVENANCE,
  SUBMITTED_NOT_RECORDED,
  buildStateTimeline,
  deriveDisplayState,
  evaluateRequisitionGate,
  lineWithoutOwnDraft,
  matchSanctionLine,
  projectHeadroom,
  requisitionRegisterQuerySchema,
  unconfiguredReason,
  wantsPreview,
  type RequisitionGateInput,
} from "./requisition-register";

const APPROVER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function line(overrides: Partial<EstablishmentLine> = {}): EstablishmentLine {
  return {
    manpowerLineId: "line-1",
    departmentId: "dept-1",
    departmentName: "Weaving",
    designation: "Operator",
    locationId: null,
    planYear: 2026,
    approvedByMembershipId: APPROVER,
    sanctioned: 4,
    filled: 1,
    open: 0,
    headroom: 3,
    utilisationPercent: 25,
    state: "within_headroom",
    unsanctioned: false,
    ...overrides,
  };
}

const gateBase: RequisitionGateInput = {
  requisitionType: "addition",
  positions: 1,
  designation: "Operator",
  controlActive: true,
  controlReason: null,
  line: { sanctioned: 4, filled: 1, open: 0, approvedByMembershipId: APPROVER },
  againstPositionCode: null,
  againstPositionVacant: true,
  override: false,
  overrideReason: null,
  overriderAuthorised: false,
  membershipId: OTHER,
};

describe("headroom projection (SCR-090)", () => {
  it("shows the live derived breakdown, not a stored number", () => {
    const projection = projectHeadroom({
      requisitionType: "addition",
      controlConfigured: true,
      designation: "Operator",
      line: line(),
      planYear: 2026,
    });
    expect(projection.kind).toBe("known");
    expect(projection.label).toBe("3 of 4");
    expect(projection.counts).toEqual({ sanctioned: 4, filled: 1, open: 0 });
    expect(projection.headroom).toBe(3);
    expect(projection.detail).toContain("filled 1");
    expect(projection.detail).toContain("open 0");
  });

  // The whole point of the column: an unconfigured ceiling is not a ceiling of
  // zero, and printing "0" would tell a hiring manager to stop hiring.
  it("reports an unconfigured control as unconfigured rather than as zero headroom", () => {
    const projection = projectHeadroom({
      requisitionType: "addition",
      controlConfigured: false,
      designation: "Operator",
      line: null,
      planYear: 2026,
    });
    expect(projection.kind).toBe("not_configured");
    expect(projection.headroom).toBeNull();
    expect(projection.counts).toBeNull();
    expect(projection.label).not.toMatch(/\b0\b/);
    expect(projection.detail).toContain("unknown, not zero");
  });

  it("distinguishes a missing sanction key from an unconfigured control", () => {
    const projection = projectHeadroom({
      requisitionType: "addition",
      controlConfigured: true,
      designation: "Weaver",
      line: null,
      planYear: 2026,
    });
    expect(projection.kind).toBe("no_sanction_key");
    expect(projection.headroom).toBeNull();
    expect(projection.detail).toContain("not an unlimited one");
  });

  it("reports an addition with no designation as an unresolvable key", () => {
    const projection = projectHeadroom({
      requisitionType: "addition",
      controlConfigured: true,
      designation: null,
      line: null,
      planYear: 2026,
    });
    expect(projection.kind).toBe("designation_missing");
    expect(projection.headroom).toBeNull();
  });

  it("draws no headroom for a replacement, which consumes no sanction (RL-461)", () => {
    const projection = projectHeadroom({
      requisitionType: "replacement",
      controlConfigured: true,
      designation: "Operator",
      line: line(),
      planYear: 2026,
    });
    expect(projection.kind).toBe("not_applicable");
    expect(projection.headroom).toBeNull();
  });

  it("reports utilisation over plan without capping it", () => {
    const projection = projectHeadroom({
      requisitionType: "addition",
      controlConfigured: true,
      designation: "Operator",
      line: line({ sanctioned: 4, filled: 4, open: 2, headroom: -2, utilisationPercent: 150, state: "over_plan" }),
      planYear: 2026,
    });
    expect(projection.label).toBe("-2 of 4");
    expect(projection.state).toBe("over_plan");
    expect(projection.utilisationPercent).toBe(150);
  });
});

describe("the establishment gate as the register runs it (SCR-090)", () => {
  it("allows an addition inside headroom", () => {
    const gate = evaluateRequisitionGate(gateBase);
    expect(gate.allowed).toBe(true);
    expect(gate.checked).toBe(true);
    expect(gate.decision).toMatchObject({ allowed: true, consumesSanction: true, headroomAfter: 2 });
  });

  it("refuses an addition that would exceed the ceiling, with the figures (RL-462)", () => {
    const gate = evaluateRequisitionGate({ ...gateBase, positions: 5 });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("SANCTION_EXCEEDED");
    expect(gate.message).toContain("Sanctioned 4");
    expect(gate.message).toContain("requested 5");
  });

  // approveRequisition throws these two BEFORE decideRequisition is reached. A
  // register that only ran the rule would call them "Draft" and let the user
  // walk into a 422.
  it("mirrors the pre-rule refusal for an addition with no designation", () => {
    const gate = evaluateRequisitionGate({ ...gateBase, designation: null, line: null });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("SANCTION_KEY_INCOMPLETE");
  });

  it("mirrors the pre-rule refusal for a sanction key with no approved line", () => {
    const gate = evaluateRequisitionGate({ ...gateBase, line: null });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("SANCTION_MISSING");
  });

  it("reports an unconfigured control as allowed BUT unchecked, never as a silent pass", () => {
    const gate = evaluateRequisitionGate({
      ...gateBase,
      controlActive: false,
      controlReason: unconfiguredReason(2026),
      line: null,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.checked).toBe(false);
    expect(gate.uncheckedReason).toContain("not in force");
    expect(gate.decision).toBeNull();
  });

  it("offers an override only for a ceiling breach, and only to an authorised role (RL-463)", () => {
    expect(evaluateRequisitionGate({ ...gateBase, positions: 5 }).overridable).toBe(false);
    expect(evaluateRequisitionGate({ ...gateBase, positions: 5, overriderAuthorised: true }).overridable).toBe(true);
    // A replacement naming no vacant seat is not cleared by ticking a box.
    const replacement = evaluateRequisitionGate({
      ...gateBase,
      requisitionType: "replacement",
      againstPositionCode: null,
      overriderAuthorised: true,
    });
    expect(replacement.code).toBe("REPLACEMENT_POSITION_REQUIRED");
    expect(replacement.overridable).toBe(false);
  });

  it("refuses an override recorded by the person who approved the ceiling", () => {
    const gate = evaluateRequisitionGate({
      ...gateBase,
      positions: 5,
      override: true,
      overrideReason: "Board approved an exceptional expansion for the new line.",
      overriderAuthorised: true,
      membershipId: APPROVER,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("OVERRIDE_SELF_APPROVAL");
  });

  it("refuses an override reason shorter than the recorded minimum", () => {
    const gate = evaluateRequisitionGate({
      ...gateBase,
      positions: 5,
      override: true,
      overrideReason: "urgent",
      overriderAuthorised: true,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.code).toBe("OVERRIDE_REASON_REQUIRED");
  });
});

describe("display state derivation (SCR-090)", () => {
  const allowed = evaluateRequisitionGate(gateBase);
  const refused = evaluateRequisitionGate({ ...gateBase, positions: 5 });

  it("keeps a draft a draft while the gate permits approval", () => {
    const result = deriveDisplayState({ storedStatus: "draft", conversionCount: 0, gate: allowed });
    expect(result.state).toBe("draft");
  });

  // The screen's most valuable signal: the refusal is surfaced before anyone
  // presses approve, with the reason the endpoint would have given.
  it("shows Blocked for a draft the gate would refuse, carrying the reason", () => {
    const result = deriveDisplayState({ storedStatus: "draft", conversionCount: 0, gate: refused });
    expect(result.state).toBe("blocked");
    expect(result.derived).toBe(true);
    expect(result.reason).toContain("exceed approved manpower");
  });

  it("shows Blocked when the sanction key has no approved line", () => {
    const result = deriveDisplayState({
      storedStatus: "draft",
      conversionCount: 0,
      gate: evaluateRequisitionGate({ ...gateBase, line: null }),
    });
    expect(result.state).toBe("blocked");
  });

  it("does not show Blocked when no ceiling is configured at all", () => {
    const result = deriveDisplayState({
      storedStatus: "draft",
      conversionCount: 0,
      gate: evaluateRequisitionGate({ ...gateBase, controlActive: false, controlReason: unconfiguredReason(2026), line: null }),
    });
    expect(result.state).toBe("draft");
    expect(result.reason).toContain("not in force");
  });

  it("shows Approved for an approved requisition with no conversion", () => {
    expect(deriveDisplayState({ storedStatus: "approved", conversionCount: 0, gate: null }).state).toBe("approved");
  });

  // Filled is backed by candidate_employee_links, which is written only when an
  // offer is accepted and a real employee record is created.
  it("shows Filled once a candidate has been converted against the requisition", () => {
    const result = deriveDisplayState({ storedStatus: "approved", conversionCount: 1, gate: null });
    expect(result.state).toBe("filled");
    expect(result.derived).toBe(true);
    expect(result.reason).toContain("converted to an employee");
  });

  it("honours a literal submitted status but declares that nothing writes it", () => {
    const result = deriveDisplayState({ storedStatus: "submitted", conversionCount: 0, gate: null });
    expect(result.state).toBe("submitted");
    expect(result.derived).toBe(false);
    expect(result.reason).toBe(SUBMITTED_NOT_RECORDED);
    expect(REQUISITION_STATE_PROVENANCE.submitted.backed).toBe(false);
  });

  it("names an unmodelled stored status instead of silently mapping it", () => {
    const result = deriveDisplayState({ storedStatus: "cancelled", conversionCount: 0, gate: allowed });
    expect(result.state).toBe("draft");
    expect(result.reason).toContain("cancelled");
  });

  it("only claims a state SCR-090 defines", () => {
    for (const stored of ["draft", "approved", "submitted", "nonsense"]) {
      const result = deriveDisplayState({ storedStatus: stored, conversionCount: 0, gate: allowed });
      expect(REQUISITION_DISPLAY_STATES).toContain(result.state);
    }
  });
});

describe("state timeline (SCR-090)", () => {
  it("covers all five states and marks Submitted as never recorded", () => {
    const steps = buildStateTimeline({
      displayState: "draft",
      storedStatus: "draft",
      draftedAt: "2026-01-02T00:00:00.000Z",
      approvedAt: null,
      filledAt: null,
      gate: evaluateRequisitionGate(gateBase),
      blockedReason: null,
    });
    expect(steps.map((step) => step.state)).toEqual([...REQUISITION_DISPLAY_STATES]);
    expect(steps.find((step) => step.state === "submitted")?.status).toBe("not_recorded");
    expect(steps.find((step) => step.state === "approved")?.status).toBe("current");
  });

  it("marks approval as blocked while the requisition is blocked, and carries the reason", () => {
    const gate = evaluateRequisitionGate({ ...gateBase, positions: 5 });
    const steps = buildStateTimeline({
      displayState: "blocked",
      storedStatus: "draft",
      draftedAt: "2026-01-02T00:00:00.000Z",
      approvedAt: null,
      filledAt: null,
      gate,
      blockedReason: gate.message,
    });
    expect(steps.find((step) => step.state === "blocked")?.status).toBe("blocked");
    expect(steps.find((step) => step.state === "blocked")?.note).toContain("exceed approved manpower");
    expect(steps.find((step) => step.state === "approved")?.status).toBe("blocked");
  });

  it("closes the timeline once a seat is filled", () => {
    const steps = buildStateTimeline({
      displayState: "filled",
      storedStatus: "approved",
      draftedAt: "2026-01-02T00:00:00.000Z",
      approvedAt: "2026-01-05T00:00:00.000Z",
      filledAt: "2026-02-01T00:00:00.000Z",
      gate: null,
      blockedReason: null,
    });
    expect(steps.find((step) => step.state === "approved")?.status).toBe("done");
    expect(steps.find((step) => step.state === "filled")).toMatchObject({ status: "done", at: "2026-02-01T00:00:00.000Z" });
    expect(steps.find((step) => step.state === "blocked")?.status).toBe("cleared");
  });
});

describe("sanction key matching (SCR-090)", () => {
  it("matches on org unit and designation, case-insensitively", () => {
    const lines = [line(), line({ departmentId: "dept-2", designation: "Fitter" })];
    expect(matchSanctionLine(lines, "dept-1", "operator")?.manpowerLineId).toBe("line-1");
    expect(matchSanctionLine(lines, "dept-2", "OPERATOR")).toBeNull();
    expect(matchSanctionLine(lines, "dept-1", null)).toBeNull();
  });
});

describe("register query contract (SCR-090)", () => {
  it("coerces the plan year and rejects an unknown state", () => {
    expect(requisitionRegisterQuerySchema.safeParse({ planYear: "2026" }).success).toBe(true);
    expect(requisitionRegisterQuerySchema.safeParse({ state: "cancelled" }).success).toBe(false);
    expect(requisitionRegisterQuerySchema.safeParse({ state: "blocked" }).success).toBe(true);
  });

  it("previews only once the gate's inputs are actually present", () => {
    expect(wantsPreview({})).toBe(false);
    expect(wantsPreview({ previewRequisitionType: "addition" })).toBe(false);
    expect(wantsPreview({ previewRequisitionType: "addition", previewDepartmentId: OTHER })).toBe(true);
    expect(wantsPreview({ previewRequisitionType: "replacement" })).toBe(false);
    expect(wantsPreview({ previewRequisitionType: "replacement", previewAgainstPositionCode: "SPN-OP-07" })).toBe(true);
  });
});

/**
 * T-40. `open` counts every live addition against the key, including the draft under
 * approval; `decideRequisition` then subtracts that draft's positions again. Sanctioned 10,
 * filled 9 and one draft for one position must approve, not refuse as SANCTION_EXCEEDED.
 */
describe("the requisition under approval is counted once (SCR-090)", () => {
  const under = { requisitionType: "addition" as const, storedStatus: "draft" };

  it("takes the row's own draft back out of the open count", () => {
    expect(lineWithoutOwnDraft(line({ sanctioned: 10, filled: 9, open: 1 }), under)?.open).toBe(0);
  });

  it("leaves an approved row and a replacement alone", () => {
    const counted = line({ open: 1 });
    expect(lineWithoutOwnDraft(counted, { ...under, storedStatus: "approved" })?.open).toBe(1);
    expect(lineWithoutOwnDraft(counted, { requisitionType: "replacement", storedStatus: "draft" })?.open).toBe(1);
    expect(lineWithoutOwnDraft(null, under)).toBeNull();
  });

  it("never drives the open count below zero", () => {
    expect(lineWithoutOwnDraft(line({ open: 0 }), under)?.open).toBe(0);
  });

  it("approves a requisition that exactly fits instead of refusing it", () => {
    const counts = line({ sanctioned: 10, filled: 9, open: 1 });
    const doubleCounted = evaluateRequisitionGate({ ...gateBase, positions: 1, line: counts });
    expect(doubleCounted.code).toBe("SANCTION_EXCEEDED");
    const corrected = evaluateRequisitionGate({ ...gateBase, positions: 1, line: lineWithoutOwnDraft(counts, under) });
    expect(corrected.allowed).toBe(true);
    expect(corrected.decision?.allowed === true ? corrected.decision.headroomAfter : null).toBe(0);
  });
});
