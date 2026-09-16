import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertOtRunAllowed } from "@/server/vp/policy";
import { getEmployeeWorkRules } from "@/server/organization/work-rules";
import { DEFAULT_RULE_PACK_CODE, requireRule, rulePack, type RulePack } from "./rule-pack";
import { ensureComponentCatalog, ensureStructureComponents, listStructureComponents, resolveStructure, type StructureLine } from "./components";
import { periodEndDate, unmappedComponents } from "./gl";

export const STANDARD_STRUCTURE = {
  basic: 5_000_000,
  hra: 2_000_000,
  da: 500_000,
  conveyance: 160_000,
  special: 840_000,
} as const;

/**
 * The default structure's component lines. These reproduce STANDARD_STRUCTURE:
 * da and hra as percentages of basic, conveyance and special as fixed amounts.
 */
export const STANDARD_STRUCTURE_LINES: StructureLine[] = [
  { componentCode: "basic", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.basic, percentageOf: null, percentageValue: null },
  { componentCode: "da", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.1 },
  { componentCode: "hra", calculationMethod: "percentage_of_component", amountMinor: null, percentageOf: "basic", percentageValue: 0.4 },
  { componentCode: "conveyance", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.conveyance, percentageOf: null, percentageValue: null },
  { componentCode: "special", calculationMethod: "fixed_amount", amountMinor: STANDARD_STRUCTURE.special, percentageOf: null, percentageValue: null },
];

const COMPONENTS = [
  { code: "basic", kind: "earning" },
  { code: "hra", kind: "earning" },
  { code: "da", kind: "earning" },
  { code: "conveyance", kind: "earning" },
  { code: "special", kind: "earning" },
  { code: "ot", kind: "earning" },
  { code: "pf", kind: "deduction" },
  { code: "esi", kind: "deduction" },
  { code: "pt", kind: "deduction" },
  { code: "tds", kind: "deduction" },
  { code: "loan_recovery", kind: "deduction" },
] as const;

export async function ensureComponent(access: Access, code: string, kind: string): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from pay_components where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into pay_components (id, tenant_id, attributes) values (${id}, ${access.tenantId}, ${JSON.stringify({ code, kind })}::jsonb)`,
  ]);
  return id;
}

export async function ensurePayrollScaffold(access: Access, period: string) {
  const [countryRows] = await tenantTx(access, [
    sqlClient`select id from countries where iso_code = 'IN' limit 1`,
  ]);
  let countryId = (countryRows as Array<{ id: string }>)[0]?.id;
  if (!countryId) {
    countryId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into countries (id, iso_code, name, default_currency_code, default_timezone) values (${countryId}, 'IN', 'India', 'INR', 'Asia/Kolkata')`,
    ]);
  }
  const [jurisdictionQueryRows] = await tenantTx(access, [
    sqlClient`
      select j.id from jurisdictions j join countries c on c.id = j.country_id
      where c.iso_code = 'IN' order by j.valid_from desc limit 1
    `,
  ]);
  let jurisdictionId = (jurisdictionQueryRows as Array<{ id: string }>)[0]?.id;
  if (!jurisdictionId) {
    jurisdictionId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into jurisdictions (id, country_id, code, name, kind) values (${jurisdictionId}, ${countryId}, 'IN', 'India', 'country')`,
    ]);
  }
  const [entityRows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} limit 1`,
  ]);
  let entityId = (entityRows as Array<{ id: string }>)[0]?.id;
  if (!entityId) {
    entityId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into legal_entities (id, tenant_id, jurisdiction_id, code, legal_name, currency_code, status) values (${entityId}, ${access.tenantId}, ${jurisdictionId}, 'MK-IND', 'MKraft Industrial Systems Pvt Ltd', 'INR', 'active')`,
    ]);
  }
  const [groupRows] = await tenantTx(access, [
    sqlClient`select id from pay_groups where tenant_id = ${access.tenantId} and attributes->>'code' = 'HO-MONTHLY' limit 1`,
  ]);
  let groupId = (groupRows as Array<{ id: string }>)[0]?.id;
  if (!groupId) {
    groupId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into pay_groups (id, tenant_id, legal_entity_id, attributes) values (${groupId}, ${access.tenantId}, ${entityId}, '{"code":"HO-MONTHLY","name":"Head Office Monthly","currency":"INR"}'::jsonb)`,
    ]);
  }
  const [periodRows] = await tenantTx(access, [
    sqlClient`select id from pay_periods where tenant_id = ${access.tenantId} and pay_group_id = ${groupId} and attributes->>'code' = ${period} limit 1`,
  ]);
  let payPeriodId = (periodRows as Array<{ id: string }>)[0]?.id;
  if (!payPeriodId) {
    payPeriodId = crypto.randomUUID();
    const year = Number(period.slice(0, 4));
    const month = Number(period.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    await tenantTx(access, [
      sqlClient`insert into pay_periods (id, tenant_id, pay_group_id, attributes) values (${payPeriodId}, ${access.tenantId}, ${groupId}, ${JSON.stringify({ code: period, starts_on: `${period}-01`, ends_on: `${period}-${String(lastDay).padStart(2, "0")}`, status: "open" })}::jsonb)`,
    ]);
  }
  // Rule packs are global reference data: rule_pack_versions has no tenant_id.
  // countryId is already ensured above.
  const [packParentRows] = await tenantTx(access, [
    sqlClient`select id from statutory_rule_packs where country_id = ${countryId} and attributes->>'code' = 'in-pay' limit 1`,
  ]);
  let packParentId = (packParentRows as Array<{ id: string }>)[0]?.id;
  if (!packParentId) {
    packParentId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into statutory_rule_packs (id, country_id, jurisdiction_id, attributes) values (${packParentId}, ${countryId}, ${jurisdictionId}, '{"code":"in-pay","scope":"country-level-india"}'::jsonb)`,
    ]);
  }
  const [packRows] = await tenantTx(access, [
    sqlClient`select id from rule_pack_versions where statutory_rule_pack_id = ${packParentId} and attributes->>'code' = 'in-pay/v1' limit 1`,
  ]);
  let packId = (packRows as Array<{ id: string }>)[0]?.id;
  if (!packId) {
    packId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into rule_pack_versions (id, statutory_rule_pack_id, attributes) values (${packId}, ${packParentId}, '{"code":"in-pay/v1","status":"approved","scope":"country-level-india"}'::jsonb)`,
    ]);
  }
  const [structureRows] = await tenantTx(access, [
    sqlClient`select id from salary_structures where tenant_id = ${access.tenantId} and pay_group_id = ${groupId} and attributes->>'code' = 'STD-2026' limit 1`,
  ]);
  let structureId = (structureRows as Array<{ id: string }>)[0]?.id;
  if (!structureId) {
    structureId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into salary_structures (id, tenant_id, pay_group_id, attributes) values (${structureId}, ${access.tenantId}, ${groupId}, ${JSON.stringify({ code: "STD-2026", lines: STANDARD_STRUCTURE })}::jsonb)`,
    ]);
  }
  // The component master and the structure's component lines are data, not constants,
  // so payslips, GL mapping and the simulator can all read the same definitions.
  const componentIds = await ensureComponentCatalog(access);
  await ensureStructureComponents(access, structureId, componentIds, STANDARD_STRUCTURE_LINES);
  return { groupId, payPeriodId, packId, structureId, componentIds };
}

async function ensureAssignment(access: Access, employeeId: string, groupId: string, structureId: string): Promise<{ id: string; basicMinor: number | null }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select a.id, (a.attributes->>'basic_minor')::bigint as basic_minor from employee_salary_assignments a where a.tenant_id = ${access.tenantId} and a.employee_id = ${employeeId} and a.pay_group_id = ${groupId} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string; basic_minor: number | string | null }>)[0];
  if (existing) return { id: existing.id, basicMinor: existing.basic_minor === null ? null : Number(existing.basic_minor) };
  const [empRows] = await tenantTx(access, [
    sqlClient`select basic_salary_minor from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const basicMinor = (empRows as Array<{ basic_salary_minor: number | string | null }>)[0]?.basic_salary_minor ?? null;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into employee_salary_assignments (id, tenant_id, employee_id, pay_group_id, salary_structure_id, attributes) values (${id}, ${access.tenantId}, ${employeeId}, ${groupId}, ${structureId}, ${JSON.stringify({ basic_minor: basicMinor === null ? null : Number(basicMinor) })}::jsonb)`,
  ]);
  return { id, basicMinor: basicMinor === null ? null : Number(basicMinor) };
}

/**
 * FRM-PAY-03 "Run type" is PL_RUN_TYPE. `payroll_runs.scope` is the stored column and keeps its
 * own slugs, so only the two that differ are translated; the rest are the same word in both
 * vocabularies. `correction` is a Nucleus-only scope the workbook does not list (see
 * `tmp/_audit/requests/payroll.md`) and is never offered as a run type on the form: corrections
 * are created by `correctRun`, not by drafting a run.
 */
export const RUN_TYPE_TO_SCOPE: Record<string, string> = {
  regular: "regular",
  off_cycle_overtime: "ot",
  arrears: "arrears",
  full_and_final: "full_final",
  bonus: "bonus",
  reimbursement: "reimbursement",
};

const SCOPE_TO_RUN_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(RUN_TYPE_TO_SCOPE).map(([runType, scope]) => [scope, runType]),
);

/** The stored scope for a workbook run type, for callers that hold a PL_RUN_TYPE value. */
export function scopeForRunType(runType: string): string {
  return RUN_TYPE_TO_SCOPE[runType] ?? runType;
}

/** The workbook run type for a stored scope. `correction` has none and is returned unchanged. */
export function runTypeForScope(scope: string): string {
  return SCOPE_TO_RUN_TYPE[scope] ?? scope;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The workbook allows a pay date before period end only for an off-cycle run - a run paid inside
 * the period it belongs to. Regular, arrears and bonus runs pay on or after the period closes.
 */
export function payDateAllowed(runType: string, period: string, payDate: string): boolean {
  if (runType === "off_cycle_overtime" || runType === "reimbursement" || runType === "full_and_final") return true;
  return payDate >= periodEndDate(period);
}

/** FRM-PAY-03 "Action reason" minimum, applied wherever a run action reverses or waives. */
export const ACTION_REASON_MIN_LENGTH = 15;

export const createRunSchema = z
  .object({
    period: z.string().regex(/^\d{4}-\d{2}$/),
    runType: z.enum(picklistValues("PL_RUN_TYPE")).default("regular"),
    /** Both are "within the grant"; when omitted the tenant's single configured group is used. */
    legalEntityId: z.string().uuid().optional(),
    payrollGroupId: z.string().uuid().optional(),
    payDate: z.string().regex(ISO_DATE),
    /** Off-cycle runs are usually a named list; an empty filter means the whole group. */
    populationFilter: z.array(z.string().trim().min(1).max(120)).max(5000).optional(),
    includeArrears: z.boolean().default(true),
    /** Reference to an uploaded CSV of ad-hoc inputs; row validation happens on commit, not here. */
    inputFileReference: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!payDateAllowed(value.runType, value.period, value.payDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payDate"],
        message: `The pay date must be on or after ${periodEndDate(value.period)} for a ${value.runType.replace(/_/g, " ")} run.`,
      });
    }
  });

export const RUN_SCOPE_LABELS: Record<string, string> = {
  regular: "Regular",
  ot: "Off-cycle overtime",
  arrears: "Arrears",
  full_final: "Full and final",
  bonus: "Bonus",
  reimbursement: "Reimbursement",
  correction: "Correction",
};

export function scopeLabel(scope: string): string {
  return RUN_SCOPE_LABELS[scope] ?? scope;
}

/** Display-only run code (no stored column): PR-YYYY-MM-XXXX from the row id. */
export function displayRunCode(period: string, id: string): string {
  const suffix = (id.replace(/-/g, "").slice(0, 4) || "0000").toUpperCase();
  return `PR-${period}-${suffix}`;
}

export function formatPeriodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1] ?? match[2];
  return `${month} ${match[1]}`;
}

/** Cockpit display status vocabulary: DRAFT / PRE_AUDIT / CLOSED. */
export function displayRunStatus(status: string): "DRAFT" | "PRE_AUDIT" | "CLOSED" {
  const key = status.trim().toLowerCase();
  if (key === "finalized" || key === "paid" || key === "closed") return "CLOSED";
  if (key === "draft") return "DRAFT";
  return "PRE_AUDIT";
}

export type CockpitTimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

/**
 * Derive the 8-step SCR-050 state timeline from persisted data only (zero DB change).
 * Order: draft → inputs_locked → pre_audit → calculated → review → approved → disbursed → closed.
 */
export function deriveTimeline(args: {
  status: string;
  inputsExist: boolean;
  anomaliesOpen: number;
  anomaliesTotal: number;
  approvalsExist: boolean;
  payslipsExist: boolean;
}): CockpitTimelineStep[] {
  const key = args.status.trim().toLowerCase();
  const stage = key === "draft" ? 0 : key === "calculated" ? 3 : key === "approved" ? 5 : 7;
  const pastDraft = stage > 0;
  const inputsDone = args.inputsExist || pastDraft;
  const preAuditDone = stage >= 3 || (args.anomaliesTotal > 0 && args.anomaliesOpen === 0 && pastDraft);
  const calculatedDone = stage >= 3;
  const reviewDone = stage >= 5;
  const approvedDone = stage >= 5 || args.approvalsExist;
  const disbursedDone = args.payslipsExist || stage >= 7;
  const closedDone = key === "finalized" || key === "paid" || key === "closed";
  const doneFlags = [true, inputsDone, preAuditDone, calculatedDone, reviewDone, approvedDone, disbursedDone, closedDone];
  const labels = ["Draft", "Inputs locked", "Pre audit", "Calculated", "Review", "Approved", "Disbursed", "Closed"];
  const keys = ["draft", "inputs_locked", "pre_audit", "calculated", "review", "approved", "disbursed", "closed"];
  const firstTodo = doneFlags.findIndex((done) => !done);
  return keys.map((stepKey, index) => ({
    key: stepKey,
    label: labels[index]!,
    state: doneFlags[index]! ? "done" : index === firstTodo ? "current" : "todo",
  }));
}

export async function createRun(access: Access, input: z.infer<typeof createRunSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const scope = scopeForRunType(input.runType);
  const scaffold = await ensurePayrollScaffold(access, input.period);
  // A caller-named group must belong to this tenant and, when an entity is also named, to it.
  let groupId = scaffold.groupId;
  if (input.payrollGroupId) {
    const [groupRows] = await tenantTx(access, [
      sqlClient`select id, legal_entity_id from pay_groups where tenant_id = ${access.tenantId} and id = ${input.payrollGroupId} limit 1`,
    ]);
    const group = (groupRows as Array<{ id: string; legal_entity_id: string }>)[0];
    if (!group) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The payroll group is not available in this tenant." });
    if (input.legalEntityId && group.legal_entity_id !== input.legalEntityId) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The payroll group belongs to a different legal entity." });
    }
    groupId = group.id;
  } else if (input.legalEntityId) {
    const [groupRows] = await tenantTx(access, [
      sqlClient`select id from pay_groups where tenant_id = ${access.tenantId} and legal_entity_id = ${input.legalEntityId} order by created_at limit 1`,
    ]);
    const group = (groupRows as Array<{ id: string }>)[0];
    if (!group) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The legal entity has no payroll group to run." });
    groupId = group.id;
  }
  if (scope === "ot") {
    const [regularRows] = await tenantTx(access, [
      sqlClient`select status from payroll_runs where tenant_id = ${access.tenantId} and period = ${input.period} and scope = 'regular' order by created_at desc limit 1`,
    ]);
    const regularStatus = (regularRows as Array<{ status: string }>)[0]?.status ?? null;
    try {
      assertOtRunAllowed(scope, regularStatus);
    } catch (error) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: error instanceof Error ? error.message : "Regular salary must be finalized before OT." });
    }
  }
  const [dupRows] = await tenantTx(access, [
    sqlClient`select id from payroll_runs where tenant_id = ${access.tenantId} and period = ${input.period} and scope = ${scope} limit 1`,
  ]);
  if ((dupRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `A ${scope} run already exists for ${input.period}.` });
  }
  const id = crypto.randomUUID();
  const header = {
    pay_date: input.payDate,
    include_arrears: input.includeArrears,
    population_filter: input.populationFilter ?? [],
    input_file_reference: input.inputFileReference ?? null,
    // Reproducibility (snapshot id, input hash) is stamped by `calculateRun`, not at draft time.
    snapshot_id: null,
    input_hash: null,
  };
  await tenantTx(access, [
    sqlClient`
      insert into payroll_runs (id, tenant_id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id, attributes)
      values (${id}, ${access.tenantId}, ${input.period}, ${scope}, 'draft', ${groupId}, ${scaffold.payPeriodId}, ${scaffold.packId},
        ${JSON.stringify(header)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.run_create', 'payroll_run', ${id}, 'Payroll run drafted',
        ${JSON.stringify({ period: input.period, scope, run_type: input.runType, pay_date: input.payDate, created_by: access.context.actorUserId })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, period: input.period, scope, runType: input.runType, payDate: input.payDate, status: "draft" };
}

type RunRow = { id: string; period: string; scope: string; status: string; pay_group_id: string; pay_period_id: string; rule_pack_version_id: string; attributes: Record<string, unknown> | null };

async function loadRun(access: Access, runId: string): Promise<RunRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id, attributes from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as RunRow[])[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}

function assertMutable(run: RunRow): void {
  if (run.status === "finalized" || run.status === "paid" || run.status === "closed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `A ${run.status} run is immutable.` });
  }
}

async function raiseAnomaly(access: Access, runId: string, employeeId: string, ruleCode: string, severity: string, facts: unknown): Promise<void> {
  await tenantTx(access, [
    sqlClient`
      insert into payroll_anomalies (tenant_id, payroll_run_id, employee_id, rule_code, severity, facts)
      values (${access.tenantId}, ${runId}, ${employeeId}, ${ruleCode}, ${severity}, ${JSON.stringify(facts)}::jsonb)
    `,
  ]);
}

/**
 * FRM-PAY-03 "Snapshot / input hash" and its reproducibility promise. The snapshot id names the
 * calculation attempt; the input hash covers exactly what went into it - the run header, the
 * pinned rule pack, the population and every ad-hoc input - so re-running the same inputs against
 * the same pack must produce the same hash, and a changed input cannot hide behind an unchanged one.
 */
export function reproducibilityStamp(args: {
  runId: string;
  period: string;
  scope: string;
  rulePackVersionId: string;
  payGroupId: string;
  employeeIds: readonly string[];
  inputs: ReadonlyArray<{ employee_id: string; component: string | null; amount_minor: string | null }>;
}): { snapshotId: string; inputHash: string } {
  const canonical = JSON.stringify({
    runId: args.runId,
    period: args.period,
    scope: args.scope,
    rulePackVersionId: args.rulePackVersionId,
    payGroupId: args.payGroupId,
    employeeIds: [...args.employeeIds].sort(),
    inputs: args.inputs
      .map((row) => `${row.employee_id}|${row.component ?? ""}|${row.amount_minor ?? ""}`)
      .sort(),
  });
  const inputHash = createHash("sha256").update(canonical).digest("hex");
  return { snapshotId: `${args.runId}:${inputHash.slice(0, 16)}`, inputHash };
}

type PayableBasis = {
  payableBasicMinor: number;
  /** Trace label and operands, so a daily-wage payslip line shows how it was reached. */
  node: string;
  rule: string | null;
  inputs: Record<string, unknown>;
};

/**
 * RL-26. The basic actually earned for the period, on the employee's own wage basis.
 *
 * A monthly employee earns the contractual monthly basic, which is what payroll has
 * always paid. A Daily employee earns days present x the day rate - and neither
 * workbook states how the day rate is reached (over 26, over 30, over the days in
 * the month, or a stored rate), nor what a half day counts towards days present.
 * Both are declared `null` in the rule pack and read through `requireRule`, so a
 * daily-wage run refuses by name instead of quietly paying a monthly salary.
 */
async function payableBasisForPeriod(
  access: Access,
  pack: RulePack,
  input: { employeeId: string; period: string; monthlyBasicMinor: number },
): Promise<PayableBasis> {
  const rules = await getEmployeeWorkRules(access, input.employeeId);
  if (rules.paysOnDaysPresent === null) {
    throw new HttpError({
      status: 422,
      code: "WORK_RULES_INCOMPLETE",
      message:
        "This employee's wage basis is not stated at any level - neither the employment category, the sub-category nor the assignment names one - " +
        "so payroll cannot tell whether they are paid a monthly salary or on days present. Set the wage type on the worker category before running payroll.",
      details: [{ field: "wageType", issue: `Unresolved for employee ${input.employeeId}. RL-26 keys the pay basis on it.` }],
    });
  }
  if (!rules.paysOnDaysPresent) {
    return { payableBasicMinor: input.monthlyBasicMinor, node: "Basic from salary assignment", rule: null, inputs: { wageType: rules.wageType } };
  }
  const divisor = requireRule(pack.dailyWage.rateDivisor, "dailyWage.rateDivisor", pack.code);
  const halfDayWeight = requireRule(pack.dailyWage.halfDayWeight, "dailyWage.halfDayWeight", pack.code);
  const [dayRows] = await tenantTx(access, [
    sqlClient`
      select count(*) filter (where status = 'present')::int as full_days,
             count(*) filter (where status = 'half_day')::int as half_days
      from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId}
        and attendance_date::text like ${`${input.period}%`}
    `,
  ]);
  const counted = (dayRows as Array<{ full_days: number; half_days: number }>)[0] ?? { full_days: 0, half_days: 0 };
  const daysPresent = Number(counted.full_days) + Number(counted.half_days) * halfDayWeight;
  const dailyRateMinor = input.monthlyBasicMinor / divisor;
  return {
    payableBasicMinor: Math.round(dailyRateMinor * daysPresent),
    node: "Basic from days present",
    rule: "dailyWage.rateDivisor",
    inputs: {
      wageType: rules.wageType,
      wageTypeSource: rules.source.wageType,
      fullDaysPresent: Number(counted.full_days),
      halfDaysPresent: Number(counted.half_days),
      halfDayWeight,
      daysPresent,
      rateDivisor: divisor,
      dailyRateMinor,
    },
  };
}

export async function calculateRun(access: Access, runId: string, employeeIds: string[] | undefined, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  const scaffold = await ensurePayrollScaffold(access, run.period);
  // Statutory rates come from the pinned rule pack, never from literals, so a run
  // stays reproducible against the version recorded on payroll_runs.
  const pack = rulePack(DEFAULT_RULE_PACK_CODE);
  const componentIds: Record<string, string> = { ...scaffold.componentIds };
  for (const component of COMPONENTS) {
    if (!componentIds[component.code]) componentIds[component.code] = await ensureComponent(access, component.code, component.kind);
  }
  const structureLines = await listStructureComponents(access, scaffold.structureId);
  // FRM-PAY-03 "Population filter": the run's own named list is what it calculates when the
  // caller does not narrow it further. Each entry is an employee code or id - a filter entry
  // that matches nobody is an error, never a silently dropped term.
  const header = toRunHeader(run, null);
  let population = employeeIds && employeeIds.length > 0 ? employeeIds : undefined;
  if (!population && header.populationFilter.length > 0) {
    const [filterRows] = await tenantTx(access, [
      sqlClient`
        select id, employee_code from employees
        where tenant_id = ${access.tenantId} and (employee_code = any(${header.populationFilter}) or id::text = any(${header.populationFilter}))
      `,
    ]);
    const matched = filterRows as Array<{ id: string; employee_code: string | null }>;
    const found = new Set<string>(matched.flatMap((row) => [row.id, row.employee_code ?? ""]));
    const missing = header.populationFilter.filter((entry) => !found.has(entry));
    if (missing.length > 0) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: `The population filter names people this run cannot resolve: ${missing.join(", ")}.`,
      });
    }
    population = matched.map((row) => row.id);
  }
  const [employeeRows] = await tenantTx(access, [
    population && population.length > 0
      ? sqlClient`select id, basic_salary_minor from employees where tenant_id = ${access.tenantId} and id = any(${population})`
      : sqlClient`select id, basic_salary_minor from employees where tenant_id = ${access.tenantId} and status = 'active'`,
  ]);
  const employees = (employeeRows as Array<{ id: string; basic_salary_minor: number | string | null }>).map((row) => ({
    id: row.id,
    basic_salary_minor: row.basic_salary_minor === null ? null : Number(row.basic_salary_minor),
  }));
  let gross = 0, deductions = 0, calculated = 0;
  for (const employee of employees) {
    const assignment = await ensureAssignment(access, employee.id, scaffold.groupId, scaffold.structureId);
    const monthlyBasic = assignment.basicMinor ?? employee.basic_salary_minor;
    if (!monthlyBasic || monthlyBasic <= 0) {
      await raiseAnomaly(access, runId, employee.id, "missing-salary", "critical", { reason: "No basic salary available for calculation." });
      continue;
    }
    if (run.scope === "ot") {
      const [otRows] = await tenantTx(access, [
        sqlClient`select coalesce(sum(payable_ot_minutes), 0)::int as minutes from attendance_days where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and attendance_date::text like ${`${run.period}%`} and locked_at is not null`,
      ]);
      const minutes = (otRows as Array<{ minutes: number }>)[0]?.minutes ?? 0;
      if (minutes <= 0) continue;
      const otBasis = requireRule(pack.overtime.hoursBasis, "overtime.hoursBasis", pack.code);
      const otMultiplier = requireRule(pack.overtime.workingDayMultiplier, "overtime.workingDayMultiplier", pack.code);
      const hourlyMinor = monthlyBasic / (otBasis.daysPerMonth * otBasis.hoursPerDay * 60);
      const amount = Math.round(hourlyMinor * minutes * otMultiplier);
      const otTrace: CalculationTrace[] = [{
        code: "ot",
        node: "Overtime amount",
        inputs: { payableOtMinutes: minutes, hourlyRateMinor: hourlyMinor, multiplier: otMultiplier },
        output: amount,
        rule: "overtime.workingDayMultiplier",
        children: [{
          code: "ot",
          node: "Hourly rate from basic",
          inputs: { basicMinor: monthlyBasic, daysPerMonth: otBasis.daysPerMonth, hoursPerDay: otBasis.hoursPerDay },
          output: hourlyMinor,
          rule: "overtime.hoursBasis",
        }],
      }];
      await persistEmployeeResult(access, run, employee.id, assignment.id, [{ code: "ot", kind: "earning", amount }], componentIds, requestId, undefined, undefined, otTrace);
      gross += amount;
      calculated += 1;
      if (minutes > 3600) await raiseAnomaly(access, runId, employee.id, "ot-outlier", "warning", { minutes });
      continue;
    }
    // RL-26. Where the wage basis is Daily the employee is paid on the days actually
    // present, not a monthly salary. The basis resolves from the employee's category
    // ladder and is never defaulted: a contractual worker silently paid monthly is a
    // pay defect, not a sensible fallback.
    const wage = await payableBasisForPeriod(access, pack, { employeeId: employee.id, period: run.period, monthlyBasicMinor: monthlyBasic });
    const basic = wage.payableBasicMinor;
    // Earnings resolve from the employee's salary structure. Percentage lines resolve
    // against the component they reference, so the structure - not the engine - decides
    // what HRA and DA are worth.
    const resolvedEarnings = resolveStructure(structureLines, basic);
    const hra = resolvedEarnings.hra ?? 0;
    const da = resolvedEarnings.da ?? 0;
    const conveyance = resolvedEarnings.conveyance ?? 0;
    const special = resolvedEarnings.special ?? 0;
    const earnings = basic + hra + da + conveyance + special;
    const pfRate = requireRule(pack.pf.employeeRate, "pf.employeeRate", pack.code);
    const pfCeiling = requireRule(pack.pf.wageCeilingMinor, "pf.wageCeilingMinor", pack.code);
    const pf = Math.min(Math.round((basic + da) * pfRate), Math.round(pfCeiling * pfRate));
    const esiRate = requireRule(pack.esi.employeeRate, "esi.employeeRate", pack.code);
    const esiThreshold = requireRule(pack.esi.wageThresholdMinor, "esi.wageThresholdMinor", pack.code);
    const esi = earnings > esiThreshold ? 0 : Math.round(earnings * esiRate);
    const pt = requireRule(pack.professionalTax.flatAmountMinor, "professionalTax.flatAmountMinor", pack.code);
    const [inputRows] = await tenantTx(access, [
      sqlClient`
        select attributes->>'component' as component, (attributes->>'amount_minor')::bigint as amount
        from payroll_inputs where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and pay_period_id = ${scaffold.payPeriodId}
      `,
    ]);
    const inputsByComponent: Record<string, number> = {};
    for (const row of inputRows as Array<{ component: string; amount: number | null }>) {
      if (row.component === "loan_recovery") continue;
      inputsByComponent[row.component] = Number(row.amount ?? 0);
    }
    const tds = inputsByComponent.tds ?? 0;
    const extraLines: Array<{ code: string; kind: string; amount: number }> = [];
    for (const [code, amount] of Object.entries(inputsByComponent)) {
      if (code === "tds" || amount === 0) continue;
      const kind = ["advance_paid", "bonus", "arrear", "overtime_extra"].includes(code) ? "earning" : "deduction";
      extraLines.push({ code, kind, amount });
    }
    const [loanRows] = await tenantTx(access, [
      sqlClient`
        select id, (attributes->>'outstanding_minor')::bigint as outstanding,
               (attributes->>'instalment_minor')::bigint as instalment
        from employee_loans
        where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and attributes->>'status' = 'disbursed'
        order by created_at limit 1
      `,
    ]);
    const loan = (loanRows as Array<{ id: string; outstanding: number; instalment: number | string | null }>)[0];
    const loanRecoveryRate = requireRule(pack.loans.recoveryPercentOfBasic, "loans.recoveryPercentOfBasic", pack.code);
    // A sanctioned loan carries its agreed instalment, so recovery follows the
    // amortisation schedule. The rule-pack percentage remains the fallback for loans
    // sanctioned before schedules existed, which carry no instalment.
    const scheduledInstalment = loan?.instalment === null || loan?.instalment === undefined ? 0 : Number(loan.instalment);
    const loanRecoveryBasis = scheduledInstalment > 0 ? scheduledInstalment : Math.round(basic * loanRecoveryRate);
    const loanRecovery = loan ? Math.min(loanRecoveryBasis, Number(loan.outstanding)) : 0;
    for (const extra of extraLines) {
      if (!componentIds[extra.code]) componentIds[extra.code] = await ensureComponent(access, extra.code, extra.kind);
    }
    const lines = [
      { code: "basic", kind: "earning", amount: basic },
      { code: "hra", kind: "earning", amount: hra },
      { code: "da", kind: "earning", amount: da },
      { code: "conveyance", kind: "earning", amount: conveyance },
      { code: "special", kind: "earning", amount: special },
      { code: "pf", kind: "deduction", amount: pf },
      { code: "esi", kind: "deduction", amount: esi },
      { code: "pt", kind: "deduction", amount: pt },
      { code: "tds", kind: "deduction", amount: tds },
      ...(loanRecovery > 0 ? [{ code: "loan_recovery", kind: "deduction", amount: loanRecovery }] : []),
      ...extraLines,
    ];
    const extraEarnings = extraLines.filter((line) => line.kind === "earning").reduce((total, line) => total + line.amount, 0);
    const extraDeductions = extraLines.filter((line) => line.kind === "deduction").reduce((total, line) => total + line.amount, 0);
    const net = earnings + extraEarnings - (pf + esi + pt + tds + loanRecovery + extraDeductions);
    if (net < 0) {
      await raiseAnomaly(access, runId, employee.id, "negative-net", "critical", {
        reason: "Deductions exceed earnings for this period.",
        earnings,
        deductions: pf + esi + pt + tds + loanRecovery + extraDeductions,
        impact_amount_minor: pf + esi + pt + tds + loanRecovery + extraDeductions - earnings,
      });
      continue;
    }
    // Record how each line was reached, so a payslip line drills back to its rule
    // and operands instead of presenting a bare number (RL-273 / PAY-04.4).
    const structureTrace = (code: string, output: number): CalculationTrace => {
      const line = structureLines.find((entry) => entry.componentCode === code);
      if (line?.calculationMethod === "percentage_of_component" && line.percentageOf && line.percentageValue !== null) {
        return {
          code, node: `${code} from ${line.percentageOf}`,
          inputs: { baseComponent: line.percentageOf, baseMinor: resolvedEarnings[line.percentageOf] ?? basic, percentage: line.percentageValue },
          output, rule: `structure.${code}`,
        };
      }
      return { code, node: `${code} fixed amount`, inputs: { amountMinor: line?.amountMinor ?? output }, output, rule: `structure.${code}` };
    };
    const traces: CalculationTrace[] = [
      { code: "basic", node: wage.node, inputs: { assignmentBasicMinor: assignment.basicMinor, employeeBasicMinor: employee.basic_salary_minor, ...wage.inputs }, output: basic, rule: wage.rule },
      structureTrace("da", da),
      structureTrace("hra", hra),
      structureTrace("conveyance", conveyance),
      structureTrace("special", special),
      {
        code: "pf", node: "Provident fund", inputs: { pfWageMinor: basic + da, rate: pfRate, wageCeilingMinor: pfCeiling, cappedByCeiling: Math.round((basic + da) * pfRate) > Math.round(pfCeiling * pfRate) },
        output: pf, rule: "pf.employeeRate",
        children: [{ code: "pf", node: "PF wage base", inputs: { components: pack.pf.wageBase, basicMinor: basic, daMinor: da }, output: basic + da, rule: "pf.wageBase" }],
      },
      { code: "esi", node: "Employee state insurance", inputs: { grossMinor: earnings, rate: esiRate, thresholdMinor: esiThreshold, coveredThisPeriod: earnings <= esiThreshold }, output: esi, rule: "esi.employeeRate" },
      { code: "pt", node: "Professional tax", inputs: { flatAmountMinor: pt }, output: pt, rule: "professionalTax.flatAmountMinor" },
      { code: "tds", node: "Tax deducted at source", inputs: { source: "payroll input", amountMinor: tds }, output: tds, rule: null },
      ...(loanRecovery > 0
        ? [{
            code: "loan_recovery", node: "Loan recovery",
            inputs: {
              basis: scheduledInstalment > 0 ? "scheduled instalment" : "percentage of basic",
              scheduledInstalmentMinor: scheduledInstalment || null,
              basicMinor: basic,
              rate: scheduledInstalment > 0 ? null : loanRecoveryRate,
              outstandingMinor: Number(loan?.outstanding ?? 0),
              cappedByOutstanding: loanRecoveryBasis > Number(loan?.outstanding ?? 0),
            },
            output: loanRecovery,
            rule: scheduledInstalment > 0 ? "loan.schedule.instalment" : "loans.recoveryPercentOfBasic",
          } satisfies CalculationTrace]
        : []),
    ];
    await persistEmployeeResult(access, run, employee.id, assignment.id, lines, componentIds, requestId, loan?.id, loanRecovery, traces);
    gross += earnings + extraEarnings;
    deductions += pf + esi + pt + tds + loanRecovery + extraDeductions;
    calculated += 1;
  }
  const net = gross - deductions;
  // FRM-PAY-03 "Snapshot / input hash": what this run was calculated from, so the same
  // figures can be reproduced against the same rule pack eleven months later. The hash covers
  // the inputs the calculation actually consumed, not the outputs it produced.
  const [stampInputRows] = await tenantTx(access, [
    sqlClient`
      select employee_id, attributes->>'component' as component, attributes->>'amount_minor' as amount_minor
      from payroll_inputs
      where tenant_id = ${access.tenantId} and pay_period_id = ${scaffold.payPeriodId}
      order by employee_id, component
    `,
  ]);
  const stamp = reproducibilityStamp({
    runId: run.id,
    period: run.period,
    scope: run.scope,
    rulePackVersionId: run.rule_pack_version_id,
    payGroupId: run.pay_group_id,
    employeeIds: employees.map((employee) => employee.id),
    inputs: stampInputRows as Array<{ employee_id: string; component: string | null; amount_minor: string | null }>,
  });
  await tenantTx(access, [
    sqlClient`
      update payroll_runs
      set status = 'calculated', employee_count = ${calculated}, gross_minor = ${gross}, deductions_minor = ${deductions}, net_minor = ${net},
          attributes = attributes || ${JSON.stringify({ snapshot_id: stamp.snapshotId, input_hash: stamp.inputHash })}::jsonb,
          updated_at = now()
      where id = ${run.id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.calculate', 'payroll_run', ${run.id}, 'Run calculated deterministically',
        ${JSON.stringify({ calculated, gross, deductions, net, snapshot_id: stamp.snapshotId, input_hash: stamp.inputHash })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { runId: run.id, calculated, gross, deductions, net, snapshotId: stamp.snapshotId, inputHash: stamp.inputHash };
}

/**
 * One step of a calculation, recorded so a payslip line can be drilled back to the
 * rule and the operands that produced it (RL-273 / PAY-04.4). `children` are the
 * intermediate values a step consumed.
 */
export type CalculationTrace = {
  code: string;
  node: string;
  inputs: Record<string, unknown>;
  output: number;
  /** The rule pack path or structure line the step applied, when one applies. */
  rule: string | null;
  children?: CalculationTrace[];
};

/** Flattens a trace forest into insertable rows, threading parent ids through. */
export function flattenTraces(
  traces: CalculationTrace[],
  componentIds: Record<string, string>,
  parentId: string | null = null,
): Array<{ id: string; parentId: string | null; componentId: string | null; attributes: Record<string, unknown> }> {
  const rows: Array<{ id: string; parentId: string | null; componentId: string | null; attributes: Record<string, unknown> }> = [];
  for (const trace of traces) {
    const id = crypto.randomUUID();
    rows.push({
      id,
      parentId,
      componentId: componentIds[trace.code] ?? null,
      attributes: {
        code: trace.code,
        node: trace.node,
        inputs: trace.inputs,
        output: trace.output,
        rule: trace.rule,
        rule_pack_version: DEFAULT_RULE_PACK_CODE,
      },
    });
    if (trace.children?.length) rows.push(...flattenTraces(trace.children, componentIds, id));
  }
  return rows;
}

async function persistEmployeeResult(
  access: Access,
  run: RunRow,
  employeeId: string,
  assignmentId: string,
  lines: Array<{ code: string; kind: string; amount: number }>,
  componentIds: Record<string, string>,
  requestId: string,
  loanId?: string,
  loanRecovery?: number,
  traces: CalculationTrace[] = [],
): Promise<string> {
  const runEmployeeId = crypto.randomUUID();
  const traceRows = flattenTraces(traces, componentIds);
  const gross = lines.filter((line) => line.kind === "earning").reduce((total, line) => total + line.amount, 0);
  const deductions = lines.filter((line) => line.kind === "deduction").reduce((total, line) => total + line.amount, 0);
  await tenantTx(access, [
    sqlClient`
      insert into payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
      values (${runEmployeeId}, ${access.tenantId}, ${employeeId}, ${run.id}, ${assignmentId},
        ${JSON.stringify({ gross_minor: gross, deductions_minor: deductions, net_minor: gross - deductions, rule: "in-pay/v1" })}::jsonb)
    `,
    ...lines.map((line) => sqlClient`
      insert into payroll_lines (tenant_id, pay_component_id, payroll_run_employee_id, attributes)
      values (${access.tenantId}, ${componentIds[line.code]}, ${runEmployeeId},
        ${JSON.stringify({ code: line.code, kind: line.kind, amount_minor: line.amount })}::jsonb)
    `),
    ...traceRows.map((row) => sqlClient`
      insert into payroll_calculations (id, tenant_id, payroll_run_employee_id, pay_component_id, parent_calculation_id, attributes)
      values (${row.id}, ${access.tenantId}, ${runEmployeeId}, ${row.componentId}, ${row.parentId}, ${JSON.stringify(row.attributes)}::jsonb)
    `),
    ...(loanId && loanRecovery
      ? [sqlClient`
        insert into loan_transactions (tenant_id, employee_loan_id, attributes)
        values (${access.tenantId}, ${loanId}, ${JSON.stringify({ kind: "recovery", amount_minor: loanRecovery, payroll_run_id: run.id })}::jsonb)
      `,
        sqlClient`
          update employee_loans
          set attributes = jsonb_set(attributes, '{outstanding_minor}', to_jsonb((attributes->>'outstanding_minor')::bigint - ${loanRecovery})),
              updated_at = now()
          where id = ${loanId} and tenant_id = ${access.tenantId}`,
        sqlClient`
          update loans set outstanding_minor = outstanding_minor - ${loanRecovery}, updated_at = now()
          where id = ${loanId} and tenant_id = ${access.tenantId}`]
      : []),
  ]);
  void requestId;
  return runEmployeeId;
}

export async function approveRun(access: Access, runId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  if (run.status !== "calculated") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only a calculated run can be approved." });
  }
  await tenantTx(access, [
    sqlClient`
      insert into payroll_approvals (tenant_id, membership_id, payroll_run_id, attributes)
      values (${access.tenantId}, ${access.context.membershipId}, ${runId},
        ${JSON.stringify({ stage: "final", decision: "approved", actor: access.context.actorUserId })}::jsonb)
    `,
    sqlClient`update payroll_runs set status = 'approved', updated_at = now() where id = ${runId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.approve', 'payroll_run', ${runId}, 'Run approved', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: runId, status: "approved" };
}

export async function finalizeRun(access: Access, runId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  assertMutable(run);
  if (run.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only an approved run can be finalized." });
  }
  const [approvalRows] = await tenantTx(access, [
    sqlClient`select attributes->>'actor' as actor from payroll_approvals where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} and attributes->>'decision' = 'approved'`,
  ]);
  const approvers = new Set((approvalRows as Array<{ actor: string }>).map((row) => row.actor));
  if (!approvers.size || (approvers.size === 1 && approvers.has(access.context.actorUserId))) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Finalization requires a maker/checker pair: an approver distinct from the finalizer." });
  }
  const [typeRows] = await tenantTx(access, [
    sqlClient`select id from document_types where tenant_id = ${access.tenantId} and attributes->>'code' = 'PAYSLIP' limit 1`,
  ]);
  let payslipTypeId = (typeRows as Array<{ id: string }>)[0]?.id;
  if (!payslipTypeId) {
    payslipTypeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`insert into document_types (id, tenant_id, attributes) values (${payslipTypeId}, ${access.tenantId}, '{"code":"PAYSLIP","name":"Payslip"}'::jsonb)`,
    ]);
  }
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}`,
  ]);
  const members = memberRows as Array<{ id: string; employee_id: string; attributes: { gross_minor: number; deductions_minor: number; net_minor: number } }>;
  await tenantTx(access, [
    sqlClient`update payroll_runs set status = 'finalized', finalized_at = now(), updated_at = now() where id = ${runId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update salary_advances set attributes = attributes || '{"status":"recovered"}'::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and attributes->>'status' = 'paid'
        and payroll_input_id in (select id from payroll_inputs where tenant_id = ${access.tenantId} and pay_period_id = ${run.pay_period_id})
    `,
    ...members.flatMap((member) => {
      const documentId = crypto.randomUUID();
      const payslipId = crypto.randomUUID();
      return [
        sqlClient`
          insert into documents (id, tenant_id, document_type_id, employee_id, attributes)
          values (${documentId}, ${access.tenantId}, ${payslipTypeId}, ${member.employee_id},
            ${JSON.stringify({ title: `Payslip ${run.period}`, current_version: 1 })}::jsonb)
        `,
        sqlClient`
          insert into payslips (id, tenant_id, document_id, payroll_run_employee_id, attributes)
          values (${payslipId}, ${access.tenantId}, ${documentId}, ${member.id},
            ${JSON.stringify({ period: run.period, scope: run.scope, totals: member.attributes, state: "generated", generated_at: new Date().toISOString() })}::jsonb)
        `,
      ];
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.finalize', 'payroll_run', ${runId}, 'Run finalized and immutable', ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.finalized', 'payroll_run', ${runId}, ${JSON.stringify({ period: run.period, scope: run.scope })}::jsonb)
    `,
  ]);
  return { id: runId, status: "finalized", payslips: members.length };
}

export async function getRun(access: Access, runId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  const [memberRows, anomalyRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
    sqlClient`select id, employee_id, rule_code, severity, status from payroll_anomalies where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
  ]);
  return { run, members: memberRows, anomalies: anomalyRows };
}

export async function listRuns(
  access: Access,
  args: { period?: string | null; status?: string | null; scope?: string | null; page: number; pageSize: number },
) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const periodFilter = args.period ?? null;
  const statusFilter = args.status ?? null;
  const scopeFilter = args.scope ?? null;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from payroll_runs where tenant_id = ${access.tenantId} and (${periodFilter}::text is null or period = ${args.period}) and (${statusFilter}::text is null or status = ${args.status}) and (${scopeFilter}::text is null or scope = ${args.scope})`,
    sqlClient`
      select id, period, scope, status, employee_count, gross_minor, deductions_minor, net_minor, currency, finalized_at
      from payroll_runs where tenant_id = ${access.tenantId} and (${periodFilter}::text is null or period = ${args.period}) and (${statusFilter}::text is null or status = ${args.status}) and (${scopeFilter}::text is null or scope = ${args.scope})
      order by period desc, created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export type RunCockpitSummary = {
  run: RunRow;
  displayCode: string;
  periodLabel: string;
  scopeLabel: string;
  displayStatus: "DRAFT" | "PRE_AUDIT" | "CLOSED";
  timeline: CockpitTimelineStep[];
  /** FRM-PAY-03 run header, read back from `payroll_runs.attributes`. */
  header: RunHeader;
  counts: {
    members: number;
    anomaliesOpen: number;
    anomaliesTotal: number;
    inputs: number;
    approvals: number;
    payslips: number;
    /** FRM-PAY-03 "Critical audit flags" - must be zero before approval. */
    criticalFlagsOpen: number;
  };
  /**
   * FRM-PAY-03 validation panels. `unmappedComponents` is null when the caller may not read the
   * GL mappings: unknown, never zero, because zero would falsely clear the approval gate.
   * `leaveLocked` reports whether leave touching the period is settled: no request
   * overlapping it is still awaiting a decision, so the leave days payroll is about to pay
   * can no longer move. A period holding no leave at all is settled by the same test.
   */
  gates: {
    attendanceLocked: boolean;
    leaveLocked: boolean;
    unmappedComponents: number | null;
  };
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

/** FRM-PAY-03 run header as it is read back onto the form. */
export type RunHeader = {
  runType: string;
  payDate: string | null;
  includeArrears: boolean;
  populationFilter: string[];
  inputFileReference: string | null;
  snapshotId: string | null;
  inputHash: string | null;
  legalEntityId: string | null;
  payrollGroupId: string;
  rulePackVersionId: string;
};

/** Reads the FRM-PAY-03 header keys out of a run's `attributes` bag, with the run row for context. */
export function toRunHeader(run: RunRow, legalEntityId: string | null): RunHeader {
  const attributes = run.attributes ?? {};
  const filter = attributes.population_filter;
  return {
    runType: runTypeForScope(run.scope),
    payDate: typeof attributes.pay_date === "string" ? attributes.pay_date : null,
    // Runs drafted before the header existed carry no flag; the workbook default is Yes.
    includeArrears: typeof attributes.include_arrears === "boolean" ? attributes.include_arrears : true,
    populationFilter: Array.isArray(filter) ? filter.filter((value): value is string => typeof value === "string") : [],
    inputFileReference: typeof attributes.input_file_reference === "string" ? attributes.input_file_reference : null,
    snapshotId: typeof attributes.snapshot_id === "string" ? attributes.snapshot_id : null,
    inputHash: typeof attributes.input_hash === "string" ? attributes.input_hash : null,
    legalEntityId,
    payrollGroupId: run.pay_group_id,
    rulePackVersionId: run.rule_pack_version_id,
  };
}

/** Cockpit read-model: composes existing run/member/anomaly/input/approval/payslip/audit rows. No writes. */
export async function getRunCockpit(access: Access, runId: string): Promise<RunCockpitSummary> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const run = await loadRun(access, runId);
  const [memberRows, anomalyRows, inputRows, approvalRows, payslipRows, auditRows, entityRows, attendanceRows, leaveRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from payroll_run_employees where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}`,
    sqlClient`
      select count(*)::int as total,
             count(*) filter (where status = 'open')::int as open,
             -- 'high' is the pre-PL_SEVERITY spelling of 'critical' and still blocks approval.
             count(*) filter (where status = 'open' and severity in ('critical', 'high'))::int as critical_open
      from payroll_anomalies where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}
    `,
    sqlClient`select count(*)::int as total from payroll_inputs i join pay_periods p on p.id = i.pay_period_id where i.tenant_id = ${access.tenantId} and p.id = ${run.pay_period_id}`,
    sqlClient`select count(*)::int as total from payroll_approvals where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}`,
    sqlClient`select count(*)::int as total from payslips p join payroll_run_employees e on e.id = p.payroll_run_employee_id where p.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}`,
    sqlClient`select action, reason, created_at from audit_events where tenant_id = ${access.tenantId} and entity_type = 'payroll_run' and entity_id = ${runId} order by created_at desc limit 8`,
    sqlClient`select legal_entity_id from pay_groups where tenant_id = ${access.tenantId} and id = ${run.pay_group_id} limit 1`,
    // The attendance period is locked when no day inside it is still unlocked.
    sqlClient`
      select count(*)::int as total, count(*) filter (where locked_at is null)::int as unlocked
      from attendance_days
      where tenant_id = ${access.tenantId} and attendance_date::text like ${`${run.period}%`}
    `,
    // FRM-PAY-03 `leave_locked`: whether leave touching this period is settled. Any request
    // overlapping the period that is still awaiting a decision can still change the days
    // payroll is about to pay, so the figures are not yet fixed.
    sqlClient`
      select count(*)::int as open
      from leave_requests
      where tenant_id = ${access.tenantId}
        and status not in ('approved', 'rejected', 'cancelled')
        and starts_on <= (date_trunc('month', ${`${run.period}-01`}::date) + interval '1 month - 1 day')::date
        and ends_on >= date_trunc('month', ${`${run.period}-01`}::date)::date
    `,
  ]);
  const members = ((memberRows as Array<{ total: number }>)[0]?.total ?? 0);
  const anomalyAgg = (anomalyRows as Array<{ total: number; open: number; critical_open: number }>)[0] ?? { total: 0, open: 0, critical_open: 0 };
  const inputs = ((inputRows as Array<{ total: number }>)[0]?.total ?? 0);
  const approvals = ((approvalRows as Array<{ total: number }>)[0]?.total ?? 0);
  const payslips = ((payslipRows as Array<{ total: number }>)[0]?.total ?? 0);
  const auditTrail = (auditRows as Array<{ action: string; reason: string | null; created_at: string | null }>).map((row) => ({
    action: row.action,
    reason: row.reason,
    createdAt: row.created_at,
  }));
  const attendanceAgg = (attendanceRows as Array<{ total: number; unlocked: number }>)[0] ?? { total: 0, unlocked: 0 };
  // A period with no attendance at all is not "locked"; it has nothing to lock yet.
  const attendanceLocked = Number(attendanceAgg.total ?? 0) > 0 && Number(attendanceAgg.unlocked ?? 0) === 0;
  // Unlike attendance, a period with no leave in it *is* settled: there is nothing
  // outstanding to change. Attendance needs days to have been processed before it can be
  // called locked; leave needs only that nothing is still waiting on a decision.
  const leaveLocked = Number((leaveRows as Array<{ open: number }>)[0]?.open ?? 0) === 0;
  let unmapped: number | null = null;
  try {
    unmapped = (await unmappedComponents(access, { runId })).items.length;
  } catch {
    // A payroll reader without `payroll.accounting.read` sees "unknown", not a cleared gate.
    unmapped = null;
  }
  const timeline = deriveTimeline({
    status: run.status,
    inputsExist: inputs > 0,
    anomaliesOpen: Number(anomalyAgg.open ?? 0),
    anomaliesTotal: Number(anomalyAgg.total ?? 0),
    approvalsExist: approvals > 0,
    payslipsExist: payslips > 0,
  });
  return {
    run,
    displayCode: displayRunCode(run.period, run.id),
    periodLabel: formatPeriodLabel(run.period),
    scopeLabel: scopeLabel(run.scope),
    displayStatus: displayRunStatus(run.status),
    timeline,
    header: toRunHeader(run, (entityRows as Array<{ legal_entity_id: string }>)[0]?.legal_entity_id ?? null),
    counts: {
      members,
      anomaliesOpen: Number(anomalyAgg.open ?? 0),
      anomaliesTotal: Number(anomalyAgg.total ?? 0),
      inputs,
      approvals,
      payslips,
      criticalFlagsOpen: Number(anomalyAgg.critical_open ?? 0),
    },
    gates: { attendanceLocked, leaveLocked, unmappedComponents: unmapped },
    auditTrail,
  };
}

export async function getPayslip(access: Access, payslipId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.attributes, e.employee_id, r.period, r.scope
      from payslips p
      join payroll_run_employees e on e.id = p.payroll_run_employee_id
      join payroll_runs r on r.id = e.payroll_run_id
      where p.tenant_id = ${access.tenantId} and p.id = ${payslipId} limit 1
    `,
  ]);
  const slip = (rows as Array<{ id: string; attributes: unknown; employee_id: string; period: string; scope: string }>)[0];
  if (!slip) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [lineRows] = await tenantTx(access, [
    sqlClient`
      select (attributes->>'code') as code, (attributes->>'kind') as kind, (attributes->>'amount_minor')::bigint as amount
      from payroll_lines where tenant_id = ${access.tenantId} and payroll_run_employee_id = (select payroll_run_employee_id from payslips where id = ${payslipId} and tenant_id = ${access.tenantId})
      order by created_at
    `,
  ]);
  return { ...slip, lines: lineRows };
}

export async function listAnomalies(access: Access, runId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, rule_code, severity, facts, status, resolution from payroll_anomalies where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
  ]);
  return rows;
}

export type FindingDisplayStatus = "OPEN" | "ASSIGNED" | "RESOLVED" | "WAIVED" | "ESCALATED";

/** Screenshot vocabulary for a finding: open → OPEN, acknowledged → ASSIGNED, resolved → RESOLVED, overridden → WAIVED. */
export function findingDisplayStatus(status: string): FindingDisplayStatus {
  const key = status.trim().toLowerCase();
  if (key === "acknowledged") return "ASSIGNED";
  if (key === "resolved") return "RESOLVED";
  if (key === "overridden") return "WAIVED";
  if (key === "escalated") return "ESCALATED";
  return "OPEN";
}

export type FindingTimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

/** Derive the 4-step SCR-051 finding timeline (Open → Assigned → Resolved / Waived) from persisted status. */
export function findingTimeline(status: string): FindingTimelineStep[] {
  const key = status.trim().toLowerCase();
  const resolved = key === "resolved";
  const waived = key === "overridden";
  // An escalated finding has an owner but no outcome yet: it sits at the same step as an assigned one.
  const assigned = key === "acknowledged" || key === "escalated" || resolved || waived;
  const terminalLabel = waived ? "Waived" : "Resolved";
  const steps: FindingTimelineStep[] = [
    { key: "open", label: "Open", state: "done" },
    { key: "assigned", label: "Assigned", state: assigned ? "done" : "current" },
    { key: "terminal", label: terminalLabel, state: resolved || waived ? "done" : assigned ? "current" : "todo" },
  ];
  return steps;
}

export const logFindingSchema = z.object({
  payrollRunId: z.string().uuid(),
  employeeId: z.string().uuid(),
  ruleCode: z.string().trim().min(1).max(60),
  // FRM-PAY-04 "Severity" (PL_SEVERITY). `warning` is the mid-band the queue previously called `medium`.
  severity: z.enum(picklistValues("PL_SEVERITY")).default("warning"),
  note: z.string().trim().max(200).optional(),
  /** FRM-PAY-04 "Financial impact" - optional, in minor units like every other money field. */
  impactAmountMinor: z.number().int().optional(),
  /** FRM-PAY-04 "Agent-drafted resolution": a draft for the reviewer, never applied automatically. */
  suggestedResolution: z.string().trim().max(400).optional(),
});

/** Log a manual pre-payroll audit finding against a mutable run. No DB change: uses payroll_anomalies. */
export async function logFinding(access: Access, input: z.infer<typeof logFindingSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRun(access, input.payrollRunId);
  assertMutable(run);
  const [empRows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and id = ${input.employeeId} limit 1`,
  ]);
  if ((empRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The employee was not found in this tenant." });
  }
  const id = crypto.randomUUID();
  const facts = {
    manual: true,
    note: input.note ?? null,
    impact_amount_minor: input.impactAmountMinor ?? null,
    suggested_resolution: input.suggestedResolution ?? null,
  };
  await tenantTx(access, [
    sqlClient`
      insert into payroll_anomalies (id, tenant_id, payroll_run_id, employee_id, rule_code, severity, facts, status)
      values (${id}, ${access.tenantId}, ${input.payrollRunId}, ${input.employeeId}, ${input.ruleCode}, ${input.severity}, ${JSON.stringify(facts)}::jsonb, 'open')
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.anomaly_log', 'payroll_anomaly', ${id}, ${input.note ?? "Manual audit finding logged"},
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "open" };
}

export type ScopeFinding = {
  id: string;
  payrollRunId: string;
  employeeId: string;
  ruleCode: string;
  severity: string;
  status: string;
  resolution: string | null;
  createdAt: string | null;
  period: string;
  scope: string;
  runStatus: string;
  employeeCount: number | null;
  firstName: string | null;
  lastName: string | null;
  employeeCode: string | null;
  entityCode: string | null;
  /** FRM-PAY-04 "Check code / description" - the text stored with the finding, not a second column. */
  description: string | null;
  /** FRM-PAY-04 "Financial impact", minor units. Null when the raising rule knows no amount. */
  impactAmountMinor: number | null;
  /** FRM-PAY-04 "Agent-drafted resolution" - shown read-only; the reviewer still types their own. */
  suggestedResolution: string | null;
};

/** Raw DB shape (snake_case) returned by the finding joins. Never leak past the mapper below. */
type ScopeFindingRow = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  rule_code: string;
  severity: string;
  status: string;
  resolution: string | null;
  created_at: string | null;
  period: string;
  scope: string;
  run_status: string;
  employee_count: number | null;
  first_name: string | null;
  last_name: string | null;
  employee_code: string | null;
  entity_code: string | null;
  facts?: Record<string, unknown> | null;
};

/** Reads one `facts` key as a finite number of minor units; anything else reads as absent. */
function factsAmount(facts: Record<string, unknown> | null | undefined, key: string): number | null {
  const raw = facts?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Math.trunc(Number(raw));
  return null;
}

function factsText(facts: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = facts?.[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw : null;
}

/** Maps the snake_case join row to the camelCase API contract. Exported for regression tests. */
export function toScopeFinding(row: ScopeFindingRow): ScopeFinding {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    ruleCode: row.rule_code,
    severity: row.severity,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.created_at,
    period: row.period,
    scope: row.scope,
    runStatus: row.run_status,
    employeeCount: row.employee_count === null ? null : Number(row.employee_count),
    firstName: row.first_name,
    lastName: row.last_name,
    employeeCode: row.employee_code,
    entityCode: row.entity_code,
    description: factsText(row.facts, "note") ?? factsText(row.facts, "reason"),
    impactAmountMinor: factsAmount(row.facts, "impact_amount_minor"),
    suggestedResolution: factsText(row.facts, "suggested_resolution"),
  };
}

/** Cross-run finding queue for the audit scope, newest first. Read-only composition, no new tables. */
export async function listScopeFindings(
  access: Access,
  args: { status?: string | null; severity?: string | null; page: number; pageSize: number },
) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const statusFilter = args.status ?? null;
  const severityFilter = args.severity ?? null;
  const whereStatus = statusFilter ? sqlClient`and a.status = ${args.status}` : sqlClient``;
  const whereSeverity = severityFilter ? sqlClient`and a.severity = ${args.severity}` : sqlClient``;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from payroll_anomalies a where a.tenant_id = ${access.tenantId} ${whereStatus} ${whereSeverity}`,
    sqlClient`
      select a.id, a.payroll_run_id, a.employee_id, a.rule_code, a.severity, a.status, a.resolution,
             a.facts, a.created_at, r.period, r.scope, r.status as run_status, r.employee_count,
             e.first_name, e.last_name, e.employee_code, le.code as entity_code
      from payroll_anomalies a
      join payroll_runs r on r.id = a.payroll_run_id and r.tenant_id = ${access.tenantId}
      left join employees e on e.id = a.employee_id and e.tenant_id = ${access.tenantId}
      left join pay_groups g on g.id = r.pay_group_id and g.tenant_id = ${access.tenantId}
      left join legal_entities le on le.id = g.legal_entity_id and le.tenant_id = ${access.tenantId}
      where a.tenant_id = ${access.tenantId} ${whereStatus} ${whereSeverity}
      order by a.created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: (rows as ScopeFindingRow[]).map(toScopeFinding), total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export type FindingDetail = {
  finding: ScopeFinding;
  displayStatus: FindingDisplayStatus;
  timeline: FindingTimelineStep[];
  runDisplayCode: string;
  runPeriodLabel: string;
  runScopeLabel: string;
  runDisplayStatus: "DRAFT" | "PRE_AUDIT" | "CLOSED";
  /**
   * FRM-PAY-04 "Affected employees". A Nucleus finding is raised per employee, so the workbook's
   * flag-level count is the number of findings the same check raised on the same run - derived,
   * never stored, so it cannot drift from the rows it counts.
   */
  affectedCount: number;
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

/** Finding detail: anomaly + owning run context + audit trail. No writes. */
export async function getFinding(access: Access, anomalyId: string): Promise<FindingDetail> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows, auditRows] = await tenantTx(access, [
    sqlClient`
      select a.id, a.payroll_run_id, a.employee_id, a.rule_code, a.severity, a.status, a.resolution,
             a.facts, a.created_at, r.period, r.scope, r.status as run_status, r.employee_count,
             e.first_name, e.last_name, e.employee_code, le.code as entity_code
      from payroll_anomalies a
      join payroll_runs r on r.id = a.payroll_run_id and r.tenant_id = ${access.tenantId}
      left join employees e on e.id = a.employee_id and e.tenant_id = ${access.tenantId}
      left join pay_groups g on g.id = r.pay_group_id and g.tenant_id = ${access.tenantId}
      left join legal_entities le on le.id = g.legal_entity_id and le.tenant_id = ${access.tenantId}
      where a.tenant_id = ${access.tenantId} and a.id = ${anomalyId} limit 1
    `,
    sqlClient`select action, reason, created_at from audit_events where tenant_id = ${access.tenantId} and entity_type = 'payroll_anomaly' and entity_id = ${anomalyId} order by created_at desc limit 8`,
  ]);
  const row = (rows as ScopeFindingRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const finding = toScopeFinding(row);
  const [affectedRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as affected from payroll_anomalies
      where tenant_id = ${access.tenantId} and payroll_run_id = ${finding.payrollRunId} and rule_code = ${finding.ruleCode}
    `,
  ]);
  return {
    finding,
    affectedCount: Number((affectedRows as Array<{ affected: number }>)[0]?.affected ?? 1),
    displayStatus: findingDisplayStatus(finding.status),
    timeline: findingTimeline(finding.status),
    runDisplayCode: displayRunCode(finding.period, finding.payrollRunId),
    runPeriodLabel: formatPeriodLabel(finding.period),
    runScopeLabel: scopeLabel(finding.scope),
    runDisplayStatus: displayRunStatus(finding.runStatus),
    auditTrail: (auditRows as Array<{ action: string; reason: string | null; created_at: string | null }>).map((row) => ({
      action: row.action,
      reason: row.reason,
      createdAt: row.created_at,
    })),
  };
}

/** Command-centre lookup that runs in parallel with the payroll summary. */
export async function listLatestRunAnomalies(access: Access) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, rule_code, severity, facts, status, resolution
      from payroll_anomalies
      where tenant_id = ${access.tenantId}
        and payroll_run_id = (
          select id from payroll_runs
          where tenant_id = ${access.tenantId}
          order by created_at desc limit 1
        )
      order by created_at
      limit 20
    `,
  ]);
  return rows;
}

/**
 * FRM-PAY-04 "Disposition" (PL_FLAG_DISPOSITION) plus Nucleus's own `assign` step, which the
 * workbook does not model but the queue needs: a finding gets an owner before it is closed.
 */
export const ANOMALY_DISPOSITIONS = [...picklistValues("PL_FLAG_DISPOSITION"), "assign"] as const;

/** The status each disposition leaves on the row. `escalate` keeps the finding open under a new owner. */
const DISPOSITION_STATUS: Record<(typeof ANOMALY_DISPOSITIONS)[number], string> = {
  resolve: "resolved",
  waive: "overridden",
  escalate: "escalated",
  assign: "acknowledged",
};

/** The workbook's minimum length for a waiver reason. Waived critical flags are named on the approval record. */
export const WAIVER_REASON_MIN_LENGTH = 20;

export const resolveAnomalySchema = z
  .object({
    disposition: z.enum(ANOMALY_DISPOSITIONS),
    resolution: z.string().trim().min(1).max(500),
  })
  .superRefine((value, ctx) => {
    // A waiver overrides a check the run would otherwise have failed, so the workbook demands a
    // reason long enough to stand on its own in the approval record.
    if (value.disposition === "waive" && value.resolution.length < WAIVER_REASON_MIN_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resolution"],
        message: `A waiver reason must be at least ${WAIVER_REASON_MIN_LENGTH} characters.`,
      });
    }
  });

export async function resolveAnomaly(access: Access, anomalyId: string, input: z.infer<typeof resolveAnomalySchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status from payroll_anomalies where tenant_id = ${access.tenantId} and id = ${anomalyId} limit 1`,
  ]);
  const anomaly = (rows as Array<{ id: string; status: string }>)[0];
  if (!anomaly) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // `escalate` and `assign` leave the finding open, so both an open and an escalated row stay actionable.
  if (anomaly.status !== "open" && anomaly.status !== "escalated" && anomaly.status !== "acknowledged") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The anomaly is already resolved." });
  }
  const status = DISPOSITION_STATUS[input.disposition];
  await tenantTx(access, [
    sqlClient`update payroll_anomalies set status = ${status}, resolution = ${input.resolution}, updated_at = now() where id = ${anomalyId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`payroll.anomaly_${status}`}, 'payroll_anomaly', ${anomalyId}, ${input.resolution}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: anomalyId, status, disposition: input.disposition };
}

export async function simulateWageBase(access: Access, args: { basicMinor: number; dearnessMinor: number; scenario: string }, requestId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  if (args.basicMinor < 0 || args.dearnessMinor < 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Wage inputs must be non-negative." });
  }
  const [packRows] = await tenantTx(access, [
    sqlClient`select id from rule_pack_versions where attributes->>'code' = 'in-pay/v1' limit 1`,
  ]);
  let packId = (packRows as Array<{ id: string }>)[0]?.id;
  const now = new Date();
  const currentPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const scaffold = await ensurePayrollScaffold(access, currentPeriod);
  if (!packId) packId = scaffold.packId;
  const result = args.basicMinor + args.dearnessMinor;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into wage_base_simulations (id, tenant_id, requested_by_membership_id, rule_pack_version_id, salary_structure_id, attributes)
      values (${id}, ${access.tenantId}, ${access.context.membershipId}, ${packId}, ${scaffold.structureId},
        ${JSON.stringify({ scenario: args.scenario, inputs: { basic_minor: args.basicMinor, dearness_minor: args.dearnessMinor }, result_minor: result, posted: false, formula: "wage-base/v1" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.wage_simulate', 'wage_base_simulation', ${id}, 'Wage-base simulation (non-posting)', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, resultMinor: result, posted: false };
}

export const INPUT_COMPONENTS = ["tds", "bonus", "arrear", "advance_paid", "advance_recovery", "overtime_extra", "other"] as const;

export const upsertInputSchema = z.object({
  employeeId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  component: z.enum(INPUT_COMPONENTS),
  amountMinor: z.number().int(),
  note: z.string().trim().max(500).optional(),
});

export async function upsertPayrollInput(access: Access, input: z.infer<typeof upsertInputSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const scaffold = await ensurePayrollScaffold(access, input.period);
  const kind = ["advance_paid", "bonus", "arrear", "overtime_extra"].includes(input.component) ? "earning" : "deduction";
  const componentId = await ensureComponent(access, input.component, kind);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, attributes from payroll_inputs
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId}
        and pay_period_id = ${scaffold.payPeriodId} and pay_component_id = ${componentId} limit 1
    `,
  ]);
  const existing = (rows as Array<{ id: string; attributes: { amount_minor: number } }>)[0];
  if (existing) {
    const before = Number(existing.attributes.amount_minor ?? 0);
    await tenantTx(access, [
      sqlClient`
        update payroll_inputs set attributes = attributes || ${JSON.stringify({ amount_minor: input.amountMinor, component: input.component, note: input.note ?? null })}::jsonb
        where id = ${existing.id} and tenant_id = ${access.tenantId}
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'payroll.input_update', 'payroll_input', ${existing.id}, 'Payroll input corrected',
          ${JSON.stringify({ before_minor: before, after_minor: input.amountMinor })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
    return { id: existing.id, updated: true };
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${componentId}, ${scaffold.payPeriodId},
        ${JSON.stringify({ amount_minor: input.amountMinor, component: input.component, note: input.note ?? null })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.input_create', 'payroll_input', ${id}, 'Payroll input recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, updated: false };
}

export async function listPayrollInputs(access: Access, args: { employeeId?: string | null; period?: string | null }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const employeeFilter = args.employeeId ?? null;
  const periodFilter = args.period ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select i.id, i.employee_id, (i.attributes->>'component') as component,
             (i.attributes->>'amount_minor')::bigint as amount_minor, p.attributes->>'code' as period
      from payroll_inputs i join pay_periods p on p.id = i.pay_period_id
      where i.tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or i.employee_id = ${args.employeeId})
        and (${periodFilter}::text is null or p.attributes->>'code' = ${args.period})
      order by i.created_at desc limit 200
    `,
  ]);
  return rows;
}

export const correctRunSchema = z.object({
  // FRM-PAY-03 "Action reason": mandatory on a rollback or waiver, minimum 15 characters. A
  // correction is the only run action that reverses posted figures, so it carries that minimum.
  reason: z.string().trim().min(ACTION_REASON_MIN_LENGTH).max(500),
  adjustments: z.array(z.object({
    employeeId: z.string().uuid(),
    component: z.string().trim().min(1).max(60),
    amountMinor: z.number().int().refine((value) => value !== 0, "Adjustments must be non-zero."),
    reversesLineId: z.string().uuid().optional(),
  })).min(1).max(200),
});

export async function correctRun(access: Access, runId: string, input: z.infer<typeof correctRunSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const source = await loadRun(access, runId);
  if (source.status !== "finalized") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Corrections apply only to finalized runs; the source run is untouched." });
  }
  const correctionId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_runs (id, tenant_id, period, scope, status, pay_group_id, pay_period_id, rule_pack_version_id)
      values (${correctionId}, ${access.tenantId}, ${source.period}, 'correction', 'draft', ${source.pay_group_id}, ${source.pay_period_id}, ${source.rule_pack_version_id})
    `,
  ]);
  let gross = 0, deductions = 0, calculated = 0;
  for (const adjustment of input.adjustments) {
    const [assignmentRows] = await tenantTx(access, [
      sqlClient`select id from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${adjustment.employeeId} order by created_at desc limit 1`,
    ]);
    const assignmentId = (assignmentRows as Array<{ id: string }>)[0]?.id;
    if (!assignmentId) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Correction needs an existing salary assignment per employee." });
    }
    if (adjustment.reversesLineId) {
      const [lineRows] = await tenantTx(access, [
        sqlClient`
          select l.id from payroll_lines l join payroll_run_employees e on e.id = l.payroll_run_employee_id
          where l.tenant_id = ${access.tenantId} and l.id = ${adjustment.reversesLineId} and e.payroll_run_id = ${runId} limit 1
        `,
      ]);
      if ((lineRows as unknown[]).length === 0) {
        throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Reversed lines must belong to the corrected run." });
      }
    }
    const kind = adjustment.amountMinor > 0 ? "earning" : "deduction";
    const magnitude = Math.abs(adjustment.amountMinor);
    const componentId = await ensureComponent(access, adjustment.component, kind === "earning" ? "earning" : "deduction");
    const runEmployeeId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into payroll_run_employees (id, tenant_id, employee_id, payroll_run_id, salary_assignment_id, attributes)
        values (${runEmployeeId}, ${access.tenantId}, ${adjustment.employeeId}, ${correctionId}, ${assignmentId},
          ${JSON.stringify({ gross_minor: kind === "earning" ? magnitude : 0, deductions_minor: kind === "deduction" ? magnitude : 0, net_minor: adjustment.amountMinor, rule: "in-pay/v1", correction: true })}::jsonb)
      `,
      sqlClient`
        insert into payroll_lines (tenant_id, pay_component_id, payroll_run_employee_id, reverses_line_id, attributes)
        values (${access.tenantId}, ${componentId}, ${runEmployeeId}, ${adjustment.reversesLineId ?? null},
          ${JSON.stringify({ code: adjustment.component, kind, amount_minor: magnitude, sign: adjustment.amountMinor > 0 ? 1 : -1 })}::jsonb)
      `,
    ]);
    if (kind === "earning") gross += magnitude; else deductions += magnitude;
    calculated += 1;
  }
  const net = gross - deductions;
  await tenantTx(access, [
    sqlClient`update payroll_runs set status = 'calculated', employee_count = ${calculated}, gross_minor = ${gross}, deductions_minor = ${deductions}, net_minor = ${net}, updated_at = now() where id = ${correctionId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.correct', 'payroll_run', ${correctionId}, ${input.reason},
        ${JSON.stringify({ corrects_run_id: runId, adjustments: input.adjustments.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.correction_ready', 'payroll_run', ${correctionId}, ${JSON.stringify({ corrects_run_id: runId })}::jsonb)
    `,
  ]);
  return { correctionId, calculated, gross, deductions, net };
}
