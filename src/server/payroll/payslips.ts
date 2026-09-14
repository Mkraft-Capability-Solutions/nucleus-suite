import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listComponents, type ComponentKind } from "./components";
import { displayRunCode, formatPeriodLabel, scopeLabel } from "./service";

/**
 * SCR-053 Payslips — retrieval, line breakdown and distribution state.
 *
 * Payslip rows are minted by `finalizeRun`, which writes
 * `{period, scope, totals, state, generated_at}` onto `payslips.attributes`.
 * Nothing read this back: there was no collection endpoint, no line breakdown
 * and no distribution state machine. This module supplies all three without
 * changing how a payslip is created.
 *
 * Line order and labelling come from the pay component master
 * (`pay_components.payslip_sequence` / `payslip_label`), never from literals in
 * this file, so a tenant that renames or re-orders a component sees the change
 * on the payslip.
 */

export const PAYSLIP_STATES = ["generated", "published", "viewed", "archived"] as const;
export type PayslipState = (typeof PAYSLIP_STATES)[number];

export const PAYSLIP_STATE_LABELS: Record<PayslipState, string> = {
  generated: "Generated",
  published: "Published",
  viewed: "Viewed",
  archived: "Archived",
};

export const PAYSLIP_ACTIONS = ["publish", "view", "archive"] as const;
export type PayslipAction = (typeof PAYSLIP_ACTIONS)[number];

/**
 * Top-level, plain `z.object` on purpose: the UI form catalog generator
 * (`scripts/generate-workflow-catalog.cjs`) statically resolves the schema a
 * route handler calls `safeParse` on, so it must be a named module export.
 */
export const transitionPayslipSchema = z.object({
  action: z.enum(PAYSLIP_ACTIONS),
});

/** generated -> published -> viewed -> archived. Archive is reachable from published or viewed. */
const PAYSLIP_TRANSITIONS: Record<PayslipAction, { from: readonly PayslipState[]; to: PayslipState }> = {
  publish: { from: ["generated"], to: "published" },
  view: { from: ["published"], to: "viewed" },
  archive: { from: ["published", "viewed"], to: "archived" },
};

export function normalizePayslipState(state: unknown): PayslipState {
  const key = typeof state === "string" ? state.trim().toLowerCase() : "";
  return (PAYSLIP_STATES as readonly string[]).includes(key) ? (key as PayslipState) : "generated";
}

/** The state an action would produce, or null when the action is not legal from `current`. */
export function nextPayslipState(current: unknown, action: PayslipAction): PayslipState | null {
  const from = normalizePayslipState(current);
  const transition = PAYSLIP_TRANSITIONS[action];
  if (!transition) return null;
  return transition.from.includes(from) ? transition.to : null;
}

/** The actions legal right now — the UI disables every button this does not return. */
export function allowedPayslipActions(current: unknown): PayslipAction[] {
  return PAYSLIP_ACTIONS.filter((action) => nextPayslipState(current, action) !== null);
}

export function assertPayslipTransition(current: unknown, action: PayslipAction): PayslipState {
  const next = nextPayslipState(current, action);
  if (next !== null) return next;
  const from = normalizePayslipState(current);
  const attempted = PAYSLIP_TRANSITIONS[action]?.to ?? action;
  throw new HttpError({
    status: 409,
    code: "VERSION_CONFLICT",
    message: `A payslip in state "${from}" cannot move to state "${attempted}" with action "${action}".`,
    details: [{ field: "action", issue: `Current state is "${from}"; attempted state is "${attempted}".` }],
  });
}

export type PayslipTimelineStep = { key: PayslipState; label: string; state: "done" | "current" | "todo" };

/**
 * Distribution timeline. `reached` carries the states with a recorded stamp on
 * the row, so archiving straight from published does not falsely mark viewed as
 * done. Rows written before stamps existed fall back to positional order.
 */
export function payslipTimeline(state: unknown, reached: readonly string[] = []): PayslipTimelineStep[] {
  const current = normalizePayslipState(state);
  const currentIndex = PAYSLIP_STATES.indexOf(current);
  const marks = new Set<string>(["generated", ...reached]);
  return PAYSLIP_STATES.map((key, index) => ({
    key,
    label: PAYSLIP_STATE_LABELS[key],
    state: key === current ? "current" : marks.has(key) || (reached.length === 0 && index < currentIndex) ? "done" : "todo",
  }));
}

/** Display-only payslip code (no stored column): PS-YYYY-MM-XXXX from the row id. */
export function displayPayslipCode(period: string, id: string): string {
  const suffix = (id.replace(/-/g, "").slice(0, 4) || "0000").toUpperCase();
  return `PS-${period || "----/--"}-${suffix}`;
}

/**
 * RL-350 — payslip retrieval accepts a period AND a run selector. One period can
 * hold several runs (regular, arrears, off-cycle, bonus), so the two filters are
 * independent and combinable; neither implies the other.
 */
export type PayslipFilters = {
  employeeId: string | null;
  period: string | null;
  runId: string | null;
  state: PayslipState | null;
};

export function normalizePayslipFilters(args: {
  employeeId?: string | null;
  period?: string | null;
  runId?: string | null;
  state?: string | null;
}): PayslipFilters {
  const trim = (value: string | null | undefined): string | null => {
    const text = typeof value === "string" ? value.trim() : "";
    return text.length > 0 ? text : null;
  };
  const period = trim(args.period);
  const state = trim(args.state)?.toLowerCase() ?? null;
  return {
    employeeId: uuidOrNull(trim(args.employeeId)),
    period: period && /^\d{4}-\d{2}$/.test(period) ? period : null,
    runId: uuidOrNull(trim(args.runId)),
    state: state && (PAYSLIP_STATES as readonly string[]).includes(state) ? (state as PayslipState) : null,
  };
}

/* ------------------------------------------------------------------ *
 * Line breakdown (RL-273 / PAY-04.4 drill-down)
 * ------------------------------------------------------------------ */

export type CalculationTraceRow = {
  id: string;
  parentId: string | null;
  componentId: string | null;
  attributes: Record<string, unknown>;
};

export type CalculationTraceNode = {
  id: string;
  componentId: string | null;
  attributes: Record<string, unknown>;
  children: CalculationTraceNode[];
};

/**
 * Group `payroll_calculations` rows into per-component trees (parent -> children).
 * A row whose parent is absent from the set is treated as a root, so a partial
 * read still yields a usable tree instead of dropping rows.
 */
export function buildTraceIndex(rows: readonly CalculationTraceRow[]): Record<string, CalculationTraceNode[]> {
  const nodes = new Map<string, CalculationTraceNode>();
  for (const row of rows) {
    nodes.set(row.id, { id: row.id, componentId: row.componentId, attributes: row.attributes, children: [] });
  }
  const roots: CalculationTraceNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentId && row.parentId !== row.id ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const index: Record<string, CalculationTraceNode[]> = {};
  for (const root of roots) {
    const key = root.componentId ?? "";
    if (key === "") continue;
    (index[key] ??= []).push(root);
  }
  return index;
}

export type PayslipComponentView = {
  id: string;
  code: string;
  kind: ComponentKind;
  payslipLabel: string;
  payslipSequence: number;
  printOnPayslipWhenZero: boolean;
};

export type PayslipLineInput = {
  componentId: string | null;
  code: string;
  kind: string;
  amountMinor: number;
};

export type PayslipLine = {
  componentId: string | null;
  code: string;
  label: string;
  kind: ComponentKind;
  amountMinor: number;
  sequence: number;
  /** False when the engine recorded no intermediate values for this line. */
  traceAvailable: boolean;
  trace: CalculationTraceNode[] | null;
};

export type PayslipLineBreakdown = {
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  /** Employer contributions and information-only lines: shown, never netted. */
  informational: PayslipLine[];
  earningsMinor: number;
  deductionsMinor: number;
  netMinor: number;
};

const EARNING_KINDS: readonly ComponentKind[] = ["earning", "reimbursement"];

/**
 * Order by the component's payslip sequence, label from the component's payslip
 * label, and drop a zero line unless the component asks to print it anyway.
 * The trace is attached verbatim when the engine recorded one and is reported as
 * absent otherwise — never invented.
 */
export function buildPayslipLines(
  lines: readonly PayslipLineInput[],
  components: readonly PayslipComponentView[],
  traceIndex: Record<string, CalculationTraceNode[]> = {},
): PayslipLineBreakdown {
  const byId = new Map(components.map((component) => [component.id, component]));
  const byCode = new Map(components.map((component) => [component.code, component]));
  const resolved: PayslipLine[] = [];
  for (const line of lines) {
    const component = (line.componentId ? byId.get(line.componentId) : undefined) ?? byCode.get(line.code);
    const amountMinor = Number.isFinite(line.amountMinor) ? Math.trunc(line.amountMinor) : 0;
    const printWhenZero = component?.printOnPayslipWhenZero ?? false;
    if (amountMinor === 0 && !printWhenZero) continue;
    const fallbackKind: ComponentKind = line.kind === "deduction" ? "deduction" : "earning";
    resolved.push({
      componentId: component?.id ?? line.componentId ?? null,
      code: line.code || component?.code || "",
      label: component?.payslipLabel ?? line.code,
      kind: component?.kind ?? fallbackKind,
      amountMinor,
      sequence: component?.payslipSequence ?? 900,
      traceAvailable: false,
      trace: null,
    });
  }
  for (const line of resolved) {
    const trace = line.componentId ? traceIndex[line.componentId] : undefined;
    if (trace && trace.length > 0) {
      line.traceAvailable = true;
      line.trace = trace;
    }
  }
  resolved.sort((left, right) => left.sequence - right.sequence || left.code.localeCompare(right.code));
  const earnings = resolved.filter((line) => EARNING_KINDS.includes(line.kind));
  const deductions = resolved.filter((line) => line.kind === "deduction");
  const informational = resolved.filter((line) => !EARNING_KINDS.includes(line.kind) && line.kind !== "deduction");
  const earningsMinor = earnings.reduce((total, line) => total + line.amountMinor, 0);
  const deductionsMinor = deductions.reduce((total, line) => total + line.amountMinor, 0);
  return { earnings, deductions, informational, earningsMinor, deductionsMinor, netMinor: earningsMinor - deductionsMinor };
}

/* ------------------------------------------------------------------ *
 * Access scope
 * ------------------------------------------------------------------ */

export type PayslipScope = "all" | "self";

/**
 * Net pay is sensitive; the process guide gives payslips a "Self only" default
 * scope. `operationalScope` in src/server/workflows/operational-access.ts does not
 * fit: it needs `<permission>.self.read` / `.team.read` permissions, and the
 * permission catalog carries no `payroll.self.read`. So the rule is kept simple
 * and explicit here: a caller holding `payroll.read` sees the tenant's payslips;
 * every other caller sees only the payslips of the employee their membership is
 * linked to, and is refused when no employee link exists.
 */
export function payslipScopeFrom(permissions: readonly string[]): PayslipScope {
  return permissions.includes("payroll.read") ? "all" : "self";
}

function resolvePayslipScope(access: Access): { scope: PayslipScope; employeeId: string | null } {
  const scope = payslipScopeFrom(access.context.permissions);
  if (scope === "all") {
    enforce(access.context, "payroll.read", { tenantId: access.tenantId });
    return { scope, employeeId: null };
  }
  const employeeId = access.context.employeeId ?? null;
  if (!employeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile to view its own payslips.",
    });
  }
  return { scope, employeeId };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export type PayslipSummary = {
  id: string;
  version: number;
  displayCode: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  period: string;
  periodLabel: string;
  runId: string;
  runDisplayCode: string;
  scope: string;
  scopeLabel: string;
  currency: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  state: PayslipState;
  generatedAt: string | null;
};

type PayslipRow = {
  id: string;
  version: number | string | null;
  attributes: Record<string, unknown> | null;
  member_attributes: Record<string, unknown> | null;
  employee_id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  run_id: string;
  period: string;
  scope: string;
  currency: string | null;
  created_at: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function minor(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function totalsOf(row: PayslipRow): { grossMinor: number; deductionsMinor: number; netMinor: number } {
  const attributes = record(row.attributes);
  const stored = record(attributes.totals);
  const fallback = record(row.member_attributes);
  const pick = (key: string): number => minor(stored[key] ?? fallback[key] ?? 0);
  return { grossMinor: pick("gross_minor"), deductionsMinor: pick("deductions_minor"), netMinor: pick("net_minor") };
}

function summaryOf(row: PayslipRow): PayslipSummary {
  const attributes = record(row.attributes);
  const totals = totalsOf(row);
  const name = [row.first_name, row.last_name].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ").trim();
  return {
    id: row.id,
    version: minor(row.version ?? 1) || 1,
    displayCode: displayPayslipCode(row.period, row.id),
    employeeId: row.employee_id,
    employeeCode: row.employee_code ?? "—",
    employeeName: name || row.employee_code || "Unnamed employee",
    period: row.period,
    periodLabel: formatPeriodLabel(row.period),
    runId: row.run_id,
    runDisplayCode: displayRunCode(row.period, row.run_id),
    scope: row.scope,
    scopeLabel: scopeLabel(row.scope),
    currency: row.currency ?? "INR",
    grossMinor: totals.grossMinor,
    deductionsMinor: totals.deductionsMinor,
    netMinor: totals.netMinor,
    state: normalizePayslipState(attributes.state),
    generatedAt: typeof attributes.generated_at === "string" ? attributes.generated_at : row.created_at,
  };
}

/**
 * Work queue for SCR-053. Both `period` and `runId` are honoured, alone or
 * together (RL-350); a self-scoped caller is pinned to their own employee row
 * whatever `employeeId` asks for.
 */
export async function listPayslips(
  access: Access,
  args: { employeeId?: string | null; period?: string | null; runId?: string | null; state?: string | null; page: number; pageSize: number },
): Promise<{ items: PayslipSummary[]; total: number; scope: PayslipScope }> {
  const { scope, employeeId: selfEmployeeId } = resolvePayslipScope(access);
  const filters = normalizePayslipFilters(args);
  const employeeFilter = scope === "self" ? selfEmployeeId : filters.employeeId;
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total
      from payslips p
      join payroll_run_employees e on e.id = p.payroll_run_employee_id and e.tenant_id = p.tenant_id
      join payroll_runs r on r.id = e.payroll_run_id and r.tenant_id = p.tenant_id
      where p.tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or e.employee_id = ${employeeFilter}::uuid)
        and (${filters.period}::text is null or r.period = ${filters.period}::text)
        and (${filters.runId}::uuid is null or r.id = ${filters.runId}::uuid)
        and (${filters.state}::text is null or coalesce(p.attributes->>'state', 'generated') = ${filters.state}::text)
    `,
    sqlClient`
      select p.id, p.version, p.attributes, p.created_at,
             e.employee_id, e.attributes as member_attributes,
             r.id as run_id, r.period, r.scope, r.currency,
             emp.employee_code, emp.first_name, emp.last_name
      from payslips p
      join payroll_run_employees e on e.id = p.payroll_run_employee_id and e.tenant_id = p.tenant_id
      join payroll_runs r on r.id = e.payroll_run_id and r.tenant_id = p.tenant_id
      left join employees emp on emp.id = e.employee_id and emp.tenant_id = p.tenant_id
      where p.tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or e.employee_id = ${employeeFilter}::uuid)
        and (${filters.period}::text is null or r.period = ${filters.period}::text)
        and (${filters.runId}::uuid is null or r.id = ${filters.runId}::uuid)
        and (${filters.state}::text is null or coalesce(p.attributes->>'state', 'generated') = ${filters.state}::text)
      order by r.period desc, emp.employee_code nulls last, p.created_at
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return {
    items: (rows as PayslipRow[]).map(summaryOf),
    total: (countRows as Array<{ total: number }>)[0]?.total ?? 0,
    scope,
  };
}

export type PayslipDetail = PayslipSummary & {
  runEmployeeId: string;
  lines: PayslipLineBreakdown;
  timeline: PayslipTimelineStep[];
  allowedActions: PayslipAction[];
  /** False for every line when the engine has not written any calculation rows. */
  traceRecorded: boolean;
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

/**
 * Header, ordered lines and per-line drill-down for one payslip.
 *
 * The drill-down reads `payroll_calculations` (the canonical table for stored
 * intermediate values, PAY-04.4). The calculation engine does not write those
 * rows yet, so `traceAvailable` is false and `trace` is null for every line
 * today. That absence is reported, never filled with a reconstructed trace.
 */
export async function getPayslipDetail(access: Access, payslipId: string): Promise<PayslipDetail> {
  const { scope, employeeId: selfEmployeeId } = resolvePayslipScope(access);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.version, p.attributes, p.created_at,
             e.id as run_employee_id, e.employee_id, e.attributes as member_attributes,
             r.id as run_id, r.period, r.scope, r.currency,
             emp.employee_code, emp.first_name, emp.last_name
      from payslips p
      join payroll_run_employees e on e.id = p.payroll_run_employee_id and e.tenant_id = p.tenant_id
      join payroll_runs r on r.id = e.payroll_run_id and r.tenant_id = p.tenant_id
      left join employees emp on emp.id = e.employee_id and emp.tenant_id = p.tenant_id
      where p.tenant_id = ${access.tenantId} and p.id = ${payslipId}
      limit 1
    `,
  ]);
  const row = (rows as Array<PayslipRow & { run_employee_id: string }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  // A self-scoped caller must not learn that another employee's payslip exists.
  if (scope === "self" && row.employee_id !== selfEmployeeId) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }

  const components = await listComponents(access);
  const [lineRows, calculationRows, auditRows] = await tenantTx(access, [
    sqlClient`
      select pay_component_id, (attributes->>'code') as code, (attributes->>'kind') as kind, (attributes->>'amount_minor')::bigint as amount
      from payroll_lines
      where tenant_id = ${access.tenantId} and payroll_run_employee_id = ${row.run_employee_id}
      order by created_at
    `,
    sqlClient`
      select id, parent_calculation_id, pay_component_id, attributes
      from payroll_calculations
      where tenant_id = ${access.tenantId} and payroll_run_employee_id = ${row.run_employee_id}
      order by created_at
    `,
    sqlClient`
      select action, reason, created_at
      from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'payslip' and entity_id = ${payslipId}
      order by created_at desc limit 8
    `,
  ]);

  const traceIndex = buildTraceIndex(
    (calculationRows as Array<{ id: string; parent_calculation_id: string | null; pay_component_id: string | null; attributes: Record<string, unknown> | null }>).map((calculation) => ({
      id: calculation.id,
      parentId: calculation.parent_calculation_id,
      componentId: calculation.pay_component_id,
      attributes: record(calculation.attributes),
    })),
  );
  const lines = buildPayslipLines(
    (lineRows as Array<{ pay_component_id: string | null; code: string | null; kind: string | null; amount: number | string | null }>).map((line) => ({
      componentId: line.pay_component_id,
      code: line.code ?? "",
      kind: line.kind ?? "earning",
      amountMinor: minor(line.amount),
    })),
    components,
    traceIndex,
  );

  const summary = summaryOf(row);
  const attributes = record(row.attributes);
  const reached = PAYSLIP_STATES.filter((state) => typeof attributes[`${state}_at`] === "string");
  const auditTrail = (auditRows as Array<{ action: string; reason: string | null; created_at: string | null }>).map((entry) => ({
    action: entry.action,
    reason: entry.reason,
    createdAt: entry.created_at,
  }));
  return {
    ...summary,
    runEmployeeId: row.run_employee_id,
    lines,
    timeline: payslipTimeline(summary.state, reached),
    allowedActions: allowedPayslipActions(summary.state),
    traceRecorded: [...lines.earnings, ...lines.deductions, ...lines.informational].some((line) => line.traceAvailable),
    auditTrail,
  };
}

/* ------------------------------------------------------------------ *
 * Transition
 * ------------------------------------------------------------------ */

const TRANSITION_REASONS: Record<PayslipAction, string> = {
  publish: "Payslip published to the employee",
  view: "Payslip viewed by the employee",
  archive: "Payslip archived",
};

/**
 * Move a payslip along generated -> published -> viewed -> archived.
 * Every accepted transition writes an audit event, in the same shape
 * `finalizeRun` uses for the run itself.
 */
export async function transitionPayslip(
  access: Access,
  payslipId: string,
  action: PayslipAction,
  requestId: string,
): Promise<{ id: string; state: PayslipState; previousState: PayslipState; allowedActions: PayslipAction[] }> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from payslips where tenant_id = ${access.tenantId} and id = ${payslipId} limit 1`,
  ]);
  const row = (rows as Array<{ id: string; attributes: Record<string, unknown> | null }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const previousState = normalizePayslipState(record(row.attributes).state);
  const state = assertPayslipTransition(previousState, action);
  const patch = JSON.stringify({ state, [`${state}_at`]: new Date().toISOString() });
  await tenantTx(access, [
    sqlClient`
      update payslips set attributes = attributes || ${patch}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${payslipId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`payroll.payslip_${action}`}, 'payslip', ${payslipId}, ${TRANSITION_REASONS[action]},
        ${JSON.stringify({ from: previousState, to: state })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: payslipId, state, previousState, allowedActions: allowedPayslipActions(state) };
}
