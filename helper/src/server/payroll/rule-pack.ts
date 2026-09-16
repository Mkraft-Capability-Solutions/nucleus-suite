import "server-only";

import { HttpError } from "@/server/platform/http";

/**
 * Statutory rule pack.
 *
 * Every rate, ceiling, divisor and slab the payroll engine may consult is declared
 * here in one place and pinned to a version code. `payroll_runs.rule_pack_version_id`
 * already records which version a run was calculated against, which is what makes a
 * finalised run reproducible.
 *
 * A rule whose value is `null` is DECLARED BUT NOT SUPPLIED. Reading one throws
 * instead of substituting a guess: statutory rates are regulated policy owned by
 * HR/Payroll/Legal, and the source workbook defers all of them to "the rule pack"
 * without ever stating a number. Supplying them means adding an `in-pay/v2` entry
 * below, not editing v1 - v1 must keep reproducing the runs already calculated
 * against it.
 */

export const DEFAULT_RULE_PACK_CODE = "in-pay/v1";

export type WageBaseComponent = "basic" | "da" | "hra" | "conveyance" | "special";

export type RulePack = {
  code: string;
  pf: {
    employeeRate: number | null;
    employerRate: number | null;
    wageCeilingMinor: number | null;
    /** Components summed to form the PF wage. */
    wageBase: WageBaseComponent[] | null;
    /** International workers are exempt from the wage ceiling. */
    ceilingWaivedForInternationalWorker: boolean | null;
  };
  esi: {
    employeeRate: number | null;
    employerRate: number | null;
    /** Monthly gross above this amount is out of ESI coverage. */
    wageThresholdMinor: number | null;
  };
  professionalTax: {
    /** Flat monthly amount applied when no state slab is available. */
    flatAmountMinor: number | null;
    /** Per-state slabs, keyed by state name. */
    stateSlabs: Record<string, Array<{ uptoMinor: number | null; amountMinor: number }>> | null;
  };
  overtime: {
    /** Divisor used to derive an hourly rate from monthly basic. */
    hoursBasis: { daysPerMonth: number; hoursPerDay: number } | null;
    workingDayMultiplier: number | null;
    restDayMultiplier: number | null;
    holidayMultiplier: number | null;
    weeklyCapMinutes: number | null;
  };
  gratuity: {
    /** Days of wages payable per completed year (the "15" in 15/26). */
    daysPerYear: number | null;
    /** Days in the notional month (the "26" in 15/26). */
    monthDays: number | null;
    qualifyingYears: number | null;
    wageBase: WageBaseComponent[] | null;
    exemptionLimitMinor: number | null;
  };
  tds: {
    standardDeductionMinor: number | null;
    slabs: Record<"old" | "new", Array<{ uptoMinor: number | null; rate: number }> | null> | null;
    surcharge: Array<{ aboveMinor: number; rate: number }> | null;
    cessRate: number | null;
    rebate87a: { incomeCeilingMinor: number; maxRebateMinor: number } | null;
    /** TDS rate applied when the employee has no PAN on record. */
    noPanRate: number | null;
  };
  deductionCaps: {
    section80c: number | null;
    section80ccd1b: number | null;
    section80dSelf: number | null;
    section80dSelfSenior: number | null;
    section80dParents: number | null;
    section80dParentsSenior: number | null;
    section80e: number | null;
    section80tta: number | null;
    section80ttb: number | null;
    housingInterestSelfOccupied: number | null;
  };
  hraExemption: {
    metroPercent: number | null;
    nonMetroPercent: number | null;
    /** Rent paid less this share of salary is the third leg of the least-of-three test. */
    rentLessSalaryPercent: number | null;
    metroCities: string[] | null;
    /** Landlord PAN becomes mandatory above this annual rent. */
    landlordPanThresholdMinor: number | null;
  };
  wageFloor: {
    /** Code on Wages basic-share test. The workbook names 50%; it never defines the denominator. */
    percent: number | null;
    denominatorComponents: WageBaseComponent[] | null;
  };
  minimumWage: {
    /**
     * FRM-PAY-02 tests CTC against "the statutory minimum wage for the state and skill" and never
     * states a single rate. Keyed `<state>::<skill>` -> monthly minor units. Null means no
     * schedule has been approved, and the test reports "indeterminate" rather than a Pass.
     */
    monthlyMinorByStateAndSkill: Record<string, number> | null;
  };
  loans: {
    /** Share of basic recovered per period when no amortisation schedule applies. */
    recoveryPercentOfBasic: number | null;
    interestMethod: "reducing_balance" | "flat" | null;
    /** Benchmark rate used to value a concessional loan as a taxable perquisite. */
    perquisiteBenchmarkRate: number | null;
    /**
     * Ceiling on the principal, as a multiple of monthly basic. RL-22 states both
     * multiples and the band they apply to: four times basic, six times at five
     * years of service or more. Read through `resolveLoanCeiling`
     * (src/server/loans/ceiling.ts), never inlined.
     */
    ceilingMultipleOfBasic: { standard: number; higher: number } | null;
    /**
     * Completed service, in years, at or above which the higher multiple applies.
     * RL-22 gives the number; Q-09 - whether a break in service, a transfer between
     * entities or a change of employment category resets the clock - is still open,
     * so `completedServiceYears` measures plain elapsed time from the joining date
     * and says so.
     */
    higherCeilingServiceYears: number | null;
    /** Share of net pay an instalment may not push take-home below. */
    netPayFloorPercent: number | null;
    /** Sanctioned principal above which a third guarantor is required. */
    thirdGuarantorThresholdMinor: number | null;
    /** Configured tenure bounds, in months. */
    tenureMonths: { minimum: number; maximum: number } | null;
    /** Rate per loan purpose, in percent per annum. */
    interestRateByPurpose: Record<string, number> | null;
  };
  advances: {
    /**
     * How the earned-to-date ceiling is prorated (PL_PRORATION_BASIS). Without it the
     * earned wage cannot be derived, so the ceiling panel reports "not available" rather
     * than a figure nobody approved.
     */
    earnedWageProrationBasis: "calendar_days" | "payable_days" | "working_days" | null;
    /** Annual instance cap the workbook says is "enforced" without naming the number. */
    maxInstancesPerYear: number | null;
  };
  dailyWage: {
    /**
     * RL-26 says a Daily-basis employee is "paid for the days present" and never says
     * how the day rate is reached: monthly basic over 26, over 30, over the days in
     * the month, or a rate stored on the employee. Neither workbook states it, and a
     * wrong divisor is a pay defect, so nothing is assumed - a daily-wage employee
     * cannot be calculated until this is approved.
     */
    rateDivisor: number | null;
    /**
     * What a half day counts towards days present. The workbook states the basis
     * ("paid for 24 days") but never the weighting, so 0.5 is not assumed either.
     */
    halfDayWeight: number | null;
  };
};

/**
 * v1 mirrors the rates that were already hard-coded in the calculation engine, so
 * moving them here does not change a single calculated figure. Everything the
 * engine never implemented is declared `null` rather than invented.
 */
const IN_PAY_V1: RulePack = {
  code: "in-pay/v1",
  pf: {
    employeeRate: 0.12,
    employerRate: null,
    wageCeilingMinor: 1_500_000,
    wageBase: ["basic", "da"],
    ceilingWaivedForInternationalWorker: null,
  },
  esi: {
    employeeRate: 0.0075,
    employerRate: null,
    wageThresholdMinor: 2_100_000,
  },
  professionalTax: {
    flatAmountMinor: 20_000,
    stateSlabs: null,
  },
  overtime: {
    hoursBasis: { daysPerMonth: 30, hoursPerDay: 8 },
    workingDayMultiplier: 2,
    restDayMultiplier: null,
    holidayMultiplier: null,
    weeklyCapMinutes: null,
  },
  gratuity: {
    daysPerYear: null,
    monthDays: null,
    qualifyingYears: null,
    wageBase: null,
    exemptionLimitMinor: null,
  },
  tds: {
    standardDeductionMinor: null,
    slabs: null,
    surcharge: null,
    cessRate: null,
    rebate87a: null,
    noPanRate: null,
  },
  deductionCaps: {
    section80c: null,
    section80ccd1b: null,
    section80dSelf: null,
    section80dSelfSenior: null,
    section80dParents: null,
    section80dParentsSenior: null,
    section80e: null,
    section80tta: null,
    section80ttb: null,
    housingInterestSelfOccupied: null,
  },
  hraExemption: {
    metroPercent: null,
    nonMetroPercent: null,
    rentLessSalaryPercent: null,
    metroCities: null,
    landlordPanThresholdMinor: null,
  },
  wageFloor: {
    percent: 0.5,
    denominatorComponents: null,
  },
  minimumWage: {
    monthlyMinorByStateAndSkill: null,
  },
  loans: {
    recoveryPercentOfBasic: 0.2,
    interestMethod: null,
    perquisiteBenchmarkRate: null,
    // RL-22, stated by the workbook and listed as a policy value in the
    // configuration register ("Eligible multiple", default 4.00).
    ceilingMultipleOfBasic: { standard: 4, higher: 6 },
    higherCeilingServiceYears: 5,
    netPayFloorPercent: null,
    thirdGuarantorThresholdMinor: null,
    tenureMonths: null,
    interestRateByPurpose: null,
  },
  advances: {
    earnedWageProrationBasis: null,
    maxInstancesPerYear: null,
  },
  dailyWage: {
    rateDivisor: null,
    halfDayWeight: null,
  },
};

const RULE_PACKS: Record<string, RulePack> = {
  [IN_PAY_V1.code]: IN_PAY_V1,
};

export function rulePack(code: string = DEFAULT_RULE_PACK_CODE): RulePack {
  const pack = RULE_PACKS[code];
  if (!pack) {
    throw new HttpError({ status: 422, code: "RULE_PACK_UNKNOWN", message: `Unknown statutory rule pack "${code}".` });
  }
  return pack;
}

/**
 * Reads a rule that must have a value. Throws a named, actionable error when the
 * value has not been supplied, so an unapproved statutory rule can never silently
 * become a zero, a default or a guess on a payslip.
 */
export function requireRule<T>(value: T | null | undefined, path: string, packCode: string = DEFAULT_RULE_PACK_CODE): T {
  if (value === null || value === undefined) {
    throw new HttpError({
      status: 422,
      code: "RULE_PACK_INCOMPLETE",
      message: `Statutory rule "${path}" is not defined in rule pack "${packCode}". It requires an approved value from the payroll policy owner before this calculation can run.`,
      details: [{ field: path, issue: `Not defined in rule pack "${packCode}".` }],
    });
  }
  return value;
}

export type RuleGap = { rule: string; area: string };

/** Every rule this pack declares but does not supply. Drives the readiness panels. */
export function ruleGaps(code: string = DEFAULT_RULE_PACK_CODE): RuleGap[] {
  const pack = rulePack(code);
  const gaps: RuleGap[] = [];
  const walk = (area: string, group: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(group)) {
      if (value === null) gaps.push({ rule: `${area}.${key}`, area });
    }
  };
  walk("pf", pack.pf);
  walk("esi", pack.esi);
  walk("professionalTax", pack.professionalTax);
  walk("overtime", pack.overtime);
  walk("gratuity", pack.gratuity);
  walk("tds", pack.tds);
  walk("deductionCaps", pack.deductionCaps);
  walk("hraExemption", pack.hraExemption);
  walk("wageFloor", pack.wageFloor);
  walk("loans", pack.loans);
  walk("advances", pack.advances);
  walk("dailyWage", pack.dailyWage);
  return gaps;
}
