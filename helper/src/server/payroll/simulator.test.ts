import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";
import type { StructureLine } from "./components";
import { rulePack, type RulePack } from "./rule-pack";
import {
  adoptionBlockers,
  evaluateMinimumWage,
  aggregateSimulations,
  computeEmployeeEsi,
  computeEmployeePf,
  computeEmployerCost,
  computeProfessionalTax,
  componentTotalsFrom,
  DEFAULT_SIMULATOR_COMPONENTS,
  computeTakeHome,
  deriveBasicFromMonthlyTarget,
  evaluateWageFloor,
  nextSimulationState,
  resolveEarnings,
  simulateEmployeeStructure,
  type EmployeeSimulation,
} from "./simulator";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PACK = rulePack("in-pay/v1");
const COMPONENTS = DEFAULT_SIMULATOR_COMPONENTS;

function line(
  componentCode: string,
  overrides: Partial<StructureLine> = {},
): StructureLine {
  return {
    componentCode,
    calculationMethod: "fixed_amount",
    amountMinor: null,
    percentageOf: null,
    percentageValue: null,
    ...overrides,
  };
}

/** basic + 10% DA + 40% HRA + fixed conveyance and special. Gross = 1.5 x basic + 400000. */
const PROPOSED: StructureLine[] = [
  line("basic", { calculationMethod: "fixed_amount", amountMinor: 0 }),
  line("da", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.1 }),
  line("hra", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.4 }),
  line("conveyance", { amountMinor: 160_000 }),
  line("special", { amountMinor: 240_000 }),
];

/** Only a basic line, so gross == basic and the ESI threshold can be hit exactly. */
const BASIC_ONLY: StructureLine[] = [line("basic", { amountMinor: 0 })];

/** A pack that DOES define the floor denominator, so the pass/fail path is reachable. */
function packWithFloorDenominator(overrides: Partial<RulePack["wageFloor"]> = {}): RulePack {
  return {
    ...PACK,
    wageFloor: { percent: 0.5, denominatorComponents: ["basic", "da", "hra", "conveyance", "special"], ...overrides },
  };
}

function employee(id: string) {
  return { id, code: id.toUpperCase(), name: `Employee ${id}` };
}

// ---------------------------------------------------------------------------

describe("proposed structure resolution (SCR-052)", () => {
  it("resolves percentage lines against the component they reference and sums only earnings", () => {
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    expect(resolved.basic).toBe(3_000_000);
    expect(resolved.da).toBe(300_000);
    expect(resolved.hra).toBe(1_200_000);
    expect(grossMinor).toBe(4_900_000);
    expect(earnings.map((entry) => entry.componentCode)).toEqual(["basic", "da", "hra", "conveyance", "special"]);
  });

  it("derives the basic that lands a CTC-driven proposal on its monthly target", () => {
    const derived = deriveBasicFromMonthlyTarget(PROPOSED, 4_900_000, COMPONENTS);
    expect(derived).toBe(3_000_000);
    expect(resolveEarnings(PROPOSED, derived as number, COMPONENTS).grossMinor).toBe(4_900_000);
  });

  it("lets basic absorb the residual when the other lines are all fixed", () => {
    const fixedOnly = [line("conveyance", { amountMinor: 160_000 })];
    expect(deriveBasicFromMonthlyTarget(fixedOnly, 300_000, COMPONENTS)).toBe(140_000);
  });

  it("returns null rather than a negative basic when the fixed lines already exceed the target", () => {
    const fixedOnly = [line("conveyance", { amountMinor: 160_000 })];
    expect(deriveBasicFromMonthlyTarget(fixedOnly, 100_000, COMPONENTS)).toBeNull();
  });
});

describe("employee provident fund (SCR-052)", () => {
  it("applies the PF wage ceiling and names the cap it applied", () => {
    const pf = computeEmployeePf(PACK, resolveEarnings(PROPOSED, 3_000_000, COMPONENTS).resolved);
    // PF wage is basic + DA = 3,300,000; 12% of that is 396,000, but the ceiling
    // (1,500,000) caps the contribution at 180,000.
    expect(pf.basisMinor).toBe(3_300_000);
    expect(pf.amountMinor).toBe(180_000);
    expect(pf.note).toContain("Capped at the PF wage ceiling");
  });

  it("leaves the contribution uncapped below the ceiling", () => {
    const pf = computeEmployeePf(PACK, resolveEarnings(PROPOSED, 1_000_000, COMPONENTS).resolved);
    expect(pf.basisMinor).toBe(1_100_000);
    expect(pf.amountMinor).toBe(132_000);
    expect(pf.note).toBeNull();
  });

  it("reads the wage base from the rule pack rather than assuming basic plus DA", () => {
    expect(PACK.pf.wageBase).toEqual(["basic", "da"]);
    const narrowed: RulePack = { ...PACK, pf: { ...PACK.pf, wageBase: ["basic"] } };
    expect(computeEmployeePf(narrowed, { basic: 1_000_000, da: 100_000 }).basisMinor).toBe(1_000_000);
  });
});

describe("employee state insurance threshold (SCR-052)", () => {
  const threshold = PACK.esi.wageThresholdMinor as number;

  it("covers a gross exactly on the threshold", () => {
    const esi = computeEmployeeEsi(PACK, threshold);
    expect(threshold).toBe(2_100_000);
    expect(esi.amountMinor).toBe(15_750);
    expect(esi.note).toBeNull();
  });

  it("drops out of cover one minor unit above the threshold and says why", () => {
    const esi = computeEmployeeEsi(PACK, threshold + 1);
    expect(esi.amountMinor).toBe(0);
    expect(esi.basisMinor).toBe(0);
    expect(esi.note).toContain("outside ESI cover");
  });

  it("tests the threshold against the resolved gross of the proposal", () => {
    expect(resolveEarnings(BASIC_ONLY, threshold, COMPONENTS).grossMinor).toBe(threshold);
    expect(computeEmployeeEsi(PACK, resolveEarnings(BASIC_ONLY, threshold, COMPONENTS).grossMinor).amountMinor).toBe(15_750);
  });
});

describe("take home excludes TDS and says so (SCR-052)", () => {
  it("subtracts only the deductions the rule pack can compute", () => {
    const { resolved, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    const statutory = [computeEmployeePf(PACK, resolved), computeEmployeeEsi(PACK, grossMinor), computeProfessionalTax(PACK)];
    const takeHome = computeTakeHome(PACK, grossMinor, statutory);
    // PF 180,000 (ceiling) + ESI 0 (above threshold) + PT 20,000.
    expect(takeHome.computedDeductionsMinor).toBe(200_000);
    expect(takeHome.takeHomeMinor).toBe(4_700_000);
    // Gross and take home are different computed figures, not the same expression twice.
    expect(takeHome.takeHomeMinor).not.toBe(takeHome.grossMinor);
  });

  it("never treats an uncomputable TDS as zero silently", () => {
    const takeHome = computeTakeHome(PACK, 4_900_000, []);
    expect(takeHome.excludesTds).toBe(true);
    expect(takeHome.caveat).toContain("EXCLUDES TDS");
    expect(takeHome.caveat).toContain("not net pay");
    expect(takeHome.excluded[0]?.missingRules).toContain("tds.slabs");
  });

  it("drops the caveat once the pack supplies the TDS rules", () => {
    const supplied: RulePack = {
      ...PACK,
      tds: {
        ...PACK.tds,
        slabs: { old: [{ uptoMinor: null, rate: 0.1 }], new: [{ uptoMinor: null, rate: 0.1 }] },
        standardDeductionMinor: 5_000_000,
        cessRate: 0.04,
        rebate87a: { incomeCeilingMinor: 70_000_000, maxRebateMinor: 2_500_000 },
      },
    };
    const takeHome = computeTakeHome(supplied, 4_900_000, []);
    expect(takeHome.excludesTds).toBe(false);
    expect(takeHome.excluded).toHaveLength(0);
  });
});

describe("employer cost is unavailable, not invented (SCR-052)", () => {
  it("names every missing employer-side rule and returns no total", () => {
    const cost = computeEmployerCost(PACK, { pfWageMinor: 3_300_000, grossMinor: 4_900_000 });
    expect(cost.available).toBe(false);
    expect(cost.totalMinor).toBeNull();
    expect(cost.items).toHaveLength(0);
    expect(cost.missingRules).toContain("pf.employerRate");
    expect(cost.missingRules).toContain("esi.employerRate");
    expect(cost.unavailable.map((entry) => entry.code)).toContain("gratuity_accrual");
  });

  it("computes the employer share as soon as the rate is supplied", () => {
    const supplied: RulePack = {
      ...PACK,
      pf: { ...PACK.pf, employerRate: 0.12 },
      esi: { ...PACK.esi, employerRate: 0.0325 },
      gratuity: { ...PACK.gratuity, daysPerYear: 15, monthDays: 26, wageBase: ["basic", "da"] },
    };
    const cost = computeEmployerCost(supplied, { pfWageMinor: 1_100_000, grossMinor: 2_000_000 });
    expect(cost.available).toBe(true);
    expect(cost.items.find((item) => item.code === "pf_employer")?.amountMinor).toBe(132_000);
    expect(cost.items.find((item) => item.code === "esi_employer")?.amountMinor).toBe(65_000);
    expect(cost.totalMinor).toBe(197_000);
  });
});

describe("wage floor test (SCR-052, RL-283)", () => {
  it("returns an indeterminate verdict while the denominator rule is missing", () => {
    expect(PACK.wageFloor.percent).toBe(0.5);
    expect(PACK.wageFloor.denominatorComponents).toBeNull();
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    const floor = evaluateWageFloor(PACK, { resolved, earnings, grossMinor });
    expect(floor.verdict).toBe("indeterminate");
    expect(floor.missingRules).toEqual(["wageFloor.denominatorComponents"]);
    expect(floor.shortfallMinor).toBeNull();
    expect(floor.reason).toContain("wageFloor.denominatorComponents");
  });

  it("still reports the observed share from the countsTowardWageFloor components", () => {
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    const floor = evaluateWageFloor(PACK, { resolved, earnings, grossMinor });
    // Basic and DA are the flagged components: 3,300,000 of an observed 4,900,000 gross.
    expect(floor.numeratorComponents).toEqual(["basic", "da"]);
    expect(floor.numeratorMinor).toBe(3_300_000);
    expect(floor.denominatorMinor).toBe(4_900_000);
    expect(floor.observedShare).toBeCloseTo(0.6735, 4);
    expect(floor.denominatorBasis).toContain("Observed monthly gross");
  });

  it("reaches a Pass once the pack defines the denominator", () => {
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    const floor = evaluateWageFloor(packWithFloorDenominator(), { resolved, earnings, grossMinor });
    expect(floor.verdict).toBe("pass");
    expect(floor.denominatorMinor).toBe(4_900_000);
    expect(floor.shortfallMinor).toBeNull();
  });

  it("reaches a Fail with the shortfall named when the basic share is too thin", () => {
    const thin: StructureLine[] = [
      line("basic", { amountMinor: 0 }),
      line("da", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.1 }),
      line("hra", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.4 }),
      line("conveyance", { amountMinor: 160_000 }),
      line("special", { amountMinor: 3_000_000 }),
    ];
    const { resolved, earnings, grossMinor } = resolveEarnings(thin, 1_000_000, COMPONENTS);
    expect(grossMinor).toBe(4_660_000);
    const floor = evaluateWageFloor(packWithFloorDenominator(), { resolved, earnings, grossMinor });
    expect(floor.verdict).toBe("fail");
    expect(floor.numeratorMinor).toBe(1_100_000);
    expect(floor.shortfallMinor).toBe(1_230_000);
  });
});

describe("adoption guard (SCR-052)", () => {
  it("blocks adoption on a failing verdict and names the shortfall", () => {
    const thin: StructureLine[] = [
      line("basic", { amountMinor: 0 }),
      line("special", { amountMinor: 3_000_000 }),
    ];
    const { resolved, earnings, grossMinor } = resolveEarnings(thin, 1_000_000, COMPONENTS);
    const floor = evaluateWageFloor(packWithFloorDenominator(), { resolved, earnings, grossMinor });
    const blockers = adoptionBlockers(floor, "in-pay/v1");
    expect(floor.verdict).toBe("fail");
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("Wage floor test failed");
    expect(blockers[0]).toContain("10,000.00");
  });

  it("blocks adoption on an indeterminate verdict and names the missing rule", () => {
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    const blockers = adoptionBlockers(evaluateWageFloor(PACK, { resolved, earnings, grossMinor }), "in-pay/v1");
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("indeterminate");
    expect(blockers[0]).toContain("wageFloor.denominatorComponents");
  });

  it("allows adoption only on a Pass", () => {
    const { resolved, earnings, grossMinor } = resolveEarnings(PROPOSED, 3_000_000, COMPONENTS);
    expect(adoptionBlockers(evaluateWageFloor(packWithFloorDenominator(), { resolved, earnings, grossMinor }))).toEqual([]);
  });

  it("walks Draft -> Simulated -> Submitted -> Adopted without skipping a step", () => {
    expect(nextSimulationState("draft", "simulate")).toBe("simulated");
    expect(nextSimulationState("simulated", "submit")).toBe("submitted");
    expect(nextSimulationState("submitted", "adopt")).toBe("adopted");
    expect(() => nextSimulationState("simulated", "adopt")).toThrow(HttpError);
    expect(() => nextSimulationState("draft", "submit")).toThrow(HttpError);
    expect(() => nextSimulationState("adopted", "simulate")).toThrow(HttpError);
  });
});

describe("per-employee and aggregate simulation (SCR-052)", () => {
  const current: StructureLine[] = [
    line("basic", { amountMinor: 0 }),
    line("da", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.1 }),
    line("hra", { calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.4 }),
    line("conveyance", { amountMinor: 160_000 }),
    line("special", { amountMinor: 100_000 }),
  ];

  function run(id: string, basicMinor: number): EmployeeSimulation {
    return simulateEmployeeStructure({
      employee: employee(id),
      basicMinor,
      proposedLines: PROPOSED,
      currentLines: current,
      currentBasicMinor: basicMinor,
      components: COMPONENTS,
      pack: PACK,
    });
  }

  it("returns gross and take home as different computed figures", () => {
    const result = run("a", 3_000_000);
    expect(result.grossMinor).toBe(4_900_000);
    expect(result.takeHome.takeHomeMinor).toBe(4_700_000);
    expect(result.employeeDeductionsMinor).toBe(200_000);
    expect(result.takeHome.takeHomeMinor).toBe(result.grossMinor - result.employeeDeductionsMinor);
  });

  it("reports the delta against the current structure per component and in total", () => {
    const result = run("a", 3_000_000);
    expect(result.delta.hasCurrent).toBe(true);
    const special = result.delta.componentDeltas.find((entry) => entry.componentCode === "special");
    expect(special).toEqual({ componentCode: "special", label: "Special allowance", currentMinor: 100_000, proposedMinor: 240_000, deltaMinor: 140_000 });
    expect(result.delta.grossDeltaMinor).toBe(140_000);
    expect(result.delta.takeHomeDeltaMinor).toBe(140_000);
  });

  it("carries the blockers from the employee's own floor verdict", () => {
    expect(run("a", 3_000_000).blockers[0]).toContain("indeterminate");
  });

  it("aggregates exactly as the sum of the per-employee figures", () => {
    const people = [run("a", 3_000_000), run("b", 1_000_000), run("c", 800_000)];
    const aggregate = aggregateSimulations(people);
    expect(aggregate.employeeCount).toBe(3);
    expect(aggregate.grossMinor).toBe(people.reduce((total, item) => total + item.grossMinor, 0));
    expect(aggregate.takeHomeMinor).toBe(people.reduce((total, item) => total + item.takeHome.takeHomeMinor, 0));
    expect(aggregate.employeeDeductionsMinor).toBe(people.reduce((total, item) => total + item.employeeDeductionsMinor, 0));
    expect(aggregate.grossDeltaMinor).toBe(people.reduce((total, item) => total + item.delta.grossDeltaMinor, 0));
    expect(aggregate.takeHomeDeltaMinor).toBe(people.reduce((total, item) => total + item.delta.takeHomeDeltaMinor, 0));
    expect(aggregate.grossMinor).not.toBe(aggregate.takeHomeMinor);
  });

  it("summarises the population's verdicts and unsupplied rules without inventing a total", () => {
    const aggregate = aggregateSimulations([run("a", 3_000_000), run("b", 1_000_000)]);
    expect(aggregate.floorIndeterminate).toBe(2);
    expect(aggregate.floorPass).toBe(0);
    expect(aggregate.floorFail).toBe(0);
    expect(aggregate.employerCostAvailable).toBe(false);
    expect(aggregate.takeHomeExcludesTds).toBe(true);
    expect(aggregate.missingRules).toContain("pf.employerRate");
    expect(aggregate.missingRules).toContain("esi.employerRate");
    expect(aggregate.missingRules).toContain("tds.slabs");
    expect(aggregate.missingRules).toContain("wageFloor.denominatorComponents");
    expect(aggregate.blockers).toHaveLength(1);
  });

  it("rolls the persisted simulation lines up per component across the population", () => {
    const totals = componentTotalsFrom([run("a", 3_000_000), run("b", 1_000_000)]);
    const special = totals.find((entry) => entry.componentCode === "special");
    expect(special?.currentMinor).toBe(200_000);
    expect(special?.proposedMinor).toBe(480_000);
    expect(special?.deltaMinor).toBe(280_000);
  });

  it("reports a zero delta rather than a fake baseline when there is no current structure", () => {
    const result = simulateEmployeeStructure({
      employee: employee("d"),
      basicMinor: 3_000_000,
      proposedLines: PROPOSED,
      currentLines: null,
      currentBasicMinor: null,
      components: COMPONENTS,
      pack: PACK,
    });
    expect(result.delta.hasCurrent).toBe(false);
    expect(result.delta.grossDeltaMinor).toBe(0);
    expect(result.delta.takeHomeDeltaMinor).toBe(0);
  });
});

describe("minimum wage test (FRM-PAY-02)", () => {
  const pack = rulePack();
  const withSchedule = (schedule: Record<string, number> | null): RulePack => ({
    ...pack,
    minimumWage: { monthlyMinorByStateAndSkill: schedule },
  });

  it("reaches no verdict while the rule pack carries no schedule", () => {
    const view = evaluateMinimumWage(pack, { state: "Karnataka", skill: "skilled", monthlyWageMinor: 2_000_000 });
    expect(view.verdict).toBe("indeterminate");
    expect(view.requiredMonthlyMinor).toBeNull();
    expect(view.missingRules).toEqual(["minimumWage.monthlyMinorByStateAndSkill"]);
    // The observed wage is still reported: the figure is known, only the verdict is not.
    expect(view.observedMonthlyMinor).toBe(2_000_000);
  });

  it("passes and fails against a supplied schedule, naming the shortfall", () => {
    const schedule = withSchedule({ "Karnataka::skilled": 1_800_000 });
    expect(evaluateMinimumWage(schedule, { state: "Karnataka", skill: "skilled", monthlyWageMinor: 2_000_000 }).verdict).toBe("pass");
    const failed = evaluateMinimumWage(schedule, { state: "Karnataka", skill: "skilled", monthlyWageMinor: 1_500_000 });
    expect(failed.verdict).toBe("fail");
    expect(failed.shortfallMinor).toBe(300_000);
  });

  it("reaches no verdict when the state, the skill or their schedule entry is missing", () => {
    const schedule = withSchedule({ "Karnataka::skilled": 1_800_000 });
    expect(evaluateMinimumWage(schedule, { state: null, skill: "skilled", monthlyWageMinor: 1 }).verdict).toBe("indeterminate");
    expect(evaluateMinimumWage(schedule, { state: "Karnataka", skill: null, monthlyWageMinor: 1 }).verdict).toBe("indeterminate");
    expect(evaluateMinimumWage(schedule, { state: "Kerala", skill: "skilled", monthlyWageMinor: 1 }).verdict).toBe("indeterminate");
  });

  it("blocks adoption on a minimum-wage failure, but not on an unreachable verdict", () => {
    const floorPassed = evaluateWageFloor({ ...pack, wageFloor: { percent: 0.5, denominatorComponents: ["basic", "da"] } }, {
      resolved: { basic: 1_000_000, da: 0 },
      earnings: [{ componentCode: "basic", label: "Basic", amountMinor: 1_000_000, partOfPfWage: true, partOfEsiWage: true, countsTowardWageFloor: true }],
      grossMinor: 1_000_000,
    });
    expect(floorPassed.verdict).toBe("pass");
    const failed = evaluateMinimumWage(withSchedule({ "Karnataka::skilled": 1_800_000 }), { state: "Karnataka", skill: "skilled", monthlyWageMinor: 1_500_000 });
    expect(adoptionBlockers(floorPassed, pack.code, failed)).toHaveLength(1);
    const unreachable = evaluateMinimumWage(pack, { state: "Karnataka", skill: "skilled", monthlyWageMinor: 1_500_000 });
    expect(adoptionBlockers(floorPassed, pack.code, unreachable)).toHaveLength(0);
  });
});
