import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError, moneyView } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";

/**
 * SCR-058 / FRM-PAY-06 — Reimbursement claims.
 *
 * A reimbursement claim and a travel expense claim are the same entity in this
 * product: both are rows of the `expenses` operational resource. The only thing
 * separating them is whether the claim hangs off a travel request. A claim with
 * no `travelId` was raised on its own and belongs on this screen; a travel-linked
 * one belongs to the travel screen and is excluded here (`reimbursementRegister`).
 *
 * This module is read-only. Every write — raise, submit, approve, return, reject,
 * cancel, reimburse — goes through the generic operational endpoints
 * (`/api/v1/operations/expenses/...`), which already own the state machine,
 * idempotency, versioning and audit. Nothing here duplicates that.
 *
 * What it does own is the arithmetic FRM-PAY-06 asks for, and the honest
 * reporting of what this repository cannot answer:
 *
 *  - Entitlement. The workbook wants annual entitlement / claimed / balance.
 *    Claimed-to-date is real and is computed from recorded claims. The ANNUAL
 *    ENTITLEMENT AMOUNT is not defined anywhere in this repository: there is no
 *    entitlement master, no scheme table and no per-category limit. It is
 *    therefore read from tenant configuration (`ENTITLEMENT_SETTINGS_PATH`) and,
 *    when absent, reported as not configured — never as zero (which reads as
 *    "nothing is due") and never as unlimited. No claim is blocked against a
 *    limit this module invented, because there is none to invent.
 *
 *  - Amount passed. An approver may pass less than was claimed;
 *    `approvedAmountMinor` carries that. `resolvePassedAmount` keeps the two
 *    apart: the claimed amount is never reported as the passed amount before a
 *    decision exists, and a recorded pass never reads higher than the claim.
 *
 *  - Payroll tagging. The workbook says a reimbursement reaches payroll by being
 *    tagged to a run, "never as a manual edit". `payrollRunId` records that tag.
 *    The `reimburse` transition in `src/server/workflows/operational-service.ts`
 *    writes the record, its event and its audit row and NOTHING ELSE: it does not
 *    call `upsertPayrollInput`, and `INPUT_COMPONENTS` in
 *    `src/server/payroll/service.ts` carries no reimbursement component for it to
 *    write to. So the tag is recorded and no payroll input is raised.
 *    `payrollTagState` reports exactly that rather than letting the screen imply
 *    money will be paid.
 */

// ---------------------------------------------------------------------------
// Vocabulary — taken from the resource, never restated
// ---------------------------------------------------------------------------

export const REIMBURSEMENT_RESOURCE = "expenses";

const RESOURCE = operationalResources[REIMBURSEMENT_RESOURCE];

/** The PL_CLAIM_TYPE list, read from the resource so the two cannot drift. */
export const CLAIM_CATEGORIES: readonly string[] = (() => {
  const field = RESOURCE.fields.find((candidate) => candidate.name === "category");
  return (field?.options ?? []).map((option) => String(option));
})();

export const CLAIM_TRANSITIONS = RESOURCE.transitions;

/** Statuses in which the record itself may still be edited (PATCH). */
export const CLAIM_EDITABLE_STATUSES: readonly string[] = RESOURCE.editable;

export const CLAIM_ACTIONS = ["submit", "approve", "return", "reject", "cancel", "reimburse"] as const;
export type ClaimAction = (typeof CLAIM_ACTIONS)[number];

export const CLAIM_ACTION_LABELS: Record<ClaimAction, string> = {
  submit: "Submit",
  approve: "Approve",
  return: "Return",
  reject: "Reject",
  cancel: "Cancel",
  reimburse: "Mark reimbursed",
};

/** Statuses that consume nothing: a rejected or cancelled claim is not "claimed". */
export const NON_CONSUMING_STATUSES: readonly string[] = ["rejected", "cancelled"];

/** Statuses in which an approver's decision on the amount exists. */
export const DECIDED_STATUSES: readonly string[] = ["approved", "reimbursed"];

// ---------------------------------------------------------------------------
// Financial year
// ---------------------------------------------------------------------------

/**
 * April–March, the same year `parseFinancialYear` in `./tax` already assumes.
 * Entitlement is annual, so every claim has to be placed in a year before
 * claimed-to-date means anything.
 */
export const FINANCIAL_YEAR_START_MONTH = 4;

/** `2026-05-14` -> `2026-27`; `2026-02-14` -> `2025-26`. Null when unparseable. */
export function financialYearLabelOf(isoDate: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const startYear = month >= FINANCIAL_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

// ---------------------------------------------------------------------------
// Claim shape
// ---------------------------------------------------------------------------

export type ClaimRecord = {
  id: string;
  status: string;
  version: number;
  employeeId: string | null;
  employeeCode: string | null;
  employeeName: string | null;
  /** Non-null means the claim belongs to the travel screen, not this one. */
  travelId: string | null;
  expenseDate: string | null;
  financialYear: string | null;
  category: string;
  amountMinor: number;
  currency: string;
  /** What the approver passed, as recorded. Null when nothing was recorded. */
  approvedAmountMinor: number | null;
  /** A per-claim entitlement captured on the claim itself, if any was. */
  entitlementMinor: number | null;
  payrollRunId: string | null;
  billNumber: string | null;
  vendor: string | null;
  vendorGstin: string | null;
  receiptDocumentId: string | null;
  description: string | null;
  paymentReference: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function isTravelLinked(claim: Pick<ClaimRecord, "travelId">): boolean {
  return typeof claim.travelId === "string" && claim.travelId.trim() !== "";
}

/**
 * The reimbursement register: standalone claims only. Travel-linked claims are
 * approved and reimbursed on the travel screen against their trip, and showing
 * them here would put the same work in two queues.
 */
export function reimbursementRegister<T extends Pick<ClaimRecord, "travelId">>(claims: readonly T[]): T[] {
  return claims.filter((claim) => !isTravelLinked(claim));
}

// ---------------------------------------------------------------------------
// Amount claimed vs amount passed
// ---------------------------------------------------------------------------

export type PassedAmount = {
  /** What the approver recorded, exactly as recorded. Null when nothing was. */
  recordedMinor: number | null;
  /** What has actually been passed. Null until a decision exists. */
  passedMinor: number | null;
  /** True once the claim is approved or reimbursed. */
  decided: boolean;
  /** True when the pass fell back to the full claim because nothing was cut. */
  defaulted: boolean;
  /** True when the recorded pass reads higher than the claim — a data fault. */
  exceedsClaim: boolean;
  /** What a reader needs to know about this figure, in plain words. */
  note: string;
};

/**
 * A passed amount may be lower than the claim and may never be higher: an
 * approver can cut a claim, not inflate it. A recorded figure above the claim is
 * reported and capped rather than shown, because paying it would pay more than
 * the employee asked for.
 */
export function resolvePassedAmount(claim: Pick<ClaimRecord, "amountMinor" | "approvedAmountMinor" | "status">): PassedAmount {
  const decided = DECIDED_STATUSES.includes(claim.status);
  const recordedMinor =
    claim.approvedAmountMinor === null || claim.approvedAmountMinor === undefined ? null : Math.trunc(claim.approvedAmountMinor);
  if (recordedMinor === null) {
    return {
      recordedMinor: null,
      passedMinor: decided ? claim.amountMinor : null,
      decided,
      defaulted: true,
      exceedsClaim: false,
      note: decided
        ? "No reduction was recorded, so the full claimed amount passed."
        : "No amount has been passed yet; this claim has not been decided.",
    };
  }
  if (recordedMinor > claim.amountMinor) {
    return {
      recordedMinor,
      passedMinor: decided ? claim.amountMinor : null,
      decided,
      defaulted: false,
      exceedsClaim: true,
      note: "The recorded passed amount is higher than the amount claimed. It is capped at the claim until it is corrected.",
    };
  }
  return {
    recordedMinor,
    passedMinor: decided ? recordedMinor : null,
    decided,
    defaulted: false,
    exceedsClaim: false,
    note: decided
      ? recordedMinor < claim.amountMinor
        ? "The approver passed less than was claimed."
        : "The approver passed the full claim."
      : "This amount is proposed on the claim; it is not passed until the claim is approved.",
  };
}

/**
 * `approvedAmountMinor` lives on the record, and the record is only editable in
 * its editable statuses. So a passed amount lower than the claim has to be
 * recorded before the claim is approved — the approve action itself carries only
 * a reason. This function names that constraint so the screen can state it rather
 * than offer a control that cannot work.
 */
export function passedAmountEditable(claim: Pick<ClaimRecord, "status">): { editable: boolean; reason: string } {
  if (CLAIM_EDITABLE_STATUSES.includes(claim.status)) {
    return { editable: true, reason: "The claim is editable, so the amount passed can be recorded on it." };
  }
  return {
    editable: false,
    reason: `The amount passed is held on the claim, and a claim is only editable while it is ${CLAIM_EDITABLE_STATUSES.join(" or ")}. Return the claim to record a different amount.`,
  };
}

// ---------------------------------------------------------------------------
// Claimed to date
// ---------------------------------------------------------------------------

export type ClaimedToDate = {
  employeeId: string;
  category: string;
  financialYear: string;
  /** Sum of amounts claimed on live claims for this employee, category, year. */
  claimedMinor: number;
  /** Of that, the part raised against a travel request. */
  travelLinkedMinor: number;
  /** Sum of amounts actually passed on decided claims. */
  passedMinor: number;
  claimCount: number;
};

/**
 * Claimed-to-date for one employee, one category, one financial year.
 *
 * Rejected and cancelled claims consume nothing and are excluded. Travel-linked
 * claims ARE counted — the entitlement belongs to the employee and the category,
 * not to the screen the claim was raised on — and are reported separately so
 * nothing is hidden inside the total.
 */
export function claimedToDate(
  claims: readonly ClaimRecord[],
  selector: { employeeId: string; category: string; financialYear: string; excludeClaimId?: string },
): ClaimedToDate {
  const matching = claims.filter(
    (claim) =>
      claim.employeeId === selector.employeeId &&
      claim.category === selector.category &&
      claim.financialYear === selector.financialYear &&
      claim.id !== selector.excludeClaimId &&
      !NON_CONSUMING_STATUSES.includes(claim.status),
  );
  let claimedMinor = 0;
  let travelLinkedMinor = 0;
  let passedMinor = 0;
  for (const claim of matching) {
    claimedMinor += claim.amountMinor;
    if (isTravelLinked(claim)) travelLinkedMinor += claim.amountMinor;
    passedMinor += resolvePassedAmount(claim).passedMinor ?? 0;
  }
  return {
    employeeId: selector.employeeId,
    category: selector.category,
    financialYear: selector.financialYear,
    claimedMinor,
    travelLinkedMinor,
    passedMinor,
    claimCount: matching.length,
  };
}

// ---------------------------------------------------------------------------
// Entitlement — configuration, never a seeded default
// ---------------------------------------------------------------------------

/** Where an annual entitlement would have to be configured for it to exist. */
export const ENTITLEMENT_SETTINGS_PATH = "tenant_settings.settings -> 'reimbursement_entitlement_scheme'";

/**
 * There is no entitlement master, scheme table or per-category limit anywhere in
 * this repository, so the annual entitlement can only come from tenant
 * configuration. This is the shape it must take. There is no default and none may
 * be added: a limit invented here would be applied to a real person's money.
 */
export const entitlementSchemeSchema = z.object({
  code: z.string().trim().min(1).max(40),
  currency: z.string().regex(/^[A-Z]{3}$/),
  /** Annual entitlement in integer minor units, keyed by claim category. */
  annualEntitlementMinorByCategory: z.record(z.string(), z.number().int().min(0)),
});
export type EntitlementScheme = z.infer<typeof entitlementSchemeSchema>;

/** Returns the configured scheme, or null when the tenant has not configured one. */
export function parseEntitlementScheme(raw: unknown): EntitlementScheme | null {
  if (raw === null || raw === undefined) return null;
  const parsed = entitlementSchemeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type EntitlementPosition = {
  configured: boolean;
  schemeCode: string | null;
  currency: string | null;
  /** Null when nothing configures it — never 0, which would read as "exhausted". */
  annualEntitlementMinor: number | null;
  claimedToDateMinor: number;
  /** Null when the entitlement is unknown. An unknown limit has no balance. */
  balanceMinor: number | null;
  /** True only when a configured entitlement is actually exceeded. */
  exceeded: boolean;
  /** Exactly what is missing before an entitlement can be stated. */
  missing: string[];
  note: string;
};

/**
 * The entitlement position for one employee, category and year.
 *
 * When no entitlement is configured the position reports itself as not configured
 * and names what is missing. It never returns zero, never returns an unlimited
 * entitlement, and never blocks a claim: `exceeded` can only be true against a
 * real configured number, and it is a statement, not a gate.
 */
export function entitlementPosition(args: {
  scheme: EntitlementScheme | null;
  category: string;
  claimedToDateMinor: number;
}): EntitlementPosition {
  const base = { claimedToDateMinor: args.claimedToDateMinor, exceeded: false };
  if (!args.scheme) {
    return {
      ...base,
      configured: false,
      schemeCode: null,
      currency: null,
      annualEntitlementMinor: null,
      balanceMinor: null,
      missing: [`${ENTITLEMENT_SETTINGS_PATH} — no reimbursement entitlement scheme is configured for this tenant.`],
      note: "This product holds no entitlement master, so the annual entitlement and the remaining balance cannot be stated. Claimed-to-date is real.",
    };
  }
  const configuredAmount = args.scheme.annualEntitlementMinorByCategory[args.category];
  if (configuredAmount === undefined) {
    return {
      ...base,
      configured: false,
      schemeCode: args.scheme.code,
      currency: args.scheme.currency,
      annualEntitlementMinor: null,
      balanceMinor: null,
      missing: [
        `${ENTITLEMENT_SETTINGS_PATH} -> annualEntitlementMinorByCategory -> '${args.category}' — this claim type carries no annual entitlement.`,
      ],
      note: `The scheme ${args.scheme.code} is configured but says nothing about this claim type, so its entitlement and balance cannot be stated.`,
    };
  }
  const balanceMinor = configuredAmount - args.claimedToDateMinor;
  return {
    ...base,
    configured: true,
    schemeCode: args.scheme.code,
    currency: args.scheme.currency,
    annualEntitlementMinor: configuredAmount,
    balanceMinor,
    exceeded: balanceMinor < 0,
    missing: [],
    note:
      balanceMinor < 0
        ? "Claims recorded this financial year already exceed the configured annual entitlement. This is reported, not enforced: nothing here blocks the claim."
        : "Annual entitlement less claims recorded this financial year.",
  };
}

// ---------------------------------------------------------------------------
// Vendor GSTIN
// ---------------------------------------------------------------------------

/** 2-digit state code, PAN, entity number, `Z`, checksum character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstinCheck = { state: "absent" | "valid" | "malformed"; message: string };

/**
 * FRM-PAY-06 gives `vendor_gstin` a 15-character format. The check is a shape check - it does
 * not confirm the GSTIN exists or is active - and it is now applied on the way in as well as on
 * the screen, so a malformed number is refused rather than stored and flagged afterwards.
 */
export function checkVendorGstin(value: string | null | undefined): GstinCheck {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return { state: "absent", message: "No vendor GSTIN was captured on this claim." };
  if (GSTIN_PATTERN.test(trimmed.toUpperCase())) {
    return { state: "valid", message: "Format checked: 15 characters in the GSTIN shape. Existence and status are not confirmed." };
  }
  return {
    state: "malformed",
    message: "This is not a 15-character GSTIN. Claims recorded before the format was enforced can still carry one.",
  };
}

/**
 * FRM-PAY-06 "Bill number": unique within the claim type and the financial year. A duplicate is
 * how the same bill gets reimbursed twice, so it is refused rather than flagged. Pure, so the
 * rule is testable without a database; the caller supplies the claims already in that scope.
 */
export function assertBillNumberUnique(
  candidate: { billNumber: string | null | undefined; category: string; expenseDate: string | null | undefined; id?: string },
  existing: ReadonlyArray<{ id: string; billNumber: string | null; category: string; expenseDate: string | null; status: string }>,
): void {
  const billNumber = String(candidate.billNumber ?? "").trim().toUpperCase();
  if (billNumber === "") return;
  const year = financialYearLabelOf(candidate.expenseDate);
  const clash = existing.find(
    (claim) =>
      claim.id !== candidate.id &&
      // A rejected or cancelled claim never consumed the bill, so it cannot block a re-submission.
      !NON_CONSUMING_STATUSES.includes(claim.status) &&
      claim.category === candidate.category &&
      financialYearLabelOf(claim.expenseDate) === year &&
      String(claim.billNumber ?? "").trim().toUpperCase() === billNumber,
  );
  if (clash) {
    throw new HttpError({
      status: 422,
      code: "DUPLICATE_BILL_NUMBER",
      message: `Bill number ${String(candidate.billNumber).trim()} is already claimed under this claim type for ${year ?? "this year"}.`,
      details: [{ field: "billNumber", issue: "A bill can be claimed once per claim type per financial year." }],
    });
  }
}

// ---------------------------------------------------------------------------
// Payroll tagging
// ---------------------------------------------------------------------------

export type PayrollTagState = {
  tagged: boolean;
  payrollRunId: string | null;
  runPeriod: string | null;
  runStatus: string | null;
  /**
   * Always false. Nothing in this product turns a reimbursed claim into a payroll
   * input; see the module header.
   */
  payrollInputRaised: boolean;
  note: string;
};

export function payrollTagState(
  claim: Pick<ClaimRecord, "payrollRunId" | "status">,
  runs: ReadonlyMap<string, { period: string; status: string }>,
): PayrollTagState {
  const runId = claim.payrollRunId && claim.payrollRunId.trim() !== "" ? claim.payrollRunId.trim() : null;
  const run = runId ? runs.get(runId) ?? null : null;
  if (!runId) {
    return {
      tagged: false,
      payrollRunId: null,
      runPeriod: null,
      runStatus: null,
      payrollInputRaised: false,
      note: "This claim carries no payroll run tag. FRM-PAY-06 requires a reimbursement to reach payroll by being tagged to a run, never by a manual edit.",
    };
  }
  return {
    tagged: true,
    payrollRunId: runId,
    runPeriod: run?.period ?? null,
    runStatus: run?.status ?? null,
    payrollInputRaised: false,
    note: run
      ? "The tag is recorded against this run. No payroll input is raised by it: the reimburse action writes the claim, its event and its audit row only, so nothing feeds payroll calculation."
      : "A payroll run is tagged but no run with that reference is visible here. No payroll input is raised in any case.",
  };
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type ActionAvailability = {
  action: ClaimAction;
  label: string;
  allowed: boolean;
  /** Why it is unavailable, in the user's terms. Null when it is available. */
  reason: string | null;
  /** What the action additionally requires from the caller. */
  requires: string[];
  permissions: string[];
};

function permissionGroupsFor(action: ClaimAction): string[][] {
  const approval = CLAIM_TRANSITIONS[action]?.approval === true;
  const base = `${RESOURCE.permission}.${approval ? "approve" : "write"}`;
  const scoped = approval ? `${RESOURCE.permission}.team.approve` : `${RESOURCE.permission}.self.write`;
  // `reimburse` additionally carries payroll.accounting.write server-side.
  const extra = action === "reimburse" ? ["payroll.accounting.write"] : [];
  return [
    [base, ...extra],
    [scoped, ...extra],
  ];
}

/**
 * Whether one action is legal on one claim right now, and if not, why not.
 *
 * The permission arm is advisory: self and team scopes also depend on who owns
 * the record, which only the server can settle. It is here so the screen can
 * disable an action with a visible reason instead of offering a button that 403s.
 */
export function claimActionAvailability(
  action: ClaimAction,
  claim: Pick<ClaimRecord, "status">,
  context: { permissions: readonly string[] },
): ActionAvailability {
  const transition = CLAIM_TRANSITIONS[action];
  const groups = permissionGroupsFor(action);
  const label = CLAIM_ACTION_LABELS[action];
  const requires =
    action === "reimburse"
      ? ["A completed payment reference", "A reason of at least 3 characters"]
      : ["A reason of at least 3 characters"];
  const base = { action, label, requires, permissions: groups[0] };
  if (!transition) {
    return { ...base, allowed: false, reason: "This action does not exist on the expense claim workflow." };
  }
  if (!transition.from.includes(claim.status)) {
    return {
      ...base,
      allowed: false,
      reason: `${label} needs a claim that is ${transition.from.join(" or ")}. This claim is ${claim.status}.`,
    };
  }
  const permitted = groups.some((group) => group.every((permission) => context.permissions.includes(permission)));
  if (!permitted) {
    return { ...base, allowed: false, reason: `Your role does not carry ${groups[0].join(" and ")}.` };
  }
  return { ...base, allowed: true, reason: null };
}

export function claimActions(
  claim: Pick<ClaimRecord, "status">,
  context: { permissions: readonly string[] },
): ActionAvailability[] {
  return CLAIM_ACTIONS.map((action) => claimActionAvailability(action, claim, context));
}

// ---------------------------------------------------------------------------
// State timeline
// ---------------------------------------------------------------------------

export type TimelineEntry = { action: string; status: string | null; reason: string | null; at: string | null };

export type StateStep = { status: string; label: string; state: "done" | "current" | "todo" };

const TIMELINE_STATUSES = ["draft", "submitted", "approved", "reimbursed"] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Raised",
  submitted: "Submitted",
  approved: "Approved",
  reimbursed: "Reimbursed",
  returned: "Returned",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * The happy path, marked against where the claim actually is. A status off that
 * path (returned, rejected, cancelled) marks only the steps the claim's own
 * history proves it reached, rather than pretending progress was made.
 */
export function stateTimeline(claim: Pick<ClaimRecord, "status">, reached: readonly string[] = []): StateStep[] {
  const index = TIMELINE_STATUSES.indexOf(claim.status as (typeof TIMELINE_STATUSES)[number]);
  return TIMELINE_STATUSES.map((status, position) => {
    const state: StateStep["state"] =
      index >= 0
        ? position < index
          ? "done"
          : position === index
            ? "current"
            : "todo"
        : reached.includes(status)
          ? "done"
          : "todo";
    return { status, label: statusLabel(status), state };
  });
}

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export type ReimbursementClaimView = ClaimRecord & {
  amount: { amount: string; currency: string };
  passed: PassedAmount;
  passedAmountEdit: { editable: boolean; reason: string };
  entitlement: EntitlementPosition & { claimedToDate: ClaimedToDate };
  payrollTag: PayrollTagState;
  gstin: GstinCheck;
  timeline: StateStep[];
  history: TimelineEntry[];
  audit: TimelineEntry[];
};

const READ_LIMIT = 500;
const EVENT_LIMIT = 2000;

export const reimbursementClaimsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(40).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  financialYear: z.string().trim().min(4).max(12).optional(),
  search: z.string().trim().max(100).optional(),
  /** Travel-linked claims belong to the travel screen; opt in to see them. */
  includeTravelLinked: z.boolean().optional(),
});
export type ReimbursementClaimsQuery = z.infer<typeof reimbursementClaimsQuerySchema>;

export function parseReimbursementClaimsQuery(params: URLSearchParams): ReimbursementClaimsQuery {
  const parsed = reimbursementClaimsQuerySchema.safeParse({
    employeeId: params.get("employeeId") ?? undefined,
    status: params.get("status") ?? undefined,
    category: params.get("category") ?? undefined,
    financialYear: params.get("financialYear") ?? undefined,
    search: params.get("search") ?? undefined,
    includeTravelLinked: params.get("includeTravelLinked") === "true" ? true : undefined,
  });
  if (!parsed.success) {
    throw new HttpError({
      status: 400,
      code: "BAD_REQUEST",
      message: "Check the claim filters.",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
    });
  }
  return parsed.data;
}

type RecordRow = {
  id: string;
  status: string;
  version: number;
  employee_id: string | null;
  data: Record<string, unknown>;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function integer(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function timestamp(value: string | Date | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toClaimRecord(row: RecordRow): ClaimRecord {
  const data = asRecord(row.data);
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const expenseDate = text(data.expenseDate);
  return {
    id: row.id,
    status: row.status,
    version: Number(row.version),
    employeeId: row.employee_id ?? text(data.employeeId),
    employeeCode: row.employee_code,
    employeeName: name === "" ? null : name,
    travelId: text(data.travelId),
    expenseDate,
    financialYear: financialYearLabelOf(expenseDate),
    category: text(data.category) ?? "other",
    amountMinor: integer(data.amountMinor) ?? 0,
    currency: text(data.currency) ?? "INR",
    approvedAmountMinor: integer(data.approvedAmountMinor),
    entitlementMinor: integer(data.entitlementMinor),
    payrollRunId: text(data.payrollRunId),
    billNumber: text(data.billNumber),
    vendor: text(data.vendor),
    vendorGstin: text(data.vendorGstin),
    receiptDocumentId: text(data.receiptDocumentId),
    description: text(data.description),
    paymentReference: text(data.paymentReference),
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

/** Assemble one claim's view from the whole claim population. */
export function buildClaimView(
  claim: ClaimRecord,
  context: {
    allClaims: readonly ClaimRecord[];
    scheme: EntitlementScheme | null;
    runs: ReadonlyMap<string, { period: string; status: string }>;
    history: readonly TimelineEntry[];
    audit: readonly TimelineEntry[];
  },
): ReimbursementClaimView {
  const totals =
    claim.employeeId && claim.financialYear
      ? claimedToDate(context.allClaims, {
          employeeId: claim.employeeId,
          category: claim.category,
          financialYear: claim.financialYear,
        })
      : {
          employeeId: claim.employeeId ?? "",
          category: claim.category,
          financialYear: claim.financialYear ?? "",
          claimedMinor: 0,
          travelLinkedMinor: 0,
          passedMinor: 0,
          claimCount: 0,
        };
  const position = entitlementPosition({
    scheme: context.scheme,
    category: claim.category,
    claimedToDateMinor: totals.claimedMinor,
  });
  const reached = context.history.map((entry) => entry.status).filter((status): status is string => status !== null);
  return {
    ...claim,
    amount: moneyView(claim.amountMinor, claim.currency),
    passed: resolvePassedAmount(claim),
    passedAmountEdit: passedAmountEditable(claim),
    entitlement: { ...position, claimedToDate: totals },
    payrollTag: payrollTagState(claim, context.runs),
    gstin: checkVendorGstin(claim.vendorGstin),
    timeline: stateTimeline(claim, reached),
    history: [...context.history],
    audit: [...context.audit],
  };
}

type EventRow = { record_id: string; action: string; reason: string | null; created_at: string | Date; status: string | null };
type AuditRow = { entity_id: string; action: string; reason: string | null; created_at: string | Date; status: string | null };

/**
 * Reads the claim population, the entitlement configuration, the payroll runs a
 * claim may be tagged to, and both trails, in one tenant transaction. Read-only
 * by design: writes belong to `/api/v1/operations/expenses`.
 *
 * The visibility predicate is the same one `listOperationalRecords` applies, via
 * the same `operationalScope` helper, so this screen can never show a claim the
 * generic register would hide.
 */
export async function listReimbursementClaims(
  access: Access,
  query: ReimbursementClaimsQuery,
): Promise<{ items: ReimbursementClaimView[]; total: number; entitlementConfigured: boolean; missing: string[] }> {
  const scope = operationalScope(access, RESOURCE.permission, "read");
  const employeeId = access.context.employeeId ?? null;
  const [recordRows, settingsRows, runRows, eventRows, auditRows] = (await tenantTx(access, [
    sqlClient`
      select r.id, r.status, r.version, r.employee_id, r.data, r.created_at, r.updated_at,
             e.employee_code, e.first_name, e.last_name
      from hrms_operation_records r
      left join employees e on e.tenant_id = r.tenant_id and e.id = r.employee_id
      where r.tenant_id = ${access.tenantId} and r.resource = ${REIMBURSEMENT_RESOURCE}
        and (${scope} = 'all' or r.employee_id = ${employeeId}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${employeeId}::uuid)))
      order by r.created_at desc, r.id desc
      limit ${READ_LIMIT}
    `,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
    sqlClient`select id, period, status from payroll_runs where tenant_id = ${access.tenantId} order by period desc limit ${READ_LIMIT}`,
    sqlClient`
      select v.record_id, v.action, v.reason, v.created_at, v.response->>'status' as status
      from hrms_operation_events v
      join hrms_operation_records r on r.tenant_id = v.tenant_id and r.id = v.record_id and r.resource = ${REIMBURSEMENT_RESOURCE}
      where v.tenant_id = ${access.tenantId}
        and (${scope} = 'all' or r.employee_id = ${employeeId}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${employeeId}::uuid)))
      order by v.created_at, v.id
      limit ${EVENT_LIMIT}
    `,
    sqlClient`
      select a.entity_id, a.action, a.reason, a.created_at, a.after->>'status' as status
      from audit_events a
      join hrms_operation_records r on r.tenant_id = a.tenant_id and r.id::text = a.entity_id and r.resource = ${REIMBURSEMENT_RESOURCE}
      where a.tenant_id = ${access.tenantId} and a.entity_type = 'hrms_operation'
        and (${scope} = 'all' or r.employee_id = ${employeeId}::uuid
             or (${scope} = 'team' and r.employee_id in (select id from employees where tenant_id = ${access.tenantId} and manager_employee_id = ${employeeId}::uuid)))
      order by a.created_at desc, a.id desc
      limit ${EVENT_LIMIT}
    `,
  ])) as [RecordRow[], Array<{ settings: unknown }>, Array<{ id: string; period: string; status: string }>, EventRow[], AuditRow[]];

  const allClaims = recordRows.map(toClaimRecord);
  const scheme = parseEntitlementScheme(asRecord(settingsRows[0]?.settings).reimbursement_entitlement_scheme);
  const runs = new Map(runRows.map((row) => [row.id, { period: row.period, status: row.status }]));

  const historyByClaim = new Map<string, TimelineEntry[]>();
  for (const row of eventRows) {
    const bucket = historyByClaim.get(row.record_id) ?? [];
    bucket.push({ action: row.action, status: row.status, reason: row.reason, at: timestamp(row.created_at) });
    historyByClaim.set(row.record_id, bucket);
  }
  const auditByClaim = new Map<string, TimelineEntry[]>();
  for (const row of auditRows) {
    const bucket = auditByClaim.get(row.entity_id) ?? [];
    bucket.push({ action: row.action, status: row.status, reason: row.reason, at: timestamp(row.created_at) });
    auditByClaim.set(row.entity_id, bucket);
  }

  const register = query.includeTravelLinked === true ? allClaims : reimbursementRegister(allClaims);
  const needle = (query.search ?? "").toLowerCase();
  const filtered = register.filter((claim) => {
    if (query.employeeId && claim.employeeId !== query.employeeId) return false;
    if (query.status && claim.status !== query.status) return false;
    if (query.category && claim.category !== query.category) return false;
    if (query.financialYear && claim.financialYear !== query.financialYear) return false;
    if (needle === "") return true;
    return [claim.employeeName, claim.employeeCode, claim.description, claim.vendor, claim.billNumber, claim.category].some(
      (value) => typeof value === "string" && value.toLowerCase().includes(needle),
    );
  });

  const items = filtered.map((claim) =>
    buildClaimView(claim, {
      allClaims,
      scheme,
      runs,
      history: historyByClaim.get(claim.id) ?? [],
      audit: auditByClaim.get(claim.id) ?? [],
    }),
  );

  const missing = new Set<string>();
  for (const item of items) for (const gap of item.entitlement.missing) missing.add(gap);

  return { items, total: items.length, entitlementConfigured: scheme !== null, missing: [...missing] };
}

/**
 * FRM-PAY-06 duplicate-bill guard, against the claims already recorded in the tenant. Reads only
 * the four columns the rule needs, and only for claims of the same category, so the scan stays
 * narrow even on a large register.
 */
export async function assertBillNumberUnusedInTenant(
  access: Access,
  candidate: { billNumber: string | null | undefined; category: string; expenseDate: string | null | undefined; id?: string },
): Promise<void> {
  const billNumber = String(candidate.billNumber ?? "").trim();
  if (billNumber === "") return;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, status,
             data->>'billNumber' as bill_number,
             data->>'category' as category,
             data->>'expenseDate' as expense_date
      from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = ${REIMBURSEMENT_RESOURCE}
        and upper(trim(data->>'billNumber')) = ${billNumber.toUpperCase()}
        and data->>'category' = ${candidate.category}
    `,
  ]);
  assertBillNumberUnique(
    candidate,
    (rows as Array<{ id: string; status: string; bill_number: string | null; category: string | null; expense_date: string | null }>).map((row) => ({
      id: row.id,
      status: row.status,
      billNumber: row.bill_number,
      category: row.category ?? "",
      expenseDate: row.expense_date,
    })),
  );
}
