import { describe, expect, it } from "vitest";

import {
  ESTABLISHMENT_STATES,
  OVERRIDE_REASON_MIN_LENGTH,
  decideRequisition,
  establishmentState,
  headroomOf,
  utilisationPercent,
  type RequisitionDecisionInput,
} from "./establishment";

const base: RequisitionDecisionInput = {
  requisitionType: "addition",
  positions: 1,
  counts: { sanctioned: 10, filled: 6, open: 1 },
  againstPositionCode: null,
  againstPositionVacant: true,
  override: false,
  overrideReason: null,
  overriderAuthorised: false,
  overriderDistinctFromApprover: true,
};

describe("headroom derivation (SCR-013 / RL-057)", () => {
  it("derives headroom as sanctioned minus filled minus open", () => {
    expect(headroomOf({ sanctioned: 24, filled: 20, open: 2 })).toBe(2);
  });

  // SCR-013 defines an "Over plan" state, which can only exist if headroom is
  // allowed to go negative. Clamping at zero would hide the condition the board
  // exists to surface.
  it("reports a negative headroom rather than clamping at zero", () => {
    expect(headroomOf({ sanctioned: 24, filled: 24, open: 3 })).toBe(-3);
  });

  it("bands the three establishment states", () => {
    expect(establishmentState({ sanctioned: 10, filled: 4, open: 1 })).toBe("within_headroom");
    expect(establishmentState({ sanctioned: 24, filled: 24, open: 0 })).toBe("at_limit");
    expect(establishmentState({ sanctioned: 24, filled: 24, open: 3 })).toBe("over_plan");
    for (const state of [
      establishmentState({ sanctioned: 1, filled: 0, open: 0 }),
      establishmentState({ sanctioned: 1, filled: 1, open: 0 }),
      establishmentState({ sanctioned: 1, filled: 2, open: 0 }),
    ]) {
      expect(ESTABLISHMENT_STATES).toContain(state);
    }
  });

  it("reports utilisation above 100 percent rather than capping it", () => {
    expect(utilisationPercent({ sanctioned: 10, filled: 8, open: 1 })).toBe(90);
    expect(utilisationPercent({ sanctioned: 10, filled: 12, open: 0 })).toBe(120);
  });

  it("returns no utilisation when nothing is sanctioned, rather than dividing by zero", () => {
    expect(utilisationPercent({ sanctioned: 0, filled: 3, open: 0 })).toBeNull();
  });
});

describe("replacement requisitions (RL-461)", () => {
  it("consumes no sanctioned strength", () => {
    const decision = decideRequisition({
      ...base,
      requisitionType: "replacement",
      againstPositionCode: "POS-DES-104",
      counts: { sanctioned: 24, filled: 24, open: 0 },
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.consumesSanction).toBe(false);
  });

  it("is allowed even when the department is already at its limit", () => {
    const decision = decideRequisition({
      ...base,
      requisitionType: "replacement",
      againstPositionCode: "POS-DES-104",
      counts: { sanctioned: 24, filled: 24, open: 4 },
    });
    expect(decision.allowed).toBe(true);
  });

  it("must name the vacated position code it backfills", () => {
    const decision = decideRequisition({ ...base, requisitionType: "replacement", againstPositionCode: null });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("REPLACEMENT_POSITION_REQUIRED");
  });

  it("is refused when the named position is not vacant", () => {
    const decision = decideRequisition({
      ...base, requisitionType: "replacement", againstPositionCode: "POS-DES-104", againstPositionVacant: false,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("REPLACEMENT_POSITION_UNAVAILABLE");
  });
});

describe("addition requisitions (RL-462)", () => {
  it("is allowed within headroom", () => {
    const decision = decideRequisition({ ...base, counts: { sanctioned: 10, filled: 6, open: 1 } });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.consumesSanction).toBe(true);
      expect(decision.headroomAfter).toBe(2);
    }
  });

  it("warns when it consumes the last of the headroom", () => {
    const decision = decideRequisition({ ...base, counts: { sanctioned: 10, filled: 8, open: 1 } });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.headroomAfter).toBe(0);
      expect(decision.warnings.join(" ")).toMatch(/last of the approved headroom/i);
    }
  });

  it("is blocked when it would exceed the ceiling, naming the figures", () => {
    const decision = decideRequisition({ ...base, counts: { sanctioned: 24, filled: 24, open: 0 } });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe("SANCTION_EXCEEDED");
      expect(decision.message).toMatch(/Sanctioned 24/);
      expect(decision.message).toMatch(/filled 24/);
      expect(decision.message).toMatch(/headroom 0/);
    }
  });

  it("counts open requisitions against the ceiling, not just filled seats", () => {
    // 24 sanctioned, 20 filled, 4 already open: no headroom left despite 4 empty seats.
    const decision = decideRequisition({ ...base, counts: { sanctioned: 24, filled: 20, open: 4 } });
    expect(decision.allowed).toBe(false);
  });

  it("blocks a multi-position requisition that only partly fits", () => {
    const decision = decideRequisition({ ...base, positions: 3, counts: { sanctioned: 10, filled: 8, open: 0 } });
    expect(decision.allowed).toBe(false);
  });

  it("refuses a requisition for fewer than one position", () => {
    const decision = decideRequisition({ ...base, positions: 0 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("INVALID_POSITIONS");
  });
});

describe("establishment override (RL-463)", () => {
  const overCeiling = { ...base, counts: { sanctioned: 24, filled: 24, open: 0 } };
  const longReason = "Board approved expansion for the new Peenya line, ref BOD-2026-11.";

  it("requires an authorised role", () => {
    const decision = decideRequisition({ ...overCeiling, override: true, overrideReason: longReason, overriderAuthorised: false });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("OVERRIDE_NOT_PERMITTED");
  });

  // An override is a decision to exceed a control. If the person who set the ceiling
  // can also waive it, the ceiling certifies itself.
  it("refuses the ceiling's own approver as the overrider", () => {
    const decision = decideRequisition({
      ...overCeiling, override: true, overrideReason: longReason,
      overriderAuthorised: true, overriderDistinctFromApprover: false,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("OVERRIDE_SELF_APPROVAL");
  });

  it("requires a recorded reason of at least the workbook minimum", () => {
    const short = "x".repeat(OVERRIDE_REASON_MIN_LENGTH - 1);
    const decision = decideRequisition({ ...overCeiling, override: true, overrideReason: short, overriderAuthorised: true });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.code).toBe("OVERRIDE_REASON_REQUIRED");
      expect(decision.message).toMatch(new RegExp(`${OVERRIDE_REASON_MIN_LENGTH} characters`));
    }
  });

  it("does not accept whitespace padding as a reason", () => {
    const decision = decideRequisition({
      ...overCeiling, override: true, overrideReason: "  short  ".padEnd(60, " "), overriderAuthorised: true,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("OVERRIDE_REASON_REQUIRED");
  });

  it("allows the override once authorised, distinct and justified, and records how far over plan", () => {
    const decision = decideRequisition({
      ...overCeiling, positions: 2, override: true, overrideReason: longReason, overriderAuthorised: true,
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.overridden).toBe(true);
      expect(decision.headroomAfter).toBe(-2);
      expect(decision.warnings.join(" ")).toMatch(/over plan by 2/i);
    }
  });

  it("does not mark an in-headroom approval as an override even when the flag is set", () => {
    const decision = decideRequisition({
      ...base, override: true, overrideReason: longReason, overriderAuthorised: true,
      counts: { sanctioned: 10, filled: 1, open: 0 },
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.overridden).toBe(false);
  });
});
