import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { operationalResources } from "@/lib/operational-catalog";
import { recordAudit, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { operationalScope } from "@/server/workflows/operational-access";

/**
 * SCR-072 — Tax & statutory filing register (module `statutory`).
 *
 * The filing workflow itself already exists: `filings` in
 * `src/lib/operational-catalog.ts`, served by the generic operational routes.
 * This module does NOT reimplement it. It adds the three things the register
 * screen needs that the generic routes cannot express:
 *
 *  1. A **due-date view** computed from real dates — overdue, due soon, filed —
 *     rather than a decorative badge. Every band here comes from the filing's
 *     own `dueDate`, the date a human says it was filed, and the workflow state.
 *
 *  2. A **filing outcome record**: filed-on date, acknowledgement number,
 *     evidence document, late-filing reason and, most importantly, the **amount
 *     remitted to the authority**. The generic transition route deliberately
 *     accepts only `reason` and `acknowledgementReference` on `file`/`accept`
 *     (see `operational-service.ts`), so there is nowhere in the filings record
 *     to put any of this. FRM-CMP-01 ("Obligation Calendar Entry") carries all
 *     of it.
 *
 *  3. Enforcement of the rule that a **late filing must carry a reason**.
 *     `validateFilingOutcome` is the single enforcement point and is called by
 *     `recordFilingOutcome` before anything is written.
 *
 * ---------------------------------------------------------------------------
 * Two honesty constraints govern this file.
 *
 * (a) **Nothing here files anything.** `HRMS_WORKFLOW_DELIVERY.md` §51 states
 *     that a stored payment or filing acknowledgement records an independently
 *     completed action; it does not initiate a transfer or government
 *     submission. So `file` records that a person filed, and `accept` records
 *     that the authority issued an acknowledgement somewhere else. No return is
 *     transmitted by this system. `EXTERNAL_FILING_DISCLAIMER` is the sentence
 *     the screen shows; it is exported so the wording cannot drift.
 *
 * (b) **An absent remitted amount is null, never zero.** `summariseRemittance`
 *     returns `totalMinor: null` when no filing carries an amount, and refuses
 *     to add amounts across currencies. This mirrors the rule in
 *     `src/server/payroll/reconciliation.ts`: a check with one missing side
 *     reports `indeterminate` rather than manufacturing assurance.
 *
 * ---------------------------------------------------------------------------
 * Where the remitted amount is stored, and why.
 *
 * `statutory_returns` is the canonical table for this, but it cannot be written
 * today: `statutory_form_id` is NOT NULL and references `statutory_forms`,
 * which holds zero rows and which nothing in this codebase ever inserts into.
 * `statutory_registrations` is blocked the same way by `statutory_rule_pack_id`.
 * Adding those tables' prerequisites is a migration, which is out of scope here.
 *
 * The remitted amount therefore lands in `vp_feature_records` — a real typed
 * table with a free-text `kind`, a jsonb `data` payload and a unique
 * `(tenant_id, kind, external_key)` index that makes one outcome per filing
 * idempotent by construction. The typed outcome columns that DO exist on
 * `vp_statutory_instances` (`filed_at`, `acknowledgement_ref`, `document_id`,
 * `status`) are updated alongside, so the generated form instance and the
 * filing tell the same story.
 *
 * This is the input `checkStatutoryVsRemittance` is missing. That check is in a
 * file this module does not own and is deliberately left untouched; the query
 * its loader would need is written out in `REMITTANCE_SOURCE_QUERY` below.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const FILING_RESOURCE = "filings";

const filingResource = operationalResources[FILING_RESOURCE];

/** The workflow's own actions, in the order a filing walks through them. */
export const FILING_ACTIONS = ["submit", "approve", "return", "reject", "cancel", "file", "accept"] as const;
export type FilingAction = (typeof FILING_ACTIONS)[number];

export const FILING_ACTION_LABELS: Record<FilingAction, string> = {
  submit: "Submit for approval",
  approve: "Approve",
  return: "Return for correction",
  reject: "Reject",
  cancel: "Cancel",
  file: "Record as filed",
  accept: "Record authority acknowledgement",
};

export type FilingTransition = { from: readonly string[]; to: string; approval: boolean };

/**
 * Read straight out of the operational catalogue rather than restated, so the
 * screen can never offer an action the API would refuse. A catalogue change
 * that removes an action fails loudly at import instead of silently drifting.
 */
function catalogueTransition(action: FilingAction): FilingTransition {
  const transition = filingResource.transitions[action];
  if (!transition) throw new Error(`The filings workflow no longer defines the "${action}" transition.`);
  return { from: transition.from, to: transition.to, approval: transition.approval === true };
}

export const FILING_TRANSITIONS: Record<FilingAction, FilingTransition> = {
  submit: catalogueTransition("submit"),
  approve: catalogueTransition("approve"),
  return: catalogueTransition("return"),
  reject: catalogueTransition("reject"),
  cancel: catalogueTransition("cancel"),
  file: catalogueTransition("file"),
  accept: catalogueTransition("accept"),
};

/** Every state a filing can hold, derived from the same catalogue. */
export const FILING_STATES: readonly string[] = [
  filingResource.initial,
  ...FILING_ACTIONS.flatMap((action) => [...FILING_TRANSITIONS[action].from, FILING_TRANSITIONS[action].to]),
].filter((state, index, all) => all.indexOf(state) === index);

/** States with no outgoing transition. A filing here is finished, not overdue. */
export const TERMINAL_FILING_STATES: readonly string[] = FILING_STATES.filter(
  (state) => !FILING_ACTIONS.some((action) => FILING_TRANSITIONS[action].from.includes(state)),
);

/** Closed without being filed. These never band as overdue. */
export const ABANDONED_FILING_STATES = ["cancelled", "rejected"] as const;

/** The filing has been recorded as filed with the authority. */
export const FILED_FILING_STATES = ["filed", "accepted"] as const;

/** An outcome (amount remitted, evidence, late reason) only exists once filed. */
export const OUTCOME_RECORDABLE_STATES: readonly string[] = FILED_FILING_STATES;

/** `vp_feature_records.kind` under which one outcome per filing is stored. */
export const REMITTANCE_KIND = "statutory_remittance";

/** Stable external key so a repeat record updates rather than duplicates. */
export function remittanceExternalKey(filingId: string): string {
  return `STATREMIT:${filingId}`;
}

/**
 * The exact read `checkStatutoryVsRemittance` needs for its `expected` side.
 * Exported as documentation; this module never runs it, and
 * `src/server/payroll/reconciliation.ts` is not changed here.
 */
export const REMITTANCE_SOURCE_QUERY =
  "select data->>'currency' as currency, sum((data->>'amountRemittedMinor')::bigint) as total_minor " +
  "from vp_feature_records where tenant_id = $1 and kind = 'statutory_remittance' " +
  "and data->>'period' = $2 and data ? 'amountRemittedMinor' and data->>'amountRemittedMinor' is not null " +
  "group by 1";

/**
 * The one sentence the screen must show about `file` and `accept`.
 * Delivery note: a stored filing acknowledgement records an independently
 * completed action; it does not initiate a government submission.
 */
export const EXTERNAL_FILING_DISCLAIMER =
  "Filing happens outside this system. Recording a filing stores what a person already completed with the authority, and recording an acknowledgement stores a reference the authority issued elsewhere. No return is transmitted from here.";

/** Said plainly when nothing has seeded a form catalogue. */
export const NO_FORM_CATALOGUE_NOTE =
  "No form catalogue is seeded in this environment, so the form code is whatever is recorded on the filing. Nothing here validates a code against a published list of statutory forms.";

/** A late filing needs a reason a reviewer can act on, not a word. */
export const LATE_REASON_MIN_LENGTH = 20;

/** How far ahead a due date counts as due soon. */
export const DUE_SOON_DAYS = 7;

export const DUE_BANDS = ["overdue", "due_soon", "scheduled", "filed", "closed", "unknown"] as const;
export type DueBand = (typeof DUE_BANDS)[number];

export const DUE_BAND_LABELS: Record<DueBand, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  scheduled: "Scheduled",
  filed: "Filed",
  closed: "Closed unfiled",
  unknown: "No due date",
};

// ---------------------------------------------------------------------------
// Pure helpers — no database, every one of these is unit-tested
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whole days since the epoch for a `YYYY-MM-DD` date, or null when the value is
 * missing or not a real calendar date. Deliberately date-only: a due date is a
 * calendar fact, and dragging a timezone into it would make the same filing
 * overdue in one place and not in another.
 */
export function epochDay(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const milliseconds = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(milliseconds)) return null;
  // Date.parse accepts 2026-02-31 and rolls it forward; reject that.
  const roundTrip = new Date(milliseconds).toISOString().slice(0, 10);
  return roundTrip === value ? Math.trunc(milliseconds / 86_400_000) : null;
}

/** Positive when the due date is still ahead, 0 on the due date, negative once past. */
export function daysUntilDue(dueDate: string | null | undefined, today: string): number | null {
  const due = epochDay(dueDate);
  const now = epochDay(today);
  return due === null || now === null ? null : due - now;
}

/** Days between the due date and the date a person says it was filed. */
export function lateByDays(dueDate: string | null | undefined, filedOn: string | null | undefined): number | null {
  const due = epochDay(dueDate);
  const filed = epochDay(filedOn);
  return due === null || filed === null ? null : filed - due;
}

/** Filed strictly after the due date. Filing on the due date is not late. */
export function isLateFiling(dueDate: string | null | undefined, filedOn: string | null | undefined): boolean {
  const late = lateByDays(dueDate, filedOn);
  return late !== null && late > 0;
}

/**
 * Which due-date band a filing sits in, from real dates and the workflow state.
 *
 * Order matters: a cancelled or rejected filing is closed, not overdue; a filing
 * the workflow already calls `filed`/`accepted` reads as filed even when no
 * outcome record carries the date yet; only then does the due date decide.
 */
export function dueBand(input: {
  status: string;
  dueDate: string | null | undefined;
  filedOn: string | null | undefined;
  today: string;
}): DueBand {
  if ((ABANDONED_FILING_STATES as readonly string[]).includes(input.status)) return "closed";
  if (epochDay(input.filedOn) !== null || (FILED_FILING_STATES as readonly string[]).includes(input.status)) return "filed";
  const days = daysUntilDue(input.dueDate, input.today);
  if (days === null) return "unknown";
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due_soon";
  return "scheduled";
}

export type FilingActionAvailability = {
  action: FilingAction;
  label: string;
  to: string;
  approval: boolean;
  allowed: boolean;
  /** Null only when the action is allowed. Never a blank button with no explanation. */
  reason: string | null;
};

function humanStates(states: readonly string[]): string {
  if (states.length === 0) return "no state";
  if (states.length === 1) return states[0];
  return `${states.slice(0, -1).join(", ")} or ${states[states.length - 1]}`;
}

/**
 * Every action with a verdict and, when refused, the reason to put on the
 * disabled control. The screen renders this list verbatim so no button is ever
 * shown live that the API would reject.
 */
export function filingActionAvailability(status: string): FilingActionAvailability[] {
  return FILING_ACTIONS.map((action) => {
    const transition = FILING_TRANSITIONS[action];
    const allowed = transition.from.includes(status);
    return {
      action,
      label: FILING_ACTION_LABELS[action],
      to: transition.to,
      approval: transition.approval,
      allowed,
      reason: allowed
        ? null
        : `A filing that is ${status} cannot be ${FILING_ACTION_LABELS[action].toLowerCase()}. This runs from ${humanStates(transition.from)}.`,
    };
  });
}

/** Whether the generated-form command can still usefully run for this filing. */
export function generateFormAvailability(input: { status: string; generatedFormId: string | null }): {
  allowed: boolean;
  reason: string | null;
} {
  if ((FILED_FILING_STATES as readonly string[]).includes(input.status)) {
    return {
      allowed: false,
      reason: "This filing is already recorded as filed. Regenerating the form would overwrite the instance the acknowledgement refers to.",
    };
  }
  if ((ABANDONED_FILING_STATES as readonly string[]).includes(input.status)) {
    return { allowed: false, reason: `This filing is ${input.status}; no further form generation applies.` };
  }
  return { allowed: true, reason: null };
}

export type FieldIssue = { field: string; issue: string };

/**
 * The late-filing rule lives here and nowhere else. `recordFilingOutcome`
 * refuses to write anything when this returns issues, so the rule cannot be
 * skipped by calling the service directly.
 */
export function validateFilingOutcome(input: {
  dueDate: string | null | undefined;
  filedOn: string;
  lateFilingReason?: string | null;
  amountRemittedMinor?: number | null;
}): FieldIssue[] {
  const issues: FieldIssue[] = [];
  if (epochDay(input.filedOn) === null) {
    issues.push({ field: "filedOn", issue: "Enter the date the filing was completed, as YYYY-MM-DD." });
  }
  const late = lateByDays(input.dueDate, input.filedOn);
  if (late !== null && late > 0) {
    const reason = (input.lateFilingReason ?? "").trim();
    if (reason.length < LATE_REASON_MIN_LENGTH) {
      issues.push({
        field: "lateFilingReason",
        issue: `This filing was completed ${late} day${late === 1 ? "" : "s"} after the due date. Enter at least ${LATE_REASON_MIN_LENGTH} characters explaining the delay.`,
      });
    }
  }
  const amount = input.amountRemittedMinor;
  if (amount !== null && amount !== undefined && (!Number.isSafeInteger(amount) || amount < 0)) {
    issues.push({
      field: "amountRemittedMinor",
      issue: "The amount remitted must be a whole number of minor units and cannot be negative.",
    });
  }
  return issues;
}

export type RemittanceFact = {
  filingId: string;
  period: string;
  /** Null when the person recording the filing did not state an amount. */
  amountRemittedMinor: number | null;
  currency: string;
};

export type RemittanceSummary = {
  /** Null when nothing recorded an amount, or when currencies cannot be added. */
  totalMinor: number | null;
  currency: string | null;
  recordedCount: number;
  missingCount: number;
  mixedCurrency: boolean;
  reason: string | null;
};

/**
 * Total remitted, or an honest null. Never returns 0 to stand in for "nobody
 * told us" — a zero would read as "nothing was owed", which is a different and
 * much stronger claim.
 */
export function summariseRemittance(records: readonly RemittanceFact[]): RemittanceSummary {
  const recorded = records.filter((record) => record.amountRemittedMinor !== null);
  const missingCount = records.length - recorded.length;
  const currencies = [...new Set(recorded.map((record) => record.currency))];
  if (recorded.length === 0) {
    return {
      totalMinor: null,
      currency: null,
      recordedCount: 0,
      missingCount,
      mixedCurrency: false,
      reason:
        missingCount === 0
          ? "No filing outcome has been recorded yet, so no remitted amount exists to total."
          : `${missingCount} recorded filing${missingCount === 1 ? "" : "s"} carr${missingCount === 1 ? "ies" : "y"} no remitted amount.`,
    };
  }
  if (currencies.length > 1) {
    return {
      totalMinor: null,
      currency: null,
      recordedCount: recorded.length,
      missingCount,
      mixedCurrency: true,
      reason: `Amounts were recorded in ${currencies.sort().join(", ")}. Amounts in different currencies are not added together.`,
    };
  }
  return {
    totalMinor: recorded.reduce((total, record) => total + (record.amountRemittedMinor ?? 0), 0),
    currency: currencies[0],
    recordedCount: recorded.length,
    missingCount,
    mixedCurrency: false,
    reason: missingCount === 0 ? null : `${missingCount} filing${missingCount === 1 ? "" : "s"} carr${missingCount === 1 ? "ies" : "y"} no remitted amount and ${missingCount === 1 ? "is" : "are"} excluded from this total.`,
  };
}

// ---------------------------------------------------------------------------
// Request shapes
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(ISO_DATE, "Use YYYY-MM-DD.");

export const recordFilingOutcomeSchema = z.object({
  filingId: z.string().uuid(),
  filedOn: isoDate,
  acknowledgementNumber: z.string().trim().min(1).max(160).optional(),
  /** Integer minor units. Omitted means "not stated", which stays null. */
  amountRemittedMinor: z.number().int().min(0).max(9_999_999_999_999).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.").default("INR"),
  challanReference: z.string().trim().min(1).max(160).optional(),
  authority: z.string().trim().min(1).max(200).optional(),
  evidenceDocumentId: z.string().uuid().optional(),
  lateFilingReason: z.string().trim().max(1000).optional(),
});

export type RecordFilingOutcomeInput = z.infer<typeof recordFilingOutcomeSchema>;

// ---------------------------------------------------------------------------
// Read model
// ---------------------------------------------------------------------------

export type GeneratedFormRef = {
  id: string;
  formCode: string;
  stateCode: string;
  period: string;
  status: string;
  templateVersion: number;
  employeeId: string | null;
  locationId: string | null;
  documentId: string | null;
  filedAt: string | null;
  acknowledgementRef: string | null;
};

export type FilingOutcome = {
  id: string;
  filedOn: string | null;
  lateByDays: number | null;
  late: boolean;
  acknowledgementNumber: string | null;
  amountRemittedMinor: number | null;
  currency: string;
  challanReference: string | null;
  authority: string | null;
  evidenceDocumentId: string | null;
  lateFilingReason: string | null;
  recordedAt: string | null;
};

export type FilingRegisterRow = {
  id: string;
  version: number;
  status: string;
  formCode: string;
  stateCode: string;
  period: string;
  dueDate: string | null;
  owner: string;
  notes: string | null;
  generatedFormId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  form: GeneratedFormRef | null;
  outcome: FilingOutcome | null;
  band: DueBand;
  daysUntilDue: number | null;
  lateByDays: number | null;
  actions: FilingActionAvailability[];
  generate: { allowed: boolean; reason: string | null };
};

export type StatutoryRegister = {
  asOf: string;
  scope: "all" | "self" | "team";
  scopeNote: string | null;
  items: FilingRegisterRow[];
  bandCounts: Record<DueBand, number>;
  remittance: RemittanceSummary;
  /** Generated instances not yet attached to any filing — the pool to raise from. */
  unlinkedForms: GeneratedFormRef[];
  formCatalogue: { seeded: boolean; codes: string[]; note: string };
  disclaimer: string;
};

type RecordRow = { record: Record<string, unknown> };
type InstanceRow = {
  id: string;
  form_code: string;
  state_code: string;
  period: string;
  status: string;
  template_version: number;
  employee_id: string | null;
  location_id: string | null;
  document_id: string | null;
  filed_at: string | null;
  acknowledgement_ref: string | null;
};
type OutcomeRow = { id: string; reference_id: string | null; data: Record<string, unknown>; created_at: string | null; updated_at: string | null };

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function readInstance(row: InstanceRow): GeneratedFormRef {
  return {
    id: row.id,
    formCode: row.form_code,
    stateCode: row.state_code,
    period: row.period,
    status: row.status,
    templateVersion: Number(row.template_version),
    employeeId: row.employee_id,
    locationId: row.location_id,
    documentId: row.document_id,
    filedAt: row.filed_at === null ? null : String(row.filed_at),
    acknowledgementRef: row.acknowledgement_ref,
  };
}

function readOutcome(row: OutcomeRow, dueDate: string | null): FilingOutcome {
  const filedOn = optionalText(row.data.filedOn);
  const late = lateByDays(dueDate, filedOn);
  return {
    id: row.id,
    filedOn,
    lateByDays: late,
    late: late !== null && late > 0,
    acknowledgementNumber: optionalText(row.data.acknowledgementNumber),
    amountRemittedMinor: optionalInt(row.data.amountRemittedMinor),
    currency: text(row.data.currency, "INR"),
    challanReference: optionalText(row.data.challanReference),
    authority: optionalText(row.data.authority),
    evidenceDocumentId: optionalText(row.data.evidenceDocumentId),
    lateFilingReason: optionalText(row.data.lateFilingReason),
    recordedAt: row.updated_at === null ? (row.created_at === null ? null : String(row.created_at)) : String(row.updated_at),
  };
}

/** Today in UTC. Bands are calendar facts, so the server decides them once. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The whole register in one read: filings, the generated form each points at,
 * the recorded outcome, and the due-date banding for all of them.
 */
export async function loadStatutoryRegister(access: Access): Promise<StatutoryRegister> {
  const scope = operationalScope(access, filingResource.permission, "read");
  const employeeId = access.context.employeeId ?? null;
  const [filingRows, instanceRows, outcomeRows, formRows] = await tenantTx(access, [
    sqlClient`
      select data || jsonb_build_object('id', id, 'status', status, 'version', version, 'createdAt', created_at, 'updatedAt', updated_at) as record
      from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = ${FILING_RESOURCE}
        and (${scope} = 'all' or employee_id = ${employeeId}::uuid)
      order by created_at desc, id desc limit 200
    `,
    sqlClient`
      select id, form_code, state_code, period, status, template_version, employee_id, location_id, document_id, filed_at, acknowledgement_ref
      from vp_statutory_instances where tenant_id = ${access.tenantId}
      order by created_at desc limit 200
    `,
    sqlClient`
      select id, reference_id, data, created_at, updated_at
      from vp_feature_records where tenant_id = ${access.tenantId} and kind = ${REMITTANCE_KIND}
      order by created_at desc limit 200
    `,
    sqlClient`select attributes from statutory_forms order by created_at limit 50`,
  ]);

  const instances = new Map((instanceRows as InstanceRow[]).map((row) => [row.id, readInstance(row)]));
  const outcomes = new Map<string, OutcomeRow>();
  for (const row of outcomeRows as OutcomeRow[]) {
    const key = row.reference_id ?? optionalText(row.data.filingId);
    if (key && !outcomes.has(key)) outcomes.set(key, row);
  }

  const asOf = todayIso();
  const linkedFormIds = new Set<string>();
  const items = (filingRows as RecordRow[]).map((row) => {
    const record = row.record;
    const id = text(record.id);
    const status = text(record.status, filingResource.initial);
    const dueDate = optionalText(record.dueDate);
    const generatedFormId = optionalText(record.generatedFormId);
    if (generatedFormId) linkedFormIds.add(generatedFormId);
    const outcomeRow = outcomes.get(id) ?? null;
    const outcome = outcomeRow === null ? null : readOutcome(outcomeRow, dueDate);
    return {
      id,
      version: Number(record.version ?? 1),
      status,
      formCode: text(record.formCode, "—"),
      stateCode: text(record.stateCode, "—"),
      period: text(record.period, "—"),
      dueDate,
      owner: text(record.owner, "—"),
      notes: optionalText(record.notes),
      generatedFormId,
      createdAt: record.createdAt === undefined || record.createdAt === null ? null : String(record.createdAt),
      updatedAt: record.updatedAt === undefined || record.updatedAt === null ? null : String(record.updatedAt),
      form: generatedFormId ? instances.get(generatedFormId) ?? null : null,
      outcome,
      band: dueBand({ status, dueDate, filedOn: outcome?.filedOn ?? null, today: asOf }),
      daysUntilDue: daysUntilDue(dueDate, asOf),
      lateByDays: outcome?.lateByDays ?? null,
      actions: filingActionAvailability(status),
      generate: generateFormAvailability({ status, generatedFormId }),
    } satisfies FilingRegisterRow;
  });

  const bandCounts = Object.fromEntries(DUE_BANDS.map((band) => [band, 0])) as Record<DueBand, number>;
  for (const item of items) bandCounts[item.band] += 1;

  const codes = (formRows as Array<{ attributes: Record<string, unknown> }>)
    .map((row) => text(row.attributes?.code))
    .filter((code) => code.length > 0);

  return {
    asOf,
    scope,
    scopeNote:
      scope === "all"
        ? null
        : "Your role sees only its own operational records. Filings are not raised against an employee, so none are visible under this scope.",
    items,
    bandCounts,
    remittance: summariseRemittance(
      items
        .filter((item) => item.outcome !== null)
        .map((item) => ({
          filingId: item.id,
          period: item.period,
          amountRemittedMinor: item.outcome?.amountRemittedMinor ?? null,
          currency: item.outcome?.currency ?? "INR",
        })),
    ),
    unlinkedForms: [...instances.values()].filter((instance) => !linkedFormIds.has(instance.id)),
    formCatalogue: { seeded: codes.length > 0, codes, note: NO_FORM_CATALOGUE_NOTE },
    disclaimer: EXTERNAL_FILING_DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export type RecordedFilingOutcome = {
  id: string;
  filingId: string;
  filedOn: string;
  late: boolean;
  lateByDays: number | null;
  amountRemittedMinor: number | null;
  currency: string;
  generatedFormId: string | null;
};

/**
 * Record what a person did outside this system: the date they filed, the
 * acknowledgement the authority gave them, the evidence they kept, and the
 * amount they remitted. Nothing here contacts an authority.
 *
 * Refuses unless the filing is already `filed` or `accepted` — the outcome is a
 * statement about a completed act, so it cannot be written for a filing that
 * has not been recorded as filed through the workflow.
 */
export async function recordFilingOutcome(
  access: Access,
  input: RecordFilingOutcomeInput,
  requestId: string,
): Promise<RecordedFilingOutcome> {
  operationalScope(access, filingResource.permission, "approve");

  const [filingRows] = await tenantTx(access, [
    sqlClient`
      select id, status, data from hrms_operation_records
      where tenant_id = ${access.tenantId} and resource = ${FILING_RESOURCE} and id = ${input.filingId} limit 1
    `,
  ]);
  const filing = (filingRows as Array<{ id: string; status: string; data: Record<string, unknown> }>)[0];
  if (!filing) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "That filing was not found." });

  if (!OUTCOME_RECORDABLE_STATES.includes(filing.status)) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `A filing outcome records a completed act, so it can only be written once the filing is ${humanStates(OUTCOME_RECORDABLE_STATES)}. This filing is ${filing.status}.`,
      details: [{ field: "filingId", issue: `Record the filing through the workflow first; it is currently ${filing.status}.` }],
    });
  }

  const dueDate = optionalText(filing.data.dueDate);
  const issues = validateFilingOutcome({
    dueDate,
    filedOn: input.filedOn,
    lateFilingReason: input.lateFilingReason ?? null,
    amountRemittedMinor: input.amountRemittedMinor ?? null,
  });
  if (issues.length > 0) {
    throw new HttpError({
      status: 422,
      code: issues.some((issue) => issue.field === "lateFilingReason") ? "LATE_FILING_REASON_REQUIRED" : "POLICY_VIOLATION",
      message: issues[0].issue,
      details: issues,
    });
  }

  if (input.evidenceDocumentId) {
    const [documentRows] = await tenantTx(access, [
      sqlClient`select id from documents where tenant_id = ${access.tenantId} and id = ${input.evidenceDocumentId} limit 1`,
    ]);
    if ((documentRows as unknown[]).length === 0) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "That evidence document does not exist in this workspace.",
        details: [{ field: "evidenceDocumentId", issue: "Upload the evidence to the document vault first, then record its id." }],
      });
    }
  }

  const generatedFormId = optionalText(filing.data.generatedFormId);
  const late = lateByDays(dueDate, input.filedOn);
  const payload = {
    filingId: filing.id,
    formCode: text(filing.data.formCode),
    stateCode: text(filing.data.stateCode),
    period: text(filing.data.period),
    generatedFormId,
    dueDate,
    filedOn: input.filedOn,
    lateByDays: late,
    late: late !== null && late > 0,
    acknowledgementNumber: input.acknowledgementNumber ?? null,
    // Absent stays absent. A zero here would assert that nothing was owed.
    amountRemittedMinor: input.amountRemittedMinor ?? null,
    currency: input.currency,
    challanReference: input.challanReference ?? null,
    authority: input.authority ?? null,
    evidenceDocumentId: input.evidenceDocumentId ?? null,
    lateFilingReason: input.lateFilingReason ?? null,
  };

  const externalKey = remittanceExternalKey(filing.id);
  const statements = [
    sqlClient`
      insert into vp_feature_records (tenant_id, kind, reference_id, external_key, status, effective_on, data, created_by_membership_id)
      values (${access.tenantId}, ${REMITTANCE_KIND}, ${filing.id}, ${externalKey}, 'recorded', ${input.filedOn}::date,
        ${JSON.stringify(payload)}::jsonb, ${access.context.membershipId})
      on conflict (tenant_id, kind, external_key) where external_key is not null
      do update set status = excluded.status, effective_on = excluded.effective_on, data = excluded.data, updated_at = now()
      returning id
    `,
  ];
  if (generatedFormId) {
    // The typed outcome columns that already exist on the generated instance, so
    // the form and the filing tell the same story. `status` is constrained to
    // generated/reviewed/filed/rejected, so 'filed' is the only value that fits.
    statements.push(sqlClient`
      update vp_statutory_instances set
        status = 'filed',
        filed_at = coalesce(filed_at, ${input.filedOn}::timestamptz),
        acknowledgement_ref = coalesce(${input.acknowledgementNumber ?? null}, acknowledgement_ref),
        document_id = coalesce(${input.evidenceDocumentId ?? null}::uuid, document_id),
        updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${generatedFormId}::uuid
    `);
  }
  const results = await tenantTx(access, statements);
  const id = (results[0] as Array<{ id: string }>)[0]?.id;
  if (!id) throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "The filing outcome could not be stored. Refresh and retry." });

  await recordAudit(access, {
    action: "compliance.filing_outcome_recorded",
    entityType: "hrms_operation",
    entityId: filing.id,
    reason: payload.late ? `Filed ${late} day(s) after the due date` : "Filing outcome recorded",
    after: payload,
    requestId,
  });

  return {
    id,
    filingId: filing.id,
    filedOn: input.filedOn,
    late: payload.late,
    lateByDays: late,
    amountRemittedMinor: payload.amountRemittedMinor,
    currency: input.currency,
    generatedFormId,
  };
}
