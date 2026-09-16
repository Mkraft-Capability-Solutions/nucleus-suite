import { describe, expect, it } from "vitest";

import {
  DESK_ACTIONS,
  EDITABLE_STATES,
  prefillFromWorking,
  proposalActionState,
  proposalActionStates,
  proposalEditIssue,
  proposalTotals,
  otherRecoveryReasonIssue,
  settlementReasonIssues,
  waiverReasonIssue,
  type WorkingLike,
} from "./settlement-proposals";

/**
 * Pure tests only: every function under test is arithmetic or a state lookup, so
 * nothing here touches the database. The two reads in this module
 * (`listProposalOptions`, `getProposalDetail`) are exercised against a live
 * tenant by the integration suites, not here.
 */

const EMPTY = {
  salaryPayableMinor: 0,
  leaveEncashmentMinor: 0,
  gratuityMinor: 0,
  bonusPayableMinor: 0,
  otherEarningsMinor: 0,
  loanRecoveryMinor: 0,
  noticeRecoveryMinor: 0,
  advanceRecoveryMinor: 0,
  assetRecoveryMinor: 0,
  otherRecoveryMinor: 0,
  taxDeductionMinor: 0,
  recoveryWaiverMinor: 0,
};

function workingFigure(
  head: WorkingLike["figures"][number]["head"],
  direction: "earning" | "recovery",
  amountMinor: number | null,
  blockedBy: string[] = [],
): WorkingLike["figures"][number] {
  return {
    head,
    label: head,
    direction,
    amountMinor,
    basis: "test basis",
    indeterminate: amountMinor === null,
    blockedBy,
  };
}

function working(figures: WorkingLike["figures"]): WorkingLike {
  return {
    employee: { id: "11111111-1111-4111-8111-111111111111", currency: "INR" },
    period: "2026-04",
    lastWorkingDate: "2026-04-18",
    payrollRunId: null,
    payrollRunStatus: null,
    rulePackCode: "in-pay/v1",
    figures,
  };
}

describe("proposal arithmetic (SCR-056 proposals)", () => {
  it("splits earnings from recoveries and nets them exactly as the server records them", () => {
    const totals = proposalTotals({
      ...EMPTY,
      salaryPayableMinor: 4_200_000,
      leaveEncashmentMinor: 1_100_000,
      gratuityMinor: 2_500_000,
      bonusPayableMinor: 300_000,
      otherEarningsMinor: 100_000,
      loanRecoveryMinor: 1_500_000,
      noticeRecoveryMinor: 900_000,
      advanceRecoveryMinor: 200_000,
      assetRecoveryMinor: 50_000,
      otherRecoveryMinor: 25_000,
      taxDeductionMinor: 400_000,
    });
    expect(totals.earningsMinor).toBe(8_200_000);
    expect(totals.recoveriesMinor).toBe(3_075_000);
    expect(totals.netPayableMinor).toBe(5_125_000);
    expect(totals.settlementOutcome).toBe("payable");
    expect(totals.recoverableMinor).toBe(0);
  });

  it("emits one line per non-zero head, with recoveries on the deduction side", () => {
    const totals = proposalTotals({ ...EMPTY, salaryPayableMinor: 1_000_000, loanRecoveryMinor: 250_000 });
    expect(totals.lines).toEqual([
      { code: "salaryPayableMinor", amount_minor: 1_000_000, direction: "earning" },
      { code: "loanRecoveryMinor", amount_minor: 250_000, direction: "deduction" },
    ]);
  });

  it("omits a zero head rather than recording an empty line", () => {
    expect(proposalTotals(EMPTY).lines).toEqual([]);
    expect(proposalTotals(EMPTY).netPayableMinor).toBe(0);
  });

  it("treats a head the proposal never carried as nothing, not as an error", () => {
    const totals = proposalTotals({ salaryPayableMinor: 500_000 });
    expect(totals.earningsMinor).toBe(500_000);
    expect(totals.recoveriesMinor).toBe(0);
    expect(totals.netPayableMinor).toBe(500_000);
  });

  it("offsets a waiver on the earning side instead of quietly editing the recovery", () => {
    const totals = proposalTotals({
      ...EMPTY,
      salaryPayableMinor: 1_000_000,
      loanRecoveryMinor: 800_000,
      recoveryWaiverMinor: 300_000,
      recoveryWaiverReason: "Board approved hardship waiver",
    });
    // The recovery stays at its full 800,000 and the waiver is a separate earning.
    expect(totals.recoveriesMinor).toBe(800_000);
    expect(totals.waiverMinor).toBe(300_000);
    expect(totals.earningsMinor).toBe(1_300_000);
    expect(totals.netPayableMinor).toBe(500_000);
    expect(totals.lines).toContainEqual({ code: "loanRecoveryMinor", amount_minor: 800_000, direction: "deduction" });
    expect(totals.lines).toContainEqual({ code: "recoveryWaiverMinor", amount_minor: 300_000, direction: "earning" });
  });

  it("turns a waiver that covers the whole recovery into a fully payable settlement", () => {
    const totals = proposalTotals({ ...EMPTY, salaryPayableMinor: 500_000, otherRecoveryMinor: 500_000, recoveryWaiverMinor: 500_000, recoveryWaiverReason: "written off" });
    expect(totals.netPayableMinor).toBe(500_000);
    expect(totals.settlementOutcome).toBe("payable");
  });
});

describe("negative nets (SCR-056 proposals)", () => {
  it("reports a leaver who owes more than is due as a recovery to collect, not a failure", () => {
    const totals = proposalTotals({ ...EMPTY, salaryPayableMinor: 1_000_000, loanRecoveryMinor: 2_500_000 });
    expect(totals.netPayableMinor).toBe(-1_500_000);
    expect(totals.settlementOutcome).toBe("recovery_pending");
    expect(totals.recoverableMinor).toBe(1_500_000);
  });

  it("keeps the recoverable amount positive and equal to the shortfall", () => {
    const totals = proposalTotals({ ...EMPTY, noticeRecoveryMinor: 750_000 });
    expect(totals.netPayableMinor).toBe(-750_000);
    expect(totals.recoverableMinor).toBe(750_000);
  });

  it("treats an exactly zero net as payable, never as a recovery", () => {
    const totals = proposalTotals({ ...EMPTY, salaryPayableMinor: 400_000, taxDeductionMinor: 400_000 });
    expect(totals.netPayableMinor).toBe(0);
    expect(totals.settlementOutcome).toBe("payable");
    expect(totals.recoverableMinor).toBe(0);
  });

  it("lets a waiver pull a recovery-pending settlement back into payable", () => {
    const values = { ...EMPTY, salaryPayableMinor: 100_000, loanRecoveryMinor: 900_000 };
    expect(proposalTotals(values).settlementOutcome).toBe("recovery_pending");
    expect(proposalTotals({ ...values, recoveryWaiverMinor: 900_000, recoveryWaiverReason: "written off" }).settlementOutcome).toBe("payable");
  });
});

describe("recovery waiver reason (SCR-056 proposals)", () => {
  it("requires a reason once any amount is waived", () => {
    expect(waiverReasonIssue({ ...EMPTY, recoveryWaiverMinor: 100_000 })).toEqual({
      field: "recoveryWaiverReason",
      issue: "A recovery waiver requires a reason. Say what is being forgiven and on whose authority.",
    });
  });

  it("rejects whitespace as a reason", () => {
    expect(waiverReasonIssue({ recoveryWaiverMinor: 1, recoveryWaiverReason: "   " })?.field).toBe("recoveryWaiverReason");
  });

  it("accepts a waiver carrying a reason", () => {
    expect(waiverReasonIssue({ recoveryWaiverMinor: 1, recoveryWaiverReason: "Settled under the exit agreement" })).toBeNull();
  });

  it("asks for nothing when no waiver is claimed", () => {
    expect(waiverReasonIssue(EMPTY)).toBeNull();
    expect(waiverReasonIssue({})).toBeNull();
  });
});

describe("proposal state machine (SCR-056 proposals)", () => {
  it("allows submit only from draft or returned", () => {
    expect(proposalActionState("submit", "draft").allowed).toBe(true);
    expect(proposalActionState("submit", "returned").allowed).toBe(true);
    for (const status of ["submitted", "approved", "finalized", "rejected", "cancelled"]) {
      const state = proposalActionState("submit", status);
      expect(state.allowed).toBe(false);
      expect(state.reason).toContain("draft or returned");
    }
  });

  it("allows approve, return and reject only from submitted", () => {
    for (const action of ["approve", "return", "reject"]) {
      expect(proposalActionState(action, "submitted").allowed).toBe(true);
      expect(proposalActionState(action, "draft").allowed).toBe(false);
      expect(proposalActionState(action, "approved").allowed).toBe(false);
    }
  });

  it("allows cancel from draft, returned and submitted, but never after approval", () => {
    expect(proposalActionState("cancel", "draft").allowed).toBe(true);
    expect(proposalActionState("cancel", "returned").allowed).toBe(true);
    expect(proposalActionState("cancel", "submitted").allowed).toBe(true);
    expect(proposalActionState("cancel", "approved").allowed).toBe(false);
    expect(proposalActionState("cancel", "finalized").allowed).toBe(false);
  });

  it("names the state that blocks an illegal transition instead of failing silently", () => {
    const state = proposalActionState("approve", "cancelled");
    expect(state.allowed).toBe(false);
    expect(state.reason).toContain("cancelled");
    expect(state.reason).toContain("submitted");
  });

  it("never offers finalize on this desk, even from approved, and says where it lives", () => {
    const fromApproved = proposalActionState("finalize", "approved");
    expect(fromApproved.allowed).toBe(false);
    expect(fromApproved.ownedElsewhere).toBe(true);
    expect(fromApproved.reason).toContain("full and final settlement screen");
    expect(proposalActionState("finalize", "draft").ownedElsewhere).toBe(true);
  });

  it("refuses an action that is not a transition of this resource at all", () => {
    const state = proposalActionState("publish", "draft");
    expect(state.allowed).toBe(false);
    expect(state.reason).toContain("not a transition");
  });

  it("reports every desk action plus finalize for any state", () => {
    const states = proposalActionStates("submitted");
    expect(states.map((state) => state.action)).toEqual([...DESK_ACTIONS, "finalize"]);
    expect(states.filter((state) => state.allowed).map((state) => state.action)).toEqual(["approve", "return", "reject", "cancel"]);
  });

  it("allows editing only in the catalog's editable states", () => {
    expect(EDITABLE_STATES).toEqual(["draft", "returned"]);
    expect(proposalEditIssue("draft")).toBeNull();
    expect(proposalEditIssue("returned")).toBeNull();
    expect(proposalEditIssue("submitted")).toContain("draft or returned");
    expect(proposalEditIssue("finalized")).toContain("finalized");
  });
});

describe("prefill projection (SCR-056 proposals)", () => {
  const projection = prefillFromWorking(
    working([
      workingFigure("salaryPayableMinor", "earning", 4_200_000),
      workingFigure("leaveEncashmentMinor", "earning", null, ["PL_ENCASHMENT_BASIS", "PL_ENCASHMENT_MONTH_DAYS"]),
      workingFigure("gratuityMinor", "earning", null, ["gratuity.daysPerYear", "gratuity.wageBase"]),
      workingFigure("loanRecoveryMinor", "recovery", 1_500_000),
      workingFigure("noticeRecoveryMinor", "recovery", null, ["exit.noticePeriodDays"]),
      workingFigure("taxDeductionMinor", "recovery", null, ["tds.slabs"]),
    ]),
  );

  it("prefills only the heads the working determined", () => {
    expect(projection.values).toEqual({ salaryPayableMinor: 4_200_000, loanRecoveryMinor: 1_500_000 });
  });

  it("never defaults an indeterminate head to zero", () => {
    for (const head of ["gratuityMinor", "leaveEncashmentMinor", "noticeRecoveryMinor", "taxDeductionMinor"]) {
      expect(Object.hasOwn(projection.values, head)).toBe(false);
    }
  });

  it("carries each indeterminate head through with the rules that block it", () => {
    const gratuity = projection.heads.find((head) => head.head === "gratuityMinor");
    expect(gratuity?.indeterminate).toBe(true);
    expect(gratuity?.amountMinor).toBeNull();
    expect(gratuity?.missingRules).toEqual(["gratuity.daysPerYear", "gratuity.wageBase"]);
    expect(projection.indeterminate.map((head) => head.head)).toEqual([
      "leaveEncashmentMinor",
      "gratuityMinor",
      "noticeRecoveryMinor",
      "taxDeductionMinor",
    ]);
  });

  it("collects the distinct missing rules so the form can name them once", () => {
    expect(projection.missingRules).toEqual([
      "PL_ENCASHMENT_BASIS",
      "PL_ENCASHMENT_MONTH_DAYS",
      "gratuity.daysPerYear",
      "gratuity.wageBase",
      "exit.noticePeriodDays",
      "tds.slabs",
    ]);
  });

  it("marks an indeterminate head that the resource still demands be keyed", () => {
    const gratuity = projection.heads.find((head) => head.head === "gratuityMinor");
    expect(gratuity?.required).toBe(true);
    const bonus = prefillFromWorking(working([workingFigure("bonusPayableMinor", "earning", 0)])).heads[0];
    expect(bonus.required).toBe(false);
  });

  it("totals only what was determined, so the provisional net excludes every blocked head", () => {
    expect(projection.totals.earningsMinor).toBe(4_200_000);
    expect(projection.totals.recoveriesMinor).toBe(1_500_000);
    expect(projection.totals.netPayableMinor).toBe(2_700_000);
    expect(projection.totals.settlementOutcome).toBe("payable");
  });

  it("treats a determinate zero as a real answer and prefills it", () => {
    const zeroed = prefillFromWorking(working([workingFigure("noticeRecoveryMinor", "recovery", 0)]));
    expect(zeroed.values).toEqual({ noticeRecoveryMinor: 0 });
    expect(zeroed.indeterminate).toEqual([]);
  });

  it("can produce a recovery-pending prefill without treating it as an error", () => {
    const recovery = prefillFromWorking(
      working([workingFigure("salaryPayableMinor", "earning", 100_000), workingFigure("loanRecoveryMinor", "recovery", 900_000)]),
    );
    expect(recovery.totals.settlementOutcome).toBe("recovery_pending");
    expect(recovery.totals.recoverableMinor).toBe(800_000);
  });

  it("carries the working's period, run status and rule pack onto the form", () => {
    expect(projection.period).toBe("2026-04");
    expect(projection.rulePackCode).toBe("in-pay/v1");
    expect(projection.lastWorkingDate).toBe("2026-04-18");
    expect(projection.payrollRunStatus).toBeNull();
  });
});

describe("settlement reasons and notice pay (FRM-PAY-08)", () => {
  it("holds a recovery waiver to the workbook's 20-character reason", () => {
    expect(waiverReasonIssue({ recoveryWaiverMinor: 0 })).toBeNull();
    expect(waiverReasonIssue({ recoveryWaiverMinor: 500_000 })?.field).toBe("recoveryWaiverReason");
    expect(waiverReasonIssue({ recoveryWaiverMinor: 500_000, recoveryWaiverReason: "Director says so" })?.field).toBe("recoveryWaiverReason");
    expect(waiverReasonIssue({ recoveryWaiverMinor: 500_000, recoveryWaiverReason: "Waived by the director on compassionate grounds" })).toBeNull();
  });

  it("requires a reason for an other recovery, however short", () => {
    expect(otherRecoveryReasonIssue({ otherRecoveryMinor: 0 })).toBeNull();
    expect(otherRecoveryReasonIssue({ otherRecoveryMinor: 100_000 })?.field).toBe("otherRecoveryReason");
    expect(otherRecoveryReasonIssue({ otherRecoveryMinor: 100_000, otherRecoveryReason: "Canteen dues" })).toBeNull();
  });

  it("reports every reason gap at once rather than one per round trip", () => {
    const issues = settlementReasonIssues({ recoveryWaiverMinor: 1, otherRecoveryMinor: 1 });
    expect(issues.map((issue) => issue.field)).toEqual(["recoveryWaiverReason", "otherRecoveryReason"]);
    expect(settlementReasonIssues({})).toEqual([]);
  });

  it("treats notice pay payable as an earning, never as a negative recovery", () => {
    const totals = proposalTotals({ salaryPayableMinor: 5_000_000, noticePayableMinor: 3_000_000, noticeRecoveryMinor: 1_000_000 });
    expect(totals.earningsMinor).toBe(8_000_000);
    expect(totals.recoveriesMinor).toBe(1_000_000);
    expect(totals.netPayableMinor).toBe(7_000_000);
    expect(totals.lines.find((line) => line.code === "noticePayableMinor")?.direction).toBe("earning");
    expect(totals.lines.find((line) => line.code === "noticeRecoveryMinor")?.direction).toBe("deduction");
  });
});
