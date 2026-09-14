import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { listDossier } from "@/server/workflows/dossier-service";

/**
 * SCR-055 — Bank disbursement control (FRM-PAY-07, PAY-09.3 / PAY-09.4).
 *
 * Turns an approved payroll run into a bank payment batch, holds it under dual
 * control, and records what the bank sent back. The canonical tables
 * `disbursement_batches` and `disbursement_items` had no reader or writer before
 * this module; the shape follows `gl.ts` (build per run, persist, stay
 * idempotent, supersede rather than mutate).
 *
 * Business rules implemented here:
 *  - The batch total must equal the sum of net pay of the employees in the file.
 *    `assertTotalMatchesNetPay` names both figures on a mismatch.
 *  - Exclusions reconcile: included count + excluded count = run population, and
 *    included total + excluded total = the run's net pay (`assertExclusionsReconcile`).
 *  - Dual control (PAY-09.4): the releaser must differ from the preparer. This is
 *    enforced in `releaseBatch`, not on the screen, mirroring `finalizeRun`.
 *  - Out-of-band verification must be recorded before release; a batch that has
 *    not been verified cannot be released.
 *  - Only an approved or finalized run may have a bank file generated. Approval is
 *    the gate FRM-PAY-07 states; `finalized` is admitted because `finalizeRun`
 *    moves an approved run straight to `finalized` when it issues payslips, and
 *    payment normally follows finalization — refusing a finalized run would make
 *    the ordinary approve → finalize → pay sequence impossible. Draft and
 *    calculated runs are refused.
 *  - RL-323: past DISBURSEMENT_PREPARED, corrections are arrears only. A released
 *    batch can neither be edited nor regenerated (`assertBatchMutable`,
 *    `resolveBatchAction`); a changed batch supersedes its predecessor and the
 *    superseded record is kept, never deleted.
 *  - Bank-detail changes inside the payroll window are surfaced as warnings on
 *    the batch (`bankDetailChangeWarnings`).
 *
 * Sensitive data: employee bank details live in the People dossier and are
 * encrypted at rest. They are read only through `listDossier`, which enforces
 * `employee.dossier.read` plus the sensitive-field permission `employee.bank.read`.
 * A full account number never leaves this module: `disbursement_items` persists a
 * masked account, and every read model returns the masked form only.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** PL_BANK_FORMAT, verbatim. */
/** FRM-PAY-07 "Bank / format" is PL_BANK_FORMAT; the registry owns the vocabulary, not this file. */
export const BANK_FILE_FORMATS = picklistValues("PL_BANK_FORMAT");
export type BankFileFormat = (typeof BANK_FILE_FORMATS)[number];

/**
 * Prepared -> Verified -> Released -> Failed, plus `superseded` for a batch that a
 * later preparation replaced. A superseded batch is retained for the audit trail.
 */
export const BATCH_STATES = ["prepared", "verified", "released", "failed", "superseded"] as const;
export type BatchState = (typeof BATCH_STATES)[number];

export const ITEM_STATES = ["included", "excluded", "released", "failed"] as const;
export type ItemState = (typeof ITEM_STATES)[number];

/** Why an employee is kept out of the bank file. */
export const EXCLUSION_REASONS = ["no_bank_account", "account_inactive", "account_incomplete", "zero_or_negative_net"] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  no_bank_account: "No bank account is recorded for this employee.",
  account_inactive: "The recorded bank account is not active.",
  account_incomplete: "The bank account is missing an account number or routing code.",
  zero_or_negative_net: "Net pay for this run is zero or negative, so there is nothing to credit.",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** The exception rule code a returned credit raises in the payroll exception queue. */
export const RETURN_RULE_CODE = "DISBURSEMENT_RETURN";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/**
 * One payment instruction. `accountNumber` is the full number and exists only
 * inside this module and inside the file handed to the bank; no read model and
 * no API response ever carries it.
 */
export type BankFileRow = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  accountHolder: string;
  accountNumber: string;
  routingCode: string;
  bankName: string;
  accountType: string;
  amountMinor: number;
  reference: string;
};

export type BankFileContext = {
  valueDate: string;
  currency: string;
  debitAccountLabel: string;
  batchReference: string;
};

export type ExcludedEmployee = {
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  amountMinor: number;
  reason: ExclusionReason;
  reasonText: string;
};

export type BankDetailWarning = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  bankAccountId: string;
  changedAt: string;
  message: string;
};

export type DisbursementItemView = {
  id: string;
  payrollRunEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  /** Masked to the last four characters. The full number is never returned. */
  accountMasked: string;
  accountHolder: string;
  bankName: string;
  routingCode: string;
  accountType: string;
  amountMinor: number;
  state: ItemState;
  exclusionReason: ExclusionReason | null;
  exclusionReasonText: string | null;
  providerReference: string | null;
  returnReason: string | null;
  returnedAt: string | null;
};

export type BatchSummary = {
  id: string;
  payrollRunId: string;
  runPeriod: string;
  runScope: string;
  state: BatchState;
  format: BankFileFormat;
  fileName: string;
  fileReference: string;
  valueDate: string;
  currency: string;
  totalAmountMinor: number;
  accountCount: number;
  excludedCount: number;
  excludedAmountMinor: number;
  checksum: string;
  preparedBy: string | null;
  preparedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  outOfBandVerified: boolean;
  supersedesBatchId: string | null;
  supersededByBatchId: string | null;
  createdAt: string | null;
};

export type TimelineStep = { key: string; label: string; state: "done" | "current" | "todo" };

export type BatchDetail = BatchSummary & {
  disbursingAccountLabel: string;
  disbursingAccountMasked: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  outOfBandReference: string | null;
  releaseRemarks: string | null;
  returnFileReference: string | null;
  items: DisbursementItemView[];
  excluded: ExcludedEmployee[];
  warnings: BankDetailWarning[];
  timeline: TimelineStep[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
  /**
   * The control copy of the bank file: identical in layout to the file the bank
   * receives, but with every account number masked. The bank-ready file, which
   * carries real account numbers, is never sent to a browser.
   */
  file: { name: string; format: BankFileFormat; masked: true; content: string };
  /** Why release is refused right now, or null when it may proceed. */
  releaseBlockedReason: string | null;
};

// ---------------------------------------------------------------------------
// Pure helpers (no database; every one of these is unit-tested)
// ---------------------------------------------------------------------------

/**
 * Show only the last four characters of an account number. The workbook requires
 * the account to be tokenised on screen; this is the only rendering permitted.
 */
export function maskAccount(accountNumber: string): string {
  const trimmed = (accountNumber ?? "").trim();
  if (trimmed === "") return "—";
  if (trimmed.length <= 4) return `••••${trimmed}`;
  return `••••${trimmed.slice(-4)}`;
}

/** Exact decimal rendering of integer minor units, for file amounts. */
export function formatAmount(amountMinor: number): string {
  if (!Number.isInteger(amountMinor)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Payment amounts must be integer minor units." });
  }
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  return `${sign}${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * A content hash over the payment instructions a batch carries: the employee, the
 * destination account, the routing code and the amount. Sorted by employee so the
 * order rows happen to be read in cannot change the control figure, while any
 * change to a row does.
 */
export function checksum(rows: BankFileRow[]): string {
  const canonical = rows
    .map((row) => [row.employeeId, row.accountNumber.trim(), row.routingCode.trim().toUpperCase(), row.amountMinor] as const)
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])) || String(left[1]).localeCompare(String(right[1])));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/**
 * The batch total must equal the sum of net pay in the file. A mismatch is a hard
 * error naming both figures, so the discrepancy is never silently absorbed.
 */
export function assertTotalMatchesNetPay(declaredTotalMinor: number, rows: Array<{ amountMinor: number }>): number {
  const summed = rows.reduce((total, row) => total + row.amountMinor, 0);
  if (declaredTotalMinor !== summed) {
    throw new HttpError({
      status: 422,
      code: "DISBURSEMENT_TOTAL_MISMATCH",
      message: `The batch total of ${formatAmount(declaredTotalMinor)} does not equal the sum of net pay of ${formatAmount(summed)} across ${rows.length} account${rows.length === 1 ? "" : "s"}. The difference is ${formatAmount(declaredTotalMinor - summed)}.`,
      details: [
        { field: "declaredTotalMinor", issue: String(declaredTotalMinor) },
        { field: "sumOfNetPayMinor", issue: String(summed) },
      ],
    });
  }
  return summed;
}

/**
 * The file plus the exclusions must account for the whole run: every employee is
 * either paid or excluded with a stated reason, and the two totals add back up.
 */
export function assertExclusionsReconcile(input: {
  runPopulation: number;
  runNetMinor: number;
  includedRows: Array<{ amountMinor: number }>;
  excluded: Array<{ amountMinor: number }>;
}): { accountCount: number; totalAmountMinor: number; excludedCount: number; excludedAmountMinor: number } {
  const accountCount = input.includedRows.length;
  const excludedCount = input.excluded.length;
  const totalAmountMinor = input.includedRows.reduce((total, row) => total + row.amountMinor, 0);
  const excludedAmountMinor = input.excluded.reduce((total, row) => total + row.amountMinor, 0);
  if (accountCount + excludedCount !== input.runPopulation) {
    throw new HttpError({
      status: 422,
      code: "DISBURSEMENT_RECONCILIATION_FAILED",
      message: `The batch accounts for ${accountCount} paid and ${excludedCount} excluded employees, which is ${accountCount + excludedCount} against a run population of ${input.runPopulation}.`,
      details: [
        { field: "accountCount", issue: String(accountCount) },
        { field: "excludedCount", issue: String(excludedCount) },
        { field: "runPopulation", issue: String(input.runPopulation) },
      ],
    });
  }
  if (totalAmountMinor + excludedAmountMinor !== input.runNetMinor) {
    throw new HttpError({
      status: 422,
      code: "DISBURSEMENT_RECONCILIATION_FAILED",
      message: `The file total of ${formatAmount(totalAmountMinor)} plus excluded net pay of ${formatAmount(excludedAmountMinor)} is ${formatAmount(totalAmountMinor + excludedAmountMinor)}, which does not equal the run net pay of ${formatAmount(input.runNetMinor)}.`,
      details: [
        { field: "totalAmountMinor", issue: String(totalAmountMinor) },
        { field: "excludedAmountMinor", issue: String(excludedAmountMinor) },
        { field: "runNetMinor", issue: String(input.runNetMinor) },
      ],
    });
  }
  return { accountCount, totalAmountMinor, excludedCount, excludedAmountMinor };
}

/**
 * Dual control (PAY-09.4), enforced at the service. Mirrors `finalizeRun`: the
 * actor performing the irreversible step must differ from the one who prepared it.
 */
export function assertDualControl(preparedBy: string | null, releasedBy: string): void {
  if (!preparedBy || preparedBy === releasedBy) {
    throw new HttpError({
      status: 403,
      code: "FORBIDDEN",
      message: "Release requires a maker/checker pair: the releaser must differ from the person who prepared the batch.",
    });
  }
}

/** RL-323: once released, a batch is a record of a payment and can never be mutated. */
export function assertBatchMutable(state: BatchState): void {
  if (state === "released") {
    throw new HttpError({
      status: 409,
      code: "DISBURSEMENT_RELEASED",
      message: "This batch has been released to the bank. Past DISBURSEMENT_PREPARED a correction is made as arrears in a later run, never by editing or regenerating a released batch.",
    });
  }
  if (state === "superseded") {
    throw new HttpError({
      status: 409,
      code: "DISBURSEMENT_SUPERSEDED",
      message: "This batch was superseded by a later preparation. Work on the current batch instead.",
    });
  }
}

/**
 * Why release cannot proceed, or null. Returned to the screen so the disabled
 * button can state its reason, and asserted again in `releaseBatch`.
 */
export function releaseBlockedReason(batch: {
  state: BatchState;
  outOfBandVerified: boolean;
  preparedBy: string | null;
}, actorUserId: string): string | null {
  if (batch.state === "released") return "This batch has already been released.";
  if (batch.state === "superseded") return "This batch was superseded by a later preparation.";
  if (batch.state === "failed") return "This batch carries returned credits. Prepare a replacement batch for the failed items.";
  if (!batch.outOfBandVerified) return "Out-of-band verification has not been recorded. Confirm the total and account count with the bank through a separate channel first.";
  if (batch.state !== "verified") return "The batch must be verified before it can be released.";
  if (!batch.preparedBy) return "The batch has no recorded preparer, so dual control cannot be evidenced.";
  if (batch.preparedBy === actorUserId) return "Dual control: you prepared this batch, so a different person must release it.";
  return null;
}

/** Out-of-band verification is a precondition of release, checked independently. */
export function assertOutOfBandVerified(batch: { outOfBandVerified: boolean }): void {
  if (!batch.outOfBandVerified) {
    throw new HttpError({
      status: 422,
      code: "DISBURSEMENT_VERIFICATION_MISSING",
      message: "Out-of-band verification of the total and account count has not been recorded. It must be recorded before the batch is released.",
    });
  }
}

/** A run must be approved (or finalized) before a bank file can be generated. */
export function assertRunReleasable(run: { id: string; status: string }): void {
  if (run.status !== "approved" && run.status !== "finalized") {
    throw new HttpError({
      status: 409,
      code: "VERSION_CONFLICT",
      message: `A bank file can only be generated for an approved or finalized run. Run ${run.id} is ${run.status}.`,
    });
  }
}

export type BatchAction = { action: "unchanged"; batchId: string } | { action: "create" } | { action: "supersede"; batchId: string };

/**
 * Idempotent preparation. Re-preparing an unchanged batch is a no-op; a changed
 * batch supersedes the live one, which is kept. A released batch blocks both:
 * RL-323 sends the correction to arrears instead.
 */
export function resolveBatchAction(existing: { id: string; state: BatchState; fingerprint: string } | null, fingerprint: string): BatchAction {
  if (!existing || existing.state === "superseded") return { action: "create" };
  assertBatchMutable(existing.state);
  if (existing.fingerprint === fingerprint) return { action: "unchanged", batchId: existing.id };
  return { action: "supersede", batchId: existing.id };
}

/** Decide whether a bank account can be paid, and say why not when it cannot. */
export function classifyAccount(input: {
  amountMinor: number;
  account: { status: string; accountNumber: string; routingCode: string } | null;
}): ExclusionReason | null {
  if (input.amountMinor <= 0) return "zero_or_negative_net";
  if (!input.account) return "no_bank_account";
  if (input.account.status !== "active") return "account_inactive";
  if (input.account.accountNumber.trim() === "" || input.account.routingCode.trim() === "") return "account_incomplete";
  return null;
}

/**
 * "Alert on any bank-detail change inside the payroll window" — an employee whose
 * bank record was written after the run was calculated is flagged, because the
 * account the file pays is not the account the run was reviewed against.
 */
export function bankDetailChangeWarnings(
  accounts: Array<{ bankAccountId: string; employeeId: string; employeeCode: string | null; employeeName: string; updatedAt: string | null }>,
  calculatedAt: string | null,
): BankDetailWarning[] {
  if (!calculatedAt) return [];
  return accounts
    .filter((account) => account.updatedAt !== null && account.updatedAt > calculatedAt)
    .map((account) => ({
      employeeId: account.employeeId,
      employeeCode: account.employeeCode,
      employeeName: account.employeeName,
      bankAccountId: account.bankAccountId,
      changedAt: account.updatedAt as string,
      message: `Bank details changed on ${(account.updatedAt as string).slice(0, 10)}, after this run was calculated on ${calculatedAt.slice(0, 10)}. Re-verify the account before release.`,
    }))
    .sort((left, right) => (left.employeeCode ?? "").localeCompare(right.employeeCode ?? ""));
}

// ---------------------------------------------------------------------------
// Bank file layouts
// ---------------------------------------------------------------------------

/**
 * File extension per format. NACH and the SBI corporate upload are flat text; the
 * rest are delimited files the portals accept as CSV.
 */
export function bankFileExtension(format: BankFileFormat): string {
  return format === "npci_nach" || format === "sbi_cinb" ? "txt" : "csv";
}

/** The file name a batch carries; also the reference shown in the work queue. */
export function bankFileName(format: BankFileFormat, period: string, batchId: string): string {
  const suffix = (batchId.replace(/-/g, "").slice(0, 6) || "000000").toUpperCase();
  return `${format.replace(/_/g, "-")}-${period || "period"}-${suffix}.${bankFileExtension(format)}`;
}

/** Strip delimiters and newlines so a name can never break the record it sits in. */
function safe(value: string, delimiter: string): string {
  return (value ?? "").replace(new RegExp(`[${delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r\\n]`, "g"), " ").trim();
}

function pad(value: string, width: number): string {
  return value.length >= width ? value.slice(0, width) : value + " ".repeat(width - value.length);
}

function padLeft(value: string, width: number, filler = "0"): string {
  return value.length >= width ? value.slice(-width) : filler.repeat(width - value.length) + value;
}

const DEFAULT_CONTEXT: BankFileContext = { valueDate: "", currency: "INR", debitAccountLabel: "", batchReference: "" };

/**
 * Produce the content of a bank file. Pure: the same rows and context always
 * yield the same bytes, which is what makes the checksum meaningful.
 *
 * The layouts below are deterministic and documented, not certified: each bank's
 * live template must be confirmed against that bank's own specification before a
 * file produced here is uploaded to a production channel. The purpose served here
 * is that each format has a distinct, stable, reviewable shape carrying the same
 * payment instructions.
 */
export function buildBankFile(format: BankFileFormat, rows: BankFileRow[], context: BankFileContext = DEFAULT_CONTEXT): string {
  const total = rows.reduce((sum, row) => sum + row.amountMinor, 0);
  switch (format) {
    case "hdfc_enet":
      // Detail records only, comma separated, no header row.
      return rows
        .map((row) =>
          ["NEFT", safe(row.accountHolder, ","), safe(row.accountNumber, ","), formatAmount(row.amountMinor), safe(row.routingCode, ","), safe(row.reference, ","), context.valueDate].join(","),
        )
        .join("\n");

    case "icici_cib":
      return [
        "PYMT_MODE,BENE_NAME,BENE_ACCT_NO,BENE_IFSC,AMOUNT,CURRENCY,VALUE_DATE,REMARKS",
        ...rows.map((row) =>
          ["NEFT", safe(row.accountHolder, ","), safe(row.accountNumber, ","), safe(row.routingCode, ","), formatAmount(row.amountMinor), context.currency, context.valueDate, safe(row.reference, ",")].join(","),
        ),
      ].join("\n");

    case "sbi_cinb":
      // Pipe-delimited flat file with a trailer carrying the control totals.
      return [
        ...rows.map((row) =>
          ["D", safe(row.accountNumber, "|"), safe(row.accountHolder, "|"), safe(row.routingCode, "|"), formatAmount(row.amountMinor), context.valueDate, safe(row.reference, "|")].join("|"),
        ),
        ["T", String(rows.length), formatAmount(total)].join("|"),
      ].join("\n");

    case "axis_corporate":
      // Header / detail / trailer, comma separated.
      return [
        ["H", safe(context.batchReference, ","), safe(context.debitAccountLabel, ","), context.valueDate, context.currency].join(","),
        ...rows.map((row) =>
          ["D", safe(row.accountHolder, ","), safe(row.accountNumber, ","), safe(row.routingCode, ","), formatAmount(row.amountMinor), safe(row.reference, ",")].join(","),
        ),
        ["T", String(rows.length), formatAmount(total)].join(","),
      ].join("\n");

    case "kotak_fyn":
      return [
        "Client Code,Payment Type,Beneficiary Name,Beneficiary Account,IFSC,Amount,Payment Date,Narration",
        ...rows.map((row) =>
          [safe(context.batchReference, ","), "NEFT", safe(row.accountHolder, ","), safe(row.accountNumber, ","), safe(row.routingCode, ","), formatAmount(row.amountMinor), context.valueDate, safe(row.reference, ",")].join(","),
        ),
      ].join("\n");

    case "yes_bank":
      return [
        "TXN_TYPE,DEBIT_ACCOUNT,BENEFICIARY_ACCOUNT,BENEFICIARY_NAME,IFSC,AMOUNT,VALUE_DATE,REFERENCE",
        ...rows.map((row) =>
          ["NEFT", safe(context.debitAccountLabel, ","), safe(row.accountNumber, ","), safe(row.accountHolder, ","), safe(row.routingCode, ","), formatAmount(row.amountMinor), context.valueDate, safe(row.reference, ",")].join(","),
        ),
      ].join("\n");

    case "npci_nach":
      // Fixed-width, 106 characters per record:
      //   2  transaction code (67 = credit)
      //   35 destination account number, left justified
      //   13 amount in paise, right justified, zero filled
      //   11 destination IFSC, left justified
      //   40 beneficiary name, left justified
      //   5  user reference, left justified
      return rows
        .map((row) =>
          [
            "67",
            pad(safe(row.accountNumber, ""), 35),
            padLeft(String(Math.abs(row.amountMinor)), 13),
            pad(safe(row.routingCode, "").toUpperCase(), 11),
            pad(safe(row.accountHolder, ""), 40),
            pad(safe(row.reference, "").slice(0, 5), 5),
          ].join(""),
        )
        .join("\n");

    case "generic_csv":
    default:
      return [
        "employee_code,employee_name,account_holder,account_number,routing_code,bank_name,account_type,amount,currency,value_date,reference",
        ...rows.map((row) =>
          [
            safe(row.employeeCode ?? "", ","),
            safe(row.employeeName, ","),
            safe(row.accountHolder, ","),
            safe(row.accountNumber, ","),
            safe(row.routingCode, ","),
            safe(row.bankName, ","),
            safe(row.accountType, ","),
            formatAmount(row.amountMinor),
            context.currency,
            context.valueDate,
            safe(row.reference, ","),
          ].join(","),
        ),
      ].join("\n");
  }
}

/** The batch's own state timeline, for the detail panel. */
export function batchTimeline(state: BatchState): TimelineStep[] {
  const order: BatchState[] = ["prepared", "verified", "released"];
  const labels: Record<string, string> = { prepared: "Prepared", verified: "Verified", released: "Released" };
  if (state === "failed") {
    return [
      { key: "prepared", label: "Prepared", state: "done" },
      { key: "verified", label: "Verified", state: "done" },
      { key: "released", label: "Released", state: "done" },
      { key: "failed", label: "Failed — returned credits await re-disbursement", state: "current" },
    ];
  }
  const effective: BatchState = state === "superseded" ? "prepared" : state;
  const index = order.indexOf(effective);
  return order.map((key, position) => ({
    key,
    label: labels[key],
    state: position < index ? "done" : position === index ? "current" : "todo",
  }));
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const prepareBatchSchema = z
  .object({
    payrollRunId: z.string().uuid(),
    format: z.enum(BANK_FILE_FORMATS),
    disbursingAccountLabel: z.string().trim().min(1).max(200),
    disbursingAccountNumber: z.string().trim().min(4).max(40),
    valueDate: z
      .string()
      .regex(DATE_PATTERN, "A value date (YYYY-MM-DD) is required.")
      // FRM-PAY-07: a bank file cannot be dated into the past - the bank would reject it.
      .refine((value) => value >= new Date().toISOString().slice(0, 10), "The value date cannot be before today."),
    currency: z.string().trim().length(3).default("INR"),
    /** Optional declared control total; a mismatch against net pay is a hard error. */
    declaredTotalMinor: z.number().int().optional(),
  })
  .strict();
export type PrepareBatchInput = z.infer<typeof prepareBatchSchema>;

export const verifyBatchSchema = z
  .object({
    outOfBandVerified: z.literal(true),
    outOfBandReference: z.string().trim().min(1).max(200),
    remarks: z.string().trim().max(1000).optional(),
  })
  .strict();
export type VerifyBatchInput = z.infer<typeof verifyBatchSchema>;

export const releaseBatchSchema = z
  .object({
    /** FRM-PAY-07 "Release remarks": Char(200), optional. Dual control is the guard, not this text. */
    releaseRemarks: z.string().trim().min(1).max(200).optional(),
  })
  .strict();
export type ReleaseBatchInput = z.infer<typeof releaseBatchSchema>;

export const bankReturnSchema = z
  .object({
    returnFileReference: z.string().trim().min(1).max(200),
    items: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            reason: z.string().trim().min(1).max(500),
            providerReference: z.string().trim().max(200).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
  })
  .strict();
export type BankReturnInput = z.infer<typeof bankReturnSchema>;

// ---------------------------------------------------------------------------
// Row readers
// ---------------------------------------------------------------------------

type RunFacts = { id: string; period: string; scope: string; status: string; net_minor: number | null; employee_count: number | null };

async function loadRunFacts(access: Access, runId: string): Promise<RunFacts> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, period, scope, status, net_minor, employee_count
      from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1
    `,
  ]);
  const run = (rows as RunFacts[])[0];
  if (!run) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return run;
}

/** When the run was calculated, which bounds the payroll window for RL-322 alerts. */
async function loadCalculatedAt(access: Access, runId: string): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'payroll_run' and entity_id = ${runId} and action = 'payroll.calculate'
      order by created_at desc limit 1
    `,
  ]);
  const value = (rows as Array<{ created_at: string | Date | null }>)[0]?.created_at ?? null;
  return value === null ? null : new Date(value).toISOString();
}

type RunMember = {
  runEmployeeId: string;
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  netMinor: number;
};

async function loadRunMembers(access: Access, runId: string): Promise<RunMember[]> {
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
    const attributes = (row.attributes ?? {}) as Record<string, unknown>;
    const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
    return {
      runEmployeeId: String(row.run_employee_id),
      employeeId: String(row.employee_id),
      employeeCode: row.employee_code ? String(row.employee_code) : null,
      employeeName: name === "" ? String(row.employee_code ?? row.employee_id) : name,
      netMinor: Number(attributes.net_minor ?? 0),
    };
  });
}

type BankAccountRecord = {
  id: string;
  employeeId: string;
  status: string;
  accountHolder: string;
  accountNumber: string;
  routingCode: string;
  bankName: string;
  accountType: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  updatedAt: string | null;
};

/** Non-sensitive metadata only: no attribute content is read here. */
async function loadBankAccountTimestamps(access: Access): Promise<Map<string, string | null>> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, updated_at from bank_accounts where tenant_id = ${access.tenantId}`,
  ]);
  return new Map(
    (rows as Array<{ id: string; updated_at: string | Date | null }>).map((row) => [
      row.id,
      row.updated_at === null ? null : new Date(row.updated_at).toISOString(),
    ]),
  );
}

/**
 * Read employee bank details through the dossier layer, which enforces
 * `employee.dossier.read` and the sensitive-field permission `employee.bank.read`
 * and decrypts the record. Payroll has no other route to this data and must not
 * read `bank_accounts.attributes` directly.
 */
async function loadBankAccounts(access: Access): Promise<BankAccountRecord[]> {
  const timestamps = await loadBankAccountTimestamps(access);
  const records: BankAccountRecord[] = [];
  for (let page = 1; page <= 500; page += 1) {
    let batch: { items: unknown[]; nextCursor: string | null };
    try {
      batch = await listDossier(access, "bank", new URLSearchParams({ page: String(page), pageSize: "100" }));
    } catch (error) {
      if (error instanceof HttpError && error.code === "LEGACY_SENSITIVE_RECORD") {
        throw new HttpError({
          status: 409,
          code: "LEGACY_SENSITIVE_RECORD",
          message: "At least one employee bank record still uses legacy unencrypted storage and cannot be read. Run the controlled storage migration (scripts/encrypt-dossier-records.cjs) before preparing a bank file.",
        });
      }
      throw error;
    }
    for (const raw of batch.items) {
      const item = (raw ?? {}) as Record<string, unknown>;
      const id = String(item.id ?? "");
      if (id === "") continue;
      records.push({
        id,
        employeeId: String(item.employeeId ?? ""),
        status: String(item.status ?? "active"),
        accountHolder: String(item.accountHolder ?? ""),
        accountNumber: String(item.accountNumber ?? ""),
        routingCode: String(item.routingCode ?? ""),
        bankName: String(item.bankName ?? ""),
        accountType: String(item.accountType ?? ""),
        currency: String(item.currency ?? ""),
        effectiveFrom: String(item.effectiveFrom ?? ""),
        effectiveTo: item.effectiveTo === null || item.effectiveTo === undefined ? null : String(item.effectiveTo),
        updatedAt: timestamps.get(id) ?? null,
      });
    }
    if (!batch.nextCursor) break;
  }
  return records;
}

/**
 * The account a payment goes to: the latest effective account for the employee,
 * preferring an active one. An employee with several historic accounts is paid on
 * the current one, not on whichever row happens to be read first.
 */
export function pickPayableAccount<T extends { status: string; effectiveFrom: string; effectiveTo: string | null }>(accounts: T[], asOf: string): T | null {
  const covering = accounts.filter((account) => (!account.effectiveFrom || account.effectiveFrom <= asOf) && (!account.effectiveTo || account.effectiveTo >= asOf));
  const pool = covering.length > 0 ? covering : accounts;
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((left, right) => {
    const leftActive = left.status === "active" ? 0 : 1;
    const rightActive = right.status === "active" ? 0 : 1;
    if (leftActive !== rightActive) return leftActive - rightActive;
    return (right.effectiveFrom ?? "").localeCompare(left.effectiveFrom ?? "");
  });
  return sorted[0] ?? null;
}

// ---------------------------------------------------------------------------
// Batch records
// ---------------------------------------------------------------------------

type BatchRow = { id: string; payroll_run_id: string; integration_connection_id: string | null; attributes: Record<string, unknown> | null; created_at: string | Date | null };

type BatchRecord = {
  id: string;
  payrollRunId: string;
  attributes: Record<string, unknown>;
  state: BatchState;
  fingerprint: string;
  createdAt: string | null;
};

function batchRecordFrom(row: BatchRow): BatchRecord {
  const attributes = row.attributes ?? {};
  const state = String(attributes.state ?? "prepared");
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    attributes,
    state: ((BATCH_STATES as readonly string[]).includes(state) ? state : "prepared") as BatchState,
    fingerprint: String(attributes.fingerprint ?? ""),
    createdAt: row.created_at === null ? null : new Date(row.created_at).toISOString(),
  };
}

async function loadBatchRecords(access: Access, runId: string): Promise<BatchRecord[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, payroll_run_id, integration_connection_id, attributes, created_at
      from disbursement_batches where tenant_id = ${access.tenantId} and payroll_run_id = ${runId}
      order by created_at
    `,
  ]);
  return (rows as BatchRow[]).map(batchRecordFrom);
}

async function loadBatchRecord(access: Access, batchId: string): Promise<BatchRecord> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, payroll_run_id, integration_connection_id, attributes, created_at
      from disbursement_batches where tenant_id = ${access.tenantId} and id = ${batchId} limit 1
    `,
  ]);
  const row = (rows as BatchRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return batchRecordFrom(row);
}

type ItemRow = { id: string; payroll_run_employee_id: string | null; employee_id: string | null; bank_account_id: string | null; attributes: Record<string, unknown> | null };

function itemViewFrom(row: ItemRow): DisbursementItemView {
  const attributes = row.attributes ?? {};
  const state = String(attributes.state ?? "included");
  const reason = attributes.exclusion_reason ? String(attributes.exclusion_reason) : null;
  const validReason = reason !== null && (EXCLUSION_REASONS as readonly string[]).includes(reason) ? (reason as ExclusionReason) : null;
  return {
    id: row.id,
    payrollRunEmployeeId: String(row.payroll_run_employee_id ?? ""),
    employeeId: String(row.employee_id ?? ""),
    employeeCode: attributes.employee_code ? String(attributes.employee_code) : null,
    employeeName: String(attributes.employee_name ?? ""),
    accountMasked: String(attributes.account_masked ?? "—"),
    accountHolder: String(attributes.account_holder ?? ""),
    bankName: String(attributes.bank_name ?? ""),
    routingCode: String(attributes.routing_code ?? ""),
    accountType: String(attributes.account_type ?? ""),
    amountMinor: Number(attributes.amount_minor ?? 0),
    state: ((ITEM_STATES as readonly string[]).includes(state) ? state : "included") as ItemState,
    exclusionReason: validReason,
    exclusionReasonText: validReason ? EXCLUSION_REASON_LABELS[validReason] : null,
    providerReference: attributes.provider_reference ? String(attributes.provider_reference) : null,
    returnReason: attributes.return_reason ? String(attributes.return_reason) : null,
    returnedAt: attributes.returned_at ? String(attributes.returned_at) : null,
  };
}

async function loadItems(access: Access, batchId: string): Promise<DisbursementItemView[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, payroll_run_employee_id, employee_id, bank_account_id, attributes
      from disbursement_items where tenant_id = ${access.tenantId} and disbursement_batch_id = ${batchId}
      order by attributes->>'employee_code', created_at
    `,
  ]);
  return (rows as ItemRow[]).map(itemViewFrom);
}

function summaryFrom(record: BatchRecord): BatchSummary {
  const attributes = record.attributes;
  const format = String(attributes.format ?? "Generic CSV");
  return {
    id: record.id,
    payrollRunId: record.payrollRunId,
    runPeriod: String(attributes.run_period ?? ""),
    runScope: String(attributes.run_scope ?? ""),
    state: record.state,
    format: ((BANK_FILE_FORMATS as readonly string[]).includes(format) ? format : "Generic CSV") as BankFileFormat,
    fileName: String(attributes.file_name ?? ""),
    fileReference: String(attributes.file_reference ?? attributes.file_name ?? ""),
    valueDate: String(attributes.value_date ?? ""),
    currency: String(attributes.currency ?? "INR"),
    totalAmountMinor: Number(attributes.total_amount_minor ?? 0),
    accountCount: Number(attributes.account_count ?? 0),
    excludedCount: Number(attributes.excluded_count ?? 0),
    excludedAmountMinor: Number(attributes.excluded_amount_minor ?? 0),
    checksum: String(attributes.checksum ?? ""),
    preparedBy: attributes.prepared_by ? String(attributes.prepared_by) : null,
    preparedAt: attributes.prepared_at ? String(attributes.prepared_at) : null,
    releasedBy: attributes.released_by ? String(attributes.released_by) : null,
    releasedAt: attributes.released_at ? String(attributes.released_at) : null,
    outOfBandVerified: attributes.out_of_band_verified === true,
    supersedesBatchId: attributes.supersedes_batch_id ? String(attributes.supersedes_batch_id) : null,
    supersededByBatchId: attributes.superseded_by_batch_id ? String(attributes.superseded_by_batch_id) : null,
    createdAt: record.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Prepare
// ---------------------------------------------------------------------------

export type PrepareResult = {
  batchId: string;
  action: BatchAction["action"];
  accountCount: number;
  totalAmountMinor: number;
  excludedCount: number;
  checksum: string;
  warnings: BankDetailWarning[];
};

/**
 * Build the bank file for a run, reconcile it against the run's net pay, and
 * persist it as a `prepared` batch. Idempotent: the same file prepared twice
 * returns the same batch; a changed file supersedes the previous batch and the
 * superseded record is retained.
 */
export async function prepareBatch(access: Access, input: PrepareBatchInput, requestId: string): Promise<PrepareResult> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const run = await loadRunFacts(access, input.payrollRunId);
  assertRunReleasable(run);

  const members = await loadRunMembers(access, run.id);
  if (members.length === 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This run has no calculated employees, so there is nothing to disburse." });
  }

  const accounts = await loadBankAccounts(access);
  const byEmployee = new Map<string, BankAccountRecord[]>();
  for (const account of accounts) {
    const bucket = byEmployee.get(account.employeeId) ?? [];
    bucket.push(account);
    byEmployee.set(account.employeeId, bucket);
  }

  const rows: BankFileRow[] = [];
  const excluded: ExcludedEmployee[] = [];
  const chosen: Array<{ member: RunMember; account: BankAccountRecord }> = [];

  for (const member of members) {
    const account = pickPayableAccount(byEmployee.get(member.employeeId) ?? [], input.valueDate);
    const reason = classifyAccount({ amountMinor: member.netMinor, account });
    if (reason || !account) {
      const resolved = reason ?? "no_bank_account";
      excluded.push({
        payrollRunEmployeeId: member.runEmployeeId,
        employeeId: member.employeeId,
        employeeCode: member.employeeCode,
        employeeName: member.employeeName,
        amountMinor: member.netMinor,
        reason: resolved,
        reasonText: EXCLUSION_REASON_LABELS[resolved],
      });
      continue;
    }
    chosen.push({ member, account });
    rows.push({
      employeeId: member.employeeId,
      employeeCode: member.employeeCode,
      employeeName: member.employeeName,
      accountHolder: account.accountHolder || member.employeeName,
      accountNumber: account.accountNumber,
      routingCode: account.routingCode,
      bankName: account.bankName,
      accountType: account.accountType,
      amountMinor: member.netMinor,
      reference: `${run.period}-${member.employeeCode ?? member.employeeId.slice(0, 8)}`,
    });
  }

  const runNetMinor = members.reduce((total, member) => total + member.netMinor, 0);
  const totals = assertExclusionsReconcile({ runPopulation: members.length, runNetMinor, includedRows: rows, excluded });
  // The declared control total, when the operator supplies one, is checked against
  // the sum of net pay; the computed total is checked against the same sum too.
  assertTotalMatchesNetPay(input.declaredTotalMinor ?? totals.totalAmountMinor, rows);

  const fileChecksum = checksum(rows);
  const calculatedAt = await loadCalculatedAt(access, run.id);
  const warnings = bankDetailChangeWarnings(
    chosen.map(({ member, account }) => ({
      bankAccountId: account.id,
      employeeId: member.employeeId,
      employeeCode: member.employeeCode,
      employeeName: member.employeeName,
      updatedAt: account.updatedAt,
    })),
    calculatedAt,
  );

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ runId: run.id, format: input.format, valueDate: input.valueDate, currency: input.currency, checksum: fileChecksum, excluded: excluded.map((entry) => [entry.employeeId, entry.reason]) }))
    .digest("hex");

  const existing = await loadBatchRecords(access, run.id);
  const live = existing.find((record) => record.state !== "superseded") ?? null;
  const decision = resolveBatchAction(live, fingerprint);
  if (decision.action === "unchanged") {
    return {
      batchId: decision.batchId,
      action: "unchanged",
      accountCount: totals.accountCount,
      totalAmountMinor: totals.totalAmountMinor,
      excludedCount: totals.excludedCount,
      checksum: fileChecksum,
      warnings,
    };
  }

  const batchId = crypto.randomUUID();
  const now = new Date().toISOString();
  const fileName = bankFileName(input.format, run.period, batchId);
  const attributes = {
    state: "prepared" satisfies BatchState,
    format: input.format,
    file_name: fileName,
    file_reference: fileName,
    run_period: run.period,
    run_scope: run.scope,
    value_date: input.valueDate,
    currency: input.currency,
    disbursing_account_label: input.disbursingAccountLabel,
    // Only the masked form of the disbursing account is stored; the full number
    // is never persisted by payroll.
    disbursing_account_masked: maskAccount(input.disbursingAccountNumber),
    total_amount_minor: totals.totalAmountMinor,
    account_count: totals.accountCount,
    excluded_count: totals.excludedCount,
    excluded_amount_minor: totals.excludedAmountMinor,
    run_net_minor: runNetMinor,
    checksum: fileChecksum,
    fingerprint,
    prepared_by: access.context.actorUserId,
    prepared_at: now,
    verified_by: null,
    verified_at: null,
    out_of_band_verified: false,
    out_of_band_reference: null,
    released_by: null,
    released_at: null,
    release_remarks: null,
    return_file_reference: null,
    bank_detail_warnings: warnings,
    calculated_at: calculatedAt,
    supersedes_batch_id: decision.action === "supersede" ? decision.batchId : null,
    superseded_by_batch_id: null,
  };

  const statements = [
    ...(decision.action === "supersede"
      ? [
          sqlClient`
            update disbursement_batches
            set attributes = attributes || ${JSON.stringify({ state: "superseded", superseded_at: now, superseded_by_batch_id: batchId })}::jsonb,
                version = version + 1, updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${decision.batchId}
          `,
        ]
      : []),
    sqlClient`
      insert into disbursement_batches (id, tenant_id, payroll_run_id, attributes)
      values (${batchId}, ${access.tenantId}, ${run.id}, ${JSON.stringify(attributes)}::jsonb)
    `,
    ...chosen.map(({ member, account }) =>
      sqlClient`
        insert into disbursement_items (id, tenant_id, disbursement_batch_id, payroll_run_employee_id, employee_id, bank_account_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${batchId}, ${member.runEmployeeId}, ${member.employeeId}, ${account.id},
          ${JSON.stringify({
            state: "included" satisfies ItemState,
            employee_code: member.employeeCode,
            employee_name: member.employeeName,
            amount_minor: member.netMinor,
            account_masked: maskAccount(account.accountNumber),
            account_holder: account.accountHolder || member.employeeName,
            bank_name: account.bankName,
            routing_code: account.routingCode,
            account_type: account.accountType,
            exclusion_reason: null,
          })}::jsonb)
      `,
    ),
    ...excluded.map((entry) =>
      sqlClient`
        insert into disbursement_items (id, tenant_id, disbursement_batch_id, payroll_run_employee_id, employee_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${batchId}, ${entry.payrollRunEmployeeId}, ${entry.employeeId},
          ${JSON.stringify({
            state: "excluded" satisfies ItemState,
            employee_code: entry.employeeCode,
            employee_name: entry.employeeName,
            amount_minor: entry.amountMinor,
            account_masked: "—",
            account_holder: "",
            bank_name: "",
            routing_code: "",
            account_type: "",
            exclusion_reason: entry.reason,
          })}::jsonb)
      `,
    ),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.disbursement_prepare', 'disbursement_batch', ${batchId},
        ${`Bank file prepared for run ${run.period} (${totals.accountCount} accounts, ${totals.excludedCount} excluded)`},
        ${JSON.stringify({ runId: run.id, format: input.format, checksum: fileChecksum, totalAmountMinor: totals.totalAmountMinor, accountCount: totals.accountCount, excludedCount: totals.excludedCount, supersedes: attributes.supersedes_batch_id })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.disbursement_prepared', 'disbursement_batch', ${batchId},
        ${JSON.stringify({ runId: run.id, period: run.period, format: input.format, totalAmountMinor: totals.totalAmountMinor, accountCount: totals.accountCount })}::jsonb)
    `,
  ];
  await tenantTx(access, statements);

  return {
    batchId,
    action: decision.action,
    accountCount: totals.accountCount,
    totalAmountMinor: totals.totalAmountMinor,
    excludedCount: totals.excludedCount,
    checksum: fileChecksum,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/** Record the out-of-band verification that release depends on. */
export async function verifyBatch(access: Access, batchId: string, input: VerifyBatchInput, requestId: string): Promise<{ id: string; state: BatchState }> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const record = await loadBatchRecord(access, batchId);
  assertBatchMutable(record.state);
  if (record.state === "failed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A failed batch cannot be verified. Prepare a replacement batch for the returned credits." });
  }
  const now = new Date().toISOString();
  const patch = {
    state: "verified" satisfies BatchState,
    out_of_band_verified: true,
    out_of_band_reference: input.outOfBandReference,
    out_of_band_remarks: input.remarks ?? null,
    verified_by: access.context.actorUserId,
    verified_at: now,
  };
  await tenantTx(access, [
    sqlClient`
      update disbursement_batches set attributes = attributes || ${JSON.stringify(patch)}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${batchId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.disbursement_verify', 'disbursement_batch', ${batchId},
        ${`Out-of-band verification recorded (${input.outOfBandReference})`}, ${JSON.stringify(patch)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: batchId, state: "verified" };
}

// ---------------------------------------------------------------------------
// Release
// ---------------------------------------------------------------------------

export type ReleaseResult = { id: string; state: BatchState; released: number; totalAmountMinor: number };

/**
 * Release the batch to the bank. The privileged step: it needs
 * `payroll.accounting.approve`, out-of-band verification on the record, and a
 * releaser distinct from the preparer. Dual control lives here, not on the screen.
 */
export async function releaseBatch(access: Access, batchId: string, input: ReleaseBatchInput, requestId: string): Promise<ReleaseResult> {
  enforce(access.context, "payroll.accounting.approve", { tenantId: access.tenantId });
  const record = await loadBatchRecord(access, batchId);
  const summary = summaryFrom(record);

  assertBatchMutable(record.state);
  if (record.state === "failed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A failed batch cannot be released. Prepare a replacement batch for the returned credits." });
  }
  assertOutOfBandVerified(summary);
  if (record.state !== "verified") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only a verified batch can be released." });
  }
  assertDualControl(summary.preparedBy, access.context.actorUserId);

  // The control total is proved again against the persisted items, so a batch
  // whose items changed after preparation cannot be released on a stale total.
  const items = await loadItems(access, batchId);
  const payable = items.filter((item) => item.state === "included");
  assertTotalMatchesNetPay(summary.totalAmountMinor, payable);
  if (payable.length !== summary.accountCount) {
    throw new HttpError({
      status: 422,
      code: "DISBURSEMENT_RECONCILIATION_FAILED",
      message: `The batch records ${summary.accountCount} accounts but holds ${payable.length} payable items.`,
      details: [{ field: "accountCount", issue: String(summary.accountCount) }, { field: "payableItems", issue: String(payable.length) }],
    });
  }

  const now = new Date().toISOString();
  const patch = {
    state: "released" satisfies BatchState,
    released_by: access.context.actorUserId,
    released_at: now,
    release_remarks: input.releaseRemarks,
  };
  await tenantTx(access, [
    sqlClient`
      update disbursement_batches set attributes = attributes || ${JSON.stringify(patch)}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${batchId}
    `,
    sqlClient`
      update disbursement_items set attributes = attributes || ${JSON.stringify({ state: "released", released_at: now })}::jsonb, version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and disbursement_batch_id = ${batchId} and attributes->>'state' = 'included'
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.disbursement_release', 'disbursement_batch', ${batchId},
        ${`Released ${payable.length} credits totalling ${formatAmount(summary.totalAmountMinor)} ${summary.currency}`},
        ${JSON.stringify({ ...patch, preparedBy: summary.preparedBy, checksum: summary.checksum, accountCount: summary.accountCount })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.disbursement_released', 'disbursement_batch', ${batchId},
        ${JSON.stringify({ runId: record.payrollRunId, period: summary.runPeriod, format: summary.format, totalAmountMinor: summary.totalAmountMinor, accountCount: summary.accountCount, checksum: summary.checksum })}::jsonb)
    `,
  ]);

  return { id: batchId, state: "released", released: payable.length, totalAmountMinor: summary.totalAmountMinor };
}

// ---------------------------------------------------------------------------
// Bank return file
// ---------------------------------------------------------------------------

export type BankReturnResult = { id: string; state: BatchState; failed: number; anomaliesRaised: number };

/**
 * Accept a returned/failed credit from the bank's return file. The item is marked
 * failed and an open `payroll_anomalies` finding is raised against the employee
 * with rule code `DISBURSEMENT_RETURN`, which is the payroll exception queue the
 * existing screens already read (GET /api/v1/payroll-anomalies, POST
 * /api/v1/payroll-anomalies/:id/resolve). That open finding is the re-disbursement
 * task; there is no separate task engine in this codebase to hook into.
 *
 * This is the one write permitted against a released batch, and it never mutates
 * the payment instructions: it only records what the bank returned.
 */
export async function recordBankReturn(access: Access, batchId: string, input: BankReturnInput, requestId: string): Promise<BankReturnResult> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const record = await loadBatchRecord(access, batchId);
  if (record.state !== "released" && record.state !== "failed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A bank return can only be recorded against a released batch." });
  }
  const items = await loadItems(access, batchId);
  const byId = new Map(items.map((item) => [item.id, item]));
  const unknown = input.items.filter((entry) => !byId.has(entry.itemId));
  if (unknown.length > 0) {
    throw new HttpError({
      status: 404,
      code: "NOT_FOUND",
      message: "One or more returned items do not belong to this batch.",
      details: unknown.map((entry) => ({ field: "itemId", issue: entry.itemId })),
    });
  }

  const now = new Date().toISOString();
  const statements = [
    sqlClient`
      update disbursement_batches
      set attributes = attributes || ${JSON.stringify({ state: "failed", return_file_reference: input.returnFileReference, return_recorded_at: now })}::jsonb,
          version = version + 1, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${batchId}
    `,
    ...input.items.map((entry) =>
      sqlClient`
        update disbursement_items
        set attributes = attributes || ${JSON.stringify({ state: "failed", return_reason: entry.reason, provider_reference: entry.providerReference ?? null, returned_at: now })}::jsonb,
            version = version + 1, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${entry.itemId} and disbursement_batch_id = ${batchId}
      `,
    ),
    ...input.items.map((entry) => {
      const item = byId.get(entry.itemId) as DisbursementItemView;
      return sqlClient`
        insert into payroll_anomalies (id, tenant_id, payroll_run_id, employee_id, rule_code, severity, facts, status)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${record.payrollRunId}, ${item.employeeId}, ${RETURN_RULE_CODE}, 'critical',
          ${JSON.stringify({
            disbursement_batch_id: batchId,
            disbursement_item_id: entry.itemId,
            note: `Credit returned by the bank: ${entry.reason}`,
            amount_minor: item.amountMinor,
            // The returned credit is the financial impact the audit queue reports for this finding.
            impact_amount_minor: item.amountMinor,
            account_masked: item.accountMasked,
            return_reason: entry.reason,
            provider_reference: entry.providerReference ?? null,
            return_file_reference: input.returnFileReference,
            requires: "re-disbursement",
          })}::jsonb, 'open')
      `;
    }),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'payroll.disbursement_return', 'disbursement_batch', ${batchId},
        ${`Bank return ${input.returnFileReference} recorded: ${input.items.length} failed credit${input.items.length === 1 ? "" : "s"}`},
        ${JSON.stringify({ returnFileReference: input.returnFileReference, failed: input.items.length })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'payroll.disbursement_returned', 'disbursement_batch', ${batchId},
        ${JSON.stringify({ runId: record.payrollRunId, failed: input.items.length, returnFileReference: input.returnFileReference })}::jsonb)
    `,
  ];
  await tenantTx(access, statements);
  return { id: batchId, state: "failed", failed: input.items.length, anomaliesRaised: input.items.length };
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

export async function listBatches(
  access: Access,
  args: { runId?: string | null; state?: string | null; page?: number; pageSize?: number } = {},
): Promise<{ items: BatchSummary[]; total: number }> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const page = args.page && args.page > 0 ? args.page : 1;
  const pageSize = args.pageSize && args.pageSize > 0 ? Math.min(args.pageSize, 100) : 25;
  const runId = args.runId ?? null;
  const state = args.state && (BATCH_STATES as readonly string[]).includes(args.state) ? args.state : null;
  const [rows, counted] = await tenantTx(access, [
    sqlClient`
      select b.id, b.payroll_run_id, b.integration_connection_id, b.attributes, b.created_at,
             r.period, r.scope
      from disbursement_batches b
      join payroll_runs r on r.tenant_id = b.tenant_id and r.id = b.payroll_run_id
      where b.tenant_id = ${access.tenantId}
        and (${runId}::uuid is null or b.payroll_run_id = ${runId}::uuid)
        and (${state}::text is null or b.attributes->>'state' = ${state}::text)
      order by b.created_at desc
      limit ${pageSize} offset ${(page - 1) * pageSize}
    `,
    sqlClient`
      select count(*)::int as total from disbursement_batches b
      where b.tenant_id = ${access.tenantId}
        and (${runId}::uuid is null or b.payroll_run_id = ${runId}::uuid)
        and (${state}::text is null or b.attributes->>'state' = ${state}::text)
    `,
  ]);
  const items = (rows as Array<BatchRow & { period: string | null; scope: string | null }>).map((row) => {
    const summary = summaryFrom(batchRecordFrom(row));
    return { ...summary, runPeriod: summary.runPeriod || String(row.period ?? ""), runScope: summary.runScope || String(row.scope ?? "") };
  });
  return { items, total: (counted as Array<{ total: number }>)[0]?.total ?? items.length };
}

/**
 * The detail read model. Rebuilt from the persisted items, so it needs neither the
 * dossier nor decryption: the control file it returns carries masked accounts only.
 */
export async function getBatch(access: Access, batchId: string): Promise<BatchDetail> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const record = await loadBatchRecord(access, batchId);
  const summary = summaryFrom(record);
  const items = await loadItems(access, batchId);
  const run = await loadRunFacts(access, record.payrollRunId);

  const [auditRows] = await tenantTx(access, [
    sqlClient`
      select action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_type = 'disbursement_batch' and entity_id = ${batchId}
      order by created_at desc limit 50
    `,
  ]);

  const payable = items.filter((item) => item.state !== "excluded");
  const excluded: ExcludedEmployee[] = items
    .filter((item) => item.state === "excluded")
    .map((item) => ({
      payrollRunEmployeeId: item.payrollRunEmployeeId,
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      amountMinor: item.amountMinor,
      reason: item.exclusionReason ?? "no_bank_account",
      reasonText: item.exclusionReasonText ?? EXCLUSION_REASON_LABELS.no_bank_account,
    }));

  // The control copy: identical layout, masked accounts. The bank-ready file is
  // built from the dossier at release time and never travels to a browser.
  const maskedRows: BankFileRow[] = payable.map((item) => ({
    employeeId: item.employeeId,
    employeeCode: item.employeeCode,
    employeeName: item.employeeName,
    accountHolder: item.accountHolder,
    accountNumber: item.accountMasked,
    routingCode: item.routingCode,
    bankName: item.bankName,
    accountType: item.accountType,
    amountMinor: item.amountMinor,
    reference: `${summary.runPeriod || run.period}-${item.employeeCode ?? item.employeeId.slice(0, 8)}`,
  }));
  const content = buildBankFile(summary.format, maskedRows, {
    valueDate: summary.valueDate,
    currency: summary.currency,
    debitAccountLabel: String(record.attributes.disbursing_account_label ?? ""),
    batchReference: summary.fileReference,
  });

  // Re-check the payroll window live, so a bank-detail change made after the batch
  // was prepared still surfaces.
  const storedWarnings = Array.isArray(record.attributes.bank_detail_warnings) ? (record.attributes.bank_detail_warnings as BankDetailWarning[]) : [];
  const liveWarnings = await liveBankDetailWarnings(access, batchId, items, record.attributes.calculated_at ? String(record.attributes.calculated_at) : null);
  const warnings = [...storedWarnings];
  for (const warning of liveWarnings) {
    if (!warnings.some((existing) => existing.bankAccountId === warning.bankAccountId)) warnings.push(warning);
  }

  return {
    ...summary,
    runPeriod: summary.runPeriod || run.period,
    runScope: summary.runScope || run.scope,
    disbursingAccountLabel: String(record.attributes.disbursing_account_label ?? ""),
    disbursingAccountMasked: String(record.attributes.disbursing_account_masked ?? "—"),
    verifiedBy: record.attributes.verified_by ? String(record.attributes.verified_by) : null,
    verifiedAt: record.attributes.verified_at ? String(record.attributes.verified_at) : null,
    outOfBandReference: record.attributes.out_of_band_reference ? String(record.attributes.out_of_band_reference) : null,
    releaseRemarks: record.attributes.release_remarks ? String(record.attributes.release_remarks) : null,
    returnFileReference: record.attributes.return_file_reference ? String(record.attributes.return_file_reference) : null,
    items,
    excluded,
    warnings,
    timeline: batchTimeline(record.state),
    auditTrail: (auditRows as Array<{ action: string; reason: string | null; created_at: string | Date | null }>).map((row) => ({
      action: row.action,
      reason: row.reason,
      createdAt: row.created_at === null ? null : new Date(row.created_at).toISOString(),
    })),
    file: { name: summary.fileName, format: summary.format, masked: true, content },
    releaseBlockedReason: releaseBlockedReason(
      { state: record.state, outOfBandVerified: summary.outOfBandVerified, preparedBy: summary.preparedBy },
      access.context.actorUserId,
    ),
  };
}

/** Non-sensitive `bank_accounts.updated_at` lookup for the batch's own accounts. */
async function liveBankDetailWarnings(
  access: Access,
  batchId: string,
  items: DisbursementItemView[],
  calculatedAt: string | null,
): Promise<BankDetailWarning[]> {
  if (!calculatedAt) return [];
  const [rows] = await tenantTx(access, [
    sqlClient`
      select i.bank_account_id, i.employee_id, i.attributes, a.updated_at
      from disbursement_items i
      join bank_accounts a on a.tenant_id = i.tenant_id and a.id = i.bank_account_id
      where i.tenant_id = ${access.tenantId} and i.disbursement_batch_id = ${batchId} and i.bank_account_id is not null
    `,
  ]);
  const byEmployee = new Map(items.map((item) => [item.employeeId, item]));
  return bankDetailChangeWarnings(
    (rows as Array<{ bank_account_id: string; employee_id: string; attributes: Record<string, unknown> | null; updated_at: string | Date | null }>).map((row) => {
      const item = byEmployee.get(String(row.employee_id));
      return {
        bankAccountId: String(row.bank_account_id),
        employeeId: String(row.employee_id),
        employeeCode: item?.employeeCode ?? null,
        employeeName: item?.employeeName ?? "",
        updatedAt: row.updated_at === null ? null : new Date(row.updated_at).toISOString(),
      };
    }),
    calculatedAt,
  );
}
