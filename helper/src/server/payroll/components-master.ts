import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { assertCurrentVersion, HttpError } from "@/server/platform/http";
import {
  componentAttributesFor,
  componentRowFrom,
  listComponents,
  resolveStructure,
  type PayComponentDefinition,
  type PayComponentRow,
  type StructureLine,
} from "./components";
import { JOURNAL_DIMENSIONS, periodEndDate } from "./gl";

/**
 * FRM-PAY-01 Pay Component Master: the form over `pay_components.attributes`.
 *
 * `components.ts` seeds and reads the catalogue; this module is the only writer a
 * screen reaches. Every rule the workbook states for the form lives here, as does
 * the versioning rule its "Effective from" note implies: a component a finalized
 * run has used is never mutated - a later-dated version is appended and the one
 * the run used stays frozen under `attributes.versions[]`.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Char(15). Codes are identifiers because formulas reference them by name. */
const CODE_PATTERN = /^[a-z][a-z0-9_]{0,14}$/;

/**
 * Components whose percentage or slab is a statutory figure read from the rule
 * pack (`rule-pack.ts`), never from this form. A value typed here would be an
 * invented rate that disagrees with the pinned pack, so the form refuses one and
 * shows the rule name in its place.
 */
export const RULE_PACK_GOVERNED: Record<string, string> = {
  pf: "pf.employeeRate",
  esi: "esi.employeeRate",
  pt: "professionalTax.stateSlabs",
  tds: "tds.slabs",
};

/** Functions a formula may call; every other identifier must be a component code. */
export const FORMULA_FUNCTIONS = ["min", "max", "round", "floor", "ceil", "abs"] as const;

const twoDecimals = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/**
 * The 28 workbook fields, keyed the way the rest of the payroll API already names
 * them (`percentageOf`, `payslipSequence`, ...). Defaults are the workbook's stated
 * defaults; a field with none and Mandatory = Y has no default here either.
 */
export const payComponentSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(CODE_PATTERN, "Up to 15 characters: lowercase letters, digits and underscores, starting with a letter."),
    name: z.string().trim().min(1).max(60),
    /** Workbook default "Same as name" is applied in `toDefinition`. */
    payslipLabel: z.string().trim().min(1).max(40).nullable().default(null),
    kind: z.enum(picklistValues("PL_COMPONENT_TYPE")).default("earning"),
    calculationMethod: z.enum(picklistValues("PL_CALC_METHOD")).default("fixed_amount"),
    percentageOf: z.string().trim().toLowerCase().regex(CODE_PATTERN).nullable().default(null),
    /** Dec(5,2), 0-100 as the workbook states it; stored as the fraction the engine multiplies by. */
    percentValue: z.number().min(0).max(100).refine(twoDecimals, "Up to two decimal places.").nullable().default(null),
    formulaExpression: z.string().trim().min(1).max(500).nullable().default(null),
    slabTableRef: z.string().trim().min(1).max(120).nullable().default(null),
    rounding: z.enum(picklistValues("PL_ROUNDING")).default("nearest_rupee"),
    proratedOnAttendance: z.boolean().default(true),
    prorationBasis: z.enum(picklistValues("PL_PRORATION_BASIS")).nullable().default(null),
    partOfPfWage: z.boolean().default(false),
    partOfEsiWage: z.boolean().default(true),
    partOfGratuityWage: z.boolean().default(false),
    partOfBonusWage: z.boolean().default(false),
    countsTowardWageFloor: z.boolean().default(true),
    taxable: z.boolean().default(true),
    exemptionSection: z.enum(picklistValues("PL_EXEMPTION_SECTION")).default("not_exempt"),
    /** Money as integer minor units (contract rule), >= 0. */
    exemptionLimitMinor: z.number().int().min(0).nullable().default(null),
    isPerquisite: z.boolean().default(false),
    glDebitAccountId: z.string().uuid("A debit account from the chart of accounts is required."),
    glCreditAccountId: z.string().uuid("A credit account from the chart of accounts is required."),
    glDimensions: z.array(z.enum(JOURNAL_DIMENSIONS)).min(1, "At least one cost dimension is required.").default(["cost_center"]),
    printOnPayslipWhenZero: z.boolean().default(false),
    payslipSequence: z.number().int().min(0),
    /** Workbook default "Today" is applied by the service, in the server's date. */
    effectiveFrom: z.string().regex(DATE_PATTERN, "A date (YYYY-MM-DD) is required.").nullable().default(null),
    status: z.enum(picklistValues("PL_ACTIVE_STATUS")).default("active"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const governedBy = RULE_PACK_GOVERNED[value.code];
    if (value.calculationMethod === "percentage_of_component") {
      if (governedBy) {
        if (value.percentValue !== null) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentValue"], message: `The rate for ${value.code} comes from rule pack ${governedBy} and cannot be entered here.` });
        }
      } else {
        if (value.percentageOf === null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentageOf"], message: "A percentage component must name the component it is a percentage of." });
        if (value.percentValue === null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentValue"], message: "A percentage value between 0 and 100 is required." });
      }
      if (value.percentageOf !== null && value.percentageOf === value.code) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percentageOf"], message: "A component cannot be a percentage of itself." });
      }
    }
    if (value.calculationMethod === "formula" && value.formulaExpression === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["formulaExpression"], message: "A formula component must carry its formula." });
    }
    if (value.calculationMethod === "slab_table" && value.slabTableRef === null && !governedBy) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["slabTableRef"], message: "A slab component must name its slab table." });
    }
  });

export type PayComponentInput = z.infer<typeof payComponentSchema>;

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

/** 40 <-> 0.4. The engine multiplies by the fraction; the workbook captures a percentage. */
export function fractionFromPercent(percent: number | null): number | null {
  return percent === null ? null : Math.round(percent * 100) / 10_000;
}

export function percentFromFraction(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 10_000) / 100;
}

/**
 * Normalises validated input into the stored definition. Fields that belong to a
 * different calculation method are cleared, so a component never carries a stale
 * percentage alongside a formula. Proration basis takes the workbook default
 * (calendar days) only when proration is on; a non-prorated component has none.
 */
export function toDefinition(input: PayComponentInput, effectiveFrom: string | null, definitionVersion: number): PayComponentDefinition {
  const method = input.calculationMethod;
  return {
    code: input.code,
    kind: input.kind,
    name: input.name,
    payslipLabel: input.payslipLabel ?? input.name,
    calculationMethod: method,
    percentageOf: method === "percentage_of_component" ? input.percentageOf : null,
    percentageValue: method === "percentage_of_component" ? fractionFromPercent(input.percentValue) : null,
    formulaExpression: method === "formula" ? input.formulaExpression : null,
    slabTableRef: method === "slab_table" ? input.slabTableRef : null,
    rounding: input.rounding,
    proratedOnAttendance: input.proratedOnAttendance,
    prorationBasis: input.proratedOnAttendance ? (input.prorationBasis ?? "calendar_days") : null,
    partOfPfWage: input.partOfPfWage,
    partOfEsiWage: input.partOfEsiWage,
    partOfGratuityWage: input.partOfGratuityWage,
    partOfBonusWage: input.partOfBonusWage,
    countsTowardWageFloor: input.countsTowardWageFloor,
    taxable: input.taxable,
    exemptionSection: input.exemptionSection,
    exemptionLimitMinor: input.exemptionLimitMinor,
    isPerquisite: input.isPerquisite,
    glDebitAccountId: input.glDebitAccountId,
    glCreditAccountId: input.glCreditAccountId,
    glDimensions: [...new Set(input.glDimensions)],
    printOnPayslipWhenZero: input.printOnPayslipWhenZero,
    payslipSequence: input.payslipSequence,
    effectiveFrom,
    definitionVersion,
    status: input.status,
  };
}

export type FormulaScan = { references: string[]; issue: string | null };

/**
 * Lists the component codes a formula references. Grammar: numbers, identifiers,
 * `+ - * / ( ) ,` and the functions in `FORMULA_FUNCTIONS`. Anything else is an
 * issue rather than something evaluated later by surprise.
 */
export function scanFormula(expression: string): FormulaScan {
  const references = new Set<string>();
  const tokens = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),])|(\S))/gy;
  let match: RegExpExecArray | null;
  let depth = 0;
  while ((match = tokens.exec(expression)) !== null) {
    const [, , identifier, operator, other] = match;
    if (other !== undefined) return { references: [...references], issue: `Unexpected "${other}" in the formula.` };
    if (identifier !== undefined) {
      const lower = identifier.toLowerCase();
      if (!(FORMULA_FUNCTIONS as readonly string[]).includes(lower)) references.add(lower);
    }
    if (operator === "(") depth += 1;
    if (operator === ")") {
      depth -= 1;
      if (depth < 0) return { references: [...references], issue: "Unbalanced parentheses in the formula." };
    }
  }
  if (depth !== 0) return { references: [...references], issue: "Unbalanced parentheses in the formula." };
  if (references.size === 0) return { references: [], issue: "A formula must reference at least one component." };
  return { references: [...references], issue: null };
}

/** The component codes a definition's value depends on: its percentage base and its formula terms. */
export function dependenciesOf(definition: Pick<PayComponentDefinition, "calculationMethod" | "percentageOf" | "formulaExpression">): string[] {
  if (definition.calculationMethod === "percentage_of_component") return definition.percentageOf ? [definition.percentageOf] : [];
  if (definition.calculationMethod === "formula" && definition.formulaExpression) return scanFormula(definition.formulaExpression).references;
  return [];
}

/**
 * Finds a dependency cycle reachable from `start`, as the path of codes, or null.
 * Percentage chains are checked through `resolveStructure`, the engine's own
 * resolver, so the master refuses exactly what the run would fail to resolve;
 * formula edges are walked here because a structure line carries one base only.
 */
export function findDependencyCycle(catalog: readonly PayComponentDefinition[], start: string): string[] | null {
  const byCode = new Map(catalog.map((component) => [component.code, component]));
  const origin = byCode.get(start);
  if (!origin) return null;
  if (origin.calculationMethod === "percentage_of_component" && origin.percentageOf && byCode.has(origin.percentageOf)) {
    const lines: StructureLine[] = catalog
      .filter((component) => component.code !== "basic")
      .map((component) =>
        component.calculationMethod === "percentage_of_component" && component.percentageOf
          ? { componentCode: component.code, calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: component.percentageOf, percentageValue: 1 }
          : { componentCode: component.code, calculationMethod: "fixed_amount", amountMinor: 1, percentageOf: null, percentageValue: null },
      );
    // Every base exists, so the only way the resolver leaves `start` unresolved is a cycle.
    if (resolveStructure(lines, 1)[start] === undefined) {
      const path = [start];
      let cursor: string | null = origin.percentageOf;
      while (cursor && cursor !== start && !path.includes(cursor)) {
        path.push(cursor);
        cursor = byCode.get(cursor)?.percentageOf ?? null;
      }
      return [...path, start];
    }
  }
  const visiting: string[] = [];
  const done = new Set<string>();
  const walk = (code: string): string[] | null => {
    const at = visiting.indexOf(code);
    if (at >= 0) return [...visiting.slice(at), code];
    if (done.has(code)) return null;
    const component = byCode.get(code);
    if (!component) return null;
    visiting.push(code);
    for (const dependency of dependenciesOf(component)) {
      const cycle = walk(dependency);
      if (cycle) return cycle;
    }
    visiting.pop();
    done.add(code);
    return null;
  };
  return walk(start);
}

export type CatalogIssue = { field: string; issue: string };

/**
 * Rules that need the rest of the catalogue: unique code, live references, no
 * cycles, and a payslip sequence unique within the type. `others` excludes the
 * component being saved (or is the whole catalogue on create).
 */
export function validateAgainstCatalog(candidate: PayComponentDefinition, others: readonly PayComponentDefinition[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const byCode = new Map(others.map((component) => [component.code, component]));
  if (byCode.has(candidate.code)) issues.push({ field: "code", issue: `Component code ${candidate.code} already exists in this tenant.` });
  const requireActive = (field: string, code: string) => {
    const target = byCode.get(code);
    if (!target) issues.push({ field, issue: `${code} is not a defined component.` });
    else if (target.status !== "active") issues.push({ field, issue: `${code} is inactive and cannot be referenced.` });
  };
  if (candidate.calculationMethod === "percentage_of_component" && candidate.percentageOf) requireActive("percentageOf", candidate.percentageOf);
  if (candidate.calculationMethod === "formula" && candidate.formulaExpression) {
    const scan = scanFormula(candidate.formulaExpression);
    if (scan.issue) issues.push({ field: "formulaExpression", issue: scan.issue });
    for (const reference of scan.references) {
      if (reference === candidate.code) issues.push({ field: "formulaExpression", issue: "A formula cannot reference its own component." });
      else requireActive("formulaExpression", reference);
    }
  }
  if (issues.length === 0) {
    const cycle = findDependencyCycle([...others, candidate], candidate.code);
    if (cycle) {
      const field = candidate.calculationMethod === "formula" ? "formulaExpression" : "percentageOf";
      issues.push({ field, issue: `Circular reference: ${cycle.join(" -> ")}.` });
    }
  }
  const sequenceClash = others.find((component) => component.kind === candidate.kind && component.status === "active" && component.payslipSequence === candidate.payslipSequence);
  if (candidate.status === "active" && sequenceClash) {
    issues.push({ field: "payslipSequence", issue: `Sequence ${candidate.payslipSequence} is already used by ${sequenceClash.code} within ${candidate.kind}.` });
  }
  return issues;
}

/** Fields whose change alters a calculated or reported figure, and therefore must be versioned once a finalized run used the component. */
export const CALCULATION_FIELDS = [
  "calculationMethod", "percentageOf", "percentageValue", "formulaExpression", "slabTableRef", "rounding",
  "proratedOnAttendance", "prorationBasis", "partOfPfWage", "partOfEsiWage", "partOfGratuityWage", "partOfBonusWage",
  "countsTowardWageFloor", "taxable", "exemptionSection", "exemptionLimitMinor", "isPerquisite",
] as const satisfies readonly (keyof PayComponentDefinition)[];

export type ComponentUsage = {
  /** Payslip lines that reference the component, across every run state. */
  lineCount: number;
  /** The latest period a finalized, paid or closed run charged this component to. */
  lastFinalizedPeriod: string | null;
};

export type EditDecision =
  | { outcome: "replace"; effectiveFrom: string | null }
  | { outcome: "version"; effectiveFrom: string; previousEffectiveTo: string }
  | { outcome: "refuse"; code: string; message: string; field: string };

function dayBefore(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * Whether an edit replaces the head in place, appends a dated version, or is refused.
 *
 * - The code, and the type it posts under, are frozen once a payslip line references it.
 * - A calculation change dated after the current version starts a new version.
 * - Once a finalized run used the component, a calculation change must start after
 *   that run's period, and a presentation-only change keeps the head's start date.
 */
export function decideEdit(current: PayComponentDefinition, proposed: PayComponentDefinition, usage: ComponentUsage): EditDecision {
  if (usage.lineCount > 0 && proposed.code !== current.code) {
    return { outcome: "refuse", code: "COMPONENT_CODE_LOCKED", field: "code", message: `${usage.lineCount} payslip line(s) reference ${current.code}; its code can no longer change.` };
  }
  if (usage.lineCount > 0 && proposed.kind !== current.kind) {
    return { outcome: "refuse", code: "COMPONENT_KIND_LOCKED", field: "kind", message: `${usage.lineCount} payslip line(s) were posted as ${current.kind}; the type can no longer change.` };
  }
  const calculationChanged = CALCULATION_FIELDS.some((field) => current[field] !== proposed[field]);
  const locked = usage.lastFinalizedPeriod !== null;
  if (!calculationChanged) {
    return { outcome: "replace", effectiveFrom: locked ? current.effectiveFrom : (proposed.effectiveFrom ?? current.effectiveFrom) };
  }
  const proposedFrom = proposed.effectiveFrom;
  if (proposedFrom === null) {
    return { outcome: "refuse", code: "COMPONENT_VERSION_REQUIRED", field: "effectiveFrom", message: "A calculation change needs the date it takes effect from." };
  }
  if (locked) {
    const floor = periodEndDate(usage.lastFinalizedPeriod as string);
    if (proposedFrom <= floor) {
      return {
        outcome: "refuse", code: "COMPONENT_VERSION_REQUIRED", field: "effectiveFrom",
        message: `A finalized run for ${usage.lastFinalizedPeriod} used this definition. The change must take effect after ${floor}; the earlier version stays as the run used it.`,
      };
    }
  }
  if (current.effectiveFrom !== null && proposedFrom <= current.effectiveFrom) {
    return { outcome: "replace", effectiveFrom: proposedFrom };
  }
  return { outcome: "version", effectiveFrom: proposedFrom, previousEffectiveTo: dayBefore(proposedFrom) };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export type PayComponentView = PayComponentRow & {
  /** The workbook's 0-100 reading of `percentageValue`. */
  percentValue: number | null;
  /** Named when a statutory rule pack, not this form, supplies the rate or slab. */
  governedByRule: string | null;
  usage: ComponentUsage;
  /** Active components that depend on this one, which block retirement. */
  dependents: string[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadRow(access: Access, id: string): Promise<PayComponentRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, version, attributes from pay_components where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const row = (rows as Array<{ id: string; version: number | string | null; attributes: Record<string, unknown> | null }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const component = componentRowFrom(row);
  if (component.code === "") throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return component;
}

async function loadUsage(access: Access, id: string): Promise<ComponentUsage> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as line_count,
             max(r.period) filter (where r.status in ('finalized', 'paid', 'closed')) as last_finalized_period
      from payroll_lines l
      join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      join payroll_runs r on r.tenant_id = e.tenant_id and r.id = e.payroll_run_id
      where l.tenant_id = ${access.tenantId} and l.pay_component_id = ${id}
    `,
  ]);
  const row = (rows as Array<{ line_count: number | string | null; last_finalized_period: string | null }>)[0];
  return { lineCount: Number(row?.line_count ?? 0), lastFinalizedPeriod: row?.last_finalized_period ?? null };
}

/** "Active in the chart of accounts": both accounts must exist in this tenant and be active. */
async function assertGlAccounts(access: Access, definition: PayComponentDefinition): Promise<void> {
  const ids = [definition.glDebitAccountId, definition.glCreditAccountId].filter((id): id is string => id !== null);
  if (ids.length === 0) return;
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes->>'status' as status from gl_accounts where tenant_id = ${access.tenantId} and id::text = any(${ids})`,
  ]);
  const found = new Map((rows as Array<{ id: string; status: string | null }>).map((row) => [row.id, row.status]));
  const details: CatalogIssue[] = [];
  for (const [field, id] of [["glDebitAccountId", definition.glDebitAccountId], ["glCreditAccountId", definition.glCreditAccountId]] as const) {
    if (id === null) continue;
    if (!found.has(id)) details.push({ field, issue: "The account is not in this tenant's chart of accounts." });
    else if (found.get(id) === "inactive") details.push({ field, issue: "The account is inactive in the chart of accounts." });
  }
  if (details.length > 0) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "GL accounts must be active in the chart of accounts.", details });
}

function dependentsOf(code: string, catalog: readonly PayComponentDefinition[]): string[] {
  return catalog
    .filter((component) => component.code !== code && component.status === "active" && dependenciesOf(component).includes(code))
    .map((component) => component.code)
    .sort();
}

function toView(component: PayComponentRow, usage: ComponentUsage, catalog: readonly PayComponentDefinition[]): PayComponentView {
  return {
    ...component,
    percentValue: percentFromFraction(component.percentageValue),
    governedByRule: RULE_PACK_GOVERNED[component.code] ?? null,
    usage,
    dependents: dependentsOf(component.code, catalog),
  };
}

export async function listPayComponents(access: Access, args: { asOf?: string | null; status?: string | null } = {}): Promise<PayComponentView[]> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  if (args.asOf && !DATE_PATTERN.test(args.asOf)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "asOf must be a date (YYYY-MM-DD)." });
  }
  const catalog = await listComponents(access, { asOf: args.asOf ?? null });
  const usageRows = await tenantTx(access, [
    sqlClient`
      select l.pay_component_id as id, count(*)::int as line_count,
             max(r.period) filter (where r.status in ('finalized', 'paid', 'closed')) as last_finalized_period
      from payroll_lines l
      join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      join payroll_runs r on r.tenant_id = e.tenant_id and r.id = e.payroll_run_id
      where l.tenant_id = ${access.tenantId}
      group by l.pay_component_id
    `,
  ]);
  const usageById = new Map(
    (usageRows[0] as Array<{ id: string; line_count: number | string | null; last_finalized_period: string | null }>).map((row) => [
      row.id,
      { lineCount: Number(row.line_count ?? 0), lastFinalizedPeriod: row.last_finalized_period ?? null },
    ]),
  );
  return catalog
    .filter((component) => !args.status || component.status === args.status)
    .map((component) => toView(component, usageById.get(component.id) ?? { lineCount: 0, lastFinalizedPeriod: null }, catalog));
}

export async function getPayComponent(access: Access, id: string): Promise<PayComponentView> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [component, usage, catalog] = await Promise.all([loadRow(access, id), loadUsage(access, id), listComponents(access)]);
  return toView(component, usage, catalog);
}

function catalogIssues(candidate: PayComponentDefinition, others: readonly PayComponentDefinition[]): void {
  const details = validateAgainstCatalog(candidate, others);
  if (details.length > 0) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The component conflicts with the rest of the master.", details });
}

async function audit(access: Access, action: string, id: string, reason: string, after: Record<string, unknown>, requestId: string): Promise<void> {
  await tenantTx(access, [
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${action}, 'pay_component', ${id}, ${reason}, ${JSON.stringify(after)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
}

export async function createPayComponent(access: Access, input: PayComponentInput, requestId: string): Promise<PayComponentView> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const definition = toDefinition(input, input.effectiveFrom ?? todayIso(), 1);
  const catalog = await listComponents(access);
  catalogIssues(definition, catalog);
  await assertGlAccounts(access, definition);
  const id = crypto.randomUUID();
  const attributes = { ...componentAttributesFor(definition), versions: [] };
  await tenantTx(access, [
    sqlClient`
      insert into pay_components (id, tenant_id, record_status, attributes)
      values (${id}, ${access.tenantId}, ${definition.status}, ${JSON.stringify(attributes)}::jsonb)
    `,
  ]);
  await audit(access, "payroll.component_create", id, `Component ${definition.code} created`, attributes, requestId);
  return toView({ ...definition, id, rowVersion: 1, history: [] }, { lineCount: 0, lastFinalizedPeriod: null }, [...catalog, definition]);
}

export async function updatePayComponent(access: Access, id: string, input: PayComponentInput, claimedVersion: number, requestId: string): Promise<PayComponentView> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const current = await loadRow(access, id);
  assertCurrentVersion(claimedVersion, current.rowVersion);
  const usage = await loadUsage(access, id);
  const proposed = toDefinition(input, input.effectiveFrom, current.definitionVersion);
  const decision = decideEdit(current, proposed, usage);
  if (decision.outcome === "refuse") {
    throw new HttpError({ status: 409, code: decision.code, message: decision.message, details: [{ field: decision.field, issue: decision.message }] });
  }
  const catalog = await listComponents(access);
  const others = catalog.filter((component) => component.id !== id);
  const next: PayComponentDefinition = {
    ...proposed,
    effectiveFrom: decision.effectiveFrom,
    definitionVersion: decision.outcome === "version" ? current.definitionVersion + 1 : current.definitionVersion,
  };
  catalogIssues(next, others);
  await assertGlAccounts(access, next);
  const [rawRows] = await tenantTx(access, [
    sqlClient`select attributes from pay_components where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const raw = ((rawRows as Array<{ attributes: Record<string, unknown> | null }>)[0]?.attributes ?? {}) as Record<string, unknown>;
  const priorVersions = Array.isArray(raw.versions) ? (raw.versions as unknown[]) : [];
  const versions =
    decision.outcome === "version"
      ? [
          ...priorVersions,
          { ...componentAttributesFor(current), effective_to: decision.previousEffectiveTo, superseded_at: new Date().toISOString(), superseded_by: access.context.membershipId },
        ]
      : priorVersions;
  // Keys this form does not own (none today, but a future migration may add some) survive the write.
  const attributes = { ...raw, ...componentAttributesFor(next), versions };
  await tenantTx(access, [
    sqlClient`
      update pay_components set attributes = ${JSON.stringify(attributes)}::jsonb, record_status = ${next.status}, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
  ]);
  const reason = decision.outcome === "version" ? `Component ${next.code} versioned (v${next.definitionVersion}) from ${next.effectiveFrom}` : `Component ${next.code} updated`;
  await audit(access, "payroll.component_update", id, reason, attributes, requestId);
  const history = decision.outcome === "version" ? [{ ...current, effectiveTo: decision.previousEffectiveTo, supersededAt: new Date().toISOString() }, ...current.history] : current.history;
  return toView({ ...next, id, rowVersion: current.rowVersion + 1, history }, usage, [...others, next]);
}

export type ComponentTransition = "activate" | "retire";

/**
 * PL_ACTIVE_STATUS lifecycle. Retiring is refused while an active component still
 * derives from this one; activating re-checks the payslip sequence is still free.
 */
export async function transitionPayComponent(access: Access, id: string, transition: ComponentTransition, claimedVersion: number, requestId: string): Promise<PayComponentView> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const current = await loadRow(access, id);
  assertCurrentVersion(claimedVersion, current.rowVersion);
  const catalog = await listComponents(access);
  const others = catalog.filter((component) => component.id !== id);
  const status = transition === "activate" ? "active" : "inactive";
  if (current.status === status) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `The component is already ${status}.` });
  }
  if (transition === "retire") {
    const dependents = dependentsOf(current.code, catalog);
    if (dependents.length > 0) {
      throw new HttpError({ status: 409, code: "COMPONENT_IN_USE", message: `${dependents.join(", ")} still derive from ${current.code}; retire or repoint them first.` });
    }
  }
  const next: PayComponentRow = { ...current, status };
  if (transition === "activate") catalogIssues(next, others);
  const [rawRows] = await tenantTx(access, [
    sqlClient`select attributes from pay_components where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const raw = ((rawRows as Array<{ attributes: Record<string, unknown> | null }>)[0]?.attributes ?? {}) as Record<string, unknown>;
  const attributes = { ...raw, status, [`${transition === "retire" ? "retired" : "activated"}_at`]: new Date().toISOString() };
  await tenantTx(access, [
    sqlClient`
      update pay_components set attributes = ${JSON.stringify(attributes)}::jsonb, record_status = ${status}, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
  ]);
  await audit(access, `payroll.component_${transition}`, id, `Component ${current.code} ${transition === "retire" ? "retired" : "activated"}`, attributes, requestId);
  const usage = await loadUsage(access, id);
  return toView({ ...next, rowVersion: current.rowVersion + 1 }, usage, [...others, next]);
}
