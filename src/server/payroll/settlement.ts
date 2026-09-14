import "server-only";

import { sqlClient } from "@/lib/db";
import { annualLeaveCredit } from "@/lib/hr-rules";
import { picklistValues } from "@/lib/picklists";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";
import {
  listComponents,
  listStructureComponents,
  resolveStructure,
  STANDARD_COMPONENTS_BY_CODE,
  type PayComponentDefinition,
  type ProrationBasis,
} from "./components";
import { DEFAULT_RULE_PACK_CODE, rulePack, type RulePack } from "./rule-pack";

/**
 * Full and final settlement working (SCR-056).
 *
 * This module computes a PROPOSAL, not a settlement. The settlement itself is the
 * `settlements` operational resource (`hrms_operation_records`): its validation
 * derives lines/net/outcome, and `operational-service.finalize` writes the canonical
 * `full_final_settlements` row once every gate passes. Nothing here writes.
 *
 * What it adds is the arithmetic a payroll officer would otherwise do by hand, with
 * the BASIS of every head stated, so a figure can be reviewed before it is proposed.
 * Where the basis is not configured the figure is returned as INDETERMINATE with the
 * missing rule named - never as a zero and never as a guessed rate. Gratuity is the
 * clearest case: rule pack `in-pay/v1` supplies none of its five inputs, so gratuity
 * cannot be computed at all and the officer keys a reviewed figure into
 * `gratuityMinor` instead.
 *
 * The one bug this deliberately does not reproduce is the demo simplification in
 * `lifecycle/service.settleFullAndFinal`, which prorated the final salary against
 * TODAY. Every function here takes the last working date as an argument; none reads
 * the clock.
 */

export const SETTLEMENT_PERMISSION = "payroll.settlement";

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Heads exactly as the `settlements` resource names them, so a figure maps to a field. */
/**
 * FRM-PAY-08 earning heads. `noticePayableMinor` is notice pay the EMPLOYER owes when it waives
 * the leaver's notice - the opposite direction to `noticeRecoveryMinor`, which is what the leaver
 * owes for notice not served. The two never net against each other and are never the same figure.
 */
export const EARNING_HEADS = ["salaryPayableMinor", "leaveEncashmentMinor", "gratuityMinor", "bonusPayableMinor", "noticePayableMinor", "otherEarningsMinor"] as const;
export const RECOVERY_HEADS = ["loanRecoveryMinor", "noticeRecoveryMinor", "advanceRecoveryMinor", "assetRecoveryMinor", "otherRecoveryMinor", "taxDeductionMinor"] as const;

export type SettlementHead = (typeof EARNING_HEADS)[number] | (typeof RECOVERY_HEADS)[number];

export type SettlementFigure = {
  head: SettlementHead;
  label: string;
  direction: "earning" | "recovery";
  /** `null` means indeterminate: the officer must key a reviewed figure. */
  amountMinor: number | null;
  /** How the figure was arrived at, in the words a reviewer needs. */
  basis: string;
  indeterminate: boolean;
  /** Rules or configuration that must be supplied before this head can be computed. */
  blockedBy: string[];
  /** The inputs that ARE known, so a manual figure can be keyed from them. */
  inputs: Record<string, string | number | null>;
};

export type SettlementTotals = {
  earningsMinor: number;
  recoveriesMinor: number;
  netPayableMinor: number;
  settlementOutcome: "payable" | "recovery_pending";
  recoverableMinor: number;
  indeterminateHeads: SettlementHead[];
};

export type FinalizeGate = { key: string; name: string; pass: boolean; blocking: string };

function parseDate(value: string, field: string): number {
  if (!ISO_DATE.test(value)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Dates must be supplied as YYYY-MM-DD.", details: [{ field, issue: "Expected YYYY-MM-DD." }] });
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "That date does not exist.", details: [{ field, issue: "Not a calendar date." }] });
  }
  return parsed;
}

/** Whole days from `fromISO` to `toISO` counting both ends; negative when reversed. */
export function daysInclusive(fromISO: string, toISO: string): number {
  const from = parseDate(fromISO, "from");
  const to = parseDate(toISO, "to");
  return Math.round((to - from) / DAY_MS) + 1;
}

export function periodOf(dateISO: string): string {
  parseDate(dateISO, "date");
  return dateISO.slice(0, 7);
}

export function periodBounds(period: string): { period: string; startDate: string; endDate: string; days: number } {
  if (!PERIOD.test(period)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A period must be supplied as YYYY-MM.", details: [{ field: "period", issue: "Expected YYYY-MM." }] });
  }
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A period must be supplied as YYYY-MM.", details: [{ field: "period", issue: "Month must be 01-12." }] });
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { period, startDate: `${period}-01`, endDate: `${period}-${String(days).padStart(2, "0")}`, days };
}

/** Completed years of service between two dates, on the calendar anniversary. */
export function completedServiceYears(joiningDate: string, lastWorkingDate: string): number {
  const join = new Date(parseDate(joiningDate, "joiningDate"));
  const exit = new Date(parseDate(lastWorkingDate, "lastWorkingDate"));
  let years = exit.getUTCFullYear() - join.getUTCFullYear();
  const beforeAnniversary =
    exit.getUTCMonth() < join.getUTCMonth() || (exit.getUTCMonth() === join.getUTCMonth() && exit.getUTCDate() < join.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

export function serviceMonths(joiningDate: string, lastWorkingDate: string): number {
  const join = new Date(parseDate(joiningDate, "joiningDate"));
  const exit = new Date(parseDate(lastWorkingDate, "lastWorkingDate"));
  const months = (exit.getUTCFullYear() - join.getUTCFullYear()) * 12 + (exit.getUTCMonth() - join.getUTCMonth());
  return Math.max(0, exit.getUTCDate() < join.getUTCDate() ? months - 1 : months);
}

/**
 * Salary for the final period, prorated to the LAST WORKING DATE.
 *
 * Pure and clock-free by construction: the served days come from the period bounds
 * and the last working date only. A component whose proration basis is `working_days`
 * (or is not recorded at all) cannot be prorated here, because no working-day calendar
 * is resolved for a settlement, so the whole head is returned indeterminate rather
 * than silently short-paying the leaver.
 */
export function finalPeriodSalary(input: {
  period: string;
  lastWorkingDate: string;
  monthlyComponentsMinor: Record<string, number>;
  prorationBasisByComponent: Record<string, ProrationBasis | null>;
}): SettlementFigure {
  const bounds = periodBounds(input.period);
  const rawServed = daysInclusive(bounds.startDate, input.lastWorkingDate);
  const servedDays = Math.min(Math.max(rawServed, 0), bounds.days);
  const codes = Object.keys(input.monthlyComponentsMinor).sort();
  const blockedBy: string[] = [];
  const bases = new Set<string>();
  let total = 0;
  for (const code of codes) {
    const monthly = input.monthlyComponentsMinor[code] ?? 0;
    const basis = input.prorationBasisByComponent[code] ?? null;
    if (basis === null) {
      blockedBy.push(`component.${code}.prorationBasis`);
      continue;
    }
    if (basis === "working_days") {
      blockedBy.push(`component.${code}.workingDayCalendar`);
      continue;
    }
    bases.add(basis);
    total += Math.round((monthly * servedDays) / bounds.days);
  }
  const basisLabel = [...bases].sort().join(" and ") || "none";
  const indeterminate = blockedBy.length > 0 || codes.length === 0;
  const monthlyTotal = codes.reduce((sum, code) => sum + (input.monthlyComponentsMinor[code] ?? 0), 0);
  return {
    head: "salaryPayableMinor",
    label: "Salary for the final period",
    direction: "earning",
    amountMinor: indeterminate ? null : total,
    basis: codes.length === 0
      ? "No monthly salary components are resolved for this employee, so the final period cannot be prorated."
      : `${servedDays} of ${bounds.days} days of ${bounds.period}, counted to the last working day ${input.lastWorkingDate} (proration basis: ${basisLabel}). The current date is not used. Unpaid absence inside the final period is not deducted here.`,
    indeterminate,
    blockedBy,
    inputs: {
      period: bounds.period,
      periodDays: bounds.days,
      servedDays,
      lastWorkingDate: input.lastWorkingDate,
      monthlyGrossMinor: monthlyTotal,
      computableSubtotalMinor: total,
      components: codes.join(", "),
    },
  };
}

/** The five gratuity rules the pack must supply before gratuity is computable at all. */
export const GRATUITY_RULES = ["gratuity.daysPerYear", "gratuity.monthDays", "gratuity.qualifyingYears", "gratuity.wageBase", "gratuity.exemptionLimitMinor"] as const;

export function missingGratuityRules(pack: RulePack): string[] {
  const values: Record<(typeof GRATUITY_RULES)[number], unknown> = {
    "gratuity.daysPerYear": pack.gratuity.daysPerYear,
    "gratuity.monthDays": pack.gratuity.monthDays,
    "gratuity.qualifyingYears": pack.gratuity.qualifyingYears,
    "gratuity.wageBase": pack.gratuity.wageBase,
    "gratuity.exemptionLimitMinor": pack.gratuity.exemptionLimitMinor,
  };
  return GRATUITY_RULES.filter((rule) => values[rule] === null || values[rule] === undefined);
}

/**
 * Gratuity is NOT computable against `in-pay/v1`: days per year, the notional month,
 * the qualifying period, the wage base and the exemption limit are all declared but
 * unsupplied. Returning `null` with those rules named is the whole point - 15/26 and a
 * five-year qualifying period are regulated policy, not defaults this code may assume.
 * The known inputs come back so the officer can key a reviewed figure.
 */
export function gratuityWorking(input: {
  pack: RulePack;
  joiningDate: string;
  lastWorkingDate: string;
  wageBaseCandidatesMinor: Record<string, number>;
}): SettlementFigure {
  const blockedBy = missingGratuityRules(input.pack);
  const years = completedServiceYears(input.joiningDate, input.lastWorkingDate);
  const months = serviceMonths(input.joiningDate, input.lastWorkingDate);
  const candidates = Object.entries(input.wageBaseCandidatesMinor)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join(", ");
  const inputs: Record<string, string | number | null> = {
    rulePack: input.pack.code,
    joiningDate: input.joiningDate,
    lastWorkingDate: input.lastWorkingDate,
    completedServiceYears: years,
    serviceMonths: months,
    monthlyWageBaseCandidates: candidates || "none resolved",
  };
  if (blockedBy.length > 0) {
    return {
      head: "gratuityMinor",
      label: "Gratuity",
      direction: "earning",
      amountMinor: null,
      basis: `Gratuity cannot be computed: rule pack "${input.pack.code}" does not supply ${blockedBy.join(", ")}. Service and wage-base inputs are shown so an approved figure can be keyed and reviewed.`,
      indeterminate: true,
      blockedBy,
      inputs,
    };
  }
  const daysPerYear = input.pack.gratuity.daysPerYear as number;
  const monthDays = input.pack.gratuity.monthDays as number;
  const qualifyingYears = input.pack.gratuity.qualifyingYears as number;
  const wageBase = input.pack.gratuity.wageBase as string[];
  const limit = input.pack.gratuity.exemptionLimitMinor as number;
  const wage = wageBase.reduce((sum, code) => sum + (input.wageBaseCandidatesMinor[code] ?? 0), 0);
  const qualified = years >= qualifyingYears;
  const amount = qualified ? Math.min(Math.round((wage / monthDays) * daysPerYear * years), limit) : 0;
  return {
    head: "gratuityMinor",
    label: "Gratuity",
    direction: "earning",
    amountMinor: amount,
    basis: qualified
      ? `${daysPerYear}/${monthDays} of the ${wageBase.join(" + ")} wage for ${years} completed years, capped at the pack exemption limit.`
      : `${years} completed years is below the qualifying period of ${qualifyingYears} years in rule pack "${input.pack.code}".`,
    indeterminate: false,
    blockedBy: [],
    inputs: { ...inputs, wageBaseMinor: wage, qualifyingYears },
  };
}

export const ENCASHMENT_BASES = ["basic", "basic_plus_da", "gross"] as const;
export type EncashmentBasis = (typeof ENCASHMENT_BASES)[number];

/**
 * Leave encashment. PL_ENCASHMENT_BASIS (Basic, Basic + DA or Gross) and the monthly
 * divisor that turns the chosen wage into a day rate are CONFIGURATION. Nothing in the
 * tenant records them today, so the balance and all three candidate wages are returned
 * and the figure is marked indeterminate - picking one of the three here would silently
 * change what a leaver is paid.
 */
export function leaveEncashmentWorking(input: {
  balanceDays: number;
  basis: EncashmentBasis | null;
  monthDaysDivisor: number | null;
  monthlyWagesMinor: Record<EncashmentBasis, number>;
  balanceSource: string;
}): SettlementFigure {
  const blockedBy: string[] = [];
  if (input.basis === null) blockedBy.push("PL_ENCASHMENT_BASIS");
  if (input.monthDaysDivisor === null) blockedBy.push("PL_ENCASHMENT_MONTH_DAYS");
  const days = Math.max(0, input.balanceDays);
  const inputs: Record<string, string | number | null> = {
    encashableDays: days,
    balanceSource: input.balanceSource,
    basic: input.monthlyWagesMinor.basic,
    basic_plus_da: input.monthlyWagesMinor.basic_plus_da,
    gross: input.monthlyWagesMinor.gross,
  };
  if (blockedBy.length > 0) {
    return {
      head: "leaveEncashmentMinor",
      label: "Leave encashment",
      direction: "earning",
      amountMinor: null,
      basis: `${days} encashable day${days === 1 ? "" : "s"} (${input.balanceSource}), but the encashment rate is not configured: ${blockedBy.join(", ")}. The three candidate monthly wages are shown; one of them must be selected as policy before a figure can be proposed.`,
      indeterminate: true,
      blockedBy,
      inputs,
    };
  }
  const divisor = input.monthDaysDivisor as number;
  const wage = input.monthlyWagesMinor[input.basis as EncashmentBasis];
  const perDay = Math.round(wage / divisor);
  return {
    head: "leaveEncashmentMinor",
    label: "Leave encashment",
    direction: "earning",
    amountMinor: Math.round(perDay * days),
    basis: `${days} day${days === 1 ? "" : "s"} (${input.balanceSource}) at ${input.basis} / ${divisor} days.`,
    indeterminate: false,
    blockedBy: [],
    inputs: { ...inputs, perDayMinor: perDay, basis: input.basis, monthDaysDivisor: divisor },
  };
}

/**
 * Notice shortfall recovery. The notice period an exit requires is not recorded on the
 * exit record anywhere in this system, so the usual answer is "not recorded" rather
 * than an assumed 30, 60 or 90 days.
 */
export function noticeShortfallWorking(input: {
  noticeRequiredDays: number | null;
  noticeGivenDate: string | null;
  lastWorkingDate: string;
  perDayRecoveryMinor: number | null;
  perDayBasis: string;
}): SettlementFigure {
  const blockedBy: string[] = [];
  if (input.noticeRequiredDays === null) blockedBy.push("exit.noticePeriodDays");
  if (input.noticeGivenDate === null) blockedBy.push("exit.noticeDate");
  if (input.perDayRecoveryMinor === null) blockedBy.push("exit.noticeRecoveryWageBasis");
  const servedDays = input.noticeGivenDate === null ? null : Math.max(0, daysInclusive(input.noticeGivenDate, input.lastWorkingDate));
  const inputs: Record<string, string | number | null> = {
    noticeRequiredDays: input.noticeRequiredDays,
    noticeGivenDate: input.noticeGivenDate,
    lastWorkingDate: input.lastWorkingDate,
    noticeServedDays: servedDays,
    perDayRecoveryMinor: input.perDayRecoveryMinor,
    perDayBasis: input.perDayBasis,
  };
  if (blockedBy.length > 0) {
    return {
      head: "noticeRecoveryMinor",
      label: "Notice shortfall recovery",
      direction: "recovery",
      amountMinor: null,
      basis: `The notice shortfall cannot be computed: ${blockedBy.join(", ")} ${blockedBy.length === 1 ? "is" : "are"} not recorded on the exit record. No notice recovery is assumed.`,
      indeterminate: true,
      blockedBy,
      inputs,
    };
  }
  const required = input.noticeRequiredDays as number;
  const served = servedDays as number;
  const perDay = input.perDayRecoveryMinor as number;
  const shortfallDays = Math.max(0, required - served);
  return {
    head: "noticeRecoveryMinor",
    label: "Notice shortfall recovery",
    direction: "recovery",
    amountMinor: Math.round(shortfallDays * perDay),
    basis: shortfallDays === 0
      ? `Notice served in full: ${served} of ${required} days to the last working day ${input.lastWorkingDate}. Nothing to recover.`
      : `${shortfallDays} day${shortfallDays === 1 ? "" : "s"} short of the ${required}-day notice period (${served} served to ${input.lastWorkingDate}) at ${input.perDayBasis}.`,
    indeterminate: false,
    blockedBy: [],
    inputs: { ...inputs, shortfallDays },
  };
}

function plainFigure(args: {
  head: SettlementHead;
  label: string;
  direction: "earning" | "recovery";
  amountMinor: number | null;
  basis: string;
  blockedBy?: string[];
  inputs?: Record<string, string | number | null>;
}): SettlementFigure {
  return {
    head: args.head,
    label: args.label,
    direction: args.direction,
    amountMinor: args.amountMinor,
    basis: args.basis,
    indeterminate: args.amountMinor === null,
    blockedBy: args.blockedBy ?? [],
    inputs: args.inputs ?? {},
  };
}

/**
 * Totals over the figures, using the same head split and the same RL-341 treatment as
 * `operational-validation`: a negative net is a legitimate settlement outcome and is
 * routed to recovery, never rejected. An indeterminate head contributes nothing to the
 * provisional total and is listed so the net is never mistaken for final.
 */
export function settlementTotals(figures: SettlementFigure[]): SettlementTotals {
  const earningHeads = new Set<string>(EARNING_HEADS);
  let earningsMinor = 0;
  let recoveriesMinor = 0;
  const indeterminateHeads: SettlementHead[] = [];
  for (const figure of figures) {
    if (figure.amountMinor === null) {
      indeterminateHeads.push(figure.head);
      continue;
    }
    if (earningHeads.has(figure.head)) earningsMinor += figure.amountMinor;
    else recoveriesMinor += figure.amountMinor;
  }
  const netPayableMinor = earningsMinor - recoveriesMinor;
  return {
    earningsMinor,
    recoveriesMinor,
    netPayableMinor,
    settlementOutcome: netPayableMinor < 0 ? "recovery_pending" : "payable",
    recoverableMinor: netPayableMinor < 0 ? -netPayableMinor : 0,
    indeterminateHeads,
  };
}

/**
 * The finalize gates, in the same order and with the same conditions that
 * `operational-service.mutateOperationalRecord` enforces in SQL for
 * `settlements`/`finalize`. Kept as a pure function so the screen can show a leaver's
 * blockers before anyone presses the button and gets a bare 409.
 */
/**
 * FRM-PAY-08 "Clearance status" (PL_CLEARANCE_STATUS), derived from the clearance items rather
 * than stored: `blocked` is reserved for an item that is open AND blocking, so a settlement held
 * by a no-dues item reads differently from one merely still in progress.
 */
export function clearanceStatus(input: { total: number; open: number; blocking?: number }): (typeof CLEARANCE_STATUSES)[number] {
  if (input.total === 0) return "not_started";
  if ((input.blocking ?? 0) > 0) return "blocked";
  if (input.open > 0) return "in_progress";
  return "cleared";
}

export const CLEARANCE_STATUSES = picklistValues("PL_CLEARANCE_STATUS");

export function finalizeGates(input: {
  recordStatus: string;
  payrollRunStatus: string | null;
  exitCaseStatus: string | null;
  clearanceTotal: number;
  clearanceOpen: number;
  allocatedAssets: number;
  outstandingLoanMinor: number;
  loanRecoveryMinor: number;
}): FinalizeGate[] {
  return [
    {
      key: "approved",
      name: "Proposal approved",
      pass: input.recordStatus === "approved",
      blocking: input.recordStatus === "approved" ? "" : `The proposal is ${input.recordStatus}; finalize is only available from approved.`,
    },
    {
      key: "payroll_run",
      name: "Payroll run finalized",
      pass: input.payrollRunStatus === "finalized",
      blocking: input.payrollRunStatus === "finalized" ? "" : input.payrollRunStatus === null ? "The linked payroll run could not be read." : `The linked payroll run is ${input.payrollRunStatus}.`,
    },
    {
      key: "exit_case",
      name: "Exit case still open",
      pass: input.exitCaseStatus !== null && input.exitCaseStatus !== "settled",
      blocking: input.exitCaseStatus === null ? "The linked exit case could not be read." : input.exitCaseStatus === "settled" ? "The exit case is already settled." : "",
    },
    {
      key: "clearance",
      name: "No-dues cleared",
      pass: input.clearanceTotal > 0 && input.clearanceOpen === 0,
      blocking: input.clearanceTotal === 0 ? "The exit case has no clearance items; at least one is required." : input.clearanceOpen > 0 ? `${input.clearanceOpen} clearance item${input.clearanceOpen === 1 ? "" : "s"} still open.` : "",
    },
    {
      key: "assets",
      name: "Assets returned",
      pass: input.allocatedAssets === 0,
      blocking: input.allocatedAssets === 0 ? "" : `${input.allocatedAssets} asset${input.allocatedAssets === 1 ? " is" : "s are"} still allocated to this employee.`,
    },
    {
      key: "loans",
      name: "Loans recovered in full",
      pass: input.outstandingLoanMinor <= input.loanRecoveryMinor,
      blocking: input.outstandingLoanMinor <= input.loanRecoveryMinor ? "" : `Outstanding loans of ${input.outstandingLoanMinor} minor units exceed the ${input.loanRecoveryMinor} recorded on the proposal.`,
    },
  ];
}

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation_level: number;
  joining_date: string;
  basic_salary_minor: string | number | null;
  currency: string;
};

async function loadEmployee(access: Access, employeeId: string): Promise<EmployeeRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, designation_level,
             joining_date::text as joining_date, basic_salary_minor, currency
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
  ]);
  const row = (rows as EmployeeRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

/** Monthly per-component amounts from the employee's structure, or basic alone. */
async function monthlyComponents(access: Access, employee: EmployeeRow): Promise<{ amounts: Record<string, number>; source: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select salary_structure_id, (attributes->>'basic_minor')::bigint as basic_minor
      from employee_salary_assignments where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
      order by created_at desc limit 1
    `,
  ]);
  const assignment = (rows as Array<{ salary_structure_id: string | null; basic_minor: string | number | null }>)[0];
  const fallbackBasic = Number(employee.basic_salary_minor ?? 0);
  const basic = Number(assignment?.basic_minor ?? fallbackBasic) || fallbackBasic;
  if (!assignment?.salary_structure_id) {
    return { amounts: basic > 0 ? { basic } : {}, source: "employees.basic_salary_minor (no salary structure assignment on record)" };
  }
  const lines = await listStructureComponents(access, assignment.salary_structure_id);
  if (lines.length === 0) {
    return { amounts: basic > 0 ? { basic } : {}, source: "salary assignment basic (the assigned structure has no component lines)" };
  }
  return { amounts: resolveStructure(lines, basic), source: "employee salary assignment resolved against its salary structure" };
}

async function componentDefinitions(access: Access): Promise<Record<string, PayComponentDefinition>> {
  const components = await listComponents(access);
  const byCode: Record<string, PayComponentDefinition> = { ...STANDARD_COMPONENTS_BY_CODE };
  for (const component of components) byCode[component.code] = component;
  return byCode;
}

/** EL balance as at the last working day, mirroring the leave service's ledger maths. */
async function leaveBalanceDays(access: Access, employee: EmployeeRow, lastWorkingDate: string): Promise<{ days: number; source: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select attributes->>'leave_type' as leave_type, attributes->>'kind' as kind, (attributes->>'days')::float as days
      from leave_ledger_entries where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
    `,
  ]);
  let used = 0;
  for (const row of rows as Array<{ leave_type: string; kind: string; days: number }>) {
    if (row.leave_type !== "EL") continue;
    const days = Number(row.days) || 0;
    if (row.kind === "debit" || row.kind === "encash" || row.kind === "lapse") used += days;
    if (row.kind === "credit" || row.kind === "grant") used -= days;
  }
  const joining = new Date(`${employee.joining_date}T00:00:00Z`);
  const exit = new Date(`${lastWorkingDate}T00:00:00Z`);
  const credit = annualLeaveCredit({
    designationLevel: employee.designation_level >= 7 ? "AGM+" : "below-AGM",
    joinMonth: joining.getUTCMonth() + 1,
    joinDay: joining.getUTCDate(),
    completedSixMonths: exit.getTime() - joining.getTime() >= 6 * 30 * DAY_MS,
  });
  const accrued = credit.EL + (credit.monthlyEL > 0 ? credit.monthlyEL * exit.getUTCMonth() : 0);
  return { days: accrued - used, source: `earned-leave entitlement accrued to ${lastWorkingDate} less the leave ledger` };
}

export type SettlementWorking = {
  employee: { id: string; code: string; name: string; joiningDate: string; currency: string };
  period: string;
  periodSource: string;
  lastWorkingDate: string;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  rulePackCode: string;
  figures: SettlementFigure[];
  totals: SettlementTotals;
  /** Determinate heads only, shaped for the `settlements` create/edit payload. */
  proposal: Record<string, number>;
  blockedBy: string[];
};

/**
 * The whole working for one leaver. Read-only: it proposes, the operational resource
 * records, and `finalize` settles.
 */
export async function computeSettlementWorking(
  access: Access,
  input: { employeeId: string; lastWorkingDate: string; payrollRunId?: string | null },
): Promise<SettlementWorking> {
  operationalScope(access, SETTLEMENT_PERMISSION, "read");
  if (!UUID.test(input.employeeId)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employee reference is required.", details: [{ field: "employeeId", issue: "Expected a uuid." }] });
  }
  parseDate(input.lastWorkingDate, "lastWorkingDate");
  const payrollRunId = input.payrollRunId && UUID.test(input.payrollRunId) ? input.payrollRunId : null;

  const employee = await loadEmployee(access, input.employeeId);
  const [runRows, loanRows, advanceRows, assetRows] = await tenantTx(access, [
    sqlClient`select id, period, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${payrollRunId}::uuid limit 1`,
    sqlClient`
      select coalesce(sum((attributes->>'outstanding_minor')::bigint), 0)::bigint as outstanding, count(*)::int as loans
      from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employee.id} and attributes->>'status' = 'disbursed'
    `,
    sqlClient`
      select coalesce(sum((attributes->>'amount_minor')::bigint), 0)::bigint as outstanding, count(*)::int as advances
      from salary_advances where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
        and attributes->>'status' not in ('recovered', 'closed', 'rejected', 'cancelled')
    `,
    sqlClient`
      select coalesce(sum((data->>'recoveryAmountMinor')::bigint), 0)::bigint as recovery,
             count(*)::int as allocated,
             count(*) filter (where data ? 'recoveryAmountMinor')::int as priced
      from hrms_operation_records where tenant_id = ${access.tenantId} and resource = 'assets'
        and employee_id = ${employee.id} and status = 'allocated'
    `,
  ]);
  const run = (runRows as Array<{ id: string; period: string; status: string }>)[0] ?? null;
  const loans = (loanRows as Array<{ outstanding: string | number; loans: number }>)[0] ?? { outstanding: 0, loans: 0 };
  const advances = (advanceRows as Array<{ outstanding: string | number; advances: number }>)[0] ?? { outstanding: 0, advances: 0 };
  const assets = (assetRows as Array<{ recovery: string | number; allocated: number; priced: number }>)[0] ?? { recovery: 0, allocated: 0, priced: 0 };

  const period = run?.period ?? periodOf(input.lastWorkingDate);
  const periodSource = run ? "the linked payroll run's period" : "the month of the last working day (no payroll run linked)";
  const { amounts, source: componentSource } = await monthlyComponents(access, employee);
  const definitions = await componentDefinitions(access);
  const earnings = Object.fromEntries(
    Object.entries(amounts).filter(([code]) => (definitions[code]?.kind ?? "earning") === "earning" && code !== "ot"),
  );
  const prorationBasisByComponent = Object.fromEntries(
    Object.keys(earnings).map((code) => [code, definitions[code]?.prorationBasis ?? null]),
  );
  const monthlyGross = Object.values(earnings).reduce((sum, value) => sum + value, 0);
  const wages: Record<EncashmentBasis, number> = {
    basic: earnings.basic ?? 0,
    basic_plus_da: (earnings.basic ?? 0) + (earnings.da ?? 0),
    gross: monthlyGross,
  };
  const gratuityWage = Object.entries(earnings)
    .filter(([code]) => definitions[code]?.partOfGratuityWage ?? false)
    .reduce((sum, [, value]) => sum + value, 0);
  const balance = await leaveBalanceDays(access, employee, input.lastWorkingDate);
  const pack = rulePack(DEFAULT_RULE_PACK_CODE);

  const salary = finalPeriodSalary({
    period,
    lastWorkingDate: input.lastWorkingDate,
    monthlyComponentsMinor: earnings,
    prorationBasisByComponent,
  });
  salary.inputs.componentSource = componentSource;

  const figures: SettlementFigure[] = [
    salary,
    leaveEncashmentWorking({
      balanceDays: balance.days,
      // Neither the basis nor the divisor is recorded anywhere in the tenant today.
      basis: null,
      monthDaysDivisor: null,
      monthlyWagesMinor: wages,
      balanceSource: balance.source,
    }),
    gratuityWorking({
      pack,
      joiningDate: employee.joining_date,
      lastWorkingDate: input.lastWorkingDate,
      wageBaseCandidatesMinor: { basic: wages.basic, da: earnings.da ?? 0, gratuity_flagged: gratuityWage, gross: wages.gross },
    }),
    plainFigure({
      head: "loanRecoveryMinor",
      label: "Loan foreclosure",
      direction: "recovery",
      amountMinor: Number(loans.outstanding ?? 0),
      basis: `Outstanding principal across ${loans.loans} disbursed loan${loans.loans === 1 ? "" : "s"}; a settlement forecloses the balance in full.`,
      inputs: { disbursedLoans: loans.loans },
    }),
    plainFigure({
      head: "advanceRecoveryMinor",
      label: "Salary advance recovery",
      direction: "recovery",
      amountMinor: Number(advances.outstanding ?? 0),
      basis: `${advances.advances} unrecovered salary advance${advances.advances === 1 ? "" : "s"} on record.`,
      inputs: { openAdvances: advances.advances },
    }),
    plainFigure({
      head: "assetRecoveryMinor",
      label: "Asset recovery",
      direction: "recovery",
      amountMinor: assets.allocated > 0 && assets.priced < assets.allocated ? null : Number(assets.recovery ?? 0),
      basis: assets.allocated === 0
        ? "No asset is still allocated to this employee."
        : assets.priced < assets.allocated
          ? `${assets.allocated - assets.priced} of ${assets.allocated} allocated asset${assets.allocated === 1 ? "" : "s"} carry no recorded recovery amount. Return the asset or record a recovery amount on it.`
          : `Recorded recovery amounts on ${assets.priced} allocated asset${assets.priced === 1 ? "" : "s"}.`,
      blockedBy: assets.allocated > 0 && assets.priced < assets.allocated ? ["asset.recoveryAmountMinor"] : [],
      inputs: { allocatedAssets: assets.allocated, assetsWithRecoveryAmount: assets.priced },
    }),
    noticeShortfallWorking({
      // The exit record carries no notice period anywhere in this system.
      noticeRequiredDays: null,
      noticeGivenDate: null,
      lastWorkingDate: input.lastWorkingDate,
      perDayRecoveryMinor: null,
      perDayBasis: "not configured",
    }),
    plainFigure({
      head: "taxDeductionMinor",
      label: "Tax deducted at source",
      direction: "recovery",
      amountMinor: null,
      basis: `Settlement TDS cannot be computed: rule pack "${pack.code}" supplies no slabs, standard deduction, cess or rebate.`,
      blockedBy: ["tds.slabs", "tds.standardDeductionMinor", "tds.cessRate", "tds.rebate87a"],
      inputs: { rulePack: pack.code },
    }),
  ];

  const totals = settlementTotals(figures);
  const proposal: Record<string, number> = {};
  for (const figure of figures) {
    if (figure.amountMinor !== null) proposal[figure.head] = figure.amountMinor;
  }
  return {
    employee: {
      id: employee.id,
      code: employee.employee_code,
      name: `${employee.first_name} ${employee.last_name}`.trim(),
      joiningDate: employee.joining_date,
      currency: employee.currency,
    },
    period,
    periodSource,
    lastWorkingDate: input.lastWorkingDate,
    payrollRunId,
    payrollRunStatus: run?.status ?? null,
    rulePackCode: pack.code,
    figures,
    totals,
    proposal,
    blockedBy: [...new Set(figures.flatMap((figure) => figure.blockedBy))],
  };
}

export type SettlementQueueRow = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  lastWorkingDate: string | null;
  exitType: string | null;
  netPayableMinor: number | null;
  settlementOutcome: string | null;
  recoverableMinor: number;
  blockingItems: number;
  clearanceItems: number;
  createdAt: string | null;
  updatedAt: string | null;
};

type RecordRow = {
  id: string;
  version: number;
  status: string;
  employee_id: string | null;
  data: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  clearance_items: number;
  open_clearance_items: number;
};

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function queueRow(row: RecordRow): SettlementQueueRow {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const net = numberOrNull(row.data.netPayableMinor);
  return {
    id: row.id,
    version: Number(row.version),
    status: row.status,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: name.length > 0 ? name : null,
    lastWorkingDate: stringOrNull(row.data.lastWorkingDate),
    exitType: stringOrNull(row.data.exitType),
    netPayableMinor: net,
    settlementOutcome: stringOrNull(row.data.settlementOutcome) ?? (net === null ? null : net < 0 ? "recovery_pending" : "payable"),
    recoverableMinor: Number(row.data.recoverableMinor ?? (net !== null && net < 0 ? -net : 0)),
    blockingItems: Number(row.open_clearance_items ?? 0),
    clearanceItems: Number(row.clearance_items ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RECORD_SELECT = `
  select r.id, r.version, r.status, r.employee_id, r.data, r.created_at::text as created_at, r.updated_at::text as updated_at,
         e.employee_code, e.first_name, e.last_name,
         coalesce(c.total_items, 0)::int as clearance_items,
         coalesce(c.open_items, 0)::int as open_clearance_items
  from hrms_operation_records r
  left join employees e on e.tenant_id = r.tenant_id and e.id = r.employee_id
  left join lateral (
    select count(*)::int as total_items,
           count(*) filter (where coalesce(i.attributes->>'status', 'pending') <> 'cleared')::int as open_items
    from clearance_items i
    where i.tenant_id = r.tenant_id and i.offboarding_case_id = nullif(r.data->>'offboardingCaseId', '')::uuid
  ) c on true
`;

/** The same row scope the generic operational list applies, as positional parameters. */
function scopeClause(scopeParam: number, employeeParam: number): string {
  return `
    and ($${scopeParam} = 'all' or r.employee_id = $${employeeParam}::uuid
         or ($${scopeParam} = 'team' and r.employee_id in (select id from employees where tenant_id = $1::uuid and manager_employee_id = $${employeeParam}::uuid)))
  `;
}

/**
 * The settlement work queue: every proposal with its leaver, its own computed net and a
 * REAL count of the clearance items still blocking it.
 */
export async function listSettlements(
  access: Access,
  filters: { status?: string | null; employeeId?: string | null; page?: number; pageSize?: number },
): Promise<{ items: SettlementQueueRow[]; nextCursor: string | null }> {
  const scope = operationalScope(access, SETTLEMENT_PERMISSION, "read");
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(filters.pageSize ?? 25)));
  const employeeId = filters.employeeId ?? null;
  if (employeeId && !UUID.test(employeeId)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A valid employee reference is required.", details: [{ field: "employeeId", issue: "Expected a uuid." }] });
  }
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${RECORD_SELECT}
       where r.tenant_id = $1::uuid and r.resource = 'settlements'
         and ($2::text is null or r.status = $2)
         and ($3::uuid is null or r.employee_id = $3::uuid)
         ${scopeClause(4, 5)}
       order by r.created_at desc, r.id desc limit $6 offset $7`,
      [access.tenantId, filters.status ?? null, employeeId, scope, access.context.employeeId ?? null, pageSize + 1, (page - 1) * pageSize],
    ),
  ]);
  const records = (rows as RecordRow[]).map(queueRow);
  return {
    items: records.slice(0, pageSize),
    nextCursor: records.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
  };
}

export type SettlementAuditEntry = { action: string; reason: string | null; status: string | null; createdAt: string | null };

export type SettlementDetail = {
  record: SettlementQueueRow & { data: Record<string, unknown> };
  working: SettlementWorking | null;
  workingError: string | null;
  gates: FinalizeGate[];
  auditTrail: SettlementAuditEntry[];
};

/** One proposal with its working, its finalize gates and its audit trail. */
export async function getSettlementDetail(access: Access, id: string): Promise<SettlementDetail> {
  const scope = operationalScope(access, SETTLEMENT_PERMISSION, "read");
  if (!UUID.test(id)) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference.", details: [{ field: "settlementId", issue: "Expected a uuid." }] });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${RECORD_SELECT} where r.tenant_id = $1::uuid and r.resource = 'settlements' and r.id = $2::uuid ${scopeClause(3, 4)} limit 1`,
      [access.tenantId, id, scope, access.context.employeeId ?? null],
    ),
  ]);
  const row = (rows as RecordRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  const offboardingCaseId = stringOrNull(row.data.offboardingCaseId);
  const payrollRunId = stringOrNull(row.data.payrollRunId);
  const [runRows, caseRows, assetRows, loanRows, eventRows] = await tenantTx(access, [
    sqlClient`select status from payroll_runs where tenant_id = ${access.tenantId} and id = ${payrollRunId}::uuid limit 1`,
    sqlClient`select attributes->>'status' as status from offboarding_cases where tenant_id = ${access.tenantId} and id = ${offboardingCaseId}::uuid limit 1`,
    sqlClient`
      select count(*)::int as allocated from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = 'assets' and employee_id = ${row.employee_id}::uuid and status = 'allocated'
    `,
    sqlClient`
      select coalesce(sum((attributes->>'outstanding_minor')::bigint), 0)::bigint as outstanding
      from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${row.employee_id}::uuid and attributes->>'status' = 'disbursed'
    `,
    sqlClient`
      select action, reason, response->>'status' as status, created_at::text as created_at
      from hrms_operation_events where tenant_id = ${access.tenantId} and record_id = ${id}
      order by created_at, id limit 100
    `,
  ]);

  const gates = finalizeGates({
    recordStatus: row.status,
    payrollRunStatus: (runRows as Array<{ status: string }>)[0]?.status ?? null,
    exitCaseStatus: (caseRows as Array<{ status: string | null }>)[0]?.status ?? null,
    clearanceTotal: Number(row.clearance_items ?? 0),
    clearanceOpen: Number(row.open_clearance_items ?? 0),
    allocatedAssets: Number((assetRows as Array<{ allocated: number }>)[0]?.allocated ?? 0),
    outstandingLoanMinor: Number((loanRows as Array<{ outstanding: string | number }>)[0]?.outstanding ?? 0),
    loanRecoveryMinor: Number(row.data.loanRecoveryMinor ?? 0),
  });

  let working: SettlementWorking | null = null;
  let workingError: string | null = null;
  const lastWorkingDate = stringOrNull(row.data.lastWorkingDate);
  if (row.employee_id && lastWorkingDate) {
    try {
      working = await computeSettlementWorking(access, { employeeId: row.employee_id, lastWorkingDate, payrollRunId });
    } catch (error) {
      workingError = error instanceof HttpError ? error.message : "The settlement working could not be computed.";
    }
  } else {
    workingError = "The proposal carries no employee or last working date, so no working can be computed.";
  }

  return {
    record: { ...queueRow(row), data: row.data },
    working,
    workingError,
    gates,
    auditTrail: (eventRows as Array<{ action: string; reason: string | null; status: string | null; created_at: string | null }>).map((entry) => ({
      action: entry.action,
      reason: entry.reason,
      status: entry.status,
      createdAt: entry.created_at,
    })),
  };
}
