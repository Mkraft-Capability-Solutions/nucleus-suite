import "server-only";

import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";
import { clearanceStatus, EARNING_HEADS, RECOVERY_HEADS, SETTLEMENT_PERMISSION, type SettlementHead } from "./settlement";

/**
 * The full and final PROPOSAL DESK (module `settlements`).
 *
 * SCR-056 (`src/components/hrms/full-final-page.tsx` over
 * `/api/v1/settlement-workings`) computes a leaver's working and finalises an
 * approved proposal against its gates. It has no create form, so nothing in the
 * product could RAISE a proposal. This module backs the screen that does: pick an
 * open exit case and a finalised payroll run, key every head, edit while the
 * proposal is draft or returned, and follow it through review.
 *
 * Nothing here writes. Creating, editing and transitioning a proposal all go
 * through the generic operational routes (`/api/v1/operations/settlements`),
 * which already own validation, idempotency, optimistic concurrency, the
 * maker/checker split, history and audit. What this module adds is the three
 * things those routes cannot answer:
 *
 *   1. WHICH exit case and WHICH payroll run may legally be cited. The create
 *      guard in `operational-service` refuses a proposal unless the offboarding
 *      case belongs to the employee and is not settled, and the payroll run is
 *      finalized. Without that list a person keys a uuid and gets a bare 409.
 *   2. The arithmetic of a keyed proposal BEFORE it is saved, using exactly the
 *      split `operational-validation` applies on save, so the desk never shows a
 *      net the server would disagree with.
 *   3. A prefill projection over a computed working that carries the
 *      INDETERMINATE heads through as indeterminate. A head the rule pack cannot
 *      support is never prefilled as zero: it comes back named, with the rules
 *      that block it, so the officer keys a reviewed figure knowingly.
 *
 * RL-341 is honoured throughout: a negative net is a legitimate settlement
 * outcome - the leaver owes more than is due - and is reported as a recovery to
 * collect, never as a validation failure.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The waiver is not a settlement head: it offsets recoveries on the earning side. */
export const WAIVER_HEAD = "recoveryWaiverMinor";
export const WAIVER_REASON_FIELD = "recoveryWaiverReason";

export const HEAD_LABELS: Record<string, string> = {
  salaryPayableMinor: "Salary for the final period",
  leaveEncashmentMinor: "Leave encashment",
  gratuityMinor: "Gratuity",
  bonusPayableMinor: "Bonus payable",
  noticePayableMinor: "Notice pay payable",
  otherEarningsMinor: "Other earnings",
  loanRecoveryMinor: "Loan foreclosure",
  noticeRecoveryMinor: "Notice shortfall recovery",
  advanceRecoveryMinor: "Salary advance recovery",
  assetRecoveryMinor: "Asset recovery",
  otherRecoveryMinor: "Other recovery",
  taxDeductionMinor: "Tax deducted at source",
  recoveryWaiverMinor: "Recovery waived",
};

/** Catalog-derived: a head with no `optional` flag must be keyed, even as zero. */
export const REQUIRED_FIELDS: string[] = operationalResources.settlements.fields
  .filter((field) => !field.optional && typeof field.name === "string")
  .map((field) => field.name as string);

export const EDITABLE_STATES: readonly string[] = operationalResources.settlements.editable;

function amount(values: Record<string, unknown>, code: string): number {
  const parsed = Number(values[code] ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export type SettlementLine = { code: string; amount_minor: number; direction: "earning" | "deduction" };

export type ProposalTotals = {
  lines: SettlementLine[];
  earningsMinor: number;
  recoveriesMinor: number;
  waiverMinor: number;
  netPayableMinor: number;
  settlementOutcome: "payable" | "recovery_pending";
  recoverableMinor: number;
};

/**
 * The same arithmetic `parseOperationalInput` applies to a `settlements` payload
 * on every save, reproduced so the desk can show the net it is about to record
 * rather than a number of its own. Deliberately identical in three respects: a
 * zero head produces no line, the waiver is an EARNING-side offset rather than a
 * quiet edit of the recovery it forgives, and a negative net is reported as
 * `recovery_pending` with a positive `recoverableMinor` instead of an error.
 */
export function proposalTotals(values: Record<string, unknown>): ProposalTotals {
  const recoveries = new Set<string>(RECOVERY_HEADS);
  const lines: SettlementLine[] = [...EARNING_HEADS, ...RECOVERY_HEADS]
    .map((code) => ({
      code: code as string,
      amount_minor: amount(values, code),
      direction: recoveries.has(code) ? ("deduction" as const) : ("earning" as const),
    }))
    .filter((line) => line.amount_minor !== 0);
  const waiverMinor = amount(values, WAIVER_HEAD);
  if (waiverMinor > 0) lines.push({ code: WAIVER_HEAD, amount_minor: waiverMinor, direction: "earning" });
  const earningsMinor = EARNING_HEADS.reduce((total, code) => total + amount(values, code), 0) + waiverMinor;
  const recoveriesMinor = RECOVERY_HEADS.reduce((total, code) => total + amount(values, code), 0);
  const netPayableMinor = earningsMinor - recoveriesMinor;
  return {
    lines,
    earningsMinor,
    recoveriesMinor,
    waiverMinor,
    netPayableMinor,
    settlementOutcome: netPayableMinor < 0 ? "recovery_pending" : "payable",
    recoverableMinor: netPayableMinor < 0 ? -netPayableMinor : 0,
  };
}

export const OTHER_RECOVERY_HEAD = "otherRecoveryMinor";
export const OTHER_RECOVERY_REASON_FIELD = "otherRecoveryReason";

/** FRM-PAY-08: a waiver reason is "authorised role; min 20 chars". */
export const SETTLEMENT_WAIVER_REASON_MIN_LENGTH = 20;

/** FRM-PAY-08 "Approval and remarks": minimum 10 characters. */
export const SETTLEMENT_REMARKS_MIN_LENGTH = 10;

function reasonIssue(
  values: Record<string, unknown>,
  head: string,
  field: string,
  minLength: number,
  missing: string,
): { field: string; issue: string } | null {
  if (amount(values, head) <= 0) return null;
  const raw = values[field];
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length >= minLength) return null;
  return { field, issue: text.length === 0 ? missing : `${missing} At least ${minLength} characters; this one is ${text.length}.` };
}

/**
 * Mirrors the WAIVER_REASON_REQUIRED rule in `operational-validation`, so the
 * desk names the missing reason before the save is attempted rather than after.
 */
export function waiverReasonIssue(values: Record<string, unknown>): { field: string; issue: string } | null {
  return reasonIssue(
    values,
    WAIVER_HEAD,
    WAIVER_REASON_FIELD,
    SETTLEMENT_WAIVER_REASON_MIN_LENGTH,
    "A recovery waiver requires a reason. Say what is being forgiven and on whose authority.",
  );
}

/** FRM-PAY-08 makes a reason mandatory on "Other recovery": an unexplained deduction is a dispute. */
export function otherRecoveryReasonIssue(values: Record<string, unknown>): { field: string; issue: string } | null {
  return reasonIssue(
    values,
    OTHER_RECOVERY_HEAD,
    OTHER_RECOVERY_REASON_FIELD,
    1,
    "An other recovery requires a reason. Say what is being recovered and why.",
  );
}

/** Every FRM-PAY-08 reason rule in one place, for the desk and the API alike. */
export function settlementReasonIssues(values: Record<string, unknown>): Array<{ field: string; issue: string }> {
  return [waiverReasonIssue(values), otherRecoveryReasonIssue(values)].filter(
    (issue): issue is { field: string; issue: string } => issue !== null,
  );
}

export type ActionAvailability = { action: string; allowed: boolean; reason: string; ownedElsewhere: boolean };

/** Actions this desk drives. `finalize` stays on SCR-056, which owns the gates. */
export const DESK_ACTIONS = ["submit", "approve", "return", "reject", "cancel"] as const;

function humanStatus(status: string): string {
  return status ? status.replace(/_/g, " ") : "not loaded";
}

/**
 * Whether one transition is legal from `status`, straight off the operational
 * catalog so the buttons can never claim a transition the server would refuse.
 * `finalize` is reported as legal-but-elsewhere: this desk links to SCR-056 for
 * it rather than rebuilding the payroll-run, no-dues, asset and loan gates.
 */
export function proposalActionState(action: string, status: string): ActionAvailability {
  const transition = Object.hasOwn(operationalResources.settlements.transitions, action)
    ? operationalResources.settlements.transitions[action]
    : undefined;
  if (!transition) {
    return { action, allowed: false, reason: `"${action}" is not a transition of a settlement proposal.`, ownedElsewhere: false };
  }
  const legal = transition.from.includes(status);
  if (action === "finalize") {
    return {
      action,
      allowed: false,
      ownedElsewhere: true,
      reason: legal
        ? "Finalize is driven from the full and final settlement screen, which checks the payroll run, no-dues, assets and loan recovery before it settles."
        : `Finalize runs from ${transition.from.join(" or ")}; this proposal is ${humanStatus(status)}.`,
    };
  }
  return {
    action,
    allowed: legal,
    ownedElsewhere: false,
    reason: legal
      ? ""
      : `${action.replace(/^./, (c) => c.toUpperCase())} is only available from ${transition.from.join(" or ")}; this proposal is ${humanStatus(status)}.`,
  };
}

export function proposalActionStates(status: string): ActionAvailability[] {
  return [...DESK_ACTIONS, "finalize"].map((action) => proposalActionState(action, status));
}

/** Why this proposal cannot be edited, or `null` when it can. */
export function proposalEditIssue(status: string): string | null {
  if (EDITABLE_STATES.includes(status)) return null;
  return `A proposal can only be edited while it is ${EDITABLE_STATES.join(" or ")}; this one is ${humanStatus(status)}.`;
}

export type PrefillHead = {
  head: SettlementHead;
  label: string;
  direction: "earning" | "recovery";
  amountMinor: number | null;
  basis: string;
  indeterminate: boolean;
  missingRules: string[];
  required: boolean;
};

export type PrefillProjection = {
  employeeId: string;
  currency: string;
  period: string;
  lastWorkingDate: string;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  rulePackCode: string;
  heads: PrefillHead[];
  /** Determinate heads only. An indeterminate head is absent, never zero. */
  values: Record<string, number>;
  indeterminate: PrefillHead[];
  missingRules: string[];
  totals: ProposalTotals;
};

/** The shape `computeSettlementWorking` returns, narrowed to what a prefill needs. */
export type WorkingLike = {
  employee: { id: string; currency: string };
  period: string;
  lastWorkingDate: string;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  rulePackCode: string;
  figures: Array<{
    head: SettlementHead;
    label: string;
    direction: "earning" | "recovery";
    amountMinor: number | null;
    basis: string;
    indeterminate: boolean;
    blockedBy: string[];
  }>;
};

/**
 * Project a computed working onto the proposal form.
 *
 * The one rule that matters: a head the working could not determine is NOT
 * prefilled. It is returned in `indeterminate` with the rules that block it and
 * left out of `values`, so the field stays empty and the screen can say "rule
 * pack in-pay/v1 supplies no gratuity.daysPerYear" instead of showing a zero
 * that reads like a computed answer. `totals` reflect only what was determined,
 * which is why the caller must present them as provisional whenever
 * `indeterminate` is non-empty.
 */
export function prefillFromWorking(working: WorkingLike): PrefillProjection {
  const required = new Set(REQUIRED_FIELDS);
  const heads: PrefillHead[] = working.figures.map((figure) => ({
    head: figure.head,
    label: figure.label || HEAD_LABELS[figure.head] || figure.head,
    direction: figure.direction,
    amountMinor: figure.indeterminate ? null : figure.amountMinor,
    basis: figure.basis,
    indeterminate: figure.indeterminate || figure.amountMinor === null,
    missingRules: figure.blockedBy,
    required: required.has(figure.head),
  }));
  const values: Record<string, number> = {};
  for (const head of heads) {
    if (!head.indeterminate && head.amountMinor !== null) values[head.head] = head.amountMinor;
  }
  const indeterminate = heads.filter((head) => head.indeterminate);
  return {
    employeeId: working.employee.id,
    currency: working.employee.currency,
    period: working.period,
    lastWorkingDate: working.lastWorkingDate,
    payrollRunId: working.payrollRunId,
    payrollRunStatus: working.payrollRunStatus,
    rulePackCode: working.rulePackCode,
    heads,
    values,
    indeterminate,
    missingRules: [...new Set(indeterminate.flatMap((head) => head.missingRules))],
    totals: proposalTotals(values),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type ExitOption = {
  offboardingCaseId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  currency: string;
  lastWorkingDate: string | null;
  exitReason: string | null;
  caseStatus: string;
  clearanceItems: number;
  openClearanceItems: number;
  /** FRM-PAY-08 "Clearance status" (PL_CLEARANCE_STATUS), derived from the items above. */
  clearanceStatus: string;
  proposals: number;
  liveProposalId: string | null;
  blocking: string | null;
};

export type PayrollRunOption = { id: string; period: string; status: string };

type ExitRow = {
  offboarding_case_id: string;
  employee_id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  currency: string | null;
  last_working_date: string | null;
  exit_reason: string | null;
  case_status: string | null;
  clearance_items: number;
  open_clearance_items: number;
  proposals: number;
  live_proposal_id: string | null;
};

function exitOption(row: ExitRow): ExitOption {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const blocking = row.last_working_date === null
    ? "This exit case records no last working date, so no settlement period can be derived. Record the exit notice before proposing."
    : row.live_proposal_id !== null
      ? "A live proposal already exists for this exit; open it instead of raising a second one."
      : null;
  return {
    offboardingCaseId: row.offboarding_case_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: name.length > 0 ? name : (row.employee_code ?? "Unnamed leaver"),
    currency: row.currency ?? "INR",
    lastWorkingDate: row.last_working_date,
    exitReason: row.exit_reason,
    caseStatus: row.case_status ?? "unknown",
    clearanceItems: Number(row.clearance_items ?? 0),
    openClearanceItems: Number(row.open_clearance_items ?? 0),
    clearanceStatus: clearanceStatus({ total: Number(row.clearance_items ?? 0), open: Number(row.open_clearance_items ?? 0) }),
    proposals: Number(row.proposals ?? 0),
    liveProposalId: row.live_proposal_id,
    blocking,
  };
}

/**
 * The exits a proposal may legally cite, and the payroll runs it may be paid
 * from. Both lists reproduce the create guard in `operational-service`: the
 * offboarding case must belong to the employee and must not be settled, and the
 * payroll run must be finalized. Runs in any other state are not offered because
 * the write would be refused - the desk says so rather than listing them.
 */
export async function listProposalOptions(access: Access): Promise<{ exits: ExitOption[]; payrollRuns: PayrollRunOption[]; eligibility: string }> {
  const scope = operationalScope(access, SETTLEMENT_PERMISSION, "read");
  const employeeId = access.context.employeeId ?? null;
  const [exitRows, runRows] = await tenantTx(access, [
    sqlClient`
      select o.id as offboarding_case_id,
             m.employee_id,
             e.employee_code, e.first_name, e.last_name, e.currency,
             l.attributes->>'last_working_date' as last_working_date,
             l.attributes->>'reason' as exit_reason,
             o.attributes->>'status' as case_status,
             coalesce(c.total_items, 0)::int as clearance_items,
             coalesce(c.open_items, 0)::int as open_clearance_items,
             coalesce(p.proposals, 0)::int as proposals,
             p.live_proposal_id
      from offboarding_cases o
      join employments m on m.tenant_id = o.tenant_id and m.id = o.employment_id
      join employees e on e.tenant_id = o.tenant_id and e.id = m.employee_id
      left join lifecycle_events l on l.tenant_id = o.tenant_id and l.id = o.lifecycle_event_id
      left join lateral (
        select count(*)::int as total_items,
               count(*) filter (where coalesce(i.attributes->>'status', 'pending') <> 'cleared')::int as open_items
        from clearance_items i where i.tenant_id = o.tenant_id and i.offboarding_case_id = o.id
      ) c on true
      left join lateral (
        select count(*)::int as proposals,
               max(r.id::text) filter (where r.status not in ('rejected', 'cancelled')) as live_proposal_id
        from hrms_operation_records r
        where r.tenant_id = o.tenant_id and r.resource = 'settlements' and r.data->>'offboardingCaseId' = o.id::text
      ) p on true
      where o.tenant_id = ${access.tenantId}
        and coalesce(o.attributes->>'status', '') <> 'settled'
        and (${scope} = 'all' or m.employee_id = ${employeeId}::uuid
             or (${scope} = 'team' and m.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${employeeId}::uuid)))
      order by l.attributes->>'last_working_date' desc nulls last, e.employee_code
      limit 100
    `,
    sqlClient`
      select id, period, status from payroll_runs
      where tenant_id = ${access.tenantId} and status = 'finalized'
      order by period desc limit 100
    `,
  ]);
  return {
    exits: (exitRows as ExitRow[]).map(exitOption),
    payrollRuns: (runRows as Array<{ id: string; period: string; status: string }>).map((row) => ({ id: row.id, period: row.period, status: row.status })),
    eligibility:
      "A proposal may only cite an exit case that is not yet settled and belongs to the same employee, and a payroll run that is already finalized. Runs in any other state are not listed because the write would be refused.",
  };
}

export type ProposalAuditEntry = { action: string; reason: string | null; status: string | null; createdAt: string | null };

export type ProposalDetail = {
  id: string;
  version: number;
  status: string;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  currency: string;
  offboardingCaseId: string | null;
  offboardingCaseStatus: string | null;
  payrollRunId: string | null;
  payrollRunStatus: string | null;
  payrollRunPeriod: string | null;
  lastWorkingDate: string | null;
  exitType: string | null;
  calculationPolicyReference: string | null;
  notes: string | null;
  recoveryWaiverReason: string | null;
  /** Every head exactly as it is stored on the record. */
  values: Record<string, number>;
  totals: ProposalTotals;
  /** What the server derived and recorded on the last save. */
  recordedNetPayableMinor: number | null;
  recordedOutcome: string | null;
  recordedMatchesHeads: boolean;
  editable: boolean;
  editIssue: string | null;
  actions: ActionAvailability[];
  auditTrail: ProposalAuditEntry[];
  createdAt: string | null;
  updatedAt: string | null;
};

type ProposalRow = {
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
  currency: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * One proposal as the desk edits it: every stored head, the arithmetic they
 * produce, the transitions legal from its state and its audited history.
 *
 * Deliberately does NOT compute a settlement working or the finalize gates -
 * that is SCR-056's job, reached from the link on this screen. Keeping them
 * apart means opening a proposal to edit a figure costs one indexed read
 * instead of the salary-structure, leave-ledger and rule-pack resolution a
 * working needs.
 */
export async function getProposalDetail(access: Access, id: string): Promise<ProposalDetail> {
  const scope = operationalScope(access, SETTLEMENT_PERMISSION, "read");
  if (!UUID.test(id)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Invalid record reference.", details: [{ field: "proposalId", issue: "Expected a uuid." }] });
  }
  const employeeId = access.context.employeeId ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.version, r.status, r.employee_id, r.data,
             r.created_at::text as created_at, r.updated_at::text as updated_at,
             e.employee_code, e.first_name, e.last_name, e.currency
      from hrms_operation_records r
      left join employees e on e.tenant_id = r.tenant_id and e.id = r.employee_id
      where r.tenant_id = ${access.tenantId} and r.resource = 'settlements' and r.id = ${id}::uuid
        and (${scope} = 'all' or r.employee_id = ${employeeId}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${employeeId}::uuid)))
      limit 1
    `,
  ]);
  const row = (rows as ProposalRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });

  const data = row.data ?? {};
  const offboardingCaseId = text(data.offboardingCaseId);
  const payrollRunId = text(data.payrollRunId);
  const [caseRows, runRows, eventRows] = await tenantTx(access, [
    sqlClient`select attributes->>'status' as status from offboarding_cases where tenant_id = ${access.tenantId} and id = ${offboardingCaseId}::uuid limit 1`,
    sqlClient`select period, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${payrollRunId}::uuid limit 1`,
    sqlClient`
      select action, reason, response->>'status' as status, created_at::text as created_at
      from hrms_operation_events where tenant_id = ${access.tenantId} and record_id = ${id}
      order by created_at, id limit 100
    `,
  ]);
  const run = (runRows as Array<{ period: string; status: string }>)[0] ?? null;

  const values: Record<string, number> = {};
  for (const code of [...EARNING_HEADS, ...RECOVERY_HEADS, WAIVER_HEAD]) values[code] = amount(data, code);
  const totals = proposalTotals(data);
  const recordedRaw = data.netPayableMinor;
  const recordedNet = recordedRaw === null || recordedRaw === undefined || !Number.isFinite(Number(recordedRaw)) ? null : Number(recordedRaw);
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

  return {
    id: row.id,
    version: Number(row.version),
    status: row.status,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: name.length > 0 ? name : null,
    currency: row.currency ?? "INR",
    offboardingCaseId,
    offboardingCaseStatus: (caseRows as Array<{ status: string | null }>)[0]?.status ?? null,
    payrollRunId,
    payrollRunStatus: run?.status ?? null,
    payrollRunPeriod: run?.period ?? null,
    lastWorkingDate: text(data.lastWorkingDate),
    exitType: text(data.exitType),
    calculationPolicyReference: text(data.calculationPolicyReference),
    notes: text(data.notes),
    recoveryWaiverReason: text(data[WAIVER_REASON_FIELD]),
    values,
    totals,
    recordedNetPayableMinor: recordedNet,
    recordedOutcome: text(data.settlementOutcome),
    recordedMatchesHeads: recordedNet === null ? true : recordedNet === totals.netPayableMinor,
    editable: proposalEditIssue(row.status) === null,
    editIssue: proposalEditIssue(row.status),
    actions: proposalActionStates(row.status),
    auditTrail: (eventRows as Array<{ action: string; reason: string | null; status: string | null; created_at: string | null }>).map((entry) => ({
      action: entry.action,
      reason: entry.reason,
      status: entry.status,
      createdAt: entry.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
