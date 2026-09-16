import "server-only";

import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";

/**
 * Pay component master and salary structure, held as data.
 *
 * The calculation engine previously carried its component vocabulary and its
 * salary structure as module constants, which meant no screen could read them,
 * map them to a ledger account, or print them on a payslip in a defined order.
 * Both now live in the canonical `pay_components` / `salary_structures` /
 * `salary_structure_components` tables. The seeded definitions reproduce the
 * previous constants exactly, so calculated figures do not move.
 */

/** PL_COMPONENT_TYPE. `earning` and `deduction` are the values already in use. */
export const COMPONENT_KINDS = ["earning", "deduction", "employer_contribution", "reimbursement", "information_only"] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

export const COMPONENT_KIND_LABELS: Record<ComponentKind, string> = {
  earning: "Earning",
  deduction: "Deduction",
  employer_contribution: "Employer contribution",
  reimbursement: "Reimbursement",
  information_only: "Information only",
};

/** PL_CALC_METHOD. */
export const CALCULATION_METHODS = ["fixed_amount", "percentage_of_component", "formula", "slab_table", "attendance_driven", "rate_x_quantity"] as const;
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];

export const CALCULATION_METHOD_LABELS: Record<CalculationMethod, string> = {
  fixed_amount: "Fixed amount",
  percentage_of_component: "Percentage of component",
  formula: "Formula",
  slab_table: "Slab table",
  attendance_driven: "Attendance driven",
  rate_x_quantity: "Rate x quantity",
};

/** PL_ROUNDING. */
export const ROUNDING_RULES = ["nearest_rupee", "round_up", "round_down", "no_rounding"] as const;
export type RoundingRule = (typeof ROUNDING_RULES)[number];

export const ROUNDING_RULE_LABELS: Record<RoundingRule, string> = {
  nearest_rupee: "Nearest rupee",
  round_up: "Round up",
  round_down: "Round down",
  no_rounding: "No rounding",
};

/** PL_PRORATION_BASIS. */
export const PRORATION_BASES = ["calendar_days", "payable_days", "working_days"] as const;
export type ProrationBasis = (typeof PRORATION_BASES)[number];

export const PRORATION_BASIS_LABELS: Record<ProrationBasis, string> = {
  calendar_days: "Calendar days",
  payable_days: "Payable days",
  working_days: "Working days",
};

/** PL_EXEMPTION_SECTION. */
export const EXEMPTION_SECTIONS = [
  "10_5_lta",
  "10_13a_hra",
  "10_14_special_allowance",
  "16_ia_standard_deduction",
  "16_ii_entertainment",
  "16_iii_professional_tax",
  "17_2_perquisite",
  "not_exempt",
] as const;
export type ExemptionSection = (typeof EXEMPTION_SECTIONS)[number];

export const EXEMPTION_SECTION_LABELS: Record<ExemptionSection, string> = {
  "10_5_lta": "10(5) LTA",
  "10_13a_hra": "10(13A) HRA",
  "10_14_special_allowance": "10(14) special allowance",
  "16_ia_standard_deduction": "16(ia) standard deduction",
  "16_ii_entertainment": "16(ii) entertainment",
  "16_iii_professional_tax": "16(iii) professional tax",
  "17_2_perquisite": "17(2) perquisite",
  not_exempt: "Not exempt",
};

export type PayComponentDefinition = {
  code: string;
  /** Retained key name: existing rows already store the component type under `kind`. */
  kind: ComponentKind;
  name: string;
  payslipLabel: string;
  calculationMethod: CalculationMethod;
  /** Set when `calculationMethod` is `percentage_of_component`. */
  percentageOf: string | null;
  percentageValue: number | null;
  rounding: RoundingRule;
  proratedOnAttendance: boolean;
  prorationBasis: ProrationBasis | null;
  partOfPfWage: boolean;
  partOfEsiWage: boolean;
  partOfGratuityWage: boolean;
  partOfBonusWage: boolean;
  countsTowardWageFloor: boolean;
  taxable: boolean;
  exemptionSection: ExemptionSection;
  printOnPayslipWhenZero: boolean;
  payslipSequence: number;
  status: "active" | "inactive";
  /** Set when `calculationMethod` is `formula`; references other component codes by name. */
  formulaExpression: string | null;
  /** Set when `calculationMethod` is `slab_table`. There is no slab-table master yet, so this is a reference string. */
  slabTableRef: string | null;
  /** Integer minor units; null when no limit is declared. */
  exemptionLimitMinor: number | null;
  isPerquisite: boolean;
  /** `gl_accounts.id` references. Null on seeded rows: the workbook names no account for them. */
  glDebitAccountId: string | null;
  glCreditAccountId: string | null;
  /** Cost dimensions the line is split by; values from `JOURNAL_DIMENSIONS` in ./gl. */
  glDimensions: string[];
  /**
   * Null on seeded definitions: they have applied since the engine existed and no
   * start date was ever declared, so none is invented. A tenant-authored version
   * always carries one, and it decides which version a run resolves (`componentVersionAsOf`).
   */
  effectiveFrom: string | null;
  /** Definition version, distinct from the row's optimistic-lock `version` column. */
  definitionVersion: number;
};

/** A superseded definition, frozen when a later version took over. */
export type PayComponentVersionSnapshot = PayComponentDefinition & {
  effectiveTo: string | null;
  supersededAt: string | null;
};

/**
 * The FRM-PAY-01 fields the seeded catalogue leaves unsupplied. `glDimensions`
 * carries the workbook's stated default (cost centre); the GL accounts, the slab
 * reference and the start date have no source and stay null rather than guessed.
 */
const SEED_MASTER_DEFAULTS = {
  formulaExpression: null,
  slabTableRef: null,
  exemptionLimitMinor: null,
  isPerquisite: false,
  glDebitAccountId: null,
  glCreditAccountId: null,
  glDimensions: ["cost_center"],
  effectiveFrom: null,
  definitionVersion: 1,
} satisfies Partial<PayComponentDefinition>;

/**
 * The eleven codes the engine already calculates, described in full.
 *
 * `percentageValue` on hra and da reproduces the previous `basic * 0.4` and
 * `basic * 0.1`; conveyance and special reproduce the previous fixed amounts from
 * `STANDARD_STRUCTURE`. Statutory wage-base flags follow rule pack `pf.wageBase`,
 * which is `["basic", "da"]`.
 */
export const STANDARD_COMPONENTS: PayComponentDefinition[] = [
  {
    ...SEED_MASTER_DEFAULTS,
    code: "basic", kind: "earning", name: "Basic", payslipLabel: "Basic",
    calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "payable_days",
    partOfPfWage: true, partOfEsiWage: true, partOfGratuityWage: true, partOfBonusWage: true, countsTowardWageFloor: true,
    taxable: true, exemptionSection: "not_exempt", printOnPayslipWhenZero: true, payslipSequence: 10, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "da", kind: "earning", name: "Dearness allowance", payslipLabel: "Dearness allowance",
    calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.1,
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "payable_days",
    partOfPfWage: true, partOfEsiWage: true, partOfGratuityWage: true, partOfBonusWage: true, countsTowardWageFloor: true,
    taxable: true, exemptionSection: "not_exempt", printOnPayslipWhenZero: true, payslipSequence: 20, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "hra", kind: "earning", name: "House rent allowance", payslipLabel: "House rent allowance",
    calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: 0.4,
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "payable_days",
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: true, exemptionSection: "10_13a_hra", printOnPayslipWhenZero: true, payslipSequence: 30, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "conveyance", kind: "earning", name: "Conveyance allowance", payslipLabel: "Conveyance",
    calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "payable_days",
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: true, exemptionSection: "10_14_special_allowance", printOnPayslipWhenZero: false, payslipSequence: 40, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "special", kind: "earning", name: "Special allowance", payslipLabel: "Special allowance",
    calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "payable_days",
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: true, exemptionSection: "not_exempt", printOnPayslipWhenZero: false, payslipSequence: 50, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "ot", kind: "earning", name: "Overtime", payslipLabel: "Overtime",
    calculationMethod: "attendance_driven", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: true, exemptionSection: "not_exempt", printOnPayslipWhenZero: false, payslipSequence: 60, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "pf", kind: "deduction", name: "Provident fund", payslipLabel: "Provident fund",
    calculationMethod: "percentage_of_component", percentageOf: "basic", percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: false, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: false, exemptionSection: "not_exempt", printOnPayslipWhenZero: true, payslipSequence: 110, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "esi", kind: "deduction", name: "Employee state insurance", payslipLabel: "ESI",
    calculationMethod: "percentage_of_component", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: false, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: false, exemptionSection: "not_exempt", printOnPayslipWhenZero: false, payslipSequence: 120, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "pt", kind: "deduction", name: "Professional tax", payslipLabel: "Professional tax",
    calculationMethod: "slab_table", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: false, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: false, exemptionSection: "16_iii_professional_tax", printOnPayslipWhenZero: true, payslipSequence: 130, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "tds", kind: "deduction", name: "Tax deducted at source", payslipLabel: "TDS",
    calculationMethod: "slab_table", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: false, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: false, exemptionSection: "not_exempt", printOnPayslipWhenZero: true, payslipSequence: 140, status: "active",
  },
  {
    ...SEED_MASTER_DEFAULTS,
    code: "loan_recovery", kind: "deduction", name: "Loan recovery", payslipLabel: "Loan recovery",
    calculationMethod: "fixed_amount", percentageOf: null, percentageValue: null,
    rounding: "nearest_rupee", proratedOnAttendance: false, prorationBasis: null,
    partOfPfWage: false, partOfEsiWage: false, partOfGratuityWage: false, partOfBonusWage: false, countsTowardWageFloor: false,
    taxable: false, exemptionSection: "not_exempt", printOnPayslipWhenZero: false, payslipSequence: 150, status: "active",
  },
];

export const STANDARD_COMPONENTS_BY_CODE: Record<string, PayComponentDefinition> = Object.fromEntries(
  STANDARD_COMPONENTS.map((component) => [component.code, component]),
);

export type PayComponentRow = PayComponentDefinition & {
  id: string;
  /** The row's optimistic-lock version (`pay_components.version`), for If-Match. */
  rowVersion: number;
  /** Superseded definitions, newest first. Empty until a versioned edit happens. */
  history: PayComponentVersionSnapshot[];
};

function definitionFrom(code: string, kind: string, attributes: Record<string, unknown>): PayComponentDefinition {
  const seeded = STANDARD_COMPONENTS_BY_CODE[code];
  const fallbackKind: ComponentKind = (COMPONENT_KINDS as readonly string[]).includes(kind) ? (kind as ComponentKind) : "earning";
  const pick = <T,>(key: string, seedValue: T, fallback: T): T => {
    const value = attributes[key];
    return value === undefined || value === null ? (seeded ? seedValue : fallback) : (value as T);
  };
  return {
    code,
    kind: (attributes.kind as ComponentKind) ?? seeded?.kind ?? fallbackKind,
    name: pick("name", seeded?.name ?? code, code),
    payslipLabel: pick("payslip_label", seeded?.payslipLabel ?? code, code),
    calculationMethod: pick("calculation_method", seeded?.calculationMethod ?? "fixed_amount", "fixed_amount"),
    percentageOf: pick("percentage_of", seeded?.percentageOf ?? null, null),
    percentageValue: pick("percentage_value", seeded?.percentageValue ?? null, null),
    rounding: pick("rounding", seeded?.rounding ?? "nearest_rupee", "nearest_rupee"),
    proratedOnAttendance: pick("prorated_on_attendance", seeded?.proratedOnAttendance ?? false, false),
    prorationBasis: pick("proration_basis", seeded?.prorationBasis ?? null, null),
    partOfPfWage: pick("part_of_pf_wage", seeded?.partOfPfWage ?? false, false),
    partOfEsiWage: pick("part_of_esi_wage", seeded?.partOfEsiWage ?? false, false),
    partOfGratuityWage: pick("part_of_gratuity_wage", seeded?.partOfGratuityWage ?? false, false),
    partOfBonusWage: pick("part_of_bonus_wage", seeded?.partOfBonusWage ?? false, false),
    countsTowardWageFloor: pick("counts_toward_wage_floor", seeded?.countsTowardWageFloor ?? false, false),
    taxable: pick("taxable", seeded?.taxable ?? true, true),
    exemptionSection: pick("exemption_section", seeded?.exemptionSection ?? "not_exempt", "not_exempt"),
    printOnPayslipWhenZero: pick("print_on_payslip_when_zero", seeded?.printOnPayslipWhenZero ?? false, false),
    payslipSequence: pick("payslip_sequence", seeded?.payslipSequence ?? 900, 900),
    status: pick("status", seeded?.status ?? "active", "active"),
    formulaExpression: pick("formula_expression", null, null),
    slabTableRef: pick("slab_table_ref", null, null),
    exemptionLimitMinor: pick("exemption_limit_minor", null, null),
    isPerquisite: pick("is_perquisite", false, false),
    glDebitAccountId: pick("gl_debit_account", null, null),
    glCreditAccountId: pick("gl_credit_account", null, null),
    glDimensions: Array.isArray(attributes.gl_dimensions)
      ? (attributes.gl_dimensions as unknown[]).filter((entry): entry is string => typeof entry === "string")
      : SEED_MASTER_DEFAULTS.glDimensions,
    effectiveFrom: pick("effective_from", null, null),
    definitionVersion: Number(pick("definition_version", 1, 1)) || 1,
  };
}

/** Reads a frozen prior version out of `attributes.versions[]`. */
function snapshotFrom(code: string, kind: string, attributes: Record<string, unknown>): PayComponentVersionSnapshot {
  return {
    ...definitionFrom(code, kind, attributes),
    effectiveTo: typeof attributes.effective_to === "string" ? attributes.effective_to : null,
    supersededAt: typeof attributes.superseded_at === "string" ? attributes.superseded_at : null,
  };
}

/**
 * The version of a component that governs `asOf` (a YYYY-MM-DD date, normally the
 * run period's last day). Candidates are the head plus its frozen predecessors;
 * the latest start date not after `asOf` wins, and a null start date counts as
 * "since inception". Null when no version was in force on that date.
 */
export function componentVersionAsOf(
  head: PayComponentDefinition,
  history: readonly PayComponentVersionSnapshot[],
  asOf: string,
): PayComponentDefinition | null {
  const candidates: PayComponentVersionSnapshot[] = [{ ...head, effectiveTo: null, supersededAt: null }, ...history];
  let chosen: PayComponentVersionSnapshot | null = null;
  for (const candidate of candidates) {
    const started = candidate.effectiveFrom === null || candidate.effectiveFrom <= asOf;
    const notEnded = candidate.effectiveTo === null || candidate.effectiveTo >= asOf;
    if (!started || !notEnded) continue;
    if (chosen === null || (candidate.effectiveFrom ?? "") > (chosen.effectiveFrom ?? "")) chosen = candidate;
  }
  if (chosen === null) return null;
  const { effectiveTo: _effectiveTo, supersededAt: _supersededAt, ...definition } = chosen;
  void _effectiveTo;
  void _supersededAt;
  return definition;
}

function attributesFor(definition: PayComponentDefinition): Record<string, unknown> {
  return {
    code: definition.code,
    kind: definition.kind,
    name: definition.name,
    payslip_label: definition.payslipLabel,
    calculation_method: definition.calculationMethod,
    percentage_of: definition.percentageOf,
    percentage_value: definition.percentageValue,
    rounding: definition.rounding,
    prorated_on_attendance: definition.proratedOnAttendance,
    proration_basis: definition.prorationBasis,
    part_of_pf_wage: definition.partOfPfWage,
    part_of_esi_wage: definition.partOfEsiWage,
    part_of_gratuity_wage: definition.partOfGratuityWage,
    part_of_bonus_wage: definition.partOfBonusWage,
    counts_toward_wage_floor: definition.countsTowardWageFloor,
    taxable: definition.taxable,
    exemption_section: definition.exemptionSection,
    print_on_payslip_when_zero: definition.printOnPayslipWhenZero,
    payslip_sequence: definition.payslipSequence,
    status: definition.status,
    formula_expression: definition.formulaExpression,
    slab_table_ref: definition.slabTableRef,
    exemption_limit_minor: definition.exemptionLimitMinor,
    is_perquisite: definition.isPerquisite,
    gl_debit_account: definition.glDebitAccountId,
    gl_credit_account: definition.glCreditAccountId,
    gl_dimensions: definition.glDimensions,
    effective_from: definition.effectiveFrom,
    definition_version: definition.definitionVersion,
  };
}

/** The envelope keys a definition occupies; the master (components-master.ts) writes through these. */
export { attributesFor as componentAttributesFor, definitionFrom as componentDefinitionFrom };

/**
 * Seeds or enriches the component master. Existing rows are merged rather than
 * replaced, so a tenant that already holds `{code, kind}` rows keeps its component
 * ids - `payroll_lines.pay_component_id` still resolves.
 */
export async function ensureComponentCatalog(access: Access): Promise<Record<string, string>> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from pay_components where tenant_id = ${access.tenantId}`,
  ]);
  const existing = new Map<string, { id: string; attributes: Record<string, unknown> }>();
  for (const row of rows as Array<{ id: string; attributes: Record<string, unknown> | null }>) {
    const attributes = row.attributes ?? {};
    const code = typeof attributes.code === "string" ? attributes.code : null;
    if (code) existing.set(code, { id: row.id, attributes });
  }

  const ids: Record<string, string> = {};
  for (const definition of STANDARD_COMPONENTS) {
    const found = existing.get(definition.code);
    if (found) {
      ids[definition.code] = found.id;
      // Only fill in keys the row does not already carry; a tenant edit always wins.
      const merged = { ...attributesFor(definition), ...found.attributes };
      await tenantTx(access, [
        sqlClient`update pay_components set attributes = ${JSON.stringify(merged)}::jsonb, updated_at = now() where tenant_id = ${access.tenantId} and id = ${found.id}`,
      ]);
      continue;
    }
    const id = crypto.randomUUID();
    ids[definition.code] = id;
    await tenantTx(access, [
      sqlClient`insert into pay_components (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify(attributesFor(definition))}::jsonb)`,
    ]);
  }
  for (const [code, found] of existing) {
    if (!ids[code]) ids[code] = found.id;
  }
  return ids;
}

export function componentRowFrom(row: { id: string; version?: number | string | null; attributes: Record<string, unknown> | null }): PayComponentRow {
  const attributes = row.attributes ?? {};
  const code = typeof attributes.code === "string" ? attributes.code : "";
  const kind = typeof attributes.kind === "string" ? attributes.kind : "earning";
  const history = Array.isArray(attributes.versions)
    ? (attributes.versions as unknown[])
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => snapshotFrom(code, kind, entry))
        .sort((left, right) => right.definitionVersion - left.definitionVersion)
    : [];
  return { id: row.id, rowVersion: Number(row.version ?? 1) || 1, history, ...definitionFrom(code, kind, attributes) };
}

/**
 * The component master. With `asOf`, each component is returned as the version in
 * force on that date (FRM-PAY-01 "Effective from"), and one that did not yet exist
 * is omitted; without it the current head is returned, which is what every
 * existing caller expects.
 */
export async function listComponents(access: Access, args: { asOf?: string | null } = {}): Promise<PayComponentRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, version, attributes from pay_components where tenant_id = ${access.tenantId}`,
  ]);
  const asOf = args.asOf ?? null;
  return (rows as Array<{ id: string; version: number | string | null; attributes: Record<string, unknown> | null }>)
    .map(componentRowFrom)
    .filter((component) => component.code !== "")
    .flatMap((component) => {
      if (asOf === null) return [component];
      const governing = componentVersionAsOf(component, component.history, asOf);
      return governing ? [{ ...component, ...governing }] : [];
    })
    .sort((left, right) => left.payslipSequence - right.payslipSequence || left.code.localeCompare(right.code));
}

export type StructureLine = {
  componentCode: string;
  calculationMethod: CalculationMethod;
  /** Present for `fixed_amount` lines. */
  amountMinor: number | null;
  /** Present for `percentage_of_component` lines. */
  percentageOf: string | null;
  percentageValue: number | null;
};

/**
 * Writes the structure's component lines. Replaces the previous representation,
 * which was an opaque `{lines: {...}}` blob on `salary_structures.attributes` that
 * no screen or join could reach.
 */
export async function ensureStructureComponents(
  access: Access,
  structureId: string,
  componentIds: Record<string, string>,
  lines: StructureLine[],
): Promise<void> {
  const [existingRows] = await tenantTx(access, [
    sqlClient`select id, pay_component_id from salary_structure_components where tenant_id = ${access.tenantId} and salary_structure_id = ${structureId}`,
  ]);
  const existing = new Map((existingRows as Array<{ id: string; pay_component_id: string }>).map((row) => [row.pay_component_id, row.id]));
  for (const line of lines) {
    const componentId = componentIds[line.componentCode];
    if (!componentId) continue;
    const attributes = {
      component_code: line.componentCode,
      calculation_method: line.calculationMethod,
      amount_minor: line.amountMinor,
      percentage_of: line.percentageOf,
      percentage_value: line.percentageValue,
    };
    const found = existing.get(componentId);
    if (found) continue;
    await tenantTx(access, [
      sqlClient`
        insert into salary_structure_components (id, tenant_id, salary_structure_id, pay_component_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${structureId}, ${componentId}, ${JSON.stringify(attributes)}::jsonb)
      `,
    ]);
  }
}

export async function listStructureComponents(access: Access, structureId: string): Promise<StructureLine[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from salary_structure_components where tenant_id = ${access.tenantId} and salary_structure_id = ${structureId}`,
  ]);
  return (rows as Array<{ attributes: Record<string, unknown> | null }>).map((row) => {
    const attributes = row.attributes ?? {};
    return {
      componentCode: String(attributes.component_code ?? ""),
      calculationMethod: (attributes.calculation_method as CalculationMethod) ?? "fixed_amount",
      amountMinor: attributes.amount_minor === null || attributes.amount_minor === undefined ? null : Number(attributes.amount_minor),
      percentageOf: (attributes.percentage_of as string | null) ?? null,
      percentageValue: attributes.percentage_value === null || attributes.percentage_value === undefined ? null : Number(attributes.percentage_value),
    };
  });
}

/**
 * Resolves a structure's earning lines against a basic amount.
 * Percentage lines resolve against another component's resolved value, so the
 * order of evaluation follows the dependency, not the row order.
 */
export function resolveStructure(lines: StructureLine[], basicMinor: number): Record<string, number> {
  const resolved: Record<string, number> = { basic: basicMinor };
  const pending = lines.filter((line) => line.componentCode !== "basic");
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const line of pending) {
      if (resolved[line.componentCode] !== undefined) continue;
      if (line.calculationMethod === "fixed_amount") {
        resolved[line.componentCode] = line.amountMinor ?? 0;
        progressed = true;
        continue;
      }
      if (line.calculationMethod === "percentage_of_component") {
        const base = line.percentageOf ? resolved[line.percentageOf] : undefined;
        if (base === undefined || line.percentageValue === null) continue;
        resolved[line.componentCode] = Math.round(base * line.percentageValue);
        progressed = true;
      }
    }
  }
  return resolved;
}
