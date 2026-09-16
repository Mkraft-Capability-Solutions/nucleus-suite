import { describe, expect, it } from "vitest";

import { DEFAULT_RULE_PACK_CODE, requireRule, rulePack, ruleGaps } from "./rule-pack";

describe("statutory rule pack (SCR-050)", () => {
  it("resolves the default pack", () => {
    expect(rulePack().code).toBe(DEFAULT_RULE_PACK_CODE);
    expect(rulePack(DEFAULT_RULE_PACK_CODE).code).toBe(DEFAULT_RULE_PACK_CODE);
  });

  it("rejects an unknown pack code", () => {
    expect(() => rulePack("in-pay/v99")).toThrowError(/Unknown statutory rule pack/);
  });

  // These are the exact literals the calculation engine used before the rates moved
  // into the pack. If one of them changes, every previously finalised run stops
  // reproducing, so the change must be a new pack version rather than an edit to v1.
  it("v1 reproduces the rates the engine was previously hard-coded with", () => {
    const pack = rulePack("in-pay/v1");
    expect(pack.pf.employeeRate).toBe(0.12);
    expect(pack.pf.wageCeilingMinor).toBe(1_500_000);
    expect(pack.pf.wageBase).toEqual(["basic", "da"]);
    expect(pack.esi.employeeRate).toBe(0.0075);
    expect(pack.esi.wageThresholdMinor).toBe(2_100_000);
    expect(pack.professionalTax.flatAmountMinor).toBe(20_000);
    expect(pack.overtime.hoursBasis).toEqual({ daysPerMonth: 30, hoursPerDay: 8 });
    expect(pack.overtime.workingDayMultiplier).toBe(2);
    expect(pack.loans.recoveryPercentOfBasic).toBe(0.2);
  });

  it("reproduces the previous PF, ESI and professional tax arithmetic", () => {
    const pack = rulePack("in-pay/v1");
    const basic = 5_000_000;
    const da = 500_000;
    const earnings = 8_500_000;
    const pfRate = requireRule(pack.pf.employeeRate, "pf.employeeRate");
    const pfCeiling = requireRule(pack.pf.wageCeilingMinor, "pf.wageCeilingMinor");
    const pf = Math.min(Math.round((basic + da) * pfRate), Math.round(pfCeiling * pfRate));
    const esiThreshold = requireRule(pack.esi.wageThresholdMinor, "esi.wageThresholdMinor");
    const esi = earnings > esiThreshold ? 0 : Math.round(earnings * requireRule(pack.esi.employeeRate, "esi.employeeRate"));
    expect(pf).toBe(Math.min(Math.round((basic + da) * 0.12), Math.round(1_500_000 * 0.12)));
    expect(esi).toBe(earnings > 2_100_000 ? 0 : Math.round(earnings * 0.0075));
    expect(requireRule(pack.professionalTax.flatAmountMinor, "professionalTax.flatAmountMinor")).toBe(20_000);
  });
});

describe("unsupplied statutory rules (SCR-050)", () => {
  it("throws a named, actionable error instead of defaulting to zero", () => {
    const pack = rulePack("in-pay/v1");
    expect(() => requireRule(pack.gratuity.daysPerYear, "gratuity.daysPerYear", pack.code)).toThrowError(
      /Statutory rule "gratuity.daysPerYear" is not defined in rule pack "in-pay\/v1"/,
    );
    expect(() => requireRule(pack.tds.slabs, "tds.slabs", pack.code)).toThrowError(/approved value from the payroll policy owner/);
  });

  it("passes through a supplied value unchanged", () => {
    expect(requireRule(0, "pf.employeeRate")).toBe(0);
    expect(requireRule(false, "pf.ceilingWaivedForInternationalWorker")).toBe(false);
  });

  it("reports every declared-but-unsupplied rule so the gaps stay visible", () => {
    const gaps = ruleGaps("in-pay/v1").map((gap) => gap.rule);
    // The statutory areas the workbook defers entirely to "the rule pack".
    expect(gaps).toContain("gratuity.daysPerYear");
    expect(gaps).toContain("gratuity.qualifyingYears");
    expect(gaps).toContain("tds.slabs");
    expect(gaps).toContain("tds.standardDeductionMinor");
    expect(gaps).toContain("deductionCaps.section80c");
    expect(gaps).toContain("hraExemption.metroPercent");
    expect(gaps).toContain("wageFloor.denominatorComponents");
    expect(gaps).toContain("professionalTax.stateSlabs");
    expect(gaps).toContain("loans.interestMethod");
    // RL-26: the workbook states the basis ("paid for 24 days") and never the day rate
    // or what a half day counts, so a daily-wage employee refuses rather than defaulting.
    expect(gaps).toContain("dailyWage.rateDivisor");
    expect(gaps).toContain("dailyWage.halfDayWeight");
    expect(gaps).toContain("advances.earnedWageProrationBasis");
    // Rates already in force must not be reported as gaps.
    expect(gaps).not.toContain("pf.employeeRate");
    expect(gaps).not.toContain("esi.wageThresholdMinor");
    expect(gaps).not.toContain("wageFloor.percent");
  });
});
