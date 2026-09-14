import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listComponents, type ComponentKind, type PayComponentRow } from "./components";

/**
 * SCR-102 — GL mapping and journal.
 *
 * Replaces the seven hard-coded account strings in `service.getJournal` with a
 * chart of accounts (`gl_accounts`), effective-dated component mappings
 * (`gl_mappings` + the `ledger` operational workflow) and a posted journal held
 * in `payroll_exports` / `payroll_export_lines`.
 *
 * Business rules implemented here:
 *  - RL-521 / FIN-03.2: every component present in a run must carry an effective
 *    approved mapping for the employee's legal entity. `unmappedComponents`
 *    returns the exceptions; `buildJournal` refuses to run while any remain.
 *  - RL-522: one balanced journal per run per legal entity, dimensioned by cost
 *    centre, department, location, project and run type. Balance is produced by
 *    construction (the net-pay leg is derived from the very lines that make it
 *    up) and then asserted; a residual is named, never absorbed.
 *  - RL-531: every journal line carries the payroll lines and employees that
 *    contributed to it, so a figure drills back to the people behind it.
 *
 * The mapping *workflow* is not re-implemented: draft -> submitted -> approved
 * (+ return/reject/cancel) and retire already live on the `ledger` operational
 * resource, including its effective-date overlap guard. This module reads that
 * workflow and materialises the approved result into `gl_mappings`.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const GL_ACCOUNT_TYPES = ["asset", "liability", "expense", "income"] as const;
export type GlAccountType = (typeof GL_ACCOUNT_TYPES)[number];

/** `net_pay` marks the single bank / salary-payable account of a legal entity. */
export const GL_ACCOUNT_PURPOSES = ["component", "net_pay"] as const;
export type GlAccountPurpose = (typeof GL_ACCOUNT_PURPOSES)[number];

/** The journal's own lifecycle. A superseded export is retained, never deleted. */
export const JOURNAL_STATES = ["draft", "validated", "posted", "superseded"] as const;
export type JournalState = (typeof JOURNAL_STATES)[number];

/** Mapping workflow states, as the `ledger` operational resource defines them. */
export const MAPPING_STATES = ["draft", "submitted", "returned", "rejected", "cancelled", "approved", "retired"] as const;
export type MappingState = (typeof MAPPING_STATES)[number];

export type PostingSide = "debit" | "credit";

/** Dimension names a journal line can carry. `run_type` is always present. */
export const JOURNAL_DIMENSIONS = ["cost_center", "department", "location", "project", "run_type"] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type GlAccountRef = {
  id: string;
  code: string;
  name: string;
  type: GlAccountType;
  purpose: GlAccountPurpose;
};

export type GlAccountRow = GlAccountRef & {
  legalEntityId: string;
  status: "active" | "inactive";
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type ResolvedMapping = {
  legalEntityId: string;
  componentCode: string;
  componentName: string;
  kind: ComponentKind;
  postingSide: PostingSide;
  debitAccount: GlAccountRef | null;
  creditAccount: GlAccountRef | null;
  costCenterSource: string;
  /** FRM-FIN-01 "Dimension source": every dimension the line is split by, at least one. */
  dimensionSource: string[];
  costCenterId: string | null;
  costCenterCode: string | null;
  /** FRM-FIN-01 "Override by location", carried through so the screen can show what overrides what. */
  locationOverrides: LedgerRecord["locationOverrides"];
  startDate: string | null;
  endDate: string | null;
  status: MappingState;
  /** `hrms_operation_records.id` of the `ledger` record carrying the workflow. */
  workflowRecordId: string | null;
  /** `gl_mappings.id` once the approved mapping has been materialised. */
  mappingId: string | null;
  dimensions: readonly string[];
};

export type LineDimensions = {
  costCenterId: string | null;
  costCenterCode: string | null;
  departmentId: string | null;
  department: string | null;
  locationId: string | null;
  location: string | null;
  projectId: string | null;
  runType: string;
};

/** The cost centres a line could resolve to, before the mapping chooses one. */
export type CostCenterOptions = {
  assignmentId: string | null;
  assignmentCode: string | null;
  positionId: string | null;
  positionCode: string | null;
};

export type SourceLine = {
  payrollLineId: string;
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  componentCode: string;
  kind: ComponentKind;
  amountMinor: number;
  legalEntityId: string | null;
  costCenterOptions: CostCenterOptions;
  dimensions: LineDimensions;
};

export type JournalContribution = {
  payrollLineId: string;
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string | null;
  amountMinor: number;
};

export type JournalLine = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: GlAccountType;
  componentCode: string | null;
  debitMinor: number;
  creditMinor: number;
  dimensions: LineDimensions;
  /** RL-531 drill-back: the payroll lines and employees behind this figure. */
  contributions: JournalContribution[];
};

export type Journal = {
  legalEntityId: string;
  runId: string;
  runType: string;
  lines: JournalLine[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  residualMinor: number;
  balanced: boolean;
};

export type UnmappedComponent = {
  legalEntityId: string | null;
  componentCode: string;
  componentName: string;
  kind: ComponentKind;
  amountMinor: number;
  employeeCount: number;
  reason: string;
};

// ---------------------------------------------------------------------------
// Pure helpers (no database; every one of these is unit-tested)
// ---------------------------------------------------------------------------

/** Last calendar day of a `YYYY-MM` period; the date a mapping is resolved at. */
export function periodEndDate(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${match[1]}-${match[2]}-${String(day).padStart(2, "0")}`;
}

/** A mapping posts only while it is approved and its window covers `asOf`. */
export function mappingEffective(mapping: Pick<ResolvedMapping, "status" | "startDate" | "endDate">, asOf: string): boolean {
  if (mapping.status !== "approved") return false;
  if (mapping.startDate && mapping.startDate > asOf) return false;
  if (mapping.endDate && mapping.endDate < asOf) return false;
  return true;
}

/** Which side of the journal a component's own account sits on. */
export function naturalSide(kind: ComponentKind): PostingSide | null {
  if (kind === "earning" || kind === "reimbursement" || kind === "employer_contribution") return "debit";
  if (kind === "deduction") return "credit";
  return null; // information_only never reaches the ledger
}

/** Does a component of this kind move the amount an employee is actually paid? */
export function affectsNetPay(kind: ComponentKind): boolean {
  return kind === "earning" || kind === "reimbursement" || kind === "deduction";
}

/**
 * Why a mapping cannot post a component, or null when it can.
 * The declared posting side is load-bearing: a credit-side mapping cannot carry
 * an earning, and the mismatch blocks the run rather than posting to the wrong side.
 */
export function mappingIssue(mapping: ResolvedMapping | undefined, kind: ComponentKind, asOf: string): string | null {
  if (!mapping) return "No GL mapping exists for this component and legal entity.";
  if (mapping.status !== "approved") return `The GL mapping is ${mapping.status}, not approved.`;
  if (!mappingEffective(mapping, asOf)) return `The GL mapping is not effective on ${asOf}.`;
  const side = naturalSide(kind);
  if (side === null) return null;
  if (kind === "employer_contribution") {
    if (!mapping.debitAccount || !mapping.creditAccount) return "An employer contribution needs both an expense and a liability account.";
    return null;
  }
  if (mapping.postingSide !== side) return `The mapping posts to the ${mapping.postingSide} side, but a ${kind} posts to the ${side} side.`;
  if (side === "debit" && !mapping.debitAccount) return "The mapped debit account does not exist in this legal entity's chart of accounts.";
  if (side === "credit" && !mapping.creditAccount) return "The mapped credit account does not exist in this legal entity's chart of accounts.";
  return null;
}

/** The account a component's own leg posts to. */
export function accountForLine(mapping: ResolvedMapping, kind: ComponentKind): GlAccountRef | null {
  const side = naturalSide(kind);
  if (side === "debit") return mapping.debitAccount;
  if (side === "credit") return mapping.creditAccount;
  return null;
}

/**
 * RL-521 / FIN-03.2 — components in the run that cannot post.
 * Pure over already-gathered lines and mappings so it is testable without a run.
 */
export function findUnmappedComponents(
  lines: SourceLine[],
  mappings: ResolvedMapping[],
  asOf: string,
  componentNames: Record<string, { name: string; kind: ComponentKind }> = {},
): UnmappedComponent[] {
  const index = new Map(mappings.map((mapping) => [`${mapping.legalEntityId}::${mapping.componentCode}`, mapping]));
  const buckets = new Map<string, UnmappedComponent>();
  const employeesByKey = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.kind === "information_only") continue;
    const key = `${line.legalEntityId ?? ""}::${line.componentCode}`;
    const mapping = index.get(key);
    const reason = line.legalEntityId === null
      ? "The employee has no legal entity, so no mapping can be resolved."
      : mappingIssue(mapping, line.kind, asOf);
    if (!reason) continue;
    const employees = employeesByKey.get(key) ?? new Set<string>();
    employees.add(line.employeeId);
    employeesByKey.set(key, employees);
    const existing = buckets.get(key);
    if (existing) {
      existing.amountMinor += line.amountMinor;
      existing.employeeCount = employees.size;
      continue;
    }
    buckets.set(key, {
      legalEntityId: line.legalEntityId,
      componentCode: line.componentCode,
      componentName: componentNames[line.componentCode]?.name ?? mapping?.componentName ?? line.componentCode,
      kind: line.kind,
      amountMinor: line.amountMinor,
      employeeCount: employees.size,
      reason,
    });
  }
  return [...buckets.values()].sort((left, right) => left.componentCode.localeCompare(right.componentCode));
}

/** A stable key for one dimension combination, so lines aggregate predictably. */
export function dimensionKey(dimensions: LineDimensions): string {
  return [
    dimensions.costCenterId ?? "",
    dimensions.departmentId ?? dimensions.department ?? "",
    dimensions.locationId ?? dimensions.location ?? "",
    dimensions.projectId ?? "",
    dimensions.runType,
  ].join("|");
}

/**
 * Resolve the cost centre a mapping asks for. An unavailable dimension stays
 * null rather than falling back to an invented value.
 */
export function resolveCostCenter(
  costCenterSource: string,
  options: CostCenterOptions,
  mapping: { costCenterId: string | null; costCenterCode: string | null },
): { costCenterId: string | null; costCenterCode: string | null } {
  const source = costCenterSource.trim().toLowerCase();
  if (source === "" || source === "none") return { costCenterId: null, costCenterCode: null };
  if (source === "position") return { costCenterId: options.positionId, costCenterCode: options.positionCode };
  if (source === "mapping" || source === "fixed") return { costCenterId: mapping.costCenterId, costCenterCode: mapping.costCenterCode };
  // "employee", "employee_assignment", "assignment" and anything unrecognised
  // resolve against the employee's own assignment, which is the only cost centre
  // every payroll line is guaranteed to be able to reach.
  return { costCenterId: options.assignmentId, costCenterCode: options.assignmentCode };
}

/**
 * Assert a journal balances to the minor unit and name the residual if it does not.
 * The current implementation in `service.getJournal` debits total earnings while
 * crediting earnings-minus-deductions *plus* each deduction; that arithmetic is
 * unsound and this guard exists so the same mistake cannot be shipped again.
 */
export function assertBalanced(lines: Pick<JournalLine, "debitMinor" | "creditMinor">[], context: { runId: string; legalEntityId: string }): { totalDebitMinor: number; totalCreditMinor: number } {
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.debitMinor) || !Number.isInteger(line.creditMinor)) {
      throw new HttpError({ status: 422, code: "GL_JOURNAL_UNBALANCED", message: "Journal amounts must be integer minor units." });
    }
    totalDebitMinor += line.debitMinor;
    totalCreditMinor += line.creditMinor;
  }
  const residualMinor = totalDebitMinor - totalCreditMinor;
  if (residualMinor !== 0) {
    throw new HttpError({
      status: 422,
      code: "GL_JOURNAL_UNBALANCED",
      message: `The journal for run ${context.runId} and legal entity ${context.legalEntityId} does not balance: debits ${totalDebitMinor} minus credits ${totalCreditMinor} leaves a residual of ${residualMinor} minor units.`,
      details: [{ field: "residualMinor", issue: String(residualMinor) }],
    });
  }
  return { totalDebitMinor, totalCreditMinor };
}

export type ComposeInput = {
  runId: string;
  runType: string;
  legalEntityId: string;
  lines: SourceLine[];
  mappings: ResolvedMapping[];
  netPayAccount: GlAccountRef;
  asOf: string;
};

/**
 * RL-522 — compose one balanced, dimensioned journal for a single legal entity.
 *
 * Every leg is driven by a mapping; no account string is written here. The
 * net-pay leg is derived from the same lines that produced the component legs,
 * so debits equal credits by construction, and `assertBalanced` then proves it.
 */
export function composeJournal(input: ComposeInput): Journal {
  const index = new Map(input.mappings.map((mapping) => [mapping.componentCode, mapping]));
  const groups = new Map<string, JournalLine>();
  const netByDimension = new Map<string, { dimensions: LineDimensions; amountMinor: number; contributions: JournalContribution[] }>();

  const push = (account: GlAccountRef, componentCode: string | null, side: PostingSide, dimensions: LineDimensions, contribution: JournalContribution): void => {
    const key = `${account.id}|${componentCode ?? ""}|${side}|${dimensionKey(dimensions)}`;
    const existing = groups.get(key);
    if (existing) {
      if (side === "debit") existing.debitMinor += contribution.amountMinor;
      else existing.creditMinor += contribution.amountMinor;
      existing.contributions.push(contribution);
      return;
    }
    groups.set(key, {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      componentCode,
      debitMinor: side === "debit" ? contribution.amountMinor : 0,
      creditMinor: side === "credit" ? contribution.amountMinor : 0,
      dimensions,
      contributions: [contribution],
    });
  };

  for (const line of input.lines) {
    if (line.kind === "information_only") continue;
    const mapping = index.get(line.componentCode);
    const issue = mappingIssue(mapping, line.kind, input.asOf);
    if (issue || !mapping) {
      throw new HttpError({ status: 409, code: "GL_MAPPING_MISSING", message: `Component ${line.componentCode} cannot post: ${issue ?? "no mapping."}` });
    }
    if (!Number.isInteger(line.amountMinor)) {
      throw new HttpError({ status: 422, code: "GL_JOURNAL_UNBALANCED", message: `Component ${line.componentCode} carries a non-integer amount.` });
    }
    const resolved = resolveCostCenter(mapping.costCenterSource, line.costCenterOptions, { costCenterId: mapping.costCenterId, costCenterCode: mapping.costCenterCode });
    const dimensions: LineDimensions = { ...line.dimensions, ...resolved, runType: input.runType };
    const contribution: JournalContribution = {
      payrollLineId: line.payrollLineId,
      payrollRunEmployeeId: line.payrollRunEmployeeId,
      employeeId: line.employeeId,
      employeeCode: line.employeeCode,
      employeeName: line.employeeName,
      amountMinor: line.amountMinor,
    };

    if (line.kind === "employer_contribution") {
      // Both legs belong to the employer: an expense and the matching liability.
      push(mapping.debitAccount as GlAccountRef, line.componentCode, "debit", dimensions, contribution);
      push(mapping.creditAccount as GlAccountRef, line.componentCode, "credit", dimensions, contribution);
      continue;
    }

    const side = naturalSide(line.kind) as PostingSide;
    const account = accountForLine(mapping, line.kind) as GlAccountRef;
    push(account, line.componentCode, side, dimensions, contribution);

    if (affectsNetPay(line.kind)) {
      const key = dimensionKey(dimensions);
      const signed = side === "debit" ? line.amountMinor : -line.amountMinor;
      const bucket = netByDimension.get(key);
      if (bucket) {
        bucket.amountMinor += signed;
        bucket.contributions.push(contribution);
      } else {
        netByDimension.set(key, { dimensions, amountMinor: signed, contributions: [contribution] });
      }
    }
  }

  for (const bucket of netByDimension.values()) {
    if (bucket.amountMinor === 0) continue;
    const side: PostingSide = bucket.amountMinor > 0 ? "credit" : "debit";
    const magnitude = Math.abs(bucket.amountMinor);
    const key = `${input.netPayAccount.id}|net_pay|${side}|${dimensionKey(bucket.dimensions)}`;
    groups.set(key, {
      accountId: input.netPayAccount.id,
      accountCode: input.netPayAccount.code,
      accountName: input.netPayAccount.name,
      accountType: input.netPayAccount.type,
      componentCode: null,
      debitMinor: side === "debit" ? magnitude : 0,
      creditMinor: side === "credit" ? magnitude : 0,
      dimensions: bucket.dimensions,
      contributions: bucket.contributions,
    });
  }

  // Deterministic order: debits first, then account code, then component. The
  // fingerprint is taken over this order, so posting the same run twice matches.
  const lines = [...groups.values()].sort((left, right) => {
    const leftSide = left.debitMinor > 0 ? 0 : 1;
    const rightSide = right.debitMinor > 0 ? 0 : 1;
    if (leftSide !== rightSide) return leftSide - rightSide;
    return (
      left.accountCode.localeCompare(right.accountCode) ||
      (left.componentCode ?? "").localeCompare(right.componentCode ?? "") ||
      dimensionKey(left.dimensions).localeCompare(dimensionKey(right.dimensions))
    );
  });
  const totals = assertBalanced(lines, { runId: input.runId, legalEntityId: input.legalEntityId });
  return {
    legalEntityId: input.legalEntityId,
    runId: input.runId,
    runType: input.runType,
    lines,
    totalDebitMinor: totals.totalDebitMinor,
    totalCreditMinor: totals.totalCreditMinor,
    residualMinor: 0,
    balanced: true,
  };
}

/** A content hash of a journal, so re-posting an unchanged journal is a no-op. */
export function journalFingerprint(journal: Journal): string {
  const canonical = journal.lines.map((line) => [line.accountCode, line.componentCode ?? "", line.debitMinor, line.creditMinor, dimensionKey(line.dimensions)]);
  return createHash("sha256").update(JSON.stringify({ runId: journal.runId, legalEntityId: journal.legalEntityId, canonical })).digest("hex");
}

export type ExportAction = { action: "unchanged"; exportId: string } | { action: "create" } | { action: "supersede"; exportId: string };

/**
 * Idempotent posting: the same journal posted twice changes nothing; a changed
 * journal supersedes the earlier export, which is kept for the audit trail.
 */
export function resolveExportAction(existing: { id: string; state: JournalState; fingerprint: string } | null, fingerprint: string): ExportAction {
  if (!existing || existing.state === "superseded") return { action: "create" };
  if (existing.fingerprint === fingerprint) return { action: "unchanged", exportId: existing.id };
  return { action: "supersede", exportId: existing.id };
}

/**
 * One `ledger` workflow record, as FRM-FIN-01 describes a GL mapping.
 *
 * The workbook gives a mapping a debit account AND a credit account. Nucleus's `ledger` resource
 * was declared with a single `accountCode` plus a `postingSide`, which can only name one of the
 * two. Both shapes are read here: `debitAccountCode` / `creditAccountCode` when the record carries
 * them, and otherwise `accountCode` resolved onto the side `postingSide` names. The single-sided
 * form stays readable because records already exist in it; new records should carry both, and the
 * catalog change that lets them is recorded in `tmp/_audit/requests/payroll.md`.
 */
export type LedgerRecord = {
  id: string;
  status: string;
  /** FRM-FIN-01 "Legal entity". Null on a record written before the field existed, which then applies to every entity. */
  entityCode: string | null;
  componentCode: string;
  accountCode: string;
  postingSide: string;
  debitAccountCode: string | null;
  creditAccountCode: string | null;
  /** FRM-FIN-01 "Dimension source": at least one, cost centre from the assignment by default. */
  dimensionSource: string[];
  costCenterSource: string;
  /** FRM-FIN-01 "Override by location": location code plus the two accounts that replace the defaults. */
  locationOverrides: Array<{ location: string; debitAccountCode: string | null; creditAccountCode: string | null }>;
  startDate: string | null;
  endDate: string | null;
};
export type GlMappingRow = { id: string; legalEntityId: string; componentCode: string; debitAccountId: string | null; creditAccountId: string | null; costCenterId: string | null; costCenterCode: string | null; status: string | null; postingSide: string | null; costCenterSource: string | null; startDate: string | null; endDate: string | null };

/**
 * Merge the `ledger` workflow records, the chart of accounts and any
 * materialised `gl_mappings` rows into one resolved mapping per
 * (legal entity, component). Pure, so the precedence rules are testable.
 */
export function mergeMappings(input: {
  legalEntityIds: string[];
  components: Array<Pick<PayComponentRow, "code" | "name" | "kind">>;
  ledgerRecords: LedgerRecord[];
  accounts: GlAccountRow[];
  mappingRows: GlMappingRow[];
  asOf: string;
  /** Legal entity id -> entity code, so FRM-FIN-01's per-entity mappings can be matched. */
  legalEntityCodes?: Record<string, string>;
}): ResolvedMapping[] {
  const componentsByCode = new Map(input.components.map((component) => [component.code, component]));
  const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
  const accountsByEntityCode = new Map(input.accounts.map((account) => [`${account.legalEntityId}::${account.code}`, account]));
  const ref = (account: GlAccountRow | undefined): GlAccountRef | null =>
    account ? { id: account.id, code: account.code, name: account.name, type: account.type, purpose: account.purpose } : null;

  // One workflow record per (entity, component): the one covering asOf wins, otherwise the
  // latest by start date, so the page can still show a draft that is not yet live. A record that
  // names no entity is the fallback for every entity, which is what records written before
  // FRM-FIN-01's entity field existed are.
  const workflowByKey = new Map<string, LedgerRecord>();
  const keyFor = (entityCode: string | null, componentCode: string) => `${entityCode ?? "*"}::${componentCode}`;
  for (const record of [...input.ledgerRecords].sort((left, right) => (left.startDate ?? "").localeCompare(right.startDate ?? ""))) {
    const key = keyFor(record.entityCode, record.componentCode);
    const covers = (!record.startDate || record.startDate <= input.asOf) && (!record.endDate || record.endDate >= input.asOf);
    const held = workflowByKey.get(key);
    const heldCovers = held ? (!held.startDate || held.startDate <= input.asOf) && (!held.endDate || held.endDate >= input.asOf) : false;
    if (!held) { workflowByKey.set(key, record); continue; }
    if (covers && (!heldCovers || held.status !== "approved")) workflowByKey.set(key, record);
    else if (!heldCovers && !covers) workflowByKey.set(key, record);
  }

  const mappingRowsByKey = new Map(input.mappingRows.map((row) => [`${row.legalEntityId}::${row.componentCode}`, row]));
  const resolved: ResolvedMapping[] = [];
  const codes = new Set<string>([...input.ledgerRecords.map((record) => record.componentCode), ...input.mappingRows.map((row) => row.componentCode)]);

  for (const legalEntityId of input.legalEntityIds) {
    const entityCode = input.legalEntityCodes?.[legalEntityId] ?? null;
    for (const componentCode of codes) {
      // The entity's own mapping first, then the one that names no entity.
      const workflow =
        (entityCode ? workflowByKey.get(keyFor(entityCode, componentCode)) : undefined) ??
        workflowByKey.get(keyFor(null, componentCode)) ??
        null;
      const row = mappingRowsByKey.get(`${legalEntityId}::${componentCode}`) ?? null;
      if (!workflow && !row) continue;
      const component = componentsByCode.get(componentCode);
      const postingSideRaw = workflow?.postingSide ?? row?.postingSide ?? "debit";
      const postingSide: PostingSide = postingSideRaw === "credit" ? "credit" : "debit";
      const account = (code: string | null | undefined) =>
        code ? accountsByEntityCode.get(`${legalEntityId}::${code}`) : undefined;
      // A record that names both sides wins; the single-sided `accountCode` + `postingSide` form
      // still resolves the one side it can name, and the other stays unmapped rather than guessed.
      const byCode = account(workflow?.accountCode);
      const workflowDebit = account(workflow?.debitAccountCode) ?? (postingSide === "debit" ? byCode : undefined);
      const workflowCredit = account(workflow?.creditAccountCode) ?? (postingSide === "credit" ? byCode : undefined);
      const debitAccount = ref(workflowDebit ?? (row?.debitAccountId ? accountsById.get(row.debitAccountId) : undefined));
      const creditAccount = ref(workflowCredit ?? (row?.creditAccountId ? accountsById.get(row.creditAccountId) : undefined));
      const statusRaw = workflow?.status ?? row?.status ?? "approved";
      const status = (MAPPING_STATES as readonly string[]).includes(statusRaw) ? (statusRaw as MappingState) : "draft";
      const costCenterSource = workflow?.costCenterSource ?? row?.costCenterSource ?? "";
      resolved.push({
        legalEntityId,
        componentCode,
        componentName: component?.name ?? componentCode,
        kind: component?.kind ?? "earning",
        postingSide,
        debitAccount,
        creditAccount,
        costCenterSource,
        dimensionSource: workflow?.dimensionSource.length ? workflow.dimensionSource : costCenterSource ? [costCenterSource] : [],
        costCenterId: row?.costCenterId ?? null,
        costCenterCode: row?.costCenterCode ?? null,
        locationOverrides: workflow?.locationOverrides ?? [],
        startDate: workflow?.startDate ?? row?.startDate ?? null,
        endDate: workflow?.endDate ?? row?.endDate ?? null,
        status,
        workflowRecordId: workflow?.id ?? null,
        mappingId: row?.id ?? null,
        dimensions: JOURNAL_DIMENSIONS,
      });
    }
  }
  return resolved.sort((left, right) => left.legalEntityId.localeCompare(right.legalEntityId) || left.componentCode.localeCompare(right.componentCode));
}

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

export const upsertGlAccountSchema = z
  .object({
    id: z.string().uuid().optional(),
    legalEntityId: z.string().uuid(),
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(200),
    type: z.enum(GL_ACCOUNT_TYPES),
    purpose: z.enum(GL_ACCOUNT_PURPOSES).default("component"),
    status: z.enum(["active", "inactive"]).default("active"),
    effectiveFrom: z.string().regex(DATE_PATTERN, "A start date (YYYY-MM-DD) is required."),
    effectiveTo: z.string().regex(DATE_PATTERN).nullable().default(null),
  })
  .strict()
  .refine((value) => value.effectiveTo === null || value.effectiveTo >= value.effectiveFrom, {
    message: "The end date cannot precede the start date.",
    path: ["effectiveTo"],
  });

export type UpsertGlAccountInput = z.infer<typeof upsertGlAccountSchema>;

type AccountRowShape = { id: string; legal_entity_id: string; attributes: Record<string, unknown> | null };

function accountFrom(row: AccountRowShape): GlAccountRow {
  const attributes = row.attributes ?? {};
  const type = String(attributes.type ?? "expense");
  const purpose = String(attributes.purpose ?? "component");
  return {
    id: row.id,
    legalEntityId: row.legal_entity_id,
    code: String(attributes.code ?? ""),
    name: String(attributes.name ?? attributes.code ?? ""),
    type: ((GL_ACCOUNT_TYPES as readonly string[]).includes(type) ? type : "expense") as GlAccountType,
    purpose: ((GL_ACCOUNT_PURPOSES as readonly string[]).includes(purpose) ? purpose : "component") as GlAccountPurpose,
    status: attributes.status === "inactive" ? "inactive" : "active",
    effectiveFrom: String(attributes.effective_from ?? ""),
    effectiveTo: attributes.effective_to === null || attributes.effective_to === undefined ? null : String(attributes.effective_to),
  };
}

export async function listGlAccounts(access: Access, args: { legalEntityId?: string | null } = {}): Promise<GlAccountRow[]> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const legalEntityId = args.legalEntityId ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, legal_entity_id, attributes from gl_accounts
      where tenant_id = ${access.tenantId} and (${legalEntityId}::uuid is null or legal_entity_id = ${legalEntityId}::uuid)
      order by attributes->>'code'
    `,
  ]);
  return (rows as AccountRowShape[]).map(accountFrom);
}

export async function upsertGlAccount(access: Access, input: UpsertGlAccountInput, requestId: string): Promise<GlAccountRow> {
  enforce(access.context, "payroll.accounting.write", { tenantId: access.tenantId });
  const [entityRows] = await tenantTx(access, [
    sqlClient`select id from legal_entities where tenant_id = ${access.tenantId} and id = ${input.legalEntityId} limit 1`,
  ]);
  if ((entityRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The legal entity was not found in this tenant." });
  }
  const [clashRows] = await tenantTx(access, [
    sqlClient`
      select id from gl_accounts
      where tenant_id = ${access.tenantId} and legal_entity_id = ${input.legalEntityId}
        and attributes->>'code' = ${input.code} and (${input.id ?? null}::uuid is null or id <> ${input.id ?? null}::uuid)
      limit 1
    `,
  ]);
  const clash = (clashRows as Array<{ id: string }>)[0];
  const id = input.id ?? clash?.id ?? crypto.randomUUID();
  if (clash && input.id && clash.id !== input.id) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Account code ${input.code} already exists in this legal entity.` });
  }
  const attributes = {
    code: input.code,
    name: input.name,
    type: input.type,
    purpose: input.purpose,
    status: input.status,
    effective_from: input.effectiveFrom,
    effective_to: input.effectiveTo,
  };
  await tenantTx(access, [
    sqlClient`
      insert into gl_accounts (id, tenant_id, legal_entity_id, attributes)
      values (${id}, ${access.tenantId}, ${input.legalEntityId}, ${JSON.stringify(attributes)}::jsonb)
      on conflict (id) do update set attributes = excluded.attributes, version = gl_accounts.version + 1, updated_at = now()
      where gl_accounts.tenant_id = excluded.tenant_id
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.gl_account_upsert', 'gl_account', ${id}, ${`Account ${input.code} saved`}, ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, legalEntityId: input.legalEntityId, code: input.code, name: input.name, type: input.type, purpose: input.purpose, status: input.status, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo };
}

// ---------------------------------------------------------------------------
// Mapping resolution
// ---------------------------------------------------------------------------

/** A multi-select that may still arrive as the single value it replaced. */
function readStringList(value: unknown, fallback: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  if (typeof value === "string" && value.trim() !== "") return [value];
  return typeof fallback === "string" && fallback.trim() !== "" ? [fallback] : [];
}

/** FRM-FIN-01 "Override by location": a repeating table of location, debit, credit. */
function readLocationOverrides(value: unknown): LedgerRecord["locationOverrides"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const location = typeof row.location === "string" ? row.location.trim() : "";
    if (location === "") return [];
    return [{
      location,
      debitAccountCode: typeof row.debitAccountCode === "string" && row.debitAccountCode.trim() !== "" ? row.debitAccountCode : null,
      creditAccountCode: typeof row.creditAccountCode === "string" && row.creditAccountCode.trim() !== "" ? row.creditAccountCode : null,
    }];
  });
}

async function loadLedgerRecords(access: Access): Promise<LedgerRecord[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, data from hrms_operation_records where tenant_id = ${access.tenantId} and resource = 'ledger'`,
  ]);
  return (rows as Array<{ id: string; status: string; data: Record<string, unknown> | null }>).map((row) => {
    const data = row.data ?? {};
    return {
      id: row.id,
      status: row.status,
      entityCode: data.entityCode ? String(data.entityCode) : null,
      componentCode: String(data.componentCode ?? ""),
      accountCode: String(data.accountCode ?? ""),
      postingSide: String(data.postingSide ?? "debit"),
      debitAccountCode: data.debitAccountCode ? String(data.debitAccountCode) : null,
      creditAccountCode: data.creditAccountCode ? String(data.creditAccountCode) : null,
      dimensionSource: readStringList(data.dimensionSource, data.costCenterSource),
      costCenterSource: String(data.costCenterSource ?? ""),
      locationOverrides: readLocationOverrides(data.locationOverride),
      startDate: data.startDate ? String(data.startDate) : null,
      endDate: data.endDate ? String(data.endDate) : null,
    };
  }).filter((record) => record.componentCode !== "");
}

async function loadMappingRows(access: Access, legalEntityId: string | null): Promise<GlMappingRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select m.id, m.legal_entity_id, m.debit_account_id, m.credit_account_id, m.cost_center_id, m.attributes,
             pc.attributes->>'code' as component_code, cc.attributes->>'code' as cost_center_code
      from gl_mappings m
      join pay_components pc on pc.tenant_id = m.tenant_id and pc.id = m.pay_component_id
      left join cost_centers cc on cc.tenant_id = m.tenant_id and cc.id = m.cost_center_id
      where m.tenant_id = ${access.tenantId} and (${legalEntityId}::uuid is null or m.legal_entity_id = ${legalEntityId}::uuid)
    `,
  ]);
  return (rows as Array<{ id: string; legal_entity_id: string; debit_account_id: string | null; credit_account_id: string | null; cost_center_id: string | null; attributes: Record<string, unknown> | null; component_code: string | null; cost_center_code: string | null }>)
    .map((row) => {
      const attributes = row.attributes ?? {};
      return {
        id: row.id,
        legalEntityId: row.legal_entity_id,
        componentCode: String(row.component_code ?? ""),
        debitAccountId: row.debit_account_id,
        creditAccountId: row.credit_account_id,
        costCenterId: row.cost_center_id,
        costCenterCode: row.cost_center_code,
        status: attributes.status ? String(attributes.status) : null,
        postingSide: attributes.posting_side ? String(attributes.posting_side) : null,
        costCenterSource: attributes.cost_center_source ? String(attributes.cost_center_source) : null,
        startDate: attributes.start_date ? String(attributes.start_date) : null,
        endDate: attributes.end_date ? String(attributes.end_date) : null,
      };
    })
    .filter((row) => row.componentCode !== "");
}

/** Entity ids in scope, with their codes: FRM-FIN-01 keys a mapping by the entity code. */
async function loadLegalEntities(access: Access, legalEntityId: string | null): Promise<Array<{ id: string; code: string }>> {
  const [rows] = await tenantTx(access, [
    legalEntityId
      ? sqlClient`select id, code from legal_entities where tenant_id = ${access.tenantId} and id = ${legalEntityId}`
      : sqlClient`select id, code from legal_entities where tenant_id = ${access.tenantId} order by created_at`,
  ]);
  const entities = (rows as Array<{ id: string; code: string | null }>).map((row) => ({ id: row.id, code: row.code ?? "" }));
  // A caller may name an entity this tenant has no row for; keep it in scope so the mapping
  // register still answers for it rather than returning silently empty.
  return entities.length > 0 || !legalEntityId ? entities : [{ id: legalEntityId, code: "" }];
}

export async function listGlMappings(access: Access, args: { legalEntityId?: string | null; asOf?: string | null } = {}): Promise<ResolvedMapping[]> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const legalEntityId = args.legalEntityId ?? null;
  const asOf = args.asOf && DATE_PATTERN.test(args.asOf) ? args.asOf : new Date().toISOString().slice(0, 10);
  const [components, ledgerRecords, mappingRows, accounts, entities] = await Promise.all([
    listComponents(access),
    loadLedgerRecords(access),
    loadMappingRows(access, legalEntityId),
    listGlAccounts(access, { legalEntityId }),
    loadLegalEntities(access, legalEntityId),
  ]);
  return mergeMappings({
    legalEntityIds: entities.map((entity) => entity.id),
    legalEntityCodes: Object.fromEntries(entities.map((entity) => [entity.id, entity.code])),
    components,
    ledgerRecords,
    accounts,
    mappingRows,
    asOf,
  });
}

// ---------------------------------------------------------------------------
// Run facts
// ---------------------------------------------------------------------------

type RunFacts = { id: string; period: string; scope: string; status: string };

async function loadRunFacts(access: Access, runId: string): Promise<RunFacts> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, scope, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as RunFacts[])[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}

async function loadSourceLines(access: Access, runId: string, runType: string): Promise<SourceLine[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select
        l.id as payroll_line_id,
        e.id as run_employee_id,
        e.employee_id,
        emp.employee_code, emp.first_name, emp.last_name, emp.department, emp.location,
        (l.attributes->>'code') as component_code,
        (l.attributes->>'kind') as kind,
        (l.attributes->>'amount_minor')::bigint as amount_minor,
        job.legal_entity_id,
        assignment.cost_center_id, assignment.department_id, assignment.location_id,
        cc.attributes->>'code' as cost_center_code,
        pos.cost_center_id as position_cost_center_id,
        pcc.attributes->>'code' as position_cost_center_code
      from payroll_lines l
      join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      join employees emp on emp.tenant_id = l.tenant_id and emp.id = e.employee_id
      left join lateral (
        select em.id, em.legal_entity_id from employments em
        where em.tenant_id = l.tenant_id and em.employee_id = emp.id order by em.created_at desc limit 1
      ) job on true
      left join lateral (
        select ea.cost_center_id, ea.department_id, ea.location_id, ea.position_id from employee_assignments ea
        where ea.tenant_id = l.tenant_id and ea.employment_id = job.id order by ea.created_at desc limit 1
      ) assignment on true
      left join cost_centers cc on cc.tenant_id = l.tenant_id and cc.id = assignment.cost_center_id
      left join positions pos on pos.tenant_id = l.tenant_id and pos.id = assignment.position_id
      left join cost_centers pcc on pcc.tenant_id = l.tenant_id and pcc.id = pos.cost_center_id
      where l.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}
      order by emp.employee_code, l.created_at
    `,
  ]);
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const kindRaw = String(row.kind ?? "earning");
    const first = row.first_name ? String(row.first_name) : "";
    const last = row.last_name ? String(row.last_name) : "";
    const name = `${first} ${last}`.trim();
    return {
      payrollLineId: String(row.payroll_line_id),
      payrollRunEmployeeId: String(row.run_employee_id),
      employeeId: String(row.employee_id),
      employeeCode: row.employee_code ? String(row.employee_code) : null,
      employeeName: name === "" ? null : name,
      componentCode: String(row.component_code ?? ""),
      kind: kindRaw as ComponentKind,
      amountMinor: Number(row.amount_minor ?? 0),
      legalEntityId: row.legal_entity_id ? String(row.legal_entity_id) : null,
      costCenterOptions: {
        assignmentId: row.cost_center_id ? String(row.cost_center_id) : null,
        assignmentCode: row.cost_center_code ? String(row.cost_center_code) : null,
        positionId: row.position_cost_center_id ? String(row.position_cost_center_id) : null,
        positionCode: row.position_cost_center_code ? String(row.position_cost_center_code) : null,
      },
      dimensions: {
        costCenterId: row.cost_center_id ? String(row.cost_center_id) : null,
        costCenterCode: row.cost_center_code ? String(row.cost_center_code) : null,
        departmentId: row.department_id ? String(row.department_id) : null,
        department: row.department ? String(row.department) : null,
        locationId: row.location_id ? String(row.location_id) : null,
        location: row.location ? String(row.location) : null,
        // No payroll line carries a project reference today; the dimension is
        // reported as null rather than invented from an unrelated allocation.
        projectId: null,
        runType,
      },
    };
  }).filter((line) => line.componentCode !== "");
}

// ---------------------------------------------------------------------------
// RL-521 — the blocking check
// ---------------------------------------------------------------------------

export async function unmappedComponents(
  access: Access,
  args: { runId?: string; legalEntityId?: string; asOf?: string },
): Promise<{ asOf: string; items: UnmappedComponent[] }> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  if (!args.runId && !args.legalEntityId) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A run or a legal entity is required." });
  }
  const components = await listComponents(access);
  const names = Object.fromEntries(components.map((component) => [component.code, { name: component.name, kind: component.kind }]));

  if (args.runId) {
    const run = await loadRunFacts(access, args.runId);
    const asOf = args.asOf ?? periodEndDate(run.period);
    const lines = await loadSourceLines(access, run.id, run.scope);
    const entityIds = [...new Set(lines.map((line) => line.legalEntityId).filter((value): value is string => value !== null))];
    const mappings = (await Promise.all(entityIds.map((entityId) => listGlMappings(access, { legalEntityId: entityId, asOf })))).flat();
    return { asOf, items: findUnmappedComponents(lines, mappings, asOf, names) };
  }

  const asOf = args.asOf ?? new Date().toISOString().slice(0, 10);
  const mappings = await listGlMappings(access, { legalEntityId: args.legalEntityId, asOf });
  const index = new Map(mappings.map((mapping) => [mapping.componentCode, mapping]));
  const items = components
    .filter((component) => component.status === "active" && component.kind !== "information_only")
    .map((component) => ({ component, reason: mappingIssue(index.get(component.code), component.kind, asOf) }))
    .filter((entry): entry is { component: PayComponentRow; reason: string } => entry.reason !== null)
    .map(({ component, reason }) => ({
      legalEntityId: args.legalEntityId ?? null,
      componentCode: component.code,
      componentName: component.name,
      kind: component.kind,
      amountMinor: 0,
      employeeCount: 0,
      reason,
    }));
  return { asOf, items };
}

// ---------------------------------------------------------------------------
// RL-522 — build
// ---------------------------------------------------------------------------

export type BuiltJournals = { runId: string; period: string; runType: string; asOf: string; journals: Journal[] };

export async function buildJournal(access: Access, runId: string): Promise<BuiltJournals> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const run = await loadRunFacts(access, runId);
  const asOf = periodEndDate(run.period);
  const lines = await loadSourceLines(access, run.id, run.scope);
  const components = await listComponents(access);
  const names = Object.fromEntries(components.map((component) => [component.code, { name: component.name, kind: component.kind }]));
  // payroll_lines carry their own `kind`; prefer the component master when it knows better.
  const typed = lines.map((line) => ({ ...line, kind: names[line.componentCode]?.kind ?? line.kind }));
  const entityIds = [...new Set(typed.map((line) => line.legalEntityId).filter((value): value is string => value !== null))];
  const mappings = (await Promise.all(entityIds.map((entityId) => listGlMappings(access, { legalEntityId: entityId, asOf })))).flat();

  const blocked = findUnmappedComponents(typed, mappings, asOf, names);
  if (blocked.length > 0) {
    throw new HttpError({
      status: 409,
      code: "GL_MAPPING_MISSING",
      message: `These components have no effective GL mapping for this run: ${blocked.map((item) => item.componentCode).join(", ")}. Map them before the run can be approved.`,
      details: blocked.map((item) => ({ field: item.componentCode, issue: item.reason })),
    });
  }

  const accounts = await listGlAccounts(access);
  const journals: Journal[] = [];
  for (const entityId of entityIds) {
    const netPayAccount = accounts.find((account) => account.legalEntityId === entityId && account.purpose === "net_pay" && account.status === "active");
    if (!netPayAccount) {
      throw new HttpError({
        status: 409,
        code: "GL_NET_PAY_ACCOUNT_MISSING",
        message: `Legal entity ${entityId} has no active net-pay account in its chart of accounts. Create one before posting.`,
        details: [{ field: "legalEntityId", issue: entityId }],
      });
    }
    journals.push(composeJournal({
      runId: run.id,
      runType: run.scope,
      legalEntityId: entityId,
      lines: typed.filter((line) => line.legalEntityId === entityId),
      mappings: mappings.filter((mapping) => mapping.legalEntityId === entityId),
      netPayAccount,
      asOf,
    }));
  }
  return { runId: run.id, period: run.period, runType: run.scope, asOf, journals };
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

type ExportRecord = { id: string; legalEntityId: string; state: JournalState; fingerprint: string; postedAt: string | null };

async function loadExports(access: Access, runId: string): Promise<ExportRecord[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from payroll_exports where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} order by created_at`,
  ]);
  return (rows as Array<{ id: string; attributes: Record<string, unknown> | null }>).map((row) => {
    const attributes = row.attributes ?? {};
    const state = String(attributes.state ?? "draft");
    return {
      id: row.id,
      legalEntityId: String(attributes.legal_entity_id ?? ""),
      state: ((JOURNAL_STATES as readonly string[]).includes(state) ? state : "draft") as JournalState,
      fingerprint: String(attributes.fingerprint ?? ""),
      postedAt: attributes.posted_at ? String(attributes.posted_at) : null,
    };
  });
}

/**
 * Materialise the approved mappings for a legal entity into `gl_mappings`, so
 * the canonical table holds exactly what the journal posted against. Runs inside
 * posting; a mapping without a resolvable account is skipped (RL-521 has already
 * refused the post in that case).
 */
async function materializeMappings(access: Access, mappings: ResolvedMapping[], asOf: string): Promise<void> {
  const componentIds = await componentIdsByCode(access);
  const statements = [];
  for (const mapping of mappings) {
    if (!mappingEffective(mapping, asOf)) continue;
    const componentId = componentIds[mapping.componentCode];
    if (!componentId) continue;
    const debitId = mapping.debitAccount?.id ?? mapping.creditAccount?.id ?? null;
    const creditId = mapping.creditAccount?.id ?? mapping.debitAccount?.id ?? null;
    if (!debitId || !creditId) continue;
    const attributes = {
      status: mapping.status,
      posting_side: mapping.postingSide,
      cost_center_source: mapping.costCenterSource,
      start_date: mapping.startDate,
      end_date: mapping.endDate,
      workflow_record_id: mapping.workflowRecordId,
    };
    const id = mapping.mappingId ?? crypto.randomUUID();
    statements.push(sqlClient`
      insert into gl_mappings (id, tenant_id, legal_entity_id, pay_component_id, debit_account_id, credit_account_id, cost_center_id, attributes)
      values (${id}, ${access.tenantId}, ${mapping.legalEntityId}, ${componentId}, ${debitId}, ${creditId}, ${mapping.costCenterId}, ${JSON.stringify(attributes)}::jsonb)
      on conflict (id) do update set
        debit_account_id = excluded.debit_account_id, credit_account_id = excluded.credit_account_id,
        cost_center_id = excluded.cost_center_id, attributes = excluded.attributes,
        version = gl_mappings.version + 1, updated_at = now()
      where gl_mappings.tenant_id = excluded.tenant_id
    `);
  }
  if (statements.length > 0) await tenantTx(access, statements);
}

async function componentIdsByCode(access: Access): Promise<Record<string, string>> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes->>'code' as code from pay_components where tenant_id = ${access.tenantId}`,
  ]);
  return Object.fromEntries((rows as Array<{ id: string; code: string | null }>).filter((row) => row.code).map((row) => [row.code as string, row.id]));
}

export type PostResult = {
  runId: string;
  posted: Array<{ legalEntityId: string; exportId: string; action: ExportAction["action"]; lineCount: number; totalDebitMinor: number }>;
};

/**
 * Persist the journal. One export per run per legal entity; re-posting the same
 * journal is a no-op, a changed journal supersedes the previous export and the
 * superseded record is kept.
 */
export async function postJournal(access: Access, runId: string, requestId: string): Promise<PostResult> {
  enforce(access.context, "payroll.accounting.approve", { tenantId: access.tenantId });
  const built = await buildJournal(access, runId);
  const existing = await loadExports(access, runId);
  const posted: PostResult["posted"] = [];

  for (const journal of built.journals) {
    const fingerprint = journalFingerprint(journal);
    const live = existing.find((record) => record.legalEntityId === journal.legalEntityId && record.state !== "superseded") ?? null;
    const decision = resolveExportAction(live, fingerprint);
    if (decision.action === "unchanged") {
      posted.push({ legalEntityId: journal.legalEntityId, exportId: decision.exportId, action: "unchanged", lineCount: journal.lines.length, totalDebitMinor: journal.totalDebitMinor });
      continue;
    }
    const exportId = crypto.randomUUID();
    const attributes = {
      state: "posted" satisfies JournalState,
      legal_entity_id: journal.legalEntityId,
      run_type: journal.runType,
      period: built.period,
      as_of: built.asOf,
      fingerprint,
      total_debit_minor: journal.totalDebitMinor,
      total_credit_minor: journal.totalCreditMinor,
      residual_minor: journal.residualMinor,
      balanced: journal.balanced,
      line_count: journal.lines.length,
      posted_at: new Date().toISOString(),
      supersedes_export_id: decision.action === "supersede" ? decision.exportId : null,
    };
    const statements = [
      ...(decision.action === "supersede"
        ? [sqlClient`
            update payroll_exports set attributes = attributes || ${JSON.stringify({ state: "superseded", superseded_at: new Date().toISOString(), superseded_by_export_id: exportId })}::jsonb,
              version = version + 1, updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${decision.exportId}
          `]
        : []),
      sqlClient`
        insert into payroll_exports (id, tenant_id, payroll_run_id, attributes)
        values (${exportId}, ${access.tenantId}, ${runId}, ${JSON.stringify(attributes)}::jsonb)
      `,
      ...journal.lines.flatMap((line) =>
        (line.contributions.length > 0 ? line.contributions : [null]).map((contribution) => sqlClient`
          insert into payroll_export_lines (id, tenant_id, payroll_export_id, payroll_line_id, gl_account_id, cost_center_id, attributes)
          values (${crypto.randomUUID()}, ${access.tenantId}, ${exportId}, ${contribution?.payrollLineId ?? null},
            ${line.accountId}, ${line.dimensions.costCenterId},
            ${JSON.stringify({
              account_code: line.accountCode,
              account_name: line.accountName,
              account_type: line.accountType,
              component_code: line.componentCode,
              side: line.debitMinor > 0 ? "debit" : "credit",
              line_debit_minor: line.debitMinor,
              line_credit_minor: line.creditMinor,
              contribution_minor: contribution?.amountMinor ?? (line.debitMinor || line.creditMinor),
              employee_id: contribution?.employeeId ?? null,
              employee_code: contribution?.employeeCode ?? null,
              department: line.dimensions.department,
              department_id: line.dimensions.departmentId,
              location: line.dimensions.location,
              location_id: line.dimensions.locationId,
              project_id: line.dimensions.projectId,
              run_type: line.dimensions.runType,
            })}::jsonb)
        `),
      ),
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'payroll.gl_journal_post', 'payroll_export', ${exportId},
          ${`GL journal posted for run ${runId}`}, ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
      sqlClient`
        insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
        values (${access.tenantId}, 'payroll.gl_journal_posted', 'payroll_export', ${exportId},
          ${JSON.stringify({ runId, legalEntityId: journal.legalEntityId, period: built.period, runType: journal.runType, totalDebitMinor: journal.totalDebitMinor, lineCount: journal.lines.length })}::jsonb)
      `,
    ];
    await tenantTx(access, statements);
    posted.push({ legalEntityId: journal.legalEntityId, exportId, action: decision.action, lineCount: journal.lines.length, totalDebitMinor: journal.totalDebitMinor });
  }

  await materializeMappings(access, (await Promise.all(built.journals.map((journal) => listGlMappings(access, { legalEntityId: journal.legalEntityId, asOf: built.asOf })))).flat(), built.asOf);
  return { runId, posted };
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export type JournalView = {
  runId: string;
  period: string;
  runType: string;
  asOf: string;
  state: JournalState;
  blocked: boolean;
  unmapped: UnmappedComponent[];
  journals: Array<Journal & { exportId: string | null; postedAt: string | null; state: JournalState }>;
  totalDebitMinor: number;
  totalCreditMinor: number;
  residualMinor: number;
  balanced: boolean;
};

/**
 * The page's read model. Unlike `buildJournal` this never throws on an unmapped
 * component: it reports state `draft` with the blocking list, so the screen can
 * show what stands between the run and a posted journal.
 */
export async function getJournal(access: Access, runId: string): Promise<JournalView> {
  enforce(access.context, "payroll.accounting.read", { tenantId: access.tenantId });
  const run = await loadRunFacts(access, runId);
  const asOf = periodEndDate(run.period);
  const blocking = await unmappedComponents(access, { runId });
  const exports = await loadExports(access, runId);

  if (blocking.items.length > 0) {
    return {
      runId: run.id, period: run.period, runType: run.scope, asOf,
      state: "draft", blocked: true, unmapped: blocking.items, journals: [],
      totalDebitMinor: 0, totalCreditMinor: 0, residualMinor: 0, balanced: false,
    };
  }

  const built = await buildJournal(access, runId);
  const journals = built.journals.map((journal) => {
    const record = exports.find((entry) => entry.legalEntityId === journal.legalEntityId && entry.state !== "superseded") ?? null;
    const fingerprint = journalFingerprint(journal);
    const state: JournalState = record && record.fingerprint === fingerprint ? record.state : "validated";
    return { ...journal, exportId: record && record.fingerprint === fingerprint ? record.id : null, postedAt: record && record.fingerprint === fingerprint ? record.postedAt : null, state };
  });
  const totalDebitMinor = journals.reduce((total, journal) => total + journal.totalDebitMinor, 0);
  const totalCreditMinor = journals.reduce((total, journal) => total + journal.totalCreditMinor, 0);
  return {
    runId: run.id, period: run.period, runType: run.scope, asOf,
    state: journals.length > 0 && journals.every((journal) => journal.state === "posted") ? "posted" : "validated",
    blocked: false, unmapped: [], journals,
    totalDebitMinor, totalCreditMinor,
    residualMinor: totalDebitMinor - totalCreditMinor,
    balanced: totalDebitMinor === totalCreditMinor,
  };
}
