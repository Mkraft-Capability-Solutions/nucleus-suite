import "server-only";

/**
 * S5 — Payroll Control Room read model.
 *
 * Everything on this console is a consequence of a payroll run that already
 * exists in the tenant. Nothing here computes a payroll figure of its own: the
 * stepper is the persisted run timeline, the composition and the department
 * split are sums of the run's own `payroll_lines`, and the bridge is a
 * difference between two runs' stored earning lines.
 *
 * Where the data cannot answer a question exactly, the feed is returned as
 * unavailable with the reason stated (DESIGN_SYSTEM.md section 9). A wrong
 * number on this screen is worse than a missing one.
 */

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import {
  displayRunCode,
  formatPeriodLabel,
  getRunCockpit,
  listAnomalies,
  listRuns,
  scopeLabel,
  type CockpitTimelineStep,
} from "@/server/payroll/service";
import { countBy, derived, ratio, source, unsupported, type Source } from "./source";

/* -------------------------------------------------------------------------- */
/* Pure helpers — unit tested in ./payroll-control-room.test.ts                */
/* -------------------------------------------------------------------------- */

/** One employee's earning total for one component code inside one run. */
export type EarningCell = {
  runId: string;
  employeeId: string;
  /** The `payroll_lines.attributes.code` the engine posted. */
  code: string;
  amountMinor: number;
};

export type BridgeBar = {
  label: string;
  amountMinor: number;
  kind: "base" | "delta" | "total";
};

export type OmittedMovement = { category: string; reason: string };

export type VarianceBridge = {
  bars: BridgeBar[];
  /** The movement categories the stored lines could actually attribute. */
  attributed: string[];
  /** Categories the bridge deliberately does not draw, each with its reason. */
  omitted: OmittedMovement[];
  /** Opening minus the movements minus closing. Non-zero means do not draw it. */
  residualMinor: number;
  /** True only when the movements reconcile the opening base to the closing total. */
  ties: boolean;
};

/**
 * Component codes the payroll engine posts, mapped to the movement they
 * represent in a month-on-month bridge. A code that is not listed is recurring
 * pay: the engine posts no separate increment or loss-of-pay component, so the
 * effect of both is inside the recurring figure and must not be split out.
 */
export const VARIANCE_CATEGORY_BY_COMPONENT: Readonly<Record<string, string>> = {
  ot: "Overtime",
  overtime_extra: "Overtime",
  arrear: "Arrears",
  bonus: "Bonus",
  advance_paid: "Advance paid",
};

export const RECURRING_MOVEMENT_LABEL = "Recurring pay";

export function varianceCategory(code: string): string {
  return VARIANCE_CATEGORY_BY_COMPONENT[code] ?? RECURRING_MOVEMENT_LABEL;
}

/**
 * The movements the specification asks for that a payroll run cannot evidence.
 * Stated rather than drawn, so the bridge is never completed with a guess.
 */
export const UNATTRIBUTABLE_MOVEMENTS: readonly OmittedMovement[] = [
  {
    category: "Increments",
    reason:
      "An increment is not posted as its own component. Its effect is inside the recurring pay movement and cannot be separated from it.",
  },
  {
    category: "Loss of pay",
    reason:
      "A run stores the payable amount of each component, not the days lost, so loss of pay cannot be separated from the recurring pay movement it has already reduced.",
  },
  {
    category: "Reversals",
    reason:
      "No reversal component is posted to a payroll run. A correction run is its own run, so a reversal cannot be isolated inside this period's bridge.",
  },
];

function byEmployeeAndCode(cells: readonly EarningCell[]): Map<string, Map<string, number>> {
  const index = new Map<string, Map<string, number>>();
  for (const cell of cells) {
    const codes = index.get(cell.employeeId) ?? new Map<string, number>();
    codes.set(cell.code, (codes.get(cell.code) ?? 0) + cell.amountMinor);
    index.set(cell.employeeId, codes);
  }
  return index;
}

function totalOf(codes: Map<string, number>): number {
  let total = 0;
  for (const amount of codes.values()) total += amount;
  return total;
}

/**
 * Bridges the prior period's gross to this period's gross using only movements
 * the stored earning lines can evidence: people who joined, people who left,
 * and — for everyone present in both runs — the component that actually moved.
 */
export function buildVarianceBridge(args: {
  priorLabel: string;
  currentLabel: string;
  prior: readonly EarningCell[];
  current: readonly EarningCell[];
}): VarianceBridge {
  const prior = byEmployeeAndCode(args.prior);
  const current = byEmployeeAndCode(args.current);

  let priorTotal = 0;
  for (const codes of prior.values()) priorTotal += totalOf(codes);
  let currentTotal = 0;
  for (const codes of current.values()) currentTotal += totalOf(codes);

  let joinersMinor = 0;
  for (const [employeeId, codes] of current) {
    if (!prior.has(employeeId)) joinersMinor += totalOf(codes);
  }
  let leaversMinor = 0;
  for (const [employeeId, codes] of prior) {
    if (!current.has(employeeId)) leaversMinor -= totalOf(codes);
  }

  // Continuing employees: name the component that moved instead of burying every
  // rupee of movement in a single unexplained bar.
  const continuing = new Map<string, number>();
  for (const [employeeId, currentCodes] of current) {
    const priorCodes = prior.get(employeeId);
    if (!priorCodes) continue;
    const codes = new Set<string>([...priorCodes.keys(), ...currentCodes.keys()]);
    for (const code of codes) {
      const delta = (currentCodes.get(code) ?? 0) - (priorCodes.get(code) ?? 0);
      if (delta === 0) continue;
      const category = varianceCategory(code);
      continuing.set(category, (continuing.get(category) ?? 0) + delta);
    }
  }

  const movements: BridgeBar[] = [];
  if (joinersMinor !== 0) movements.push({ label: "Joiners", amountMinor: joinersMinor, kind: "delta" });
  if (leaversMinor !== 0) movements.push({ label: "Leavers", amountMinor: leaversMinor, kind: "delta" });
  const continuingBars = [...continuing.entries()]
    .filter(([, amount]) => amount !== 0)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .map(([label, amountMinor]): BridgeBar => ({ label, amountMinor, kind: "delta" }));
  movements.push(...continuingBars);

  const movementTotal = movements.reduce((total, bar) => total + bar.amountMinor, 0);
  const residualMinor = priorTotal + movementTotal - currentTotal;

  return {
    bars: [
      { label: args.priorLabel, amountMinor: priorTotal, kind: "base" },
      ...movements,
      { label: args.currentLabel, amountMinor: currentTotal, kind: "total" },
    ],
    attributed: movements.map((bar) => bar.label),
    omitted: [...UNATTRIBUTABLE_MOVEMENTS],
    residualMinor,
    ties: residualMinor === 0,
  };
}

export type CompositionSlice = { code: string; label: string; amountMinor: number; sharePct: number | null };

/** Display names for the component codes the payroll engine itself posts. */
export const COMPONENT_LABELS: Readonly<Record<string, string>> = {
  basic: "Basic",
  hra: "House rent allowance",
  da: "Dearness allowance",
  conveyance: "Conveyance",
  special: "Special allowance",
  ot: "Overtime",
  overtime_extra: "Overtime (input)",
  arrear: "Arrears",
  bonus: "Bonus",
  advance_paid: "Advance paid",
};

export function componentLabel(code: string): string {
  const known = COMPONENT_LABELS[code];
  if (known) return known;
  const spaced = code.replace(/[_-]+/g, " ").trim();
  return spaced.length === 0 ? code : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Groups one run's earning lines into the composition of its gross. */
export function composeGross(cells: readonly EarningCell[]): CompositionSlice[] {
  const totals = new Map<string, number>();
  for (const cell of cells) totals.set(cell.code, (totals.get(cell.code) ?? 0) + cell.amountMinor);
  let grandTotal = 0;
  for (const amount of totals.values()) grandTotal += amount;
  return [...totals.entries()]
    .map(([code, amountMinor]) => ({
      code,
      label: componentLabel(code),
      amountMinor,
      sharePct: ratio(amountMinor, grandTotal),
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor);
}

/**
 * Renders an anomaly's `facts` blob as one readable sentence. Facts are written
 * by the rule that raised the anomaly, so they are shown verbatim rather than
 * rephrased into a reason the rule never gave.
 */
export function describeFacts(facts: unknown): string {
  if (typeof facts === "string") return facts;
  if (typeof facts !== "object" || facts === null) return "";
  const record = facts as Record<string, unknown>;
  if (typeof record.reason === "string" && record.reason.trim().length > 0) return record.reason;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || typeof value === "object") continue;
    parts.push(`${key.replace(/[_-]+/g, " ")}: ${String(value)}`);
  }
  return parts.join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Database reads                                                             */
/* -------------------------------------------------------------------------- */

type EarningRow = { run_id: string; employee_id: string; code: string | null; amount: string | number | null };
type DepartmentRow = { department: string | null; amount: string | number | null; employees: number | string | null };
type PersonRow = { id: string; employee_code: string | null; first_name: string | null; last_name: string | null; department: string | null };

function toInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

/**
 * Every employee's earning lines for the given runs, grouped by component.
 * Earnings alone, because gross is the sum of the earning lines.
 */
async function readEarningCells(access: Access, runIds: readonly string[]): Promise<EarningCell[]> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  if (runIds.length === 0) return [];
  const ids = [...runIds];
  const [rows] = await tenantTx(access, [
    sqlClient`
      select member.payroll_run_id as run_id,
             member.employee_id as employee_id,
             (line.attributes->>'code') as code,
             sum((line.attributes->>'amount_minor')::bigint)::bigint as amount
      from payroll_lines line
      join payroll_run_employees member
        on member.id = line.payroll_run_employee_id and member.tenant_id = line.tenant_id
      where line.tenant_id = ${access.tenantId}
        and member.payroll_run_id = any(${ids}::uuid[])
        and (line.attributes->>'kind') = 'earning'
      group by 1, 2, 3
    `,
  ]);
  return (rows as EarningRow[])
    .filter((row) => typeof row.code === "string" && row.code.length > 0)
    .map((row) => ({
      runId: row.run_id,
      employeeId: row.employee_id,
      code: String(row.code),
      amountMinor: toInt(row.amount),
    }));
}

export type DepartmentCost = { department: string; amountMinor: number; employees: number };

async function readDepartmentCosts(access: Access, runId: string): Promise<DepartmentCost[]> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select coalesce(nullif(btrim(employee.department), ''), 'Unassigned') as department,
             sum((line.attributes->>'amount_minor')::bigint)::bigint as amount,
             count(distinct member.employee_id)::int as employees
      from payroll_lines line
      join payroll_run_employees member
        on member.id = line.payroll_run_employee_id and member.tenant_id = line.tenant_id
      join employees employee
        on employee.id = member.employee_id and employee.tenant_id = member.tenant_id
      where line.tenant_id = ${access.tenantId}
        and member.payroll_run_id = ${runId}
        and (line.attributes->>'kind') = 'earning'
      group by 1
      order by 2 desc
    `,
  ]);
  return (rows as DepartmentRow[]).map((row) => ({
    department: row.department ?? "Unassigned",
    amountMinor: toInt(row.amount),
    employees: toInt(row.employees),
  }));
}

export type PersonRef = { id: string; code: string; name: string; department: string };

async function readPeople(access: Access, employeeIds: readonly string[]): Promise<Map<string, PersonRef>> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const ids = [...new Set(employeeIds)].filter((id) => id.length > 0);
  if (ids.length === 0) return new Map();
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, department
      from employees
      where tenant_id = ${access.tenantId} and id = any(${ids}::uuid[])
    `,
  ]);
  const index = new Map<string, PersonRef>();
  for (const row of rows as PersonRow[]) {
    const name = [row.first_name, row.last_name].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ").trim();
    index.set(row.id, {
      id: row.id,
      code: row.employee_code ?? "—",
      name: name.length > 0 ? name : (row.employee_code ?? "Unnamed employee"),
      department: row.department ?? "Unassigned",
    });
  }
  return index;
}

/* -------------------------------------------------------------------------- */
/* Read model                                                                 */
/* -------------------------------------------------------------------------- */

export type PeriodOption = {
  runId: string;
  period: string;
  periodLabel: string;
  scope: string;
  scopeLabel: string;
  status: string;
  displayCode: string;
  grossMinor: number | null;
  netMinor: number | null;
  currency: string;
  employeeCount: number | null;
};

export type ExceptionRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  ruleCode: string;
  severity: string;
  status: string;
  reason: string;
  resolution: string | null;
  /** `resolveAnomaly` only accepts an anomaly that is still open. */
  resolvable: boolean;
};

export type CompositionView = {
  slices: CompositionSlice[];
  componentTotalMinor: number;
  runGrossMinor: number | null;
  /** False when the summed lines and the run's stored gross disagree. */
  tiesToRunGross: boolean;
  currency: string;
};

export type PayrollControlRoomView = {
  periods: PeriodOption[];
  selectedRunId: string | null;
  selected: PeriodOption | null;
  priorRunId: string | null;
  stepper: Source<CockpitTimelineStep[]>;
  counts: Source<{ members: number; anomaliesOpen: number; anomaliesTotal: number; inputs: number; approvals: number; payslips: number } | null>;
  variance: Source<(VarianceBridge & { priorPeriodLabel: string; currentPeriodLabel: string; currency: string }) | null>;
  composition: Source<CompositionView | null>;
  departments: Source<DepartmentCost[]>;
  exceptions: Source<ExceptionRow[]>;
  severityCounts: Source<Array<{ label: string; value: number }>>;
  unavailableSources: Array<{ name: string; message: string }>;
};

type RunListRow = {
  id: string;
  period: string;
  scope: string;
  status: string;
  employee_count: number | string | null;
  gross_minor: number | string | null;
  net_minor: number | string | null;
  currency: string | null;
};

function toPeriodOption(row: RunListRow): PeriodOption {
  return {
    runId: row.id,
    period: row.period,
    periodLabel: formatPeriodLabel(row.period),
    scope: row.scope,
    scopeLabel: scopeLabel(row.scope),
    status: row.status,
    displayCode: displayRunCode(row.period, row.id),
    grossMinor: row.gross_minor === null || row.gross_minor === undefined ? null : toInt(row.gross_minor),
    netMinor: row.net_minor === null || row.net_minor === undefined ? null : toInt(row.net_minor),
    currency: row.currency ?? "INR",
    employeeCount: row.employee_count === null || row.employee_count === undefined ? null : toInt(row.employee_count),
  };
}

const NO_RUN_MESSAGE = "No payroll run exists for this tenant yet, so there is nothing to control.";

/** Assembles the S5 console for one payroll run. */
export async function loadPayrollControlRoom(
  access: Access,
  args: { runId: string | null },
): Promise<PayrollControlRoomView> {
  const runs = await source(
    () => listRuns(access, { period: null, status: null, scope: null, page: 1, pageSize: 36 }),
    { items: [] as unknown[], total: 0 },
    "payroll_runs",
  );

  const periods = (runs.value.items as RunListRow[]).map(toPeriodOption);
  const selected = (args.runId ? periods.find((period) => period.runId === args.runId) : undefined) ?? periods[0] ?? null;

  if (!selected) {
    const empty = unsupported<null>(null, runs.available ? NO_RUN_MESSAGE : (runs.message ?? NO_RUN_MESSAGE));
    return {
      periods,
      selectedRunId: null,
      selected: null,
      priorRunId: null,
      stepper: unsupported<CockpitTimelineStep[]>([], empty.message ?? NO_RUN_MESSAGE),
      counts: empty,
      variance: empty,
      composition: empty,
      departments: unsupported<DepartmentCost[]>([], empty.message ?? NO_RUN_MESSAGE),
      exceptions: unsupported<ExceptionRow[]>([], empty.message ?? NO_RUN_MESSAGE),
      severityCounts: unsupported<Array<{ label: string; value: number }>>([], empty.message ?? NO_RUN_MESSAGE),
      unavailableSources: [{ name: "runs", message: empty.message ?? NO_RUN_MESSAGE }],
    };
  }

  // The comparable prior period is the most recent earlier run of the same scope:
  // a regular run is only comparable with another regular run.
  const prior =
    periods
      .filter((period) => period.scope === selected.scope && period.period < selected.period)
      .sort((left, right) => (left.period < right.period ? 1 : -1))[0] ?? null;

  const [cockpit, earnings, departments, anomalies] = await Promise.all([
    source(() => getRunCockpit(access, selected.runId), null as Awaited<ReturnType<typeof getRunCockpit>> | null, "payroll_runs + payroll_anomalies + payslips"),
    source(
      () => readEarningCells(access, prior ? [selected.runId, prior.runId] : [selected.runId]),
      [] as EarningCell[],
      "payroll_lines",
    ),
    source(() => readDepartmentCosts(access, selected.runId), [] as DepartmentCost[], "payroll_lines + employees"),
    source(() => listAnomalies(access, selected.runId), [] as unknown[], "payroll_anomalies"),
  ]);

  const stepper: Source<CockpitTimelineStep[]> = cockpit.available && cockpit.value
    ? derived(cockpit.value.timeline, "payroll run state, derived from persisted inputs, anomalies, approvals and payslips")
    : unsupported<CockpitTimelineStep[]>([], cockpit.message ?? "The run timeline could not be read.");

  const counts: PayrollControlRoomView["counts"] = cockpit.available && cockpit.value
    ? derived(cockpit.value.counts, "payroll run cockpit counts")
    : unsupported(null, cockpit.message ?? "The run counts could not be read.");

  // --- Composition ---------------------------------------------------------
  const currentCells = earnings.value.filter((cell) => cell.runId === selected.runId);
  let composition: PayrollControlRoomView["composition"];
  if (!earnings.available) {
    composition = unsupported(null, earnings.message ?? "The run's component lines could not be read.");
  } else if (currentCells.length === 0) {
    composition = unsupported(
      null,
      "This run has posted no earning lines yet, so it has no cost composition. Calculate the run to build it.",
    );
  } else {
    const slices = composeGross(currentCells);
    const componentTotalMinor = slices.reduce((total, slice) => total + slice.amountMinor, 0);
    composition = derived(
      {
        slices,
        componentTotalMinor,
        runGrossMinor: selected.grossMinor,
        tiesToRunGross: selected.grossMinor === null ? false : selected.grossMinor === componentTotalMinor,
        currency: selected.currency,
      },
      "sum of the run's earning payroll_lines by component",
    );
  }

  // --- Month-on-month bridge ----------------------------------------------
  let variance: PayrollControlRoomView["variance"];
  if (!earnings.available) {
    variance = unsupported(null, earnings.message ?? "The run's component lines could not be read.");
  } else if (!prior) {
    variance = unsupported(
      null,
      `There is no earlier ${selected.scopeLabel.toLowerCase()} run to compare ${selected.periodLabel} against, so no month-on-month bridge can be drawn.`,
    );
  } else if (prior.currency !== selected.currency) {
    variance = unsupported(
      null,
      `${prior.periodLabel} is recorded in ${prior.currency} and ${selected.periodLabel} in ${selected.currency}. Two currencies cannot be bridged without a rate this console does not hold.`,
    );
  } else {
    const bridge = buildVarianceBridge({
      priorLabel: `${prior.periodLabel} gross`,
      currentLabel: `${selected.periodLabel} gross`,
      prior: earnings.value.filter((cell) => cell.runId === prior.runId),
      current: currentCells,
    });
    variance = bridge.ties
      ? derived(
          { ...bridge, priorPeriodLabel: prior.periodLabel, currentPeriodLabel: selected.periodLabel, currency: selected.currency },
          "difference between the two runs' earning payroll_lines",
        )
      : unsupported(
          null,
          "The attributed movements do not reconcile the two periods' gross totals, so the bridge is withheld rather than shown with a balancing figure.",
        );
  }

  // --- Blocking exceptions -------------------------------------------------
  type AnomalyRow = {
    id: string;
    employee_id: string;
    rule_code: string | null;
    severity: string | null;
    facts: unknown;
    status: string | null;
    resolution: string | null;
  };
  const anomalyRows = anomalies.value as AnomalyRow[];
  const people = await source(
    () => readPeople(access, anomalyRows.map((row) => row.employee_id)),
    new Map<string, PersonRef>(),
    "employees",
  );
  const exceptionRows: ExceptionRow[] = anomalyRows.map((row) => {
    const person = people.value.get(row.employee_id);
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeCode: person?.code ?? "—",
      employeeName: person?.name ?? "Name unavailable",
      ruleCode: row.rule_code ?? "unknown",
      severity: row.severity ?? "unknown",
      status: row.status ?? "open",
      reason: describeFacts(row.facts),
      resolution: row.resolution,
      resolvable: (row.status ?? "open") === "open",
    };
  });
  const exceptions: Source<ExceptionRow[]> = anomalies.available
    ? derived(exceptionRows, "payroll_anomalies for this run")
    : unsupported<ExceptionRow[]>([], anomalies.message ?? "Anomalies could not be read.");

  const severityCounts: Source<Array<{ label: string; value: number }>> = anomalies.available
    ? derived(countBy(exceptionRows.filter((row) => row.resolvable), (row) => row.severity), "open payroll_anomalies by severity")
    : unsupported<Array<{ label: string; value: number }>>([], anomalies.message ?? "Anomalies could not be read.");

  const feeds: Record<string, Source<unknown>> = {
    runs,
    runTimeline: stepper,
    componentLines: composition,
    varianceBridge: variance,
    departmentCost: departments,
    exceptions,
    employeeDirectory: people,
  };
  const unavailableSources = Object.entries(feeds)
    .filter(([, feed]) => !feed.available)
    .map(([name, feed]) => ({ name, message: feed.message ?? "This source is unavailable." }));

  return {
    periods,
    selectedRunId: selected.runId,
    selected,
    priorRunId: prior?.runId ?? null,
    stepper,
    counts,
    variance,
    composition,
    departments,
    exceptions,
    severityCounts,
    unavailableSources,
  };
}
