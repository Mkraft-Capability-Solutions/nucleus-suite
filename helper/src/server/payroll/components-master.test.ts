import { describe, expect, it } from "vitest";

import {
  STANDARD_COMPONENTS_BY_CODE,
  componentAttributesFor,
  componentDefinitionFrom,
  componentVersionAsOf,
  type PayComponentDefinition,
  type PayComponentVersionSnapshot,
} from "./components";
import {
  decideEdit,
  findDependencyCycle,
  fractionFromPercent,
  payComponentSchema,
  percentFromFraction,
  scanFormula,
  toDefinition,
  validateAgainstCatalog,
  type PayComponentInput,
} from "./components-master";

const DEBIT = "11111111-1111-4111-8111-111111111111";
const CREDIT = "22222222-2222-4222-8222-222222222222";

/** The smallest body the form accepts: the five Mandatory = Y fields with no workbook default. */
const MINIMAL = { code: "meal", name: "Meal allowance", glDebitAccountId: DEBIT, glCreditAccountId: CREDIT, payslipSequence: 70 };

function definition(overrides: Partial<PayComponentDefinition> & Pick<PayComponentDefinition, "code">): PayComponentDefinition {
  return {
    ...STANDARD_COMPONENTS_BY_CODE.special,
    glDebitAccountId: DEBIT,
    glCreditAccountId: CREDIT,
    effectiveFrom: "2026-01-01",
    ...overrides,
  };
}

function parse(body: Record<string, unknown>): PayComponentInput {
  const parsed = payComponentSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return parsed.data;
}

function issuesOf(body: Record<string, unknown>): string[] {
  const parsed = payComponentSchema.safeParse(body);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join("."));
}

describe("FRM-PAY-01 schema", () => {
  it("applies the workbook defaults and requires only the fields it leaves blank", () => {
    const input = parse(MINIMAL);
    expect(input.kind).toBe("earning");
    expect(input.calculationMethod).toBe("fixed_amount");
    expect(input.rounding).toBe("nearest_rupee");
    expect(input.proratedOnAttendance).toBe(true);
    expect(input.partOfPfWage).toBe(false);
    expect(input.partOfEsiWage).toBe(true);
    expect(input.countsTowardWageFloor).toBe(true);
    expect(input.taxable).toBe(true);
    expect(input.isPerquisite).toBe(false);
    expect(input.glDimensions).toEqual(["cost_center"]);
    expect(input.printOnPayslipWhenZero).toBe(false);
    expect(input.status).toBe("active");
    expect(input.effectiveFrom).toBeNull();
  });

  it("refuses a body without the GL accounts or the payslip sequence", () => {
    expect(issuesOf({ code: "meal", name: "Meal" })).toEqual(expect.arrayContaining(["glDebitAccountId", "glCreditAccountId", "payslipSequence"]));
  });

  it("holds a percentage component to its base and its 0-100 value", () => {
    expect(issuesOf({ ...MINIMAL, calculationMethod: "percentage_of_component" })).toEqual(expect.arrayContaining(["percentageOf", "percentValue"]));
    expect(issuesOf({ ...MINIMAL, calculationMethod: "percentage_of_component", percentageOf: "basic", percentValue: 120 })).toContain("percentValue");
    expect(issuesOf({ ...MINIMAL, calculationMethod: "percentage_of_component", percentageOf: "basic", percentValue: 12.345 })).toContain("percentValue");
    expect(issuesOf({ ...MINIMAL, calculationMethod: "percentage_of_component", percentageOf: "meal", percentValue: 10 })).toContain("percentageOf");
    expect(issuesOf({ ...MINIMAL, calculationMethod: "percentage_of_component", percentageOf: "basic", percentValue: 12.5 })).toEqual([]);
  });

  it("refuses a statutory rate typed into a rule-pack-governed component", () => {
    const body = { ...MINIMAL, code: "pf", kind: "deduction", calculationMethod: "percentage_of_component", percentageOf: "basic" };
    expect(issuesOf({ ...body, percentValue: 12 })).toContain("percentValue");
    expect(issuesOf(body)).toEqual([]);
    expect(issuesOf({ ...MINIMAL, code: "pt", kind: "deduction", calculationMethod: "slab_table" })).toEqual([]);
  });

  it("requires a formula for formula components and a slab reference for slab components", () => {
    expect(issuesOf({ ...MINIMAL, calculationMethod: "formula" })).toContain("formulaExpression");
    expect(issuesOf({ ...MINIMAL, calculationMethod: "slab_table" })).toContain("slabTableRef");
  });

  it("keeps the code an identifier of at most 15 characters and lowercases it", () => {
    expect(parse({ ...MINIMAL, code: "Meal_Allow" }).code).toBe("meal_allow");
    expect(issuesOf({ ...MINIMAL, code: "meal allowance" })).toContain("code");
    expect(issuesOf({ ...MINIMAL, code: "a_very_long_component_code" })).toContain("code");
  });

  it("wants at least one cost dimension, an integer sequence and a non-negative exemption limit", () => {
    expect(issuesOf({ ...MINIMAL, glDimensions: [] })).toContain("glDimensions");
    expect(issuesOf({ ...MINIMAL, glDimensions: ["region"] })).toContain("glDimensions.0");
    expect(issuesOf({ ...MINIMAL, payslipSequence: 7.5 })).toContain("payslipSequence");
    expect(issuesOf({ ...MINIMAL, exemptionLimitMinor: -1 })).toContain("exemptionLimitMinor");
  });
});

describe("percentage storage", () => {
  it("stores the workbook's 0-100 percentage as the fraction the engine multiplies by, exactly", () => {
    expect(fractionFromPercent(40)).toBe(0.4);
    expect(fractionFromPercent(12.5)).toBe(0.125);
    expect(fractionFromPercent(33.33)).toBe(0.3333);
    expect(percentFromFraction(0.4)).toBe(40);
    expect(percentFromFraction(0.3333)).toBe(33.33);
    expect(percentFromFraction(null)).toBeNull();
  });
});

describe("toDefinition", () => {
  it("defaults the payslip label to the name and clears fields that belong to another method", () => {
    const input = parse({ ...MINIMAL, percentageOf: "basic", percentValue: 10, formulaExpression: "basic * 2", slabTableRef: "x" });
    const def = toDefinition(input, "2026-04-01", 1);
    expect(def.payslipLabel).toBe("Meal allowance");
    expect(def.percentageOf).toBeNull();
    expect(def.percentageValue).toBeNull();
    expect(def.formulaExpression).toBeNull();
    expect(def.slabTableRef).toBeNull();
    expect(def.prorationBasis).toBe("calendar_days");
  });

  it("gives a non-prorated component no proration basis", () => {
    const def = toDefinition(parse({ ...MINIMAL, proratedOnAttendance: false, prorationBasis: "payable_days" }), "2026-04-01", 1);
    expect(def.prorationBasis).toBeNull();
  });

  it("round-trips every field through the envelope keys", () => {
    const def = toDefinition(
      parse({
        ...MINIMAL, kind: "reimbursement", calculationMethod: "formula", formulaExpression: "min(basic * 0.1, 500000)",
        exemptionSection: "10_14_special_allowance", exemptionLimitMinor: 1_600_000, isPerquisite: true, glDimensions: ["cost_center", "project"],
      }),
      "2026-04-01",
      3,
    );
    const attributes = componentAttributesFor(def);
    expect(attributes.formula_expression).toBe("min(basic * 0.1, 500000)");
    expect(attributes.exemption_limit_minor).toBe(1_600_000);
    expect(attributes.is_perquisite).toBe(true);
    expect(attributes.gl_debit_account).toBe(DEBIT);
    expect(attributes.gl_credit_account).toBe(CREDIT);
    expect(attributes.gl_dimensions).toEqual(["cost_center", "project"]);
    expect(attributes.effective_from).toBe("2026-04-01");
    expect(attributes.definition_version).toBe(3);
    expect(componentDefinitionFrom(def.code, def.kind, attributes)).toEqual(def);
  });
});

describe("formula scan", () => {
  it("lists the components a formula references and ignores the allowed functions", () => {
    expect(scanFormula("basic * 0.4 + max(HRA, 0) - round(da / 2)")).toEqual({ references: ["basic", "hra", "da"], issue: null });
  });

  it("refuses characters outside the grammar, unbalanced parentheses and a constant-only formula", () => {
    expect(scanFormula("basic $ 2").issue).toMatch(/Unexpected/);
    expect(scanFormula("(basic * 2").issue).toMatch(/parentheses/);
    expect(scanFormula("basic * 2)").issue).toMatch(/parentheses/);
    expect(scanFormula("1000 * 2").issue).toMatch(/at least one component/);
  });
});

describe("dependency cycles", () => {
  const basic = definition({ code: "basic", calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null, payslipSequence: 10 });
  const percentage = (code: string, of: string, sequence: number) =>
    definition({ code, calculationMethod: "percentage_of_component", percentageOf: of, percentageValue: 0.5, payslipSequence: sequence });
  const formula = (code: string, expression: string, sequence: number) =>
    definition({ code, calculationMethod: "formula", formulaExpression: expression, payslipSequence: sequence });

  it("accepts a chain that resolves", () => {
    expect(findDependencyCycle([basic, percentage("da", "basic", 20), percentage("special", "da", 30)], "special")).toBeNull();
  });

  it("names a percentage cycle the run resolver would leave unresolved", () => {
    const cycle = findDependencyCycle([basic, percentage("a", "b", 20), percentage("b", "a", 30)], "a");
    expect(cycle).toEqual(["a", "b", "a"]);
  });

  it("names a cycle that passes through a formula", () => {
    const cycle = findDependencyCycle([basic, formula("bonus", "basic + incentive", 20), percentage("incentive", "bonus", 30)], "bonus");
    expect(cycle).toEqual(["bonus", "incentive", "bonus"]);
  });

  it("is reported by validateAgainstCatalog on the field that closes the loop", () => {
    const issues = validateAgainstCatalog(percentage("a", "b", 20), [basic, percentage("b", "a", 30)]);
    expect(issues).toEqual([{ field: "percentageOf", issue: expect.stringMatching(/Circular reference: a -> b -> a/) }]);
  });
});

describe("catalogue rules", () => {
  const basic = definition({ code: "basic", calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null, payslipSequence: 10 });
  const retired = definition({ code: "old", status: "inactive", payslipSequence: 15 });

  it("keeps the code unique per tenant", () => {
    expect(validateAgainstCatalog(definition({ code: "basic", payslipSequence: 99 }), [basic])).toContainEqual({ field: "code", issue: expect.stringMatching(/already exists/) });
  });

  it("only lets a percentage or formula name an active, defined component", () => {
    const pct = definition({ code: "x", calculationMethod: "percentage_of_component", percentageOf: "old", percentageValue: 0.1, payslipSequence: 40 });
    expect(validateAgainstCatalog(pct, [basic, retired]).map((issue) => issue.field)).toEqual(["percentageOf"]);
    const missing = definition({ code: "y", calculationMethod: "formula", formulaExpression: "basic + ghost", payslipSequence: 41 });
    expect(validateAgainstCatalog(missing, [basic])[0]).toEqual({ field: "formulaExpression", issue: "ghost is not a defined component." });
    const selfRef = definition({ code: "z", calculationMethod: "formula", formulaExpression: "z * 2", payslipSequence: 42 });
    expect(validateAgainstCatalog(selfRef, [basic])[0].issue).toMatch(/its own component/);
  });

  it("keeps the payslip sequence unique within the type, not across types", () => {
    const deduction = definition({ code: "d", kind: "deduction", payslipSequence: 10 });
    expect(validateAgainstCatalog(deduction, [basic])).toEqual([]);
    const clash = definition({ code: "e", kind: "earning", payslipSequence: 10 });
    expect(validateAgainstCatalog(clash, [basic]).map((issue) => issue.field)).toEqual(["payslipSequence"]);
    expect(validateAgainstCatalog(definition({ code: "f", payslipSequence: 15 }), [retired])).toEqual([]);
  });
});

describe("versioning on edit", () => {
  const current = definition({ code: "special", effectiveFrom: "2026-01-01", definitionVersion: 1 });
  const unused = { lineCount: 0, lastFinalizedPeriod: null };
  const draftOnly = { lineCount: 12, lastFinalizedPeriod: null };
  const finalized = { lineCount: 12, lastFinalizedPeriod: "2026-08" };

  it("freezes the code and the type once a payslip line references the component", () => {
    expect(decideEdit(current, { ...current, code: "spl" }, draftOnly)).toMatchObject({ outcome: "refuse", code: "COMPONENT_CODE_LOCKED" });
    expect(decideEdit(current, { ...current, kind: "deduction" }, draftOnly)).toMatchObject({ outcome: "refuse", code: "COMPONENT_KIND_LOCKED" });
    expect(decideEdit(current, { ...current, code: "spl" }, unused)).toMatchObject({ outcome: "replace" });
  });

  it("replaces a presentation-only change in place and keeps the start date once a run is finalized", () => {
    const relabel = { ...current, payslipLabel: "Special", payslipSequence: 55, effectiveFrom: "2026-09-01" };
    expect(decideEdit(current, relabel, unused)).toEqual({ outcome: "replace", effectiveFrom: "2026-09-01" });
    expect(decideEdit(current, relabel, finalized)).toEqual({ outcome: "replace", effectiveFrom: "2026-01-01" });
  });

  it("versions a calculation change dated after the current version", () => {
    const change = { ...current, taxable: false, effectiveFrom: "2026-09-01" };
    expect(decideEdit(current, change, unused)).toEqual({ outcome: "version", effectiveFrom: "2026-09-01", previousEffectiveTo: "2026-08-31" });
    expect(decideEdit(current, { ...change, effectiveFrom: "2026-03-01" }, unused)).toEqual({ outcome: "version", effectiveFrom: "2026-03-01", previousEffectiveTo: "2026-02-28" });
  });

  it("corrects an unused version in place when the change is not dated later", () => {
    expect(decideEdit(current, { ...current, taxable: false, effectiveFrom: "2026-01-01" }, unused)).toEqual({ outcome: "replace", effectiveFrom: "2026-01-01" });
    expect(decideEdit(current, { ...current, taxable: false, effectiveFrom: "2025-12-01" }, unused)).toEqual({ outcome: "replace", effectiveFrom: "2025-12-01" });
  });

  it("never mutates the definition a finalized run used: the change must start after that period", () => {
    const change = { ...current, percentageOf: "basic", percentageValue: 0.2, calculationMethod: "percentage_of_component" as const };
    expect(decideEdit(current, { ...change, effectiveFrom: "2026-08-31" }, finalized)).toMatchObject({ outcome: "refuse", code: "COMPONENT_VERSION_REQUIRED", message: expect.stringContaining("2026-08") });
    expect(decideEdit(current, { ...change, effectiveFrom: "2026-01-01" }, finalized)).toMatchObject({ outcome: "refuse", code: "COMPONENT_VERSION_REQUIRED" });
    expect(decideEdit(current, { ...change, effectiveFrom: "2026-09-01" }, finalized)).toEqual({ outcome: "version", effectiveFrom: "2026-09-01", previousEffectiveTo: "2026-08-31" });
    expect(decideEdit(current, { ...change, effectiveFrom: null }, unused)).toMatchObject({ outcome: "refuse", code: "COMPONENT_VERSION_REQUIRED" });
  });

  it("versions a seeded definition, which has no declared start, rather than overwriting it", () => {
    const seeded = { ...current, effectiveFrom: null };
    expect(decideEdit(seeded, { ...seeded, taxable: false, effectiveFrom: "2026-09-01" }, unused)).toEqual({ outcome: "version", effectiveFrom: "2026-09-01", previousEffectiveTo: "2026-08-31" });
  });
});

describe("which version a run uses", () => {
  const head = definition({ code: "special", effectiveFrom: "2026-09-01", definitionVersion: 2, taxable: false });
  const v1: PayComponentVersionSnapshot = { ...definition({ code: "special", effectiveFrom: null, definitionVersion: 1, taxable: true }), effectiveTo: "2026-08-31", supersededAt: "2026-08-20T00:00:00Z" };

  it("resolves the version in force on the run's date", () => {
    expect(componentVersionAsOf(head, [v1], "2026-08-15")?.definitionVersion).toBe(1);
    expect(componentVersionAsOf(head, [v1], "2026-08-31")?.taxable).toBe(true);
    expect(componentVersionAsOf(head, [v1], "2026-09-01")?.definitionVersion).toBe(2);
    expect(componentVersionAsOf(head, [v1], "2027-01-01")?.taxable).toBe(false);
  });

  it("returns nothing for a date before the component existed", () => {
    const later = definition({ code: "newcomp", effectiveFrom: "2026-10-01", definitionVersion: 1 });
    expect(componentVersionAsOf(later, [], "2026-09-15")).toBeNull();
    expect(componentVersionAsOf(later, [], "2026-10-01")?.code).toBe("newcomp");
  });

  it("does not leak the snapshot's end-date fields into the definition it returns", () => {
    expect(componentVersionAsOf(head, [v1], "2026-08-15")).not.toHaveProperty("effectiveTo");
  });
});
