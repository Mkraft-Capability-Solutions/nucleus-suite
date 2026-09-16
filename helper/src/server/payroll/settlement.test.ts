import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearanceStatus,
  completedServiceYears,
  daysInclusive,
  finalizeGates,
  finalPeriodSalary,
  gratuityWorking,
  leaveEncashmentWorking,
  missingGratuityRules,
  noticeShortfallWorking,
  periodBounds,
  settlementTotals,
  type SettlementFigure,
} from "./settlement";
import { rulePack } from "./rule-pack";

const MONTHLY = { basic: 5_000_000, da: 500_000, hra: 2_000_000, conveyance: 160_000, special: 840_000 };
const PAYABLE_DAYS = { basic: "payable_days", da: "payable_days", hra: "payable_days", conveyance: "payable_days", special: "payable_days" } as const;

function figure(head: SettlementFigure["head"], direction: "earning" | "recovery", amountMinor: number | null): SettlementFigure {
  return { head, label: head, direction, amountMinor, basis: "test", indeterminate: amountMinor === null, blockedBy: [], inputs: {} };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("final period salary (SCR-056)", () => {
  it("prorates to the last working day, not to today", () => {
    const working = finalPeriodSalary({
      period: "2026-09",
      lastWorkingDate: "2026-09-10",
      monthlyComponentsMinor: MONTHLY,
      prorationBasisByComponent: { ...PAYABLE_DAYS },
    });
    // 10 of the 30 days of September, component by component.
    const expected = Object.values(MONTHLY).reduce((sum, monthly) => sum + Math.round((monthly * 10) / 30), 0);
    expect(working.amountMinor).toBe(expected);
    expect(working.indeterminate).toBe(false);
    expect(working.inputs.servedDays).toBe(10);
    expect(working.inputs.periodDays).toBe(30);
    expect(working.basis).toContain("2026-09-10");
  });

  // The bug in the lifecycle demo path is that the final salary was prorated against
  // the current date. Moving the clock must not move a single figure here.
  it("returns the same figure whatever the current date is", () => {
    const compute = () =>
      finalPeriodSalary({
        period: "2026-09",
        lastWorkingDate: "2026-09-10",
        monthlyComponentsMinor: MONTHLY,
        prorationBasisByComponent: { ...PAYABLE_DAYS },
      }).amountMinor;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T00:00:00Z"));
    const early = compute();
    vi.setSystemTime(new Date("2027-04-27T00:00:00Z"));
    const late = compute();
    expect(early).toBe(late);
    expect(early).not.toBeNull();
  });

  it("pays the whole period when the last working day falls on or after the period end", () => {
    const working = finalPeriodSalary({
      period: "2026-09",
      lastWorkingDate: "2026-10-15",
      monthlyComponentsMinor: MONTHLY,
      prorationBasisByComponent: { ...PAYABLE_DAYS },
    });
    expect(working.amountMinor).toBe(Object.values(MONTHLY).reduce((sum, monthly) => sum + monthly, 0));
    expect(working.inputs.servedDays).toBe(30);
  });

  it("is indeterminate when a component's proration basis is not recorded", () => {
    const working = finalPeriodSalary({
      period: "2026-09",
      lastWorkingDate: "2026-09-10",
      monthlyComponentsMinor: MONTHLY,
      prorationBasisByComponent: { ...PAYABLE_DAYS, special: null },
    });
    expect(working.amountMinor).toBeNull();
    expect(working.indeterminate).toBe(true);
    expect(working.blockedBy).toContain("component.special.prorationBasis");
  });

  it("will not prorate a working-days component without a working-day calendar", () => {
    const working = finalPeriodSalary({
      period: "2026-09",
      lastWorkingDate: "2026-09-10",
      monthlyComponentsMinor: { basic: MONTHLY.basic },
      prorationBasisByComponent: { basic: "working_days" },
    });
    expect(working.amountMinor).toBeNull();
    expect(working.blockedBy).toEqual(["component.basic.workingDayCalendar"]);
  });

  it("counts February and the period bounds correctly", () => {
    expect(periodBounds("2026-02").days).toBe(28);
    expect(periodBounds("2028-02").days).toBe(29);
    expect(daysInclusive("2026-09-01", "2026-09-10")).toBe(10);
  });
});

describe("gratuity (SCR-056)", () => {
  it("returns no figure and names every missing rule in the pack", () => {
    const pack = rulePack("in-pay/v1");
    const working = gratuityWorking({
      pack,
      joiningDate: "2018-04-01",
      lastWorkingDate: "2026-09-20",
      wageBaseCandidatesMinor: { basic: MONTHLY.basic, da: MONTHLY.da, gratuity_flagged: MONTHLY.basic + MONTHLY.da, gross: 8_500_000 },
    });
    expect(working.amountMinor).toBeNull();
    expect(working.indeterminate).toBe(true);
    expect(working.blockedBy).toEqual([
      "gratuity.daysPerYear",
      "gratuity.monthDays",
      "gratuity.qualifyingYears",
      "gratuity.wageBase",
      "gratuity.exemptionLimitMinor",
    ]);
    expect(missingGratuityRules(pack)).toHaveLength(5);
    // No 15/26 and no five-year qualifying period are assumed anywhere in the basis.
    expect(working.basis).not.toMatch(/15|26|five/);
  });

  it("still returns the service and wage-base inputs so a reviewed figure can be keyed", () => {
    const working = gratuityWorking({
      pack: rulePack("in-pay/v1"),
      joiningDate: "2018-04-01",
      lastWorkingDate: "2026-09-20",
      wageBaseCandidatesMinor: { basic: MONTHLY.basic },
    });
    expect(working.inputs.completedServiceYears).toBe(8);
    expect(working.inputs.serviceMonths).toBe(101);
    expect(String(working.inputs.monthlyWageBaseCandidates)).toContain("basic=5000000");
    expect(completedServiceYears("2018-04-01", "2026-03-31")).toBe(7);
  });
});

describe("leave encashment (SCR-056)", () => {
  it("is indeterminate when the rate basis is not configured, and names it", () => {
    const working = leaveEncashmentWorking({
      balanceDays: 12,
      basis: null,
      monthDaysDivisor: null,
      monthlyWagesMinor: { basic: MONTHLY.basic, basic_plus_da: MONTHLY.basic + MONTHLY.da, gross: 8_500_000 },
      balanceSource: "leave ledger",
    });
    expect(working.amountMinor).toBeNull();
    expect(working.blockedBy).toEqual(["PL_ENCASHMENT_BASIS", "PL_ENCASHMENT_MONTH_DAYS"]);
    // The balance and all three candidate wages survive so the officer can decide.
    expect(working.inputs.encashableDays).toBe(12);
    expect(working.inputs.basic).toBe(MONTHLY.basic);
    expect(working.inputs.basic_plus_da).toBe(MONTHLY.basic + MONTHLY.da);
    expect(working.inputs.gross).toBe(8_500_000);
  });

  it("computes the figure once a basis and divisor are configured", () => {
    const working = leaveEncashmentWorking({
      balanceDays: 12,
      basis: "basic_plus_da",
      monthDaysDivisor: 30,
      monthlyWagesMinor: { basic: MONTHLY.basic, basic_plus_da: MONTHLY.basic + MONTHLY.da, gross: 8_500_000 },
      balanceSource: "leave ledger",
    });
    expect(working.indeterminate).toBe(false);
    expect(working.amountMinor).toBe(Math.round((MONTHLY.basic + MONTHLY.da) / 30) * 12);
  });
});

describe("notice shortfall recovery (SCR-056)", () => {
  it("computes the shortfall when the approved last working day is earlier than notice requires", () => {
    const working = noticeShortfallWorking({
      noticeRequiredDays: 60,
      noticeGivenDate: "2026-09-01",
      lastWorkingDate: "2026-09-20",
      perDayRecoveryMinor: 183_333,
      perDayBasis: "basic + DA / 30 days",
    });
    expect(working.inputs.noticeServedDays).toBe(20);
    expect(working.inputs.shortfallDays).toBe(40);
    expect(working.amountMinor).toBe(40 * 183_333);
    expect(working.direction).toBe("recovery");
  });

  it("recovers nothing when notice was served in full", () => {
    const working = noticeShortfallWorking({
      noticeRequiredDays: 30,
      noticeGivenDate: "2026-08-01",
      lastWorkingDate: "2026-09-20",
      perDayRecoveryMinor: 183_333,
      perDayBasis: "basic + DA / 30 days",
    });
    expect(working.amountMinor).toBe(0);
    expect(working.basis).toContain("served in full");
  });

  it("says the notice period is not recorded rather than assuming one", () => {
    const working = noticeShortfallWorking({
      noticeRequiredDays: null,
      noticeGivenDate: null,
      lastWorkingDate: "2026-09-20",
      perDayRecoveryMinor: null,
      perDayBasis: "not configured",
    });
    expect(working.amountMinor).toBeNull();
    expect(working.blockedBy).toEqual(["exit.noticePeriodDays", "exit.noticeDate", "exit.noticeRecoveryWageBasis"]);
    expect(working.basis).toContain("not recorded");
  });
});

describe("settlement totals (SCR-056)", () => {
  it("routes a negative net to recovery with a positive recoverable amount (RL-341)", () => {
    const totals = settlementTotals([
      figure("salaryPayableMinor", "earning", 1_666_667),
      figure("loanRecoveryMinor", "recovery", 4_000_000),
      figure("noticeRecoveryMinor", "recovery", 1_500_000),
    ]);
    expect(totals.netPayableMinor).toBe(1_666_667 - 5_500_000);
    expect(totals.netPayableMinor).toBeLessThan(0);
    expect(totals.settlementOutcome).toBe("recovery_pending");
    expect(totals.recoverableMinor).toBe(5_500_000 - 1_666_667);
    expect(totals.recoverableMinor).toBeGreaterThan(0);
  });

  it("keeps a positive net payable and recovers nothing", () => {
    const totals = settlementTotals([
      figure("salaryPayableMinor", "earning", 5_000_000),
      figure("loanRecoveryMinor", "recovery", 1_000_000),
    ]);
    expect(totals.settlementOutcome).toBe("payable");
    expect(totals.netPayableMinor).toBe(4_000_000);
    expect(totals.recoverableMinor).toBe(0);
  });

  it("excludes indeterminate heads from the provisional net and lists them", () => {
    const totals = settlementTotals([
      figure("salaryPayableMinor", "earning", 5_000_000),
      figure("gratuityMinor", "earning", null),
      figure("taxDeductionMinor", "recovery", null),
    ]);
    expect(totals.earningsMinor).toBe(5_000_000);
    expect(totals.recoveriesMinor).toBe(0);
    expect(totals.indeterminateHeads).toEqual(["gratuityMinor", "taxDeductionMinor"]);
  });
});

describe("finalize gates (SCR-056)", () => {
  const passing = {
    recordStatus: "approved",
    payrollRunStatus: "finalized",
    exitCaseStatus: "clearance_active",
    clearanceTotal: 3,
    clearanceOpen: 0,
    allocatedAssets: 0,
    outstandingLoanMinor: 1_000_000,
    loanRecoveryMinor: 1_000_000,
  };

  it("passes every gate the workflow enforces when nothing blocks", () => {
    const gates = finalizeGates(passing);
    expect(gates.map((gate) => gate.key)).toEqual(["approved", "payroll_run", "exit_case", "clearance", "assets", "loans"]);
    expect(gates.every((gate) => gate.pass)).toBe(true);
    expect(gates.every((gate) => gate.blocking === "")).toBe(true);
  });

  it("reports each blocker with what is blocking it", () => {
    const gates = finalizeGates({
      recordStatus: "submitted",
      payrollRunStatus: "draft",
      exitCaseStatus: "settled",
      clearanceTotal: 3,
      clearanceOpen: 2,
      allocatedAssets: 1,
      outstandingLoanMinor: 4_000_000,
      loanRecoveryMinor: 1_000_000,
    });
    const blocking = Object.fromEntries(gates.map((gate) => [gate.key, gate]));
    expect(gates.filter((gate) => gate.pass)).toHaveLength(0);
    expect(blocking.approved.blocking).toContain("submitted");
    expect(blocking.payroll_run.blocking).toContain("draft");
    expect(blocking.exit_case.blocking).toContain("already settled");
    expect(blocking.clearance.blocking).toContain("2 clearance items still open");
    expect(blocking.assets.blocking).toContain("1 asset is still allocated");
    expect(blocking.loans.blocking).toContain("exceed");
  });

  it("blocks an exit case that carries no clearance items at all", () => {
    const gates = finalizeGates({ ...passing, clearanceTotal: 0, clearanceOpen: 0 });
    const clearance = gates.find((gate) => gate.key === "clearance");
    expect(clearance?.pass).toBe(false);
    expect(clearance?.blocking).toContain("no clearance items");
  });
});

describe("clearance status (FRM-PAY-08)", () => {
  it("maps the clearance items onto PL_CLEARANCE_STATUS", () => {
    expect(clearanceStatus({ total: 0, open: 0 })).toBe("not_started");
    expect(clearanceStatus({ total: 3, open: 2 })).toBe("in_progress");
    expect(clearanceStatus({ total: 3, open: 0 })).toBe("cleared");
    // "Blocked" is reserved for an open item that actually blocks, not merely one still in progress.
    expect(clearanceStatus({ total: 3, open: 2, blocking: 1 })).toBe("blocked");
    expect(clearanceStatus({ total: 3, open: 0, blocking: 0 })).toBe("cleared");
  });
});
