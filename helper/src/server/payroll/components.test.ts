import { describe, expect, it } from "vitest";

import {
  CALCULATION_METHODS,
  COMPONENT_KINDS,
  EXEMPTION_SECTIONS,
  PRORATION_BASES,
  ROUNDING_RULES,
  STANDARD_COMPONENTS,
  STANDARD_COMPONENTS_BY_CODE,
  resolveStructure,
  type StructureLine,
} from "./components";

const STANDARD_STRUCTURE = { basic: 5_000_000, hra: 2_000_000, da: 500_000, conveyance: 160_000, special: 840_000 } as const;

const STANDARD_LINES: StructureLine[] = [
  { componentCode: "basic", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.basic, percentageOf: null, percentageValue: null },
  { componentCode: "da", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.1 },
  { componentCode: "hra", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.4 },
  { componentCode: "conveyance", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.conveyance, percentageOf: null, percentageValue: null },
  { componentCode: "special", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.special, percentageOf: null, percentageValue: null },
];

describe("pay component master (SCR-057)", () => {
  it("covers every component code the calculation engine emits", () => {
    const codes = STANDARD_COMPONENTS.map((component) => component.code);
    for (const code of ["basic", "hra", "da", "conveyance", "special", "ot", "pf", "esi", "pt", "tds", "loan_recovery"]) {
      expect(codes).toContain(code);
    }
  });

  it("holds only values drawn from the defined vocabularies", () => {
    for (const component of STANDARD_COMPONENTS) {
      expect(COMPONENT_KINDS).toContain(component.kind);
      expect(CALCULATION_METHODS).toContain(component.calculationMethod);
      expect(ROUNDING_RULES).toContain(component.rounding);
      expect(EXEMPTION_SECTIONS).toContain(component.exemptionSection);
      if (component.prorationBasis !== null) expect(PRORATION_BASES).toContain(component.prorationBasis);
    }
  });

  it("gives every component a distinct payslip sequence so line order is defined", () => {
    const sequences = STANDARD_COMPONENTS.map((component) => component.payslipSequence);
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("marks the PF wage base as basic and DA, matching rule pack pf.wageBase", () => {
    const inPfWage = STANDARD_COMPONENTS.filter((component) => component.partOfPfWage).map((component) => component.code).sort();
    expect(inPfWage).toEqual(["basic", "da"]);
  });

  it("keeps a percentage component pointed at the component it derives from", () => {
    for (const component of STANDARD_COMPONENTS) {
      if (component.calculationMethod !== "percentage_of_component") continue;
      if (component.percentageValue === null) continue;
      expect(component.percentageOf).not.toBeNull();
      expect(STANDARD_COMPONENTS_BY_CODE[component.percentageOf as string]).toBeDefined();
    }
  });
});

describe("salary structure resolution (SCR-052)", () => {
  // The engine previously computed these four figures from literals. The structure
  // must reproduce them exactly, or existing runs stop matching.
  it("reproduces the arithmetic the engine previously hard-coded", () => {
    const basic = STANDARD_STRUCTURE.basic;
    const resolved = resolveStructure(STANDARD_LINES, basic);
    expect(resolved.hra).toBe(Math.round(basic * 0.4));
    expect(resolved.da).toBe(Math.round(basic * 0.1));
    expect(resolved.conveyance).toBe(STANDARD_STRUCTURE.conveyance);
    expect(resolved.special).toBe(STANDARD_STRUCTURE.special);
    expect(resolved.hra).toBe(STANDARD_STRUCTURE.hra);
    expect(resolved.da).toBe(STANDARD_STRUCTURE.da);
  });

  it("resolves against the employee's own basic rather than the structure default", () => {
    const resolved = resolveStructure(STANDARD_LINES, 3_300_000);
    expect(resolved.basic).toBe(3_300_000);
    expect(resolved.hra).toBe(1_320_000);
    expect(resolved.da).toBe(330_000);
    expect(resolved.conveyance).toBe(STANDARD_STRUCTURE.conveyance);
  });

  it("follows the dependency chain rather than row order", () => {
    const chained: StructureLine[] = [
      { componentCode: "special", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "da", percentageValue: 0.5 },
      { componentCode: "da", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.1 },
    ];
    const resolved = resolveStructure(chained, 1_000_000);
    expect(resolved.da).toBe(100_000);
    expect(resolved.special).toBe(50_000);
  });

  it("leaves a line unresolved rather than guessing when its base is missing", () => {
    const orphan: StructureLine[] = [
      { componentCode: "bonus", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "absent", percentageValue: 0.25 },
    ];
    const resolved = resolveStructure(orphan, 1_000_000);
    expect(resolved.bonus).toBeUndefined();
  });

  it("terminates on a circular reference instead of looping", () => {
    const cycle: StructureLine[] = [
      { componentCode: "a", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "b", percentageValue: 0.5 },
      { componentCode: "b", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "a", percentageValue: 0.5 },
    ];
    const resolved = resolveStructure(cycle, 1_000_000);
    expect(resolved.a).toBeUndefined();
    expect(resolved.b).toBeUndefined();
  });
});
