import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listComponents, type ComponentKind } from "./components";

/**
 * SCR-103 — Payroll reconciliation.
 *
 * The final control before a payroll period is closed. Process step FIN-04.1
 * names seven assertions; RL-530 requires all seven to pass and to be *shown*
 * passing, which means each one is evaluated on its own and reports both sides
 * of the comparison, not a single aggregate verdict.
 *
 * Two rules govern everything in this file:
 *
 *  1. A check compares two *independently sourced* figures. A check that reads
 *     one number and compares it to itself would always pass and would tell a
 *     controller nothing; it is worse than no check, because it manufactures
 *     assurance. Where one side genuinely does not exist in this system the
 *     check returns `indeterminate` and names the missing source. It never
 *     substitutes the side it does have for the side it does not.
 *  2. A variance is signed and directional: `varianceMinor = actual - expected`,
 *     so the sign says which side is heavier and by how much. Nothing is
 *     absorbed, rounded away, or reported as zero when it is unknown.
 *
 * Known gap, reported rather than faked — assertion (c), "statutory heads ==
 * challan/remittance amounts". Nothing in this codebase records a remitted
 * amount: there is no challan, remittance, or statutory-payment table, and
 * `statutory_returns` / `statutory_return_lines` carry filing records, not
 * paid-to-authority figures. Additionally `pay_components` carries no flag that
 * marks a head as statutory, so even the withheld side can only be grouped by
 * component `kind`. Check (c) therefore returns `indeterminate` and names both
 * gaps. It is deliberately not implemented as "withheld == withheld".
 *
 * Persistence uses `reconciliation_items`, which exists in the canonical schema
 * and was previously unused. Its two foreign keys — `disbursement_item_id` and
 * `payroll_export_line_id` — are precisely the bank side and the ledger side of
 * a reconciliation pairing, so the net-pay assertion also writes one pairing row
 * per employee linking the bank item it paid to the journal line that recorded
 * it. The seven check rows themselves carry `record_kind = 'check'`.
 *
 * RL-531 drill-back reuses the link GL posting already persists:
 * `payroll_export_lines.payroll_line_id -> payroll_lines ->
 * payroll_run_employees -> employees`.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** The seven assertions of FIN-04.1, in the order the workbook states them. */
export const CHECK_KEYS = [
  "journal_gross_vs_payslip_earnings",
  "journal_net_vs_bank_file",
  "statutory_vs_remittance",
  "dimension_sums_vs_total",
  "ot_paid_vs_attendance_approved",
  "loan_recovery_vs_loan_movement",
  "gross_less_deductions_vs_net",
] as const;
export type CheckKey = (typeof CHECK_KEYS)[number];

export const CHECK_LABELS: Record<CheckKey, string> = {
  journal_gross_vs_payslip_earnings: "Journal gross equals payslip earnings",
  journal_net_vs_bank_file: "Journal net equals the released bank file total",
  statutory_vs_remittance: "Statutory heads equal the remitted amounts",
  dimension_sums_vs_total: "Dimension sums equal the journal total with no residue",
  ot_paid_vs_attendance_approved: "Overtime paid equals approved attendance overtime",
  loan_recovery_vs_loan_movement: "Loan recovery equals the movement in loan outstanding",
  gross_less_deductions_vs_net: "Gross less deductions equals net",
};

/**
 * `pass` — both sides exist and agree to the minor unit.
 * `variance` — both sides exist and disagree; the difference is signed.
 * `indeterminate` — at least one side does not exist. The check names it.
 */
export const CHECK_STATUSES = ["pass", "variance", "indeterminate"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/** Per-check and per-run lifecycle. A superseded result is retained, never deleted. */
export const RECONCILIATION_STATES = ["open", "explained", "reconciled", "escalated"] as const;
export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export const RECONCILIATION_STATE_LABELS: Record<ReconciliationState, string> = {
  open: "Open",
  explained: "Explained",
  reconciled: "Reconciled",
  escalated: "Escalated",
};

/** What an explanation asserts about the variance. */
export const DISPOSITIONS = ["timing", "data_correction", "accepted", "reconcile", "escalate"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  timing: "Timing difference",
  data_correction: "Correction required at source",
  accepted: "Accepted variance",
  reconcile: "Close as reconciled",
  escalate: "Escalate",
};

/** A result's own lifecycle: one live result per run, earlier ones retained. */
export const RESULT_LIFECYCLES = ["live", "superseded"] as const;
export type ResultLifecycle = (typeof RESULT_LIFECYCLES)[number];

/** Which row of `reconciliation_items` this is. */
export const RECORD_KINDS = ["check", "pairing"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/**
 * Minimum characters in an explanation. The house range for a required reason is
 * 1-3 characters, but the SCR-103 workbook wants a reason a reviewer can act on,
 * so this follows the stricter precedent already set for free-text that has to
 * stand on its own (`src/server/ai/service.ts` uses `min(10)`).
 */
export const EXPLANATION_MIN_LENGTH = 10;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type CheckDetail = { label: string; value: string };

export type CheckResult = {
  key: CheckKey;
  label: string;
  /** The independent / authoritative side of the assertion. */
  expectedMinor: number | null;
  /** The payroll or ledger side being proved. */
  actualMinor: number | null;
  /** `actualMinor - expectedMinor`, signed. Null when either side is unknown. */
  varianceMinor: number | null;
  status: CheckStatus;
  /** Why the check is indeterminate, or what the variance consists of. Null on a clean pass. */
  reason: string | null;
  expectedSource: string;
  actualSource: string;
  /** Supporting figures the screen shows beside the headline numbers. */
  detail: CheckDetail[];
  /** Populated only where a check resolves to one bank item and/or one journal line. */
  disbursementItemId: string | null;
  payrollExportLineId: string | null;
};

export type JournalDimensions = {
  costCenterId: string | null;
  departmentId: string | null;
  department: string | null;
  locationId: string | null;
  location: string | null;
  projectId: string | null;
  runType: string;
};

export type JournalContributionFact = {
  exportLineId: string;
  payrollLineId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  amountMinor: number;
};

/**
 * One posted journal line, reassembled from the `payroll_export_lines` rows that
 * carry it. GL posting writes one row per contributing payroll line and repeats
 * the line totals on each, so summing the rows would multiply the journal.
 */
export type JournalFactLine = {
  key: string;
  primaryExportLineId: string;
  glAccountId: string | null;
  accountCode: string;
  accountName: string;
  /** Null marks the net-pay leg, which no component owns. */
  componentCode: string | null;
  kind: ComponentKind | null;
  debitMinor: number;
  creditMinor: number;
  dimensions: JournalDimensions;
  contributions: JournalContributionFact[];
};

export type PayslipFact = {
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
};

export type BankItemFact = {
  disbursementItemId: string;
  payrollRunEmployeeId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  amountMinor: number;
  state: string;
};

export type BankFact = {
  batchId: string;
  state: string;
  totalAmountMinor: number;
  items: BankItemFact[];
};

export type OtEmployeeFact = {
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  /** Locked (approved) `attendance_days.payable_ot_minutes` inside the period. */
  approvedMinutes: number;
  /** The rate the engine actually applied, from the run's calculation trace. */
  hourlyRateMinor: number | null;
  multiplier: number | null;
  paidMinutes: number | null;
  paidAmountMinor: number;
};

export type LoanEmployeeFact = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  /** The `loan_recovery`-kind deduction actually withheld in this run. */
  recoveredMinor: number;
  /** `loan_transactions` rows this run wrote against the employee's loans. */
  movementMinor: number;
  transactionCount: number;
};

/**
 * Everything the seven checks need, already loaded. Keeping this a plain value
 * is what makes `evaluateReconciliation` testable without a database, exactly as
 * `gl.ts` splits `composeJournal` from `buildJournal`.
 */
export type ReconciliationFacts = {
  runId: string;
  period: string;
  runType: string;
  runStatus: string;
  currency: string;
  /** False when no `payroll_exports` row for the run is in state `posted`. */
  journalPosted: boolean;
  journalLines: JournalFactLine[];
  payslips: PayslipFact[];
  /** The released batch, or null when the run has not been released. */
  bank: BankFact | null;
  /**
   * Remitted statutory amounts. Always null: no table in this system records a
   * challan or remittance. Kept in the shape so the day a source appears, only
   * the loader changes.
   */
  remittance: { totalMinor: number; heads: Array<{ head: string; amountMinor: number }> } | null;
  ot: { employees: OtEmployeeFact[]; traceRowCount: number };
  loans: { employees: LoanEmployeeFact[]; transactionCount: number };
};

// ---------------------------------------------------------------------------
// Pure helpers (no database; every one of these is unit-tested)
// ---------------------------------------------------------------------------

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Stable identity for one posted journal line across its contribution rows. */
export function journalLineKey(row: {
  glAccountId: string | null;
  componentCode: string | null;
  side: string;
  dimensions: JournalDimensions;
}): string {
  return [
    row.glAccountId ?? "",
    row.componentCode ?? "",
    row.side,
    row.dimensions.costCenterId ?? "",
    row.dimensions.departmentId ?? "",
    row.dimensions.locationId ?? "",
    row.dimensions.projectId ?? "",
    row.dimensions.runType,
  ].join("|");
}

export type ExportLineRow = {
  exportLineId: string;
  payrollLineId: string | null;
  glAccountId: string | null;
  accountCode: string;
  accountName: string;
  componentCode: string | null;
  side: string;
  lineDebitMinor: number;
  lineCreditMinor: number;
  contributionMinor: number;
  employeeId: string | null;
  employeeCode: string | null;
  dimensions: JournalDimensions;
};

/**
 * Collapse the per-contribution export rows back into journal lines. The line
 * totals are taken once per line and the contributions are kept for drill-back;
 * adding `contributionMinor` across a net-pay leg would not produce net pay,
 * because those contributions are the component amounts that netted to it.
 */
export function groupExportLines(rows: readonly ExportLineRow[], kindByCode: Readonly<Record<string, ComponentKind>> = {}): JournalFactLine[] {
  const lines = new Map<string, JournalFactLine>();
  for (const row of rows) {
    const key = journalLineKey(row);
    const existing = lines.get(key);
    const contribution: JournalContributionFact = {
      exportLineId: row.exportLineId,
      payrollLineId: row.payrollLineId,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      amountMinor: row.contributionMinor,
    };
    if (existing) {
      existing.contributions.push(contribution);
      continue;
    }
    lines.set(key, {
      key,
      primaryExportLineId: row.exportLineId,
      glAccountId: row.glAccountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      componentCode: row.componentCode,
      kind: row.componentCode === null ? null : kindByCode[row.componentCode] ?? null,
      debitMinor: row.lineDebitMinor,
      creditMinor: row.lineCreditMinor,
      dimensions: row.dimensions,
      contributions: [contribution],
    });
  }
  return [...lines.values()].sort(
    (left, right) => left.accountCode.localeCompare(right.accountCode) || left.key.localeCompare(right.key),
  );
}

/** A line carries analysis when at least one dimension beyond run type resolved. */
export function isDimensioned(dimensions: JournalDimensions): boolean {
  return (
    dimensions.costCenterId !== null ||
    dimensions.departmentId !== null ||
    dimensions.locationId !== null ||
    dimensions.projectId !== null
  );
}

/** The dimension combination a line rolls up into, for the residue breakdown. */
export function dimensionLabel(dimensions: JournalDimensions): string {
  const parts = [
    dimensions.costCenterId ? `cost centre ${dimensions.costCenterId}` : null,
    dimensions.department ?? (dimensions.departmentId ? `department ${dimensions.departmentId}` : null),
    dimensions.location ?? (dimensions.locationId ? `location ${dimensions.locationId}` : null),
    dimensions.projectId ? `project ${dimensions.projectId}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? "No dimension" : parts.join(" · ");
}

/** Component kinds that make up the earnings side of a journal. */
const EARNING_KINDS: readonly ComponentKind[] = ["earning", "reimbursement"];

function sumLines(lines: readonly JournalFactLine[], predicate: (line: JournalFactLine) => boolean, side: "debit" | "credit"): number {
  return sum(lines.filter(predicate).map((line) => (side === "debit" ? line.debitMinor : line.creditMinor)));
}

function statusFor(expected: number | null, actual: number | null): CheckStatus {
  if (expected === null || actual === null) return "indeterminate";
  return actual - expected === 0 ? "pass" : "variance";
}

function varianceOf(expected: number | null, actual: number | null): number | null {
  return expected === null || actual === null ? null : actual - expected;
}

const NO_JOURNAL =
  "No journal has been posted for this run, so the ledger side of the assertion does not exist. Post the GL journal (SCR-102), then run the reconciliation again.";

// ---------------------------------------------------------------------------
// The seven checks. Each is exported so it can be evaluated, and failed, alone.
// ---------------------------------------------------------------------------

/** (a) Journal gross == sum of payslip earnings. */
export function checkJournalGrossVsPayslipEarnings(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "journal_gross_vs_payslip_earnings";
  const expectedMinor = facts.payslips.length === 0 ? null : sum(facts.payslips.map((row) => row.grossMinor));
  const actualMinor = facts.journalPosted
    ? sumLines(facts.journalLines, (line) => line.kind !== null && EARNING_KINDS.includes(line.kind), "debit")
    : null;
  const reason =
    expectedMinor === null
      ? "This run has no calculated employees, so there are no payslip earnings to compare the journal against."
      : actualMinor === null
        ? NO_JOURNAL
        : null;
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: varianceOf(expectedMinor, actualMinor),
    status: statusFor(expectedMinor, actualMinor),
    reason,
    expectedSource: "payroll_run_employees.gross_minor (payslip earnings)",
    actualSource: "payroll_export_lines — debits on earning and reimbursement accounts",
    detail: [
      { label: "Payslips counted", value: String(facts.payslips.length) },
      { label: "Earning journal lines", value: String(facts.journalLines.filter((line) => line.kind !== null && EARNING_KINDS.includes(line.kind)).length) },
    ],
    disbursementItemId: null,
    payrollExportLineId: null,
  };
}

/** (b) Journal net == bank file total (the released batch). */
export function checkJournalNetVsBankFile(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "journal_net_vs_bank_file";
  const netLines = facts.journalLines.filter((line) => line.componentCode === null);
  const actualMinor = facts.journalPosted ? sum(netLines.map((line) => line.creditMinor - line.debitMinor)) : null;
  const expectedMinor = facts.bank === null ? null : facts.bank.totalAmountMinor;
  const reason =
    expectedMinor === null
      ? "No disbursement batch for this run has reached the released state, so there is no bank file total to compare against. Release the batch (SCR-101) first."
      : actualMinor === null
        ? NO_JOURNAL
        : null;
  // Pair the two sides only when each resolves to exactly one record; otherwise
  // the per-employee pairing rows carry the linkage instead.
  const singleItem = facts.bank && facts.bank.items.filter((item) => item.state !== "excluded").length === 1
    ? facts.bank.items.filter((item) => item.state !== "excluded")[0]
    : null;
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: varianceOf(expectedMinor, actualMinor),
    status: statusFor(expectedMinor, actualMinor),
    reason,
    expectedSource: "disbursement_batches — released batch total",
    actualSource: "payroll_export_lines — the net-pay legs of the posted journal",
    detail: [
      { label: "Released batch", value: facts.bank?.batchId ?? "None" },
      { label: "Bank items", value: facts.bank === null ? "—" : String(facts.bank.items.filter((item) => item.state !== "excluded").length) },
      { label: "Net-pay journal legs", value: String(netLines.length) },
    ],
    disbursementItemId: singleItem?.disbursementItemId ?? null,
    payrollExportLineId: netLines.length === 1 ? netLines[0].primaryExportLineId : null,
  };
}

/**
 * (c) Statutory heads == challan / remittance amounts.
 *
 * Deliberately indeterminate. Nothing in this system records what was remitted
 * to an authority, and no component attribute marks a head as statutory. The
 * withheld figure below is reported so the controller can see what *would* be
 * compared, but it is placed on the `actual` side only; `expected` stays null
 * rather than being filled with the same number.
 */
export function checkStatutoryVsRemittance(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "statutory_vs_remittance";
  const statutoryKinds: readonly ComponentKind[] = ["deduction", "employer_contribution"];
  const heads = facts.journalLines.filter((line) => line.kind !== null && statutoryKinds.includes(line.kind));
  const actualMinor = facts.journalPosted ? sum(heads.map((line) => line.creditMinor)) : null;
  const expectedMinor = facts.remittance === null ? null : facts.remittance.totalMinor;
  const byHead = new Map<string, number>();
  for (const line of heads) {
    const head = line.componentCode ?? line.accountCode;
    byHead.set(head, (byHead.get(head) ?? 0) + line.creditMinor);
  }
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: varianceOf(expectedMinor, actualMinor),
    status: statusFor(expectedMinor, actualMinor),
    reason:
      expectedMinor === null
        ? "No remitted amount has been recorded for this period. The statutory filing register records what was paid to each authority; until a filing outcome carries an amount for this period there is nothing to compare the withheld figure against, and pay_components carries no flag marking a head as statutory, so the withheld side is grouped by component kind only. Reported as indeterminate rather than compared against itself."
        : actualMinor === null
          ? NO_JOURNAL
          : null,
    expectedSource: "Statutory filing register — recorded remittance outcomes for the period",
    actualSource: "payroll_export_lines — credits on deduction and employer-contribution heads",
    detail: [...byHead.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([head, amountMinor]) => ({ label: `Withheld · ${head}`, value: String(amountMinor) })),
    disbursementItemId: null,
    payrollExportLineId: null,
  };
}

/** (d) Dimension sums == journal total, with no undimensioned residue. */
export function checkDimensionSums(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "dimension_sums_vs_total";
  const expectedMinor = facts.journalPosted ? sum(facts.journalLines.map((line) => line.debitMinor)) : null;
  const actualMinor = facts.journalPosted
    ? sum(facts.journalLines.filter((line) => isDimensioned(line.dimensions)).map((line) => line.debitMinor))
    : null;
  const residue = facts.journalLines.filter((line) => !isDimensioned(line.dimensions) && line.debitMinor !== 0);
  const byDimension = new Map<string, number>();
  for (const line of facts.journalLines) {
    if (line.debitMinor === 0) continue;
    const label = dimensionLabel(line.dimensions);
    byDimension.set(label, (byDimension.get(label) ?? 0) + line.debitMinor);
  }
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: varianceOf(expectedMinor, actualMinor),
    status: statusFor(expectedMinor, actualMinor),
    reason:
      expectedMinor === null
        ? NO_JOURNAL
        : residue.length === 0
          ? null
          : `${residue.length} posted journal line${residue.length === 1 ? "" : "s"} carry no cost centre, department, location or project, so the dimensioned sums fall short of the journal total by that residue. The residue is named, never absorbed.`,
    expectedSource: "payroll_export_lines — total debits posted for the run",
    actualSource: "payroll_export_lines — debits on lines carrying at least one analysis dimension",
    detail: [...byDimension.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, amountMinor]) => ({ label, value: String(amountMinor) })),
    disbursementItemId: null,
    payrollExportLineId: residue.length === 1 ? residue[0].primaryExportLineId : null,
  };
}

/**
 * (e) Overtime paid in an off-cycle run == approved overtime from attendance.
 *
 * Approved overtime is `attendance_days.payable_ot_minutes` on *locked* days —
 * locking is what approval means for an attendance day, and it is the same
 * filter the engine itself applies. The expected amount re-prices those minutes
 * at the rate the run's own calculation trace recorded, so the assertion is
 * attendance's minutes against payroll's amount, not payroll against payroll.
 */
export function checkOvertimeVsAttendance(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "ot_paid_vs_attendance_approved";
  const employees = facts.ot.employees;
  const actualMinor = sum(employees.map((row) => row.paidAmountMinor));
  const approvedMinutes = sum(employees.map((row) => row.approvedMinutes));
  const paidMinutes = sum(employees.map((row) => row.paidMinutes ?? 0));
  const detail: CheckDetail[] = [
    { label: "Approved overtime minutes (locked attendance)", value: String(approvedMinutes) },
    { label: "Overtime minutes the run paid for", value: String(paidMinutes) },
    { label: "Employees with overtime", value: String(employees.filter((row) => row.approvedMinutes > 0 || row.paidAmountMinor !== 0).length) },
  ];
  const base = {
    key,
    label: CHECK_LABELS[key],
    expectedSource: "attendance_days.payable_ot_minutes on locked days, re-priced at the run's recorded overtime rate",
    actualSource: "payroll_lines — the overtime component paid by this run",
    detail,
    disbursementItemId: null,
    payrollExportLineId: null,
  };

  if (facts.runType !== "ot") {
    return {
      ...base,
      expectedMinor: null,
      actualMinor: null,
      varianceMinor: null,
      status: "indeterminate",
      reason: `FIN-04.1 scopes this assertion to an off-cycle overtime run; this run's type is "${facts.runType}". Overtime in a regular run is not settled against locked attendance and is not asserted here.`,
    };
  }
  const priced = employees.filter((row) => row.hourlyRateMinor !== null && row.multiplier !== null);
  const unpriced = employees.filter((row) => row.approvedMinutes > 0 && (row.hourlyRateMinor === null || row.multiplier === null));
  if (priced.length === 0 || unpriced.length > 0) {
    return {
      ...base,
      expectedMinor: null,
      actualMinor,
      varianceMinor: null,
      status: "indeterminate",
      reason:
        priced.length === 0
          ? "This run records no overtime calculation trace in payroll_calculations, so the rate that approved minutes should be re-priced at does not exist. The approved minutes cannot be turned into an expected amount without inventing a rate."
          : `${unpriced.length} employee${unpriced.length === 1 ? " has" : "s have"} approved overtime minutes but no overtime rate in payroll_calculations, so part of the expected amount has no source. The check reports the gap rather than pricing those minutes at a guessed rate.`,
    };
  }
  const expectedMinor = sum(
    priced.map((row) => Math.round((row.hourlyRateMinor as number) * row.approvedMinutes * (row.multiplier as number))),
  );
  const variance = actualMinor - expectedMinor;
  return {
    ...base,
    expectedMinor,
    actualMinor,
    varianceMinor: variance,
    status: variance === 0 ? "pass" : "variance",
    reason:
      variance === 0
        ? null
        : `The run paid ${paidMinutes} overtime minutes against ${approvedMinutes} approved in locked attendance, a difference of ${paidMinutes - approvedMinutes} minutes.`,
  };
}

/** (f) Loan recovery == movement in loan outstanding. */
export function checkLoanRecoveryVsMovement(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "loan_recovery_vs_loan_movement";
  const employees = facts.loans.employees;
  const actualMinor = sum(employees.map((row) => row.recoveredMinor));
  const expectedMinor = facts.loans.transactionCount === 0 && actualMinor === 0 ? 0 : sum(employees.map((row) => row.movementMinor));
  const variance = actualMinor - expectedMinor;
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: variance,
    status: variance === 0 ? "pass" : "variance",
    reason:
      variance === 0
        ? null
        : `Loan recovery withheld in payroll differs from the movement written against loan outstanding for this run across ${employees.filter((row) => row.recoveredMinor !== row.movementMinor).length} employee(s).`,
    expectedSource: "loan_transactions — recovery rows written by this payroll run",
    actualSource: "payroll_lines — loan-recovery deductions in this run",
    detail: [
      { label: "Loan transactions for this run", value: String(facts.loans.transactionCount) },
      { label: "Employees with a loan recovery", value: String(employees.filter((row) => row.recoveredMinor !== 0 || row.movementMinor !== 0).length) },
    ],
    disbursementItemId: null,
    payrollExportLineId: null,
  };
}

/** (g) Gross - deductions == net. The internal identity, asserted per employee. */
export function checkInternalIdentity(facts: ReconciliationFacts): CheckResult {
  const key: CheckKey = "gross_less_deductions_vs_net";
  const expectedMinor = facts.payslips.length === 0 ? null : sum(facts.payslips.map((row) => row.grossMinor - row.deductionsMinor));
  const actualMinor = facts.payslips.length === 0 ? null : sum(facts.payslips.map((row) => row.netMinor));
  const breaking = facts.payslips.filter((row) => row.grossMinor - row.deductionsMinor !== row.netMinor);
  return {
    key,
    label: CHECK_LABELS[key],
    expectedMinor,
    actualMinor,
    varianceMinor: varianceOf(expectedMinor, actualMinor),
    status: statusFor(expectedMinor, actualMinor),
    reason:
      expectedMinor === null
        ? "This run has no calculated employees, so the identity has nothing to assert."
        : breaking.length === 0
          ? null
          : `${breaking.length} employee${breaking.length === 1 ? "" : "s"} carry a stored net that does not equal their own gross less deductions. Offsetting breaks can cancel in the total, so the per-employee count is reported beside it.`,
    expectedSource: "payroll_run_employees — gross_minor less deductions_minor",
    actualSource: "payroll_run_employees.net_minor as stored",
    detail: [
      { label: "Employees asserted", value: String(facts.payslips.length) },
      { label: "Employees breaking the identity", value: String(breaking.length) },
    ],
    disbursementItemId: null,
    payrollExportLineId: null,
  };
}

const CHECK_FUNCTIONS: Record<CheckKey, (facts: ReconciliationFacts) => CheckResult> = {
  journal_gross_vs_payslip_earnings: checkJournalGrossVsPayslipEarnings,
  journal_net_vs_bank_file: checkJournalNetVsBankFile,
  statutory_vs_remittance: checkStatutoryVsRemittance,
  dimension_sums_vs_total: checkDimensionSums,
  ot_paid_vs_attendance_approved: checkOvertimeVsAttendance,
  loan_recovery_vs_loan_movement: checkLoanRecoveryVsMovement,
  gross_less_deductions_vs_net: checkInternalIdentity,
};

/**
 * RL-530 — evaluate all seven, independently, always in the same order. One
 * check throwing or being indeterminate never suppresses the other six.
 */
export function evaluateReconciliation(facts: ReconciliationFacts): CheckResult[] {
  return CHECK_KEYS.map((key) => CHECK_FUNCTIONS[key](facts));
}

/** A content hash of the evaluated result, so re-running an unchanged run is a no-op. */
export function reconciliationFingerprint(runId: string, checks: readonly CheckResult[]): string {
  const canonical = checks.map((check) => [check.key, check.expectedMinor, check.actualMinor, check.varianceMinor, check.status]);
  return createHash("sha256").update(JSON.stringify({ runId, canonical })).digest("hex");
}

export type ResultAction = { action: "unchanged"; resultId: string } | { action: "create" } | { action: "supersede"; resultId: string };

/**
 * Idempotent per run. Re-running an unchanged reconciliation returns the live
 * result untouched — which matters, because the explanations recorded against it
 * would otherwise be discarded. A changed result supersedes the previous one,
 * and the previous one is retained.
 */
export function resolveResultAction(
  existing: { resultId: string; lifecycle: ResultLifecycle; fingerprint: string } | null,
  fingerprint: string,
): ResultAction {
  if (!existing || existing.lifecycle === "superseded") return { action: "create" };
  if (existing.fingerprint === fingerprint) return { action: "unchanged", resultId: existing.resultId };
  return { action: "supersede", resultId: existing.resultId };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/** A passing check needs no explanation: it is reconciled the moment it passes. */
export function initialStateFor(status: CheckStatus): ReconciliationState {
  return status === "pass" ? "reconciled" : "open";
}

const TRANSITIONS: Record<Disposition, Partial<Record<ReconciliationState, ReconciliationState>>> = {
  timing: { open: "explained", explained: "explained", escalated: "explained" },
  data_correction: { open: "explained", explained: "explained", escalated: "explained" },
  accepted: { open: "explained", explained: "explained", escalated: "explained" },
  // Closing a control requires the explanation to exist first.
  reconcile: { explained: "reconciled" },
  escalate: { open: "escalated", explained: "escalated" },
};

/** The state a disposition moves an item to, or null when it is not allowed. */
export function nextItemState(current: ReconciliationState, disposition: Disposition): ReconciliationState | null {
  return TRANSITIONS[disposition][current] ?? null;
}

export function allowedDispositions(current: ReconciliationState): Disposition[] {
  return DISPOSITIONS.filter((disposition) => nextItemState(current, disposition) !== null);
}

export function assertItemTransition(current: ReconciliationState, disposition: Disposition): ReconciliationState {
  const next = nextItemState(current, disposition);
  if (next === null) {
    throw new HttpError({
      status: 409,
      code: "VERSION_CONFLICT",
      message:
        disposition === "reconcile" && current === "open"
          ? "A variance must be explained before it can be closed as reconciled. Record the explanation first."
          : `A ${RECONCILIATION_STATE_LABELS[current].toLowerCase()} control cannot be ${DISPOSITION_LABELS[disposition].toLowerCase()}.`,
      details: [{ field: "disposition", issue: `${current} -> ${disposition}` }],
    });
  }
  return next;
}

/** The run rolls up to its weakest item: escalated beats open beats explained. */
export function runStateFrom(states: readonly ReconciliationState[]): ReconciliationState {
  if (states.length === 0) return "open";
  if (states.includes("escalated")) return "escalated";
  if (states.includes("open")) return "open";
  if (states.includes("explained")) return "explained";
  return "reconciled";
}

export type TimelineStep = { key: ReconciliationState; label: string; state: "done" | "current" | "todo" };

export function reconciliationTimeline(state: ReconciliationState): TimelineStep[] {
  const order: ReconciliationState[] = ["open", "explained", "reconciled", "escalated"];
  if (state === "escalated") {
    return order.map((key) => ({
      key,
      label: RECONCILIATION_STATE_LABELS[key],
      state: key === "escalated" ? "current" : key === "reconciled" ? "todo" : "done",
    }));
  }
  const index = order.indexOf(state);
  return order.map((key, position) => ({
    key,
    label: RECONCILIATION_STATE_LABELS[key],
    state: key === "escalated" ? "todo" : position < index ? "done" : position === index ? "current" : "todo",
  }));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const runReconciliationSchema = z
  .object({ payrollRunId: z.string().uuid("A payroll run is required.") })
  .strict();
export type RunReconciliationInput = z.infer<typeof runReconciliationSchema>;

export const explainVarianceSchema = z
  .object({
    itemId: z.string().uuid("The control being explained is required."),
    disposition: z.enum(DISPOSITIONS),
    note: z
      .string()
      .trim()
      .min(EXPLANATION_MIN_LENGTH, `Give a reason of at least ${EXPLANATION_MIN_LENGTH} characters so the next reviewer can act on it.`)
      .max(1000),
  })
  .strict();
export type ExplainVarianceInput = z.infer<typeof explainVarianceSchema>;

// ---------------------------------------------------------------------------
// Fact gathering (database)
// ---------------------------------------------------------------------------

const READ_PERMISSION = "payroll.accounting.read";
const WRITE_PERMISSION = "payroll.accounting.write";
const APPROVE_PERMISSION = "payroll.accounting.approve";

type RunRow = { id: string; period: string; scope: string; status: string; currency: string | null };

async function loadRunFacts(access: Access, runId: string): Promise<RunRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, scope, status, currency from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as RunRow[])[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function minor(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function nullableText(value: unknown): string | null {
  const parsed = text(value);
  return parsed === "" ? null : parsed;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

async function loadPayslipFacts(access: Access, runId: string): Promise<PayslipFact[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id as run_employee_id, e.employee_id, e.attributes,
             emp.employee_code, emp.first_name, emp.last_name
      from payroll_run_employees e
      join employees emp on emp.tenant_id = e.tenant_id and emp.id = e.employee_id
      where e.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}
      order by emp.employee_code, e.created_at
    `,
  ]);
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const attributes = record(row.attributes);
    const name = `${text(row.first_name)} ${text(row.last_name)}`.trim();
    return {
      payrollRunEmployeeId: text(row.run_employee_id),
      employeeId: text(row.employee_id),
      employeeCode: nullableText(row.employee_code),
      employeeName: name === "" ? text(row.employee_code) || text(row.employee_id) : name,
      grossMinor: minor(attributes.gross_minor),
      deductionsMinor: minor(attributes.deductions_minor),
      netMinor: minor(attributes.net_minor),
    };
  });
}

async function loadExportLineRows(access: Access, runId: string): Promise<ExportLineRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select el.id, el.payroll_line_id, el.gl_account_id, el.cost_center_id, el.attributes
      from payroll_export_lines el
      join payroll_exports ex on ex.tenant_id = el.tenant_id and ex.id = el.payroll_export_id
      where el.tenant_id = ${access.tenantId} and ex.payroll_run_id = ${runId} and ex.attributes->>'state' = 'posted'
      order by el.created_at, el.id
    `,
  ]);
  return (rows as Array<Record<string, unknown>>).map((row) => {
    const attributes = record(row.attributes);
    return {
      exportLineId: text(row.id),
      payrollLineId: nullableText(row.payroll_line_id),
      glAccountId: nullableText(row.gl_account_id),
      accountCode: text(attributes.account_code),
      accountName: text(attributes.account_name),
      componentCode: nullableText(attributes.component_code),
      side: text(attributes.side) === "credit" ? "credit" : "debit",
      lineDebitMinor: minor(attributes.line_debit_minor),
      lineCreditMinor: minor(attributes.line_credit_minor),
      contributionMinor: minor(attributes.contribution_minor),
      employeeId: nullableText(attributes.employee_id),
      employeeCode: nullableText(attributes.employee_code),
      dimensions: {
        costCenterId: nullableText(row.cost_center_id),
        departmentId: nullableText(attributes.department_id),
        department: nullableText(attributes.department),
        locationId: nullableText(attributes.location_id),
        location: nullableText(attributes.location),
        projectId: nullableText(attributes.project_id),
        runType: text(attributes.run_type),
      },
    };
  });
}

async function loadBankFact(access: Access, runId: string): Promise<BankFact | null> {
  const [batchRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes from disbursement_batches
      where tenant_id = ${access.tenantId} and payroll_run_id = ${runId} and attributes->>'state' = 'released'
      order by created_at desc limit 1
    `,
  ]);
  const batch = (batchRows as Array<{ id: string; attributes: Record<string, unknown> | null }>)[0];
  if (!batch) return null;
  const [itemRows] = await tenantTx(access, [
    sqlClient`
      select id, payroll_run_employee_id, employee_id, attributes
      from disbursement_items where tenant_id = ${access.tenantId} and disbursement_batch_id = ${batch.id}
      order by attributes->>'employee_code', created_at
    `,
  ]);
  const attributes = record(batch.attributes);
  return {
    batchId: batch.id,
    state: text(attributes.state),
    totalAmountMinor: minor(attributes.total_amount_minor),
    items: (itemRows as Array<Record<string, unknown>>).map((row) => {
      const itemAttributes = record(row.attributes);
      return {
        disbursementItemId: text(row.id),
        payrollRunEmployeeId: nullableText(row.payroll_run_employee_id),
        employeeId: nullableText(row.employee_id),
        employeeCode: nullableText(itemAttributes.employee_code),
        amountMinor: minor(itemAttributes.amount_minor),
        state: text(itemAttributes.state) || "included",
      };
    }),
  };
}

/**
 * Per-component totals for the run, keyed by run employee. Loaded once and
 * filtered in TypeScript by the component catalog, so no query has to name a
 * component code.
 */
type ComponentTotal = { payrollRunEmployeeId: string; employeeId: string; code: string; amountMinor: number };

async function loadComponentTotals(access: Access, runId: string): Promise<ComponentTotal[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select e.id as run_employee_id, e.employee_id, (l.attributes->>'code') as code,
             coalesce(sum((l.attributes->>'amount_minor')::bigint), 0)::bigint as amount_minor
      from payroll_lines l
      join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      where l.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}
      group by e.id, e.employee_id, (l.attributes->>'code')
    `,
  ]);
  return (rows as Array<Record<string, unknown>>)
    .map((row) => ({
      payrollRunEmployeeId: text(row.run_employee_id),
      employeeId: text(row.employee_id),
      code: text(row.code),
      amountMinor: minor(row.amount_minor),
    }))
    .filter((row) => row.code !== "");
}

/**
 * Overtime facts. `attendance_days.locked_at is not null` is what "approved"
 * means for an attendance day and is the same filter `service.calculateRun`
 * applies, so the two sides of the assertion read the same definition of
 * approval from different tables.
 */
async function loadOtFacts(
  access: Access,
  runId: string,
  period: string,
  payslips: readonly PayslipFact[],
  totals: readonly ComponentTotal[],
  otComponentCodes: readonly string[],
): Promise<ReconciliationFacts["ot"]> {
  if (payslips.length === 0) return { employees: [], traceRowCount: 0 };
  const employeeIds = payslips.map((row) => row.employeeId);
  const [attendanceRows, traceRows] = await tenantTx(access, [
    sqlClient`
      select employee_id, coalesce(sum(payable_ot_minutes), 0)::int as minutes
      from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = any(${employeeIds}::uuid[])
        and attendance_date::text like ${`${period}%`} and locked_at is not null
      group by employee_id
    `,
    sqlClient`
      select c.payroll_run_employee_id, c.attributes
      from payroll_calculations c
      join payroll_run_employees e on e.tenant_id = c.tenant_id and e.id = c.payroll_run_employee_id
      where c.tenant_id = ${access.tenantId} and e.payroll_run_id = ${runId}
        and c.attributes->>'rule' = 'overtime.workingDayMultiplier'
    `,
  ]);
  const otCodes = new Set(otComponentCodes);
  const lineRows = totals.filter((row) => otCodes.has(row.code));
  const minutesByEmployee = new Map(
    (attendanceRows as Array<{ employee_id: string; minutes: number }>).map((row) => [text(row.employee_id), minor(row.minutes)]),
  );
  const traceByMember = new Map<string, { hourlyRateMinor: number | null; multiplier: number | null; paidMinutes: number | null }>();
  for (const raw of traceRows as Array<Record<string, unknown>>) {
    const attributes = record(raw.attributes);
    const inputs = record(attributes.inputs);
    const rate = Number(inputs.hourlyRateMinor);
    const multiplier = Number(inputs.multiplier);
    const paid = Number(inputs.payableOtMinutes);
    traceByMember.set(text(raw.payroll_run_employee_id), {
      hourlyRateMinor: Number.isFinite(rate) ? rate : null,
      multiplier: Number.isFinite(multiplier) ? multiplier : null,
      paidMinutes: Number.isFinite(paid) ? Math.trunc(paid) : null,
    });
  }
  const paidByMember = new Map<string, number>();
  for (const row of lineRows) {
    paidByMember.set(row.payrollRunEmployeeId, (paidByMember.get(row.payrollRunEmployeeId) ?? 0) + row.amountMinor);
  }
  const employees = payslips.map((row) => {
    const trace = traceByMember.get(row.payrollRunEmployeeId) ?? null;
    return {
      payrollRunEmployeeId: row.payrollRunEmployeeId,
      employeeId: row.employeeId,
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      approvedMinutes: minutesByEmployee.get(row.employeeId) ?? 0,
      hourlyRateMinor: trace?.hourlyRateMinor ?? null,
      multiplier: trace?.multiplier ?? null,
      paidMinutes: trace?.paidMinutes ?? null,
      paidAmountMinor: paidByMember.get(row.payrollRunEmployeeId) ?? 0,
    };
  });
  return { employees, traceRowCount: traceByMember.size };
}

/**
 * Loan facts. The payroll side is the loan-recovery deduction actually withheld;
 * the loan side is the `loan_transactions` rows this run wrote, which are what
 * moved `employee_loans.outstanding_minor`. Two tables, two writers.
 */
async function loadLoanFacts(
  access: Access,
  runId: string,
  payslips: readonly PayslipFact[],
  totals: readonly ComponentTotal[],
  loanComponentCodes: readonly string[],
): Promise<ReconciliationFacts["loans"]> {
  if (payslips.length === 0) return { employees: [], transactionCount: 0 };
  const [transactionRows] = await tenantTx(access, [
    sqlClient`
      select loan.employee_id, t.attributes
      from loan_transactions t
      join employee_loans loan on loan.tenant_id = t.tenant_id and loan.id = t.employee_loan_id
      where t.tenant_id = ${access.tenantId} and t.attributes->>'payroll_run_id' = ${runId}
        and t.attributes->>'kind' = 'recovery'
    `,
  ]);
  const loanCodes = new Set(loanComponentCodes);
  const recoveredByEmployee = new Map<string, number>();
  for (const row of totals) {
    if (!loanCodes.has(row.code)) continue;
    recoveredByEmployee.set(row.employeeId, (recoveredByEmployee.get(row.employeeId) ?? 0) + row.amountMinor);
  }
  const movementByEmployee = new Map<string, { amountMinor: number; count: number }>();
  for (const raw of transactionRows as Array<Record<string, unknown>>) {
    const employeeId = text(raw.employee_id);
    const attributes = record(raw.attributes);
    const held = movementByEmployee.get(employeeId) ?? { amountMinor: 0, count: 0 };
    movementByEmployee.set(employeeId, { amountMinor: held.amountMinor + minor(attributes.amount_minor), count: held.count + 1 });
  }
  const employeeIds = new Set([...recoveredByEmployee.keys(), ...movementByEmployee.keys()]);
  const byId = new Map(payslips.map((row) => [row.employeeId, row]));
  const employees: LoanEmployeeFact[] = [...employeeIds].map((employeeId) => {
    const movement = movementByEmployee.get(employeeId) ?? { amountMinor: 0, count: 0 };
    const member = byId.get(employeeId);
    return {
      employeeId,
      employeeCode: member?.employeeCode ?? null,
      employeeName: member?.employeeName ?? employeeId,
      recoveredMinor: recoveredByEmployee.get(employeeId) ?? 0,
      movementMinor: movement.amountMinor,
      transactionCount: movement.count,
    };
  });
  employees.sort((left, right) => (left.employeeCode ?? "").localeCompare(right.employeeCode ?? ""));
  return { employees, transactionCount: sum(employees.map((row) => row.transactionCount)) };
}

/**
 * Gather every fact the seven assertions need. Nothing is evaluated here: the
 * arithmetic lives in the pure checks above, which is what makes them testable
 * without a database.
 */
export async function gatherFacts(access: Access, runId: string): Promise<ReconciliationFacts> {
  // Guarded here too: the writing callers enforce their own permission first,
  // exactly as `gl.postJournal` guards and then calls the read-guarded builder.
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const run = await loadRunFacts(access, runId);
  const components = await listComponents(access);
  const kindByCode: Record<string, ComponentKind> = Object.fromEntries(components.map((component) => [component.code, component.kind]));
  // Heads are classified by `kind`, never by a hard-coded component code. The
  // overtime and loan-recovery heads are the two the assertions name directly;
  // they are resolved from the catalog by calculation method and by the loan
  // transactions that reference them, so a tenant that renames a code still works.
  const otComponentCodes = components
    .filter((component) => component.kind === "earning" && component.calculationMethod === "attendance_driven")
    .map((component) => component.code);
  const loanComponentCodes = components
    .filter((component) => component.kind === "deduction" && /loan/i.test(`${component.code} ${component.name}`))
    .map((component) => component.code);

  const [payslips, exportRows, bank, totals] = await Promise.all([
    loadPayslipFacts(access, run.id),
    loadExportLineRows(access, run.id),
    loadBankFact(access, run.id),
    loadComponentTotals(access, run.id),
  ]);
  const [ot, loans] = await Promise.all([
    loadOtFacts(access, run.id, run.period, payslips, totals, otComponentCodes),
    loadLoanFacts(access, run.id, payslips, totals, loanComponentCodes),
  ]);

  return {
    runId: run.id,
    period: run.period,
    runType: run.scope,
    runStatus: run.status,
    currency: run.currency ?? "INR",
    journalPosted: exportRows.length > 0,
    journalLines: groupExportLines(exportRows, kindByCode),
    payslips,
    bank,
    remittance: await loadRemittanceFacts(access, run.period),
    ot,
    loans,
  };
}

/**
 * Amounts remitted to an authority for the period.
 *
 * Recorded by the statutory filing register (SCR-072), which writes one
 * `vp_feature_records` row of kind `statutory_remittance` per filing outcome. Until
 * that register existed there was no paid-to-authority figure anywhere in the
 * system, which is why this control reported indeterminate.
 *
 * A period with no recorded remittance still returns null, not zero: zero would
 * assert that nothing was owed, which is a different and much stronger claim than
 * "nobody has recorded what was paid". Mixed currencies also return null rather
 * than summing across them.
 */
async function loadRemittanceFacts(
  access: Access,
  period: string,
): Promise<{ totalMinor: number; heads: Array<{ head: string; amountMinor: number }> } | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select data->>'currency' as currency,
             coalesce(data->>'formCode', data->>'authority', 'unattributed') as head,
             sum((data->>'amountRemittedMinor')::bigint) as total_minor
      from vp_feature_records
      where tenant_id = ${access.tenantId}
        and kind = 'statutory_remittance'
        and data->>'period' = ${period}
        and data ? 'amountRemittedMinor'
        and data->>'amountRemittedMinor' is not null
      group by 1, 2
    `,
  ]);
  const records = rows as Array<{ currency: string | null; head: string; total_minor: number | string }>;
  if (records.length === 0) return null;
  const currencies = new Set(records.map((row) => row.currency ?? "INR"));
  if (currencies.size > 1) return null;
  const heads = records.map((row) => ({ head: row.head, amountMinor: Number(row.total_minor) }));
  return { totalMinor: heads.reduce((total, entry) => total + entry.amountMinor, 0), heads };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type ItemRow = {
  id: string;
  disbursement_item_id: string | null;
  payroll_export_line_id: string | null;
  attributes: Record<string, unknown> | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
};

export type ExplanationEntry = {
  disposition: Disposition;
  note: string;
  state: ReconciliationState;
  actorUserId: string | null;
  recordedAt: string;
};

export type ReconciliationItemView = CheckResult & {
  id: string;
  resultId: string;
  runId: string;
  period: string;
  runType: string;
  currency: string;
  state: ReconciliationState;
  lifecycle: ResultLifecycle;
  disposition: Disposition | null;
  note: string | null;
  explanations: ExplanationEntry[];
  allowedDispositions: Disposition[];
  ranAt: string | null;
};

function iso(value: string | Date | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function stateOf(value: unknown, fallback: ReconciliationState = "open"): ReconciliationState {
  const parsed = text(value);
  return (RECONCILIATION_STATES as readonly string[]).includes(parsed) ? (parsed as ReconciliationState) : fallback;
}

function checkResultFrom(attributes: Record<string, unknown>, row: ItemRow): CheckResult {
  const key = text(attributes.check_key) as CheckKey;
  const numberOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : minor(value));
  return {
    key,
    label: text(attributes.label) || CHECK_LABELS[key] || key,
    expectedMinor: numberOrNull(attributes.expected_minor),
    actualMinor: numberOrNull(attributes.actual_minor),
    varianceMinor: numberOrNull(attributes.variance_minor),
    status: ((CHECK_STATUSES as readonly string[]).includes(text(attributes.status)) ? text(attributes.status) : "indeterminate") as CheckStatus,
    reason: nullableText(attributes.reason),
    expectedSource: text(attributes.expected_source),
    actualSource: text(attributes.actual_source),
    detail: Array.isArray(attributes.detail)
      ? (attributes.detail as unknown[]).map((entry) => ({ label: text(record(entry).label), value: text(record(entry).value) }))
      : [],
    disbursementItemId: row.disbursement_item_id,
    payrollExportLineId: row.payroll_export_line_id,
  };
}

function itemViewFrom(row: ItemRow): ReconciliationItemView {
  const attributes = record(row.attributes);
  const state = stateOf(attributes.item_state);
  const explanations = Array.isArray(attributes.explanations)
    ? (attributes.explanations as unknown[]).map((entry) => {
        const parsed = record(entry);
        return {
          disposition: text(parsed.disposition) as Disposition,
          note: text(parsed.note),
          state: stateOf(parsed.state),
          actorUserId: nullableText(parsed.actor_user_id),
          recordedAt: text(parsed.recorded_at),
        };
      })
    : [];
  return {
    ...checkResultFrom(attributes, row),
    id: row.id,
    resultId: text(attributes.result_id),
    runId: text(attributes.payroll_run_id),
    period: text(attributes.period),
    runType: text(attributes.run_type),
    currency: text(attributes.currency) || "INR",
    state,
    lifecycle: text(attributes.lifecycle) === "superseded" ? "superseded" : "live",
    disposition: nullableText(attributes.disposition) as Disposition | null,
    note: nullableText(attributes.note),
    explanations,
    allowedDispositions: allowedDispositions(state),
    ranAt: text(attributes.ran_at) || iso(row.created_at),
  };
}

async function loadItemRows(
  access: Access,
  where: { runId?: string | null; resultId?: string | null; itemId?: string | null; lifecycle?: ResultLifecycle | null; recordKind?: RecordKind | null },
): Promise<ItemRow[]> {
  const runId = where.runId ?? null;
  const resultId = where.resultId ?? null;
  const itemId = where.itemId ?? null;
  const lifecycle = where.lifecycle ?? null;
  const recordKind = where.recordKind ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, disbursement_item_id, payroll_export_line_id, attributes, created_at, updated_at
      from reconciliation_items
      where tenant_id = ${access.tenantId}
        and (${runId}::text is null or attributes->>'payroll_run_id' = ${runId}::text)
        and (${resultId}::text is null or attributes->>'result_id' = ${resultId}::text)
        and (${itemId}::uuid is null or id = ${itemId}::uuid)
        and (${lifecycle}::text is null or attributes->>'lifecycle' = ${lifecycle}::text)
        and (${recordKind}::text is null or attributes->>'record_kind' = ${recordKind}::text)
      order by created_at desc, attributes->>'sequence'
    `,
  ]);
  return rows as ItemRow[];
}

async function loadLiveResult(
  access: Access,
  runId: string,
): Promise<{ resultId: string; lifecycle: ResultLifecycle; fingerprint: string; ranAt: string | null } | null> {
  const rows = await loadItemRows(access, { runId, lifecycle: "live", recordKind: "check" });
  const first = rows[0];
  if (!first) return null;
  const attributes = record(first.attributes);
  return {
    resultId: text(attributes.result_id),
    lifecycle: "live",
    fingerprint: text(attributes.fingerprint),
    ranAt: nullableText(attributes.ran_at),
  };
}

export type RunReconciliationResult = {
  resultId: string;
  runId: string;
  action: ResultAction["action"];
  state: ReconciliationState;
  checks: number;
  passed: number;
  variances: number;
  indeterminate: number;
  pairings: number;
};

/**
 * RL-530 — evaluate the seven assertions and persist the result.
 *
 * One `reconciliation_items` row per check. The net-pay assertion additionally
 * writes one pairing row per employee linking the bank item that paid them to
 * the journal line that recorded it, which is what the table's two foreign keys
 * are for. Re-running is idempotent: an unchanged result is left alone (so the
 * explanations recorded against it survive), a changed result supersedes the
 * previous one, and the previous one is retained, never deleted.
 */
export async function runReconciliation(access: Access, runId: string, requestId: string): Promise<RunReconciliationResult> {
  enforce(access.context, WRITE_PERMISSION, { tenantId: access.tenantId });
  const facts = await gatherFacts(access, runId);
  const checks = evaluateReconciliation(facts);
  const fingerprint = reconciliationFingerprint(facts.runId, checks);
  const existing = await loadLiveResult(access, facts.runId);
  const decision = resolveResultAction(existing, fingerprint);

  const summary = {
    checks: checks.length,
    passed: checks.filter((check) => check.status === "pass").length,
    variances: checks.filter((check) => check.status === "variance").length,
    indeterminate: checks.filter((check) => check.status === "indeterminate").length,
  };

  if (decision.action === "unchanged") {
    const rows = await loadItemRows(access, { resultId: decision.resultId, recordKind: "check" });
    return {
      resultId: decision.resultId,
      runId: facts.runId,
      action: "unchanged",
      state: runStateFrom(rows.map((row) => stateOf(record(row.attributes).item_state))),
      ...summary,
      pairings: 0,
    };
  }

  const resultId = crypto.randomUUID();
  const ranAt = new Date().toISOString();
  const common = {
    result_id: resultId,
    payroll_run_id: facts.runId,
    period: facts.period,
    run_type: facts.runType,
    currency: facts.currency,
    fingerprint,
    lifecycle: "live" satisfies ResultLifecycle,
    ran_at: ranAt,
    ran_by: access.context.actorUserId,
    supersedes_result_id: decision.action === "supersede" ? decision.resultId : null,
  };

  // The net-pay pairing: the bank item an employee was paid on against the
  // journal contribution that recorded their net pay.
  const netContributions = new Map<string, string>();
  for (const line of facts.journalLines) {
    if (line.componentCode !== null) continue;
    for (const contribution of line.contributions) {
      if (contribution.employeeId && !netContributions.has(contribution.employeeId)) {
        netContributions.set(contribution.employeeId, contribution.exportLineId);
      }
    }
  }
  const pairings = (facts.bank?.items ?? [])
    .filter((item) => item.state !== "excluded" && item.employeeId !== null)
    .map((item) => ({ item, exportLineId: netContributions.get(item.employeeId as string) ?? null }));

  const statements = [
    ...(decision.action === "supersede"
      ? [sqlClient`
          update reconciliation_items
          set attributes = attributes || ${JSON.stringify({ lifecycle: "superseded", superseded_at: ranAt, superseded_by_result_id: resultId })}::jsonb,
              version = version + 1, updated_at = now()
          where tenant_id = ${access.tenantId} and attributes->>'payroll_run_id' = ${facts.runId} and attributes->>'lifecycle' = 'live'
        `]
      : []),
    ...checks.map((check, index) => {
      const state = initialStateFor(check.status);
      return sqlClient`
        insert into reconciliation_items (id, tenant_id, disbursement_item_id, payroll_export_line_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${check.disbursementItemId}, ${check.payrollExportLineId},
          ${JSON.stringify({
            ...common,
            record_kind: "check" satisfies RecordKind,
            sequence: String(index).padStart(2, "0"),
            check_key: check.key,
            label: check.label,
            expected_minor: check.expectedMinor,
            actual_minor: check.actualMinor,
            variance_minor: check.varianceMinor,
            status: check.status,
            reason: check.reason,
            expected_source: check.expectedSource,
            actual_source: check.actualSource,
            detail: check.detail,
            item_state: state,
            disposition: null,
            note: null,
            explanations: [],
          })}::jsonb)
      `;
    }),
    ...pairings.map((pairing) => sqlClient`
      insert into reconciliation_items (id, tenant_id, disbursement_item_id, payroll_export_line_id, attributes)
      values (${crypto.randomUUID()}, ${access.tenantId}, ${pairing.item.disbursementItemId}, ${pairing.exportLineId},
        ${JSON.stringify({
          ...common,
          record_kind: "pairing" satisfies RecordKind,
          sequence: "99",
          check_key: "journal_net_vs_bank_file",
          employee_id: pairing.item.employeeId,
          employee_code: pairing.item.employeeCode,
          bank_amount_minor: pairing.item.amountMinor,
          matched: pairing.exportLineId !== null,
          item_state: pairing.exportLineId === null ? "open" : "reconciled",
        })}::jsonb)
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.reconciliation_run', 'payroll_run', ${facts.runId},
        ${`Payroll reconciliation run for ${facts.period}`},
        ${JSON.stringify({ resultId, action: decision.action, ...summary, pairings: pairings.length })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.reconciliation_completed', 'payroll_run', ${facts.runId},
        ${JSON.stringify({ resultId, runId: facts.runId, period: facts.period, runType: facts.runType, ...summary })}::jsonb)
    `,
  ];
  await tenantTx(access, statements);

  return {
    resultId,
    runId: facts.runId,
    action: decision.action,
    state: runStateFrom(checks.map((check) => initialStateFor(check.status))),
    ...summary,
    pairings: pairings.length,
  };
}

/**
 * Record why a control does not balance and move it along the state machine.
 * The note is mandatory: an unexplained variance stays open, which is the whole
 * point of the control. Closing a control as reconciled needs the approve
 * permission, because it is the act that lets the period close.
 */
export async function explainVariance(
  access: Access,
  itemId: string,
  input: { disposition: Disposition; note: string },
  requestId: string,
): Promise<ReconciliationItemView> {
  enforce(access.context, input.disposition === "reconcile" ? APPROVE_PERMISSION : WRITE_PERMISSION, { tenantId: access.tenantId });
  const rows = await loadItemRows(access, { itemId, recordKind: "check" });
  const row = rows[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const view = itemViewFrom(row);
  if (view.lifecycle === "superseded") {
    throw new HttpError({
      status: 409,
      code: "VERSION_CONFLICT",
      message: "This control belongs to a superseded reconciliation result. Re-run the reconciliation and explain the current result.",
    });
  }
  if (view.status === "pass") {
    throw new HttpError({
      status: 409,
      code: "VERSION_CONFLICT",
      message: "This control passes, so it is already reconciled and needs no explanation.",
      details: [{ field: "itemId", issue: "status=pass" }],
    });
  }
  const note = input.note.trim();
  if (note.length < EXPLANATION_MIN_LENGTH) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: `Give a reason of at least ${EXPLANATION_MIN_LENGTH} characters so the next reviewer can act on it.`,
      details: [{ field: "note", issue: `minimum ${EXPLANATION_MIN_LENGTH} characters` }],
    });
  }
  const next = assertItemTransition(view.state, input.disposition);
  const recordedAt = new Date().toISOString();
  const entry: ExplanationEntry = {
    disposition: input.disposition,
    note,
    state: next,
    actorUserId: access.context.actorUserId,
    recordedAt,
  };
  const patch = {
    item_state: next,
    disposition: input.disposition,
    note,
    explanations: [...view.explanations, entry],
    last_explained_at: recordedAt,
    last_explained_by: access.context.actorUserId,
  };
  await tenantTx(access, [
    sqlClient`
      update reconciliation_items set attributes = attributes || ${JSON.stringify(patch)}::jsonb,
        version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${itemId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.reconciliation_explain', 'reconciliation_item', ${itemId},
        ${note}, ${JSON.stringify({ checkKey: view.key, disposition: input.disposition, from: view.state, to: next })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, ${next === "escalated" ? "payroll.reconciliation_escalated" : "payroll.reconciliation_explained"},
        'reconciliation_item', ${itemId},
        ${JSON.stringify({ runId: view.runId, resultId: view.resultId, checkKey: view.key, disposition: input.disposition, state: next })}::jsonb)
    `,
  ]);
  return {
    ...view,
    state: next,
    disposition: input.disposition,
    note,
    explanations: [...view.explanations, entry],
    allowedDispositions: allowedDispositions(next),
  };
}

// ---------------------------------------------------------------------------
// RL-531 — drill back to the contributing employees
// ---------------------------------------------------------------------------

export type DrillEmployee = {
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  expectedMinor: number | null;
  actualMinor: number | null;
  varianceMinor: number | null;
};

export type DrillLine = {
  payrollLineId: string | null;
  payrollExportLineId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  componentCode: string | null;
  accountCode: string;
  amountMinor: number;
};

export type DrillResult = {
  checkKey: CheckKey;
  label: string;
  runId: string;
  basis: string;
  employees: DrillEmployee[];
  lines: DrillLine[];
};

/** The component kinds whose journal lines a check is built from, if any. */
export function drillKindsFor(checkKey: CheckKey): readonly ComponentKind[] | "net_pay" | null {
  if (checkKey === "journal_gross_vs_payslip_earnings") return EARNING_KINDS;
  if (checkKey === "statutory_vs_remittance") return ["deduction", "employer_contribution"];
  if (checkKey === "journal_net_vs_bank_file") return "net_pay";
  if (checkKey === "dimension_sums_vs_total") return null;
  return null;
}

type DrillRow = {
  export_line_id: string;
  payroll_line_id: string | null;
  run_employee_id: string;
  employee_id: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  export_attributes: Record<string, unknown> | null;
  line_attributes: Record<string, unknown> | null;
};

/**
 * RL-531 — the employees and payslip lines behind a figure, reached through the
 * link GL posting persists: `payroll_export_lines.payroll_line_id ->
 * payroll_lines -> payroll_run_employees -> employees`.
 */
export async function drillVariance(access: Access, checkKey: CheckKey, runId: string): Promise<DrillResult> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  if (!(CHECK_KEYS as readonly string[]).includes(checkKey)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Unknown reconciliation control.", details: [{ field: "checkKey", issue: checkKey }] });
  }
  const facts = await gatherFacts(access, runId);
  const label = CHECK_LABELS[checkKey];

  if (checkKey === "gross_less_deductions_vs_net") {
    return {
      checkKey,
      label,
      runId: facts.runId,
      basis: "Every calculated employee, their stored gross less deductions against their stored net.",
      employees: facts.payslips.map((row) => ({
        payrollRunEmployeeId: row.payrollRunEmployeeId,
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        expectedMinor: row.grossMinor - row.deductionsMinor,
        actualMinor: row.netMinor,
        varianceMinor: row.netMinor - (row.grossMinor - row.deductionsMinor),
      })).filter((row) => row.varianceMinor !== 0),
      lines: [],
    };
  }

  if (checkKey === "ot_paid_vs_attendance_approved") {
    return {
      checkKey,
      label,
      runId: facts.runId,
      basis: "Approved overtime minutes from locked attendance, re-priced at the rate the run recorded, against the overtime actually paid.",
      employees: facts.ot.employees
        .filter((row) => row.approvedMinutes > 0 || row.paidAmountMinor !== 0)
        .map((row) => {
          const expected =
            row.hourlyRateMinor === null || row.multiplier === null ? null : Math.round(row.hourlyRateMinor * row.approvedMinutes * row.multiplier);
          return {
            payrollRunEmployeeId: row.payrollRunEmployeeId,
            employeeId: row.employeeId,
            employeeCode: row.employeeCode,
            employeeName: row.employeeName,
            expectedMinor: expected,
            actualMinor: row.paidAmountMinor,
            varianceMinor: expected === null ? null : row.paidAmountMinor - expected,
          };
        }),
      lines: [],
    };
  }

  if (checkKey === "loan_recovery_vs_loan_movement") {
    const byEmployee = new Map(facts.payslips.map((row) => [row.employeeId, row]));
    return {
      checkKey,
      label,
      runId: facts.runId,
      basis: "Loan recovery withheld in payroll against the loan_transactions rows this run wrote.",
      employees: facts.loans.employees.map((row) => ({
        payrollRunEmployeeId: byEmployee.get(row.employeeId)?.payrollRunEmployeeId ?? "",
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        expectedMinor: row.movementMinor,
        actualMinor: row.recoveredMinor,
        varianceMinor: row.recoveredMinor - row.movementMinor,
      })),
      lines: [],
    };
  }

  const [rows] = await tenantTx(access, [
    sqlClient`
      select el.id as export_line_id, el.payroll_line_id, el.attributes as export_attributes,
             pl.attributes as line_attributes,
             pre.id as run_employee_id, emp.id as employee_id, emp.employee_code, emp.first_name, emp.last_name
      from payroll_export_lines el
      join payroll_exports ex on ex.tenant_id = el.tenant_id and ex.id = el.payroll_export_id
      join payroll_lines pl on pl.tenant_id = el.tenant_id and pl.id = el.payroll_line_id
      join payroll_run_employees pre on pre.tenant_id = pl.tenant_id and pre.id = pl.payroll_run_employee_id
      join employees emp on emp.tenant_id = pre.tenant_id and emp.id = pre.employee_id
      where el.tenant_id = ${access.tenantId} and ex.payroll_run_id = ${runId} and ex.attributes->>'state' = 'posted'
      order by emp.employee_code, el.created_at
    `,
  ]);

  const kinds = drillKindsFor(checkKey);
  const components = await listComponents(access);
  const kindByCode: Record<string, ComponentKind> = Object.fromEntries(components.map((component) => [component.code, component.kind]));
  const lines: DrillLine[] = [];
  const perEmployee = new Map<string, DrillEmployee>();
  for (const raw of rows as DrillRow[]) {
    const exportAttributes = record(raw.export_attributes);
    const componentCode = nullableText(exportAttributes.component_code);
    if (kinds === "net_pay") {
      if (componentCode !== null) continue;
    } else if (Array.isArray(kinds)) {
      const kind = componentCode === null ? null : kindByCode[componentCode] ?? null;
      if (kind === null || !kinds.includes(kind)) continue;
    }
    const name = `${text(raw.first_name)} ${text(raw.last_name)}`.trim();
    const employeeName = name === "" ? text(raw.employee_code) || text(raw.employee_id) : name;
    const amountMinor = minor(exportAttributes.contribution_minor);
    lines.push({
      payrollLineId: raw.payroll_line_id,
      payrollExportLineId: text(raw.export_line_id),
      employeeId: text(raw.employee_id),
      employeeCode: nullableText(raw.employee_code),
      employeeName,
      componentCode,
      accountCode: text(exportAttributes.account_code),
      amountMinor,
    });
    const held = perEmployee.get(text(raw.employee_id));
    if (held) {
      held.actualMinor = (held.actualMinor ?? 0) + amountMinor;
    } else {
      perEmployee.set(text(raw.employee_id), {
        payrollRunEmployeeId: text(raw.run_employee_id),
        employeeId: text(raw.employee_id),
        employeeCode: nullableText(raw.employee_code),
        employeeName,
        expectedMinor: null,
        actualMinor: amountMinor,
        varianceMinor: null,
      });
    }
  }

  // For the two checks with a per-employee counter-source, fill the expected side.
  if (checkKey === "journal_gross_vs_payslip_earnings" || checkKey === "journal_net_vs_bank_file") {
    const expectedByEmployee = new Map<string, number>(
      checkKey === "journal_gross_vs_payslip_earnings"
        ? facts.payslips.map((row) => [row.employeeId, row.grossMinor])
        : (facts.bank?.items ?? [])
            .filter((item) => item.state !== "excluded" && item.employeeId !== null)
            .map((item) => [item.employeeId as string, item.amountMinor]),
    );
    for (const employee of perEmployee.values()) {
      const expected = expectedByEmployee.get(employee.employeeId);
      if (expected === undefined) continue;
      employee.expectedMinor = expected;
      employee.varianceMinor = (employee.actualMinor ?? 0) - expected;
    }
  }

  return {
    checkKey,
    label,
    runId: facts.runId,
    basis: "Posted journal lines, drilled back through payroll_export_lines.payroll_line_id to the payroll lines and employees that produced them.",
    employees: [...perEmployee.values()].sort((left, right) => (left.employeeCode ?? "").localeCompare(right.employeeCode ?? "")),
    lines,
  };
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/**
 * The work queue: one row per control, carrying both sides of its assertion so
 * the screen can show Control / Expected / Actual / Variance without computing
 * anything itself.
 */
export async function listReconciliations(
  access: Access,
  args: { runId?: string | null; status?: string | null; state?: string | null; includeSuperseded?: boolean; page?: number; pageSize?: number } = {},
): Promise<{ items: ReconciliationItemView[]; total: number }> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const page = args.page && args.page > 0 ? args.page : 1;
  const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 100) : 50;
  const rows = await loadItemRows(access, {
    runId: args.runId ?? null,
    lifecycle: args.includeSuperseded === true ? null : "live",
    recordKind: "check",
  });
  const status = args.status && (CHECK_STATUSES as readonly string[]).includes(args.status) ? args.status : null;
  const state = args.state && (RECONCILIATION_STATES as readonly string[]).includes(args.state) ? args.state : null;
  const items = rows
    .map(itemViewFrom)
    .filter((item) => (status === null || item.status === status) && (state === null || item.state === state));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length };
}

export type ReconciliationDetail = {
  id: string;
  runId: string;
  period: string;
  runType: string;
  currency: string;
  lifecycle: ResultLifecycle;
  state: ReconciliationState;
  ranAt: string | null;
  fingerprint: string;
  supersedesResultId: string | null;
  supersededByResultId: string | null;
  checks: ReconciliationItemView[];
  pairings: Array<{ id: string; employeeId: string | null; employeeCode: string | null; bankAmountMinor: number; disbursementItemId: string | null; payrollExportLineId: string | null; matched: boolean }>;
  timeline: TimelineStep[];
  summary: { checks: number; passed: number; variances: number; indeterminate: number; totalVarianceMinor: number };
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

/** The detail read model, keyed by the reconciliation result id. */
export async function getReconciliation(access: Access, resultId: string): Promise<ReconciliationDetail> {
  enforce(access.context, READ_PERMISSION, { tenantId: access.tenantId });
  const rows = await loadItemRows(access, { resultId });
  if (rows.length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const checkRows = rows.filter((row) => text(record(row.attributes).record_kind) !== "pairing");
  const checks = checkRows.map(itemViewFrom).sort((left, right) => CHECK_KEYS.indexOf(left.key) - CHECK_KEYS.indexOf(right.key));
  const head = record(checkRows[0]?.attributes ?? rows[0].attributes);
  const runId = text(head.payroll_run_id);
  const [auditRows] = await tenantTx(access, [
    sqlClient`
      select action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId}
        and ((entity_type = 'payroll_run' and entity_id = ${runId} and action = 'payroll.reconciliation_run')
          or (entity_type = 'reconciliation_item' and entity_id = any(${rows.map((row) => row.id)}::uuid[])))
      order by created_at desc limit 50
    `,
  ]);
  const state = runStateFrom(checks.map((check) => check.state));
  return {
    id: resultId,
    runId,
    period: text(head.period),
    runType: text(head.run_type),
    currency: text(head.currency) || "INR",
    lifecycle: text(head.lifecycle) === "superseded" ? "superseded" : "live",
    state,
    ranAt: nullableText(head.ran_at),
    fingerprint: text(head.fingerprint),
    supersedesResultId: nullableText(head.supersedes_result_id),
    supersededByResultId: nullableText(head.superseded_by_result_id),
    checks,
    pairings: rows
      .filter((row) => text(record(row.attributes).record_kind) === "pairing")
      .map((row) => {
        const attributes = record(row.attributes);
        return {
          id: row.id,
          employeeId: nullableText(attributes.employee_id),
          employeeCode: nullableText(attributes.employee_code),
          bankAmountMinor: minor(attributes.bank_amount_minor),
          disbursementItemId: row.disbursement_item_id,
          payrollExportLineId: row.payroll_export_line_id,
          matched: attributes.matched === true,
        };
      }),
    timeline: reconciliationTimeline(state),
    summary: {
      checks: checks.length,
      passed: checks.filter((check) => check.status === "pass").length,
      variances: checks.filter((check) => check.status === "variance").length,
      indeterminate: checks.filter((check) => check.status === "indeterminate").length,
      totalVarianceMinor: sum(checks.map((check) => check.varianceMinor ?? 0)),
    },
    auditTrail: (auditRows as Array<{ action: string; reason: string | null; created_at: string | Date | null }>).map((row) => ({
      action: row.action,
      reason: row.reason,
      createdAt: iso(row.created_at),
    })),
  };
}
