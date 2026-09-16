import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  CALCULATION_METHODS,
  listComponents,
  listStructureComponents,
  resolveStructure,
  STANDARD_COMPONENTS,
  type PayComponentDefinition,
  type StructureLine,
} from "./components";
import { DEFAULT_RULE_PACK_CODE, requireRule, rulePack, type RulePack } from "./rule-pack";
import { ensurePayrollScaffold } from "./service";

/**
 * SCR-052 — Salary structure simulator (PAY-05.4 / RL-283).
 *
 * "Wage base, 50% floor test, statutory cost and take-home impact of a proposed
 * structure", per employee and in aggregate, shown BEFORE adoption.
 *
 * The hard rule this module exists to honour is the same one the rule pack states:
 * a statutory rule that is declared but not supplied is never guessed. That has
 * three visible consequences here, and each is reported rather than papered over:
 *
 *  - Employer cost is UNAVAILABLE. `pf.employerRate`, `esi.employerRate` and every
 *    `gratuity.*` rule are null in `in-pay/v1`. The employer-side total is returned
 *    as unavailable with the missing rule names attached; everything employee-side
 *    is still computed and returned.
 *  - Take home EXCLUDES TDS and says so. `tds.slabs` is null, so income tax cannot
 *    be computed. Treating it as zero would print a take-home figure that is not
 *    take home, so the exclusion travels with the number as a caveat.
 *  - The wage floor VERDICT is indeterminate. `wageFloor.percent` is 0.5, but
 *    `wageFloor.denominatorComponents` is null: the workbook names the 50% but never
 *    defines what it is 50% OF. The observed basic share is computed and returned
 *    (numerator from the components flagged `countsTowardWageFloor`, denominator
 *    stated explicitly as the observed monthly gross), while the Pass/Fail verdict
 *    stays `indeterminate`. A verdict derived from a guessed denominator would be a
 *    fabricated compliance result.
 *
 * Adoption is blocked by a failing verdict (the workbook has the floor test block
 * the save with the shortfall named) AND by an indeterminate one - letting an
 * unchecked structure through is the same unchecked structure either way.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Draft -> Simulated -> Submitted -> Adopted, per the SCR-052 state list. */
export const SIMULATION_STATES = ["draft", "simulated", "submitted", "adopted"] as const;
export type SimulationState = (typeof SIMULATION_STATES)[number];

export const SIMULATION_STATE_LABELS: Record<SimulationState, string> = {
  draft: "Draft",
  simulated: "Simulated",
  submitted: "Submitted",
  adopted: "Adopted",
};

/** Pinned formula version, in the same shape as the engine's `wage-base/v1`. */
export const SIMULATION_FORMULA = "salary-structure/v1";

/** The population a single simulation may carry, so the stored result stays bounded. */
export const MAX_SIMULATION_POPULATION = 200;

export type WageFloorVerdict = "pass" | "fail" | "indeterminate";

/** Only the component facts the simulator needs; keeps the pure core free of DB rows. */
export type SimulatorComponent = Pick<
  PayComponentDefinition,
  "code" | "name" | "payslipLabel" | "kind" | "partOfPfWage" | "partOfEsiWage" | "countsTowardWageFloor" | "payslipSequence"
>;

export const DEFAULT_SIMULATOR_COMPONENTS: SimulatorComponent[] = STANDARD_COMPONENTS.map((component) => ({
  code: component.code,
  name: component.name,
  payslipLabel: component.payslipLabel,
  kind: component.kind,
  partOfPfWage: component.partOfPfWage,
  partOfEsiWage: component.partOfEsiWage,
  countsTowardWageFloor: component.countsTowardWageFloor,
  payslipSequence: component.payslipSequence,
}));

export type EarningLine = {
  componentCode: string;
  label: string;
  amountMinor: number;
  partOfPfWage: boolean;
  partOfEsiWage: boolean;
  countsTowardWageFloor: boolean;
};

/** A statutory figure that WAS computable, carrying the rule it came from. */
export type StatutoryItem = {
  code: string;
  label: string;
  amountMinor: number;
  basisMinor: number;
  rule: string;
  note: string | null;
};

/** A statutory figure that was NOT computable, carrying the rules that are missing. */
export type UnavailableItem = {
  code: string;
  label: string;
  missingRules: string[];
  reason: string;
};

export type EmployerCostView = {
  available: boolean;
  /** Null whenever any employer-side item is unavailable: a partial total is a misleading total. */
  totalMinor: number | null;
  items: StatutoryItem[];
  unavailable: UnavailableItem[];
  missingRules: string[];
};

export type TakeHomeView = {
  grossMinor: number;
  computedDeductionsMinor: number;
  takeHomeMinor: number;
  /** True while TDS cannot be computed, which is what makes the caveat load-bearing. */
  excludesTds: boolean;
  excluded: UnavailableItem[];
  caveat: string;
};

export type WageFloorView = {
  percent: number | null;
  numeratorMinor: number;
  numeratorComponents: string[];
  denominatorMinor: number;
  denominatorBasis: string;
  /** Ratio, not a percentage: 0.4717 means the floor components are 47.17% of the denominator. */
  observedShare: number | null;
  verdict: WageFloorVerdict;
  /** Only present when a verdict was actually reached and it was a Fail. */
  shortfallMinor: number | null;
  missingRules: string[];
  reason: string;
};

export type ComponentDelta = {
  componentCode: string;
  label: string;
  currentMinor: number;
  proposedMinor: number;
  deltaMinor: number;
};

export type SimulationDelta = {
  hasCurrent: boolean;
  componentDeltas: ComponentDelta[];
  currentGrossMinor: number;
  currentTakeHomeMinor: number;
  grossDeltaMinor: number;
  takeHomeDeltaMinor: number;
};

export type EmployeeSimulation = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  basicMinor: number;
  resolved: Record<string, number>;
  earnings: EarningLine[];
  grossMinor: number;
  employeeStatutory: StatutoryItem[];
  employeeDeductionsMinor: number;
  takeHome: TakeHomeView;
  employerCost: EmployerCostView;
  wageFloor: WageFloorView;
  /** FRM-PAY-02 "Minimum wage test result" (PL_TEST_RESULT), or indeterminate while unsupplied. */
  minimumWage: MinimumWageView;
  delta: SimulationDelta;
  blockers: string[];
};

export type AggregateSimulation = {
  employeeCount: number;
  grossMinor: number;
  employeeDeductionsMinor: number;
  takeHomeMinor: number;
  currentGrossMinor: number;
  currentTakeHomeMinor: number;
  grossDeltaMinor: number;
  takeHomeDeltaMinor: number;
  floorPass: number;
  floorFail: number;
  floorIndeterminate: number;
  employerCostAvailable: boolean;
  takeHomeExcludesTds: boolean;
  missingRules: string[];
  blockers: string[];
};

// ---------------------------------------------------------------------------
// Pure calculation core
// ---------------------------------------------------------------------------

/** Exact decimal rendering of integer minor units; never touches floating point. */
export function formatMinorUnits(amountMinor: number): string {
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(Math.trunc(amountMinor));
  return `${sign}${Math.trunc(absolute / 100).toLocaleString("en-IN")}.${String(absolute % 100).padStart(2, "0")}`;
}

function componentIndex(components: SimulatorComponent[]): Map<string, SimulatorComponent> {
  return new Map(components.map((component) => [component.code, component]));
}

/**
 * Resolves the proposed lines against a basic and keeps only the earning side.
 * Ordering follows the payslip sequence so the breakdown reads the way a payslip does.
 */
export function resolveEarnings(
  lines: StructureLine[],
  basicMinor: number,
  components: SimulatorComponent[],
): { resolved: Record<string, number>; earnings: EarningLine[]; grossMinor: number } {
  const byCode = componentIndex(components);
  const resolved = resolveStructure(lines, basicMinor);
  const earnings: EarningLine[] = [];
  for (const [code, amountMinor] of Object.entries(resolved)) {
    const component = byCode.get(code);
    // An unknown code is treated as an earning: it was proposed as a pay line, and
    // silently dropping it would understate the gross the employee is being offered.
    if (component && component.kind !== "earning") continue;
    earnings.push({
      componentCode: code,
      label: component?.payslipLabel ?? component?.name ?? code,
      amountMinor,
      partOfPfWage: component?.partOfPfWage ?? false,
      partOfEsiWage: component?.partOfEsiWage ?? false,
      countsTowardWageFloor: component?.countsTowardWageFloor ?? false,
    });
  }
  earnings.sort(
    (left, right) =>
      (byCode.get(left.componentCode)?.payslipSequence ?? 900) - (byCode.get(right.componentCode)?.payslipSequence ?? 900) ||
      left.componentCode.localeCompare(right.componentCode),
  );
  return { resolved, earnings, grossMinor: earnings.reduce((total, line) => total + line.amountMinor, 0) };
}

/**
 * Derives the basic that makes a structure resolve to a target monthly gross.
 *
 * Every supported line is linear in basic (fixed amounts, or a percentage of another
 * resolved component), so gross(basic) = fixed + slope * basic and one probe at each
 * end is exact. Returns null when no positive basic reaches the target - either the
 * fixed lines already exceed it, or the structure carries no basic-driven slope at
 * all. Either way the honest answer is "no basic does this", not a rounded guess.
 */
export function deriveBasicFromMonthlyTarget(
  lines: StructureLine[],
  monthlyTargetMinor: number,
  components: SimulatorComponent[],
): number | null {
  const probe = 100_000_000;
  const atZero = resolveEarnings(lines, 0, components).grossMinor;
  const atProbe = resolveEarnings(lines, probe, components).grossMinor;
  const slope = (atProbe - atZero) / probe;
  if (!Number.isFinite(slope) || slope <= 0) return null;
  const derived = Math.round((monthlyTargetMinor - atZero) / slope);
  return derived > 0 ? derived : null;
}

/** Employee PF. Wage base and ceiling both come from the pack; the cap is reported, not hidden. */
export function computeEmployeePf(pack: RulePack, resolved: Record<string, number>): StatutoryItem {
  const wageBase = requireRule(pack.pf.wageBase, "pf.wageBase", pack.code);
  const rate = requireRule(pack.pf.employeeRate, "pf.employeeRate", pack.code);
  const ceilingMinor = requireRule(pack.pf.wageCeilingMinor, "pf.wageCeilingMinor", pack.code);
  const pfWageMinor = wageBase.reduce((total, code) => total + (resolved[code] ?? 0), 0);
  const uncapped = Math.round(pfWageMinor * rate);
  const capped = Math.round(ceilingMinor * rate);
  const amountMinor = Math.min(uncapped, capped);
  return {
    code: "pf",
    label: "Provident fund (employee)",
    amountMinor,
    basisMinor: pfWageMinor,
    rule: "pf.employeeRate",
    note:
      uncapped > capped
        ? `Capped at the PF wage ceiling of ${formatMinorUnits(ceilingMinor)}; the uncapped contribution would be ${formatMinorUnits(uncapped)}.`
        : null,
  };
}

/** Employee ESI. Coverage is threshold-tested on monthly gross, and a gross above it is out of cover, not zero-rated. */
export function computeEmployeeEsi(pack: RulePack, grossMinor: number): StatutoryItem {
  const rate = requireRule(pack.esi.employeeRate, "esi.employeeRate", pack.code);
  const thresholdMinor = requireRule(pack.esi.wageThresholdMinor, "esi.wageThresholdMinor", pack.code);
  const covered = grossMinor <= thresholdMinor;
  return {
    code: "esi",
    label: "Employee state insurance (employee)",
    amountMinor: covered ? Math.round(grossMinor * rate) : 0,
    basisMinor: covered ? grossMinor : 0,
    rule: "esi.employeeRate",
    note: covered
      ? null
      : `Monthly gross of ${formatMinorUnits(grossMinor)} is above the ESI coverage threshold of ${formatMinorUnits(thresholdMinor)}; this employee is outside ESI cover.`,
  };
}

/** Professional tax. State slabs are undefined in the pack, so the flat amount applies and says why. */
export function computeProfessionalTax(pack: RulePack): StatutoryItem {
  const flatAmountMinor = requireRule(pack.professionalTax.flatAmountMinor, "professionalTax.flatAmountMinor", pack.code);
  return {
    code: "pt",
    label: "Professional tax",
    amountMinor: flatAmountMinor,
    basisMinor: flatAmountMinor,
    rule: "professionalTax.flatAmountMinor",
    note:
      pack.professionalTax.stateSlabs === null
        ? "Per-state slabs (professionalTax.stateSlabs) are not defined in the rule pack, so the flat monthly amount applies."
        : null,
  };
}

/**
 * Employer-side cost. Each item is computed when its rules are supplied and named as
 * unavailable when they are not; the total stays null while anything is unavailable,
 * because a partial employer cost read as a whole one is worse than no figure.
 */
export function computeEmployerCost(pack: RulePack, args: { pfWageMinor: number; grossMinor: number }): EmployerCostView {
  const items: StatutoryItem[] = [];
  const unavailable: UnavailableItem[] = [];

  if (pack.pf.employerRate === null) {
    unavailable.push({
      code: "pf_employer",
      label: "Provident fund (employer)",
      missingRules: ["pf.employerRate"],
      reason: `Rule pack "${pack.code}" declares pf.employerRate but does not supply it. The employer PF share requires an approved value from the payroll policy owner.`,
    });
  } else {
    items.push({
      code: "pf_employer",
      label: "Provident fund (employer)",
      amountMinor: Math.round(args.pfWageMinor * pack.pf.employerRate),
      basisMinor: args.pfWageMinor,
      rule: "pf.employerRate",
      note: null,
    });
  }

  if (pack.esi.employerRate === null) {
    unavailable.push({
      code: "esi_employer",
      label: "Employee state insurance (employer)",
      missingRules: ["esi.employerRate"],
      reason: `Rule pack "${pack.code}" declares esi.employerRate but does not supply it. The employer ESI share requires an approved value from the payroll policy owner.`,
    });
  } else {
    const thresholdMinor = requireRule(pack.esi.wageThresholdMinor, "esi.wageThresholdMinor", pack.code);
    const covered = args.grossMinor <= thresholdMinor;
    items.push({
      code: "esi_employer",
      label: "Employee state insurance (employer)",
      amountMinor: covered ? Math.round(args.grossMinor * pack.esi.employerRate) : 0,
      basisMinor: covered ? args.grossMinor : 0,
      rule: "esi.employerRate",
      note: covered ? null : "Outside ESI cover at this gross.",
    });
  }

  const gratuityMissing = (
    [
      ["gratuity.daysPerYear", pack.gratuity.daysPerYear],
      ["gratuity.monthDays", pack.gratuity.monthDays],
      ["gratuity.wageBase", pack.gratuity.wageBase],
    ] as const
  )
    .filter(([, value]) => value === null)
    .map(([name]) => name);
  if (gratuityMissing.length > 0) {
    unavailable.push({
      code: "gratuity_accrual",
      label: "Gratuity accrual (employer)",
      missingRules: [...gratuityMissing],
      reason: `Rule pack "${pack.code}" does not supply ${gratuityMissing.join(", ")}, so the gratuity accrual carried by this structure cannot be costed.`,
    });
  }

  const available = unavailable.length === 0;
  return {
    available,
    totalMinor: available ? items.reduce((total, item) => total + item.amountMinor, 0) : null,
    items,
    unavailable,
    missingRules: unavailable.flatMap((item) => item.missingRules),
  };
}

/**
 * Take home = gross less the deductions that could actually be computed.
 *
 * TDS is not one of them while `tds.slabs` is null, and a take-home figure that
 * silently treats income tax as zero is not take home. The exclusion is returned
 * with the number so it cannot be read without it.
 */
export function computeTakeHome(pack: RulePack, grossMinor: number, statutory: StatutoryItem[]): TakeHomeView {
  const computedDeductionsMinor = statutory.reduce((total, item) => total + item.amountMinor, 0);
  const tdsMissing = (
    [
      ["tds.slabs", pack.tds.slabs],
      ["tds.standardDeductionMinor", pack.tds.standardDeductionMinor],
      ["tds.cessRate", pack.tds.cessRate],
      ["tds.rebate87a", pack.tds.rebate87a],
    ] as const
  )
    .filter(([, value]) => value === null)
    .map(([name]) => name);
  const excluded: UnavailableItem[] = [];
  if (tdsMissing.length > 0) {
    excluded.push({
      code: "tds",
      label: "Tax deducted at source",
      missingRules: [...tdsMissing],
      reason: `Rule pack "${pack.code}" does not supply ${tdsMissing.join(", ")}, so income tax cannot be computed for this structure.`,
    });
  }
  const excludesTds = excluded.length > 0;
  return {
    grossMinor,
    computedDeductionsMinor,
    takeHomeMinor: grossMinor - computedDeductionsMinor,
    excludesTds,
    excluded,
    caveat: excludesTds
      ? `This figure EXCLUDES TDS (${tdsMissing.join(", ")} are not defined in rule pack "${pack.code}"). It is take home before income tax, not net pay.`
      : "Take home includes every deduction the rule pack defines.",
  };
}

/**
 * Code on Wages basic-share test.
 *
 * The numerator is the components flagged `countsTowardWageFloor`. The denominator is
 * the pack's `wageFloor.denominatorComponents` - and while that rule is null there IS
 * no defined denominator, so the verdict is `indeterminate` and the observed share is
 * reported against the monthly gross with the basis stated in words. A Pass/Fail read
 * off a denominator the code chose for itself would be a fabricated compliance result.
 */
export function evaluateWageFloor(
  pack: RulePack,
  args: { resolved: Record<string, number>; earnings: EarningLine[]; grossMinor: number },
): WageFloorView {
  const floorLines = args.earnings.filter((line) => line.countsTowardWageFloor);
  const numeratorMinor = floorLines.reduce((total, line) => total + line.amountMinor, 0);
  const numeratorComponents = floorLines.map((line) => line.componentCode);
  const missingRules: string[] = [];
  if (pack.wageFloor.percent === null) missingRules.push("wageFloor.percent");
  if (pack.wageFloor.denominatorComponents === null) missingRules.push("wageFloor.denominatorComponents");

  if (missingRules.length > 0) {
    const denominatorMinor = args.grossMinor;
    return {
      percent: pack.wageFloor.percent,
      numeratorMinor,
      numeratorComponents,
      denominatorMinor,
      denominatorBasis: "Observed monthly gross (the rule pack does not define the floor denominator).",
      observedShare: denominatorMinor > 0 ? numeratorMinor / denominatorMinor : null,
      verdict: "indeterminate",
      shortfallMinor: null,
      missingRules,
      reason: `The observed basic share is shown, but no Pass/Fail verdict can be reached: rule pack "${pack.code}" does not supply ${missingRules.join(", ")}. The share above is measured against observed monthly gross, which is not a rule-pack-defined denominator.`,
    };
  }

  const percent = pack.wageFloor.percent as number;
  const denominatorComponents = pack.wageFloor.denominatorComponents as string[];
  const denominatorMinor = denominatorComponents.reduce((total, code) => total + (args.resolved[code] ?? 0), 0);
  const requiredMinor = Math.round(denominatorMinor * percent);
  const pass = numeratorMinor >= requiredMinor;
  return {
    percent,
    numeratorMinor,
    numeratorComponents,
    denominatorMinor,
    denominatorBasis: `Rule pack denominator: ${denominatorComponents.join(" + ")}.`,
    observedShare: denominatorMinor > 0 ? numeratorMinor / denominatorMinor : null,
    verdict: pass ? "pass" : "fail",
    shortfallMinor: pass ? null : requiredMinor - numeratorMinor,
    missingRules: [],
    reason: pass
      ? `Components counting toward the floor are ${formatMinorUnits(numeratorMinor)} against a required ${formatMinorUnits(requiredMinor)}.`
      : `Components counting toward the floor are ${formatMinorUnits(numeratorMinor)} against a required ${formatMinorUnits(requiredMinor)}.`,
  };
}

/** FRM-PAY-02 "Minimum wage test result" (PL_TEST_RESULT), plus the indeterminate case. */
export type MinimumWageView = {
  verdict: WageFloorVerdict;
  /** The monthly minimum the schedule states for this state and skill, in minor units. */
  requiredMonthlyMinor: number | null;
  observedMonthlyMinor: number;
  shortfallMinor: number | null;
  missingRules: string[];
  reason: string;
};

/**
 * Statutory minimum wage test.
 *
 * The workbook tests the structure against "the statutory minimum wage for the state and skill"
 * and never states a rate. While `minimumWage.monthlyMinorByStateAndSkill` is null there is no
 * schedule to test against, so the verdict is `indeterminate` and the observed monthly wage is
 * reported as-is. A Pass read off a rate the code chose for itself would be a fabricated
 * compliance result, exactly as it would be for the wage floor above.
 */
export function evaluateMinimumWage(
  pack: RulePack,
  args: { state: string | null; skill: string | null; monthlyWageMinor: number },
): MinimumWageView {
  const schedule = pack.minimumWage.monthlyMinorByStateAndSkill;
  if (schedule === null) {
    return {
      verdict: "indeterminate",
      requiredMonthlyMinor: null,
      observedMonthlyMinor: args.monthlyWageMinor,
      shortfallMinor: null,
      missingRules: ["minimumWage.monthlyMinorByStateAndSkill"],
      reason: `No Pass/Fail verdict can be reached: rule pack "${pack.code}" carries no minimum-wage schedule. The observed monthly wage is shown as-is.`,
    };
  }
  if (!args.state || !args.skill) {
    return {
      verdict: "indeterminate",
      requiredMonthlyMinor: null,
      observedMonthlyMinor: args.monthlyWageMinor,
      shortfallMinor: null,
      missingRules: [args.state ? "skill" : "state"],
      reason: "The minimum wage is set per state and skill; this structure names neither, so the test cannot be applied.",
    };
  }
  const required = schedule[`${args.state}::${args.skill}`];
  if (required === undefined) {
    return {
      verdict: "indeterminate",
      requiredMonthlyMinor: null,
      observedMonthlyMinor: args.monthlyWageMinor,
      shortfallMinor: null,
      missingRules: [`minimumWage.monthlyMinorByStateAndSkill[${args.state}::${args.skill}]`],
      reason: `The schedule in rule pack "${pack.code}" has no entry for ${args.state} / ${args.skill}.`,
    };
  }
  const pass = args.monthlyWageMinor >= required;
  return {
    verdict: pass ? "pass" : "fail",
    requiredMonthlyMinor: required,
    observedMonthlyMinor: args.monthlyWageMinor,
    shortfallMinor: pass ? null : required - args.monthlyWageMinor,
    missingRules: [],
    reason: `Monthly wage of ${formatMinorUnits(args.monthlyWageMinor)} against a statutory minimum of ${formatMinorUnits(required)} for ${args.state} / ${args.skill}.`,
  };
}

/**
 * Why this structure may not be adopted. A Fail blocks with the shortfall named; an
 * indeterminate verdict blocks with the missing rule named, because adopting on an
 * unreachable verdict adopts an unchecked structure just the same.
 */
export function adoptionBlockers(
  wageFloor: WageFloorView,
  packCode: string = DEFAULT_RULE_PACK_CODE,
  minimumWage?: MinimumWageView,
): string[] {
  // A minimum-wage failure blocks on its own; an indeterminate one does not, because there is no
  // schedule to be short of - the wage floor above is what already blocks on an unreachable verdict.
  const minimumWageBlockers =
    minimumWage && minimumWage.verdict === "fail"
      ? [`Minimum wage test failed: the monthly wage is short by ${formatMinorUnits(minimumWage.shortfallMinor ?? 0)} of the statutory minimum. ${minimumWage.reason}`]
      : [];
  if (wageFloor.verdict === "fail") {
    const percentLabel = wageFloor.percent === null ? "wage" : `${(wageFloor.percent * 100).toFixed(0)}%`;
    return [
      `Wage floor test failed: components counting toward the floor are short by ${formatMinorUnits(wageFloor.shortfallMinor ?? 0)} of the ${percentLabel} floor (${formatMinorUnits(wageFloor.numeratorMinor)} of ${formatMinorUnits(wageFloor.denominatorMinor)}).`,
      ...minimumWageBlockers,
    ];
  }
  if (wageFloor.verdict === "indeterminate") {
    return [
      `Wage floor verdict is indeterminate: rule pack "${packCode}" does not supply ${wageFloor.missingRules.join(", ")}. Adoption stays blocked until the payroll policy owner supplies an approved value.`,
      ...minimumWageBlockers,
    ];
  }
  return minimumWageBlockers;
}

/** Runs the whole employee-level simulation, including the delta against the current structure. */
export function simulateEmployeeStructure(args: {
  employee: { id: string; code: string | null; name: string; state?: string | null; skill?: string | null };
  basicMinor: number;
  proposedLines: StructureLine[];
  currentLines: StructureLine[] | null;
  currentBasicMinor: number | null;
  components: SimulatorComponent[];
  pack: RulePack;
}): EmployeeSimulation {
  const { pack, components } = args;
  const proposed = resolveEarnings(args.proposedLines, args.basicMinor, components);
  const pf = computeEmployeePf(pack, proposed.resolved);
  const esi = computeEmployeeEsi(pack, proposed.grossMinor);
  const pt = computeProfessionalTax(pack);
  const employeeStatutory = [pf, esi, pt];
  const takeHome = computeTakeHome(pack, proposed.grossMinor, employeeStatutory);
  const employerCost = computeEmployerCost(pack, { pfWageMinor: pf.basisMinor, grossMinor: proposed.grossMinor });
  const wageFloor = evaluateWageFloor(pack, { resolved: proposed.resolved, earnings: proposed.earnings, grossMinor: proposed.grossMinor });
  // FRM-PAY-02 "Minimum wage test result". Tested against monthly gross, which is what a state's
  // schedule states; the verdict stays indeterminate while no schedule is supplied.
  const minimumWage = evaluateMinimumWage(pack, {
    state: args.employee.state ?? null,
    skill: args.employee.skill ?? null,
    monthlyWageMinor: proposed.grossMinor,
  });

  const hasCurrent = args.currentLines !== null && args.currentBasicMinor !== null && args.currentBasicMinor > 0;
  const current = hasCurrent
    ? resolveEarnings(args.currentLines as StructureLine[], args.currentBasicMinor as number, components)
    : { resolved: {} as Record<string, number>, earnings: [] as EarningLine[], grossMinor: 0 };
  const currentTakeHome = hasCurrent
    ? computeTakeHome(pack, current.grossMinor, [
        computeEmployeePf(pack, current.resolved),
        computeEmployeeEsi(pack, current.grossMinor),
        pt,
      ]).takeHomeMinor
    : 0;

  const codes = [...new Set([...current.earnings.map((line) => line.componentCode), ...proposed.earnings.map((line) => line.componentCode)])];
  const byCode = componentIndex(components);
  const componentDeltas: ComponentDelta[] = codes
    .map((code) => {
      const currentMinor = current.earnings.find((line) => line.componentCode === code)?.amountMinor ?? 0;
      const proposedMinor = proposed.earnings.find((line) => line.componentCode === code)?.amountMinor ?? 0;
      return {
        componentCode: code,
        label: byCode.get(code)?.payslipLabel ?? byCode.get(code)?.name ?? code,
        currentMinor,
        proposedMinor,
        deltaMinor: proposedMinor - currentMinor,
      };
    })
    .sort(
      (left, right) =>
        (byCode.get(left.componentCode)?.payslipSequence ?? 900) - (byCode.get(right.componentCode)?.payslipSequence ?? 900) ||
        left.componentCode.localeCompare(right.componentCode),
    );

  return {
    employeeId: args.employee.id,
    employeeCode: args.employee.code,
    employeeName: args.employee.name,
    basicMinor: args.basicMinor,
    resolved: proposed.resolved,
    earnings: proposed.earnings,
    grossMinor: proposed.grossMinor,
    employeeStatutory,
    employeeDeductionsMinor: takeHome.computedDeductionsMinor,
    takeHome,
    employerCost,
    wageFloor,
    minimumWage,
    delta: {
      hasCurrent,
      componentDeltas,
      currentGrossMinor: current.grossMinor,
      currentTakeHomeMinor: currentTakeHome,
      grossDeltaMinor: hasCurrent ? proposed.grossMinor - current.grossMinor : 0,
      takeHomeDeltaMinor: hasCurrent ? takeHome.takeHomeMinor - currentTakeHome : 0,
    },
    blockers: adoptionBlockers(wageFloor, pack.code, minimumWage),
  };
}

/** Population totals. Every money total is the exact sum of the per-employee figures. */
export function aggregateSimulations(employees: EmployeeSimulation[]): AggregateSimulation {
  const sum = (pick: (item: EmployeeSimulation) => number): number => employees.reduce((total, item) => total + pick(item), 0);
  const missingRules = [
    ...new Set(
      employees.flatMap((item) => [
        ...item.employerCost.missingRules,
        ...item.takeHome.excluded.flatMap((entry) => entry.missingRules),
        ...item.wageFloor.missingRules,
      ]),
    ),
  ].sort();
  return {
    employeeCount: employees.length,
    grossMinor: sum((item) => item.grossMinor),
    employeeDeductionsMinor: sum((item) => item.employeeDeductionsMinor),
    takeHomeMinor: sum((item) => item.takeHome.takeHomeMinor),
    currentGrossMinor: sum((item) => item.delta.currentGrossMinor),
    currentTakeHomeMinor: sum((item) => item.delta.currentTakeHomeMinor),
    grossDeltaMinor: sum((item) => item.delta.grossDeltaMinor),
    takeHomeDeltaMinor: sum((item) => item.delta.takeHomeDeltaMinor),
    floorPass: employees.filter((item) => item.wageFloor.verdict === "pass").length,
    floorFail: employees.filter((item) => item.wageFloor.verdict === "fail").length,
    floorIndeterminate: employees.filter((item) => item.wageFloor.verdict === "indeterminate").length,
    employerCostAvailable: employees.length > 0 && employees.every((item) => item.employerCost.available),
    takeHomeExcludesTds: employees.some((item) => item.takeHome.excludesTds),
    missingRules,
    blockers: [...new Set(employees.flatMap((item) => item.blockers))],
  };
}

/** The state machine. Draft -> Simulated -> Submitted -> Adopted, no skipping and no reopening. */
export function nextSimulationState(current: SimulationState, action: "simulate" | "submit" | "adopt"): SimulationState {
  if (action === "simulate") {
    if (current === "adopted") {
      throw new HttpError({ status: 409, code: "INVALID_STATE", message: "An adopted simulation cannot be re-simulated. Start a new scenario." });
    }
    return "simulated";
  }
  if (action === "submit") {
    if (current !== "simulated") {
      throw new HttpError({ status: 409, code: "INVALID_STATE", message: `A ${SIMULATION_STATE_LABELS[current].toLowerCase()} simulation cannot be submitted. Run the simulation first.` });
    }
    return "submitted";
  }
  if (current !== "submitted") {
    throw new HttpError({ status: 409, code: "INVALID_STATE", message: `A ${SIMULATION_STATE_LABELS[current].toLowerCase()} simulation cannot be adopted. It must be submitted for approval first.` });
  }
  return "adopted";
}

// ---------------------------------------------------------------------------
// Request contracts
// ---------------------------------------------------------------------------

const structureLineSchema = z
  .object({
    componentCode: z.string().trim().min(1).max(60),
    calculationMethod: z.enum(CALCULATION_METHODS),
    amountMinor: z.number().int().min(0).nullable().default(null),
    percentageOf: z.string().trim().min(1).max(60).nullable().default(null),
    percentageValue: z.number().min(0).max(10).nullable().default(null),
  })
  .strict();

export const simulateStructureSchema = z
  .object({
    action: z.literal("simulate").optional(),
    scenario: z.string().trim().min(1).max(120),
    lines: z.array(structureLineSchema).min(1).max(40),
    /** Applied to every selected employee; omit to reshape each employee's own basic. */
    basicMinor: z.number().int().min(0).nullable().default(null),
    /** Annual CTC; the basic is derived from the proposed lines so the gross lands on CTC/12. */
    ctcMinor: z.number().int().min(0).nullable().default(null),
    employeeIds: z.array(z.string().uuid()).max(MAX_SIMULATION_POPULATION).nullable().default(null),
  })
  .strict()
  .refine((value) => value.basicMinor === null || value.ctcMinor === null, {
    message: "Provide either a basic or a CTC, not both.",
    path: ["ctcMinor"],
  });

export type SimulateStructureInput = z.infer<typeof simulateStructureSchema>;

export const simulationActionSchema = z
  .object({
    action: z.enum(["submit", "adopt"]),
    simulationId: z.string().uuid(),
    reason: z.string().trim().max(500).nullable().default(null),
  })
  .strict();

export type SimulationActionInput = z.infer<typeof simulationActionSchema>;

export const listSimulationsSchema = z
  .object({
    state: z.enum(SIMULATION_STATES).nullable().default(null),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })
  .strict();

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export type SimulationSummary = {
  id: string;
  scenario: string;
  state: SimulationState;
  formula: string;
  rulePackCode: string;
  salaryStructureId: string | null;
  employeeCount: number;
  grossMinor: number;
  takeHomeMinor: number;
  employeeDeductionsMinor: number;
  grossDeltaMinor: number;
  takeHomeDeltaMinor: number;
  floorVerdictSummary: string;
  blocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SimulationDetail = SimulationSummary & {
  aggregate: AggregateSimulation;
  employees: EmployeeSimulation[];
  proposedLines: StructureLine[];
  basis: { basicMinor: number | null; ctcMinor: number | null; derivedBasicMinor: number | null };
  truncated: boolean;
  lines: Array<{ componentCode: string; label: string; currentMinor: number; proposedMinor: number; deltaMinor: number }>;
};

type SimulationRow = {
  id: string;
  salary_structure_id: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function readState(value: unknown): SimulationState {
  return (SIMULATION_STATES as readonly string[]).includes(String(value)) ? (value as SimulationState) : "draft";
}

function floorSummary(aggregate: AggregateSimulation): string {
  if (aggregate.floorFail > 0) return `${aggregate.floorFail} fail`;
  if (aggregate.floorIndeterminate > 0) return `${aggregate.floorIndeterminate} indeterminate`;
  if (aggregate.floorPass > 0) return `${aggregate.floorPass} pass`;
  return "No population";
}

function emptyAggregate(): AggregateSimulation {
  return aggregateSimulations([]);
}

function summaryFrom(row: SimulationRow): SimulationSummary {
  const attributes = row.attributes ?? {};
  const aggregate = (attributes.aggregate as AggregateSimulation | undefined) ?? emptyAggregate();
  return {
    id: row.id,
    scenario: String(attributes.scenario ?? "Scenario"),
    state: readState(attributes.state),
    formula: String(attributes.formula ?? SIMULATION_FORMULA),
    rulePackCode: String(attributes.rule_pack_code ?? DEFAULT_RULE_PACK_CODE),
    salaryStructureId: row.salary_structure_id,
    employeeCount: Number(aggregate.employeeCount ?? 0),
    grossMinor: Number(aggregate.grossMinor ?? 0),
    takeHomeMinor: Number(aggregate.takeHomeMinor ?? 0),
    employeeDeductionsMinor: Number(aggregate.employeeDeductionsMinor ?? 0),
    grossDeltaMinor: Number(aggregate.grossDeltaMinor ?? 0),
    takeHomeDeltaMinor: Number(aggregate.takeHomeDeltaMinor ?? 0),
    floorVerdictSummary: floorSummary(aggregate),
    blocked: (aggregate.blockers ?? []).length > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function detailFrom(row: SimulationRow): SimulationDetail {
  const attributes = row.attributes ?? {};
  const aggregate = (attributes.aggregate as AggregateSimulation | undefined) ?? emptyAggregate();
  const employees = Array.isArray(attributes.employees) ? (attributes.employees as EmployeeSimulation[]) : [];
  const basis = (attributes.basis as SimulationDetail["basis"] | undefined) ?? { basicMinor: null, ctcMinor: null, derivedBasicMinor: null };
  const lines = Array.isArray(attributes.component_totals) ? (attributes.component_totals as SimulationDetail["lines"]) : [];
  return {
    ...summaryFrom(row),
    aggregate,
    employees,
    proposedLines: Array.isArray(attributes.proposed_lines) ? (attributes.proposed_lines as StructureLine[]) : [],
    basis,
    truncated: attributes.truncated === true,
    lines,
  };
}

async function loadSimulatorComponents(access: Access): Promise<SimulatorComponent[]> {
  const rows = await listComponents(access);
  if (rows.length === 0) return DEFAULT_SIMULATOR_COMPONENTS;
  return rows.map((component) => ({
    code: component.code,
    name: component.name,
    payslipLabel: component.payslipLabel,
    kind: component.kind,
    partOfPfWage: component.partOfPfWage,
    partOfEsiWage: component.partOfEsiWage,
    countsTowardWageFloor: component.countsTowardWageFloor,
    payslipSequence: component.payslipSequence,
  }));
}

type PopulationRow = {
  id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  basic_salary_minor: number | string | null;
  salary_structure_id: string | null;
  assigned_basic_minor: number | string | null;
};

function currentPeriodCode(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Runs a proposed structure over one employee or a population and persists the result.
 *
 * The simulation is explicitly non-posting: nothing reaches `payroll_lines`, and the
 * stored row carries `posted: false` alongside the rule pack version it was measured
 * against, so the figures stay reproducible.
 */
export async function simulateStructure(access: Access, input: SimulateStructureInput, requestId: string): Promise<SimulationDetail> {
  // Compensation figures: the caller needs payroll.run AND the compensation sensitivity grant.
  enforce(access.context, "payroll.run", { tenantId: access.tenantId, sensitivity: ["compensation"] });

  const pack = rulePack(DEFAULT_RULE_PACK_CODE);
  const components = await loadSimulatorComponents(access);
  const scaffold = await ensurePayrollScaffold(access, currentPeriodCode());
  const proposedLines: StructureLine[] = input.lines.map((line) => ({
    componentCode: line.componentCode,
    calculationMethod: line.calculationMethod,
    amountMinor: line.amountMinor,
    percentageOf: line.percentageOf,
    percentageValue: line.percentageValue,
  }));

  let derivedBasicMinor: number | null = null;
  if (input.ctcMinor !== null) {
    derivedBasicMinor = deriveBasicFromMonthlyTarget(proposedLines, Math.round(input.ctcMinor / 12), components);
    if (derivedBasicMinor === null) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "No basic can be derived from these lines: none of them scale with basic, so the structure cannot reach the requested CTC.",
        details: [{ field: "lines", issue: "At least one line must be a percentage of basic for a CTC-driven proposal." }],
      });
    }
  }
  const overrideBasicMinor = input.basicMinor ?? derivedBasicMinor;

  const employeeIds = input.employeeIds;
  const [populationRows] = await tenantTx(access, [
    employeeIds && employeeIds.length > 0
      ? sqlClient`
          select e.id, e.employee_code, e.first_name, e.last_name, e.basic_salary_minor,
                 a.salary_structure_id, a.assigned_basic_minor
          from employees e
          left join lateral (
            select sa.salary_structure_id, (sa.attributes->>'basic_minor')::bigint as assigned_basic_minor
            from employee_salary_assignments sa
            where sa.tenant_id = e.tenant_id and sa.employee_id = e.id
            order by sa.created_at desc limit 1
          ) a on true
          where e.tenant_id = ${access.tenantId} and e.id = any(${employeeIds})
          order by e.employee_code nulls last, e.id
          limit ${MAX_SIMULATION_POPULATION + 1}
        `
      : sqlClient`
          select e.id, e.employee_code, e.first_name, e.last_name, e.basic_salary_minor,
                 a.salary_structure_id, a.assigned_basic_minor
          from employees e
          left join lateral (
            select sa.salary_structure_id, (sa.attributes->>'basic_minor')::bigint as assigned_basic_minor
            from employee_salary_assignments sa
            where sa.tenant_id = e.tenant_id and sa.employee_id = e.id
            order by sa.created_at desc limit 1
          ) a on true
          where e.tenant_id = ${access.tenantId} and e.status = 'active'
          order by e.employee_code nulls last, e.id
          limit ${MAX_SIMULATION_POPULATION + 1}
        `,
  ]);
  const allRows = populationRows as PopulationRow[];
  const truncated = allRows.length > MAX_SIMULATION_POPULATION;
  const population = allRows.slice(0, MAX_SIMULATION_POPULATION);
  if (population.length === 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "No employee is in scope for this simulation, so there is nothing to measure.",
      details: [{ field: "employeeIds", issue: "No matching active employee was found in this tenant." }],
    });
  }

  // Current structures, loaded once per distinct structure rather than per employee.
  const structureIds = [...new Set(population.map((row) => row.salary_structure_id ?? scaffold.structureId))];
  const currentLinesByStructure = new Map<string, StructureLine[]>();
  for (const structureId of structureIds) {
    currentLinesByStructure.set(structureId, await listStructureComponents(access, structureId));
  }

  const employees: EmployeeSimulation[] = [];
  for (const row of population) {
    const currentBasicMinor =
      row.assigned_basic_minor !== null && row.assigned_basic_minor !== undefined
        ? Number(row.assigned_basic_minor)
        : row.basic_salary_minor !== null && row.basic_salary_minor !== undefined
          ? Number(row.basic_salary_minor)
          : null;
    const basicMinor = overrideBasicMinor ?? currentBasicMinor;
    if (basicMinor === null || basicMinor <= 0) continue;
    const structureId = row.salary_structure_id ?? scaffold.structureId;
    const currentLines = currentLinesByStructure.get(structureId) ?? null;
    employees.push(
      simulateEmployeeStructure({
        employee: {
          id: row.id,
          code: row.employee_code,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.employee_code || row.id,
          // FRM-PAY-02's minimum wage is set per state and skill. `employees` records a free-text
          // `location` and a `category`, neither of which is a state or a skill grade, so neither
          // is supplied here: the test reports why it cannot be applied rather than guessing a
          // mapping. See `tmp/_audit/requests/payroll.md`.
          state: null,
          skill: null,
        },
        basicMinor,
        proposedLines,
        currentLines: currentLines && currentLines.length > 0 ? currentLines : null,
        currentBasicMinor,
        components,
        pack,
      }),
    );
  }
  if (employees.length === 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "No employee in scope has a basic salary, so no structure can be simulated. Supply a basic or a CTC on the proposal.",
      details: [{ field: "basicMinor", issue: "Neither the proposal nor the employee records carry a basic salary." }],
    });
  }

  const aggregate = aggregateSimulations(employees);
  const componentTotals = componentTotalsFrom(employees);
  const id = crypto.randomUUID();
  const attributes = {
    scenario: input.scenario,
    state: "simulated" satisfies SimulationState,
    formula: SIMULATION_FORMULA,
    posted: false,
    rule_pack_code: pack.code,
    proposed_lines: proposedLines,
    basis: { basicMinor: input.basicMinor, ctcMinor: input.ctcMinor, derivedBasicMinor },
    truncated,
    aggregate,
    employees,
    component_totals: componentTotals,
    /** Kept so the legacy `wage-base/v1` reader still finds a headline figure. */
    result_minor: aggregate.grossMinor,
    missing_rules: aggregate.missingRules,
  };

  const componentIds = await componentIdsByCode(access);
  await tenantTx(access, [
    sqlClient`
      insert into wage_base_simulations (id, tenant_id, requested_by_membership_id, rule_pack_version_id, salary_structure_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${scaffold.packId}, ${scaffold.structureId}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.structure_simulate', 'wage_base_simulation', ${id},
        ${`Salary structure simulated (non-posting): ${input.scenario}`},
        ${JSON.stringify({ aggregate, missing_rules: aggregate.missingRules })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  for (const total of componentTotals) {
    const componentId = componentIds[total.componentCode];
    if (!componentId) continue;
    await tenantTx(access, [
      sqlClient`
        insert into wage_base_simulation_lines (id, tenant_id, wage_base_simulation_id, pay_component_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${id}, ${componentId}, ${JSON.stringify({
          component_code: total.componentCode,
          label: total.label,
          current_minor: total.currentMinor,
          proposed_minor: total.proposedMinor,
          delta_minor: total.deltaMinor,
        })}::jsonb)
      `,
    ]);
  }

  return {
    ...summaryFrom({ id, salary_structure_id: scaffold.structureId, attributes, created_at: null, updated_at: null }),
    aggregate,
    employees,
    proposedLines,
    basis: { basicMinor: input.basicMinor, ctcMinor: input.ctcMinor, derivedBasicMinor },
    truncated,
    lines: componentTotals,
  };
}

/** Population totals per component, which is what the persisted simulation lines carry. */
export function componentTotalsFrom(employees: EmployeeSimulation[]): SimulationDetail["lines"] {
  const totals = new Map<string, { componentCode: string; label: string; currentMinor: number; proposedMinor: number; deltaMinor: number }>();
  for (const employee of employees) {
    for (const delta of employee.delta.componentDeltas) {
      const existing = totals.get(delta.componentCode) ?? {
        componentCode: delta.componentCode,
        label: delta.label,
        currentMinor: 0,
        proposedMinor: 0,
        deltaMinor: 0,
      };
      existing.currentMinor += delta.currentMinor;
      existing.proposedMinor += delta.proposedMinor;
      existing.deltaMinor += delta.deltaMinor;
      totals.set(delta.componentCode, existing);
    }
  }
  return [...totals.values()];
}

async function componentIdsByCode(access: Access): Promise<Record<string, string>> {
  const rows = await listComponents(access);
  return Object.fromEntries(rows.map((component) => [component.code, component.id]));
}

export async function listSimulations(
  access: Access,
  args: { state?: SimulationState | null; page: number; pageSize: number },
): Promise<{ items: SimulationSummary[]; total: number }> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId, sensitivity: ["compensation"] });
  const state = args.state ?? null;
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from wage_base_simulations
      where tenant_id = ${access.tenantId}
        and attributes->>'formula' = ${SIMULATION_FORMULA}
        and (${state}::text is null or attributes->>'state' = ${state}::text)
    `,
    sqlClient`
      select id, salary_structure_id, attributes, created_at, updated_at
      from wage_base_simulations
      where tenant_id = ${access.tenantId}
        and attributes->>'formula' = ${SIMULATION_FORMULA}
        and (${state}::text is null or attributes->>'state' = ${state}::text)
      order by created_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return {
    items: (rows as SimulationRow[]).map(summaryFrom),
    total: (countRows as Array<{ total: number }>)[0]?.total ?? 0,
  };
}

export async function getSimulation(access: Access, simulationId: string): Promise<SimulationDetail> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId, sensitivity: ["compensation"] });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, salary_structure_id, attributes, created_at, updated_at
      from wage_base_simulations
      where tenant_id = ${access.tenantId} and id = ${simulationId} limit 1
    `,
  ]);
  const row = (rows as SimulationRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return detailFrom(row);
}

async function loadSimulationRow(access: Access, simulationId: string): Promise<SimulationRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, salary_structure_id, attributes, created_at, updated_at
      from wage_base_simulations
      where tenant_id = ${access.tenantId} and id = ${simulationId} limit 1
    `,
  ]);
  const row = (rows as SimulationRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/** Simulated -> Submitted. Take-home impact is already on the record before anyone approves it. */
export async function submitSimulation(access: Access, input: SimulationActionInput, requestId: string): Promise<SimulationDetail> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId, sensitivity: ["compensation"] });
  const row = await loadSimulationRow(access, input.simulationId);
  const attributes = row.attributes ?? {};
  const state = nextSimulationState(readState(attributes.state), "submit");
  const next = { ...attributes, state };
  await tenantTx(access, [
    sqlClient`
      update wage_base_simulations set attributes = ${JSON.stringify(next)}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${input.simulationId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.structure_simulation_submit', 'wage_base_simulation', ${input.simulationId},
        ${input.reason ?? "Proposed salary structure submitted for adoption"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return detailFrom({ ...row, attributes: next });
}

/**
 * Submitted -> Adopted. Writes the proposed lines onto the simulation's salary
 * structure, but only after the wage floor verdict is re-evaluated against the live
 * rule pack: a Fail blocks with the shortfall named, and an indeterminate verdict
 * blocks with the missing rule named.
 */
export async function adoptSimulation(access: Access, input: SimulationActionInput, requestId: string): Promise<SimulationDetail> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId, sensitivity: ["compensation"] });
  const row = await loadSimulationRow(access, input.simulationId);
  const attributes = row.attributes ?? {};
  const state = nextSimulationState(readState(attributes.state), "adopt");

  const pack = rulePack(String(attributes.rule_pack_code ?? DEFAULT_RULE_PACK_CODE));
  const components = await loadSimulatorComponents(access);
  const employees = Array.isArray(attributes.employees) ? (attributes.employees as EmployeeSimulation[]) : [];
  // Re-evaluated now, not read off the stored verdict: if a rule has been supplied
  // since the simulation ran, the floor test must be able to reach a real verdict.
  const blockers = [
    ...new Set(
      employees.flatMap((employee) => {
        const { earnings, grossMinor } = resolveEarnings(
          (attributes.proposed_lines as StructureLine[]) ?? [],
          employee.basicMinor,
          components,
        );
        const verdict = evaluateWageFloor(pack, { resolved: employee.resolved, earnings, grossMinor });
        return adoptionBlockers(verdict, pack.code).map((blocker) => `${employee.employeeName}: ${blocker}`);
      }),
    ),
  ];
  if (blockers.length > 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "This structure cannot be adopted while the wage floor test is failing or cannot be evaluated.",
      details: blockers.map((blocker) => ({ field: "wageFloor", issue: blocker })),
    });
  }

  const structureId = row.salary_structure_id;
  if (!structureId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This simulation is not attached to a salary structure, so there is nothing to adopt it onto." });
  }
  const proposedLines = Array.isArray(attributes.proposed_lines) ? (attributes.proposed_lines as StructureLine[]) : [];
  const componentIds = await componentIdsByCode(access);
  const [existingRows] = await tenantTx(access, [
    sqlClient`select id, pay_component_id from salary_structure_components where tenant_id = ${access.tenantId} and salary_structure_id = ${structureId}`,
  ]);
  const existing = new Map((existingRows as Array<{ id: string; pay_component_id: string }>).map((entry) => [entry.pay_component_id, entry.id]));

  for (const line of proposedLines) {
    const componentId = componentIds[line.componentCode];
    if (!componentId) continue;
    const lineAttributes = {
      component_code: line.componentCode,
      calculation_method: line.calculationMethod,
      amount_minor: line.amountMinor,
      percentage_of: line.percentageOf,
      percentage_value: line.percentageValue,
    };
    const found = existing.get(componentId);
    await tenantTx(access, [
      found
        ? sqlClient`
            update salary_structure_components set attributes = ${JSON.stringify(lineAttributes)}::jsonb, version = version + 1, updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${found}
          `
        : sqlClient`
            insert into salary_structure_components (id, tenant_id, salary_structure_id, pay_component_id, attributes)
            values (${crypto.randomUUID()}, ${access.tenantId}, ${structureId}, ${componentId}, ${JSON.stringify(lineAttributes)}::jsonb)
          `,
    ]);
  }

  const next = { ...attributes, state, adopted_at: new Date().toISOString() };
  await tenantTx(access, [
    sqlClient`
      update wage_base_simulations set attributes = ${JSON.stringify(next)}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${input.simulationId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.structure_simulation_adopt', 'wage_base_simulation', ${input.simulationId},
        ${input.reason ?? "Proposed salary structure adopted"},
        ${JSON.stringify({ salary_structure_id: structureId, lines: proposedLines })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return detailFrom({ ...row, attributes: next });
}
