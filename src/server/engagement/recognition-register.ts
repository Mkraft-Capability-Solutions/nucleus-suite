import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { publishAnnouncement } from "@/server/engagement/service";

/**
 * SCR-065 — Recognition register (FRM-EXP-02, process EXP-01).
 *
 * A recognition award is a nomination that a committee decides, an
 * announcement that references the decision, and — only when the programme
 * carries a monetary component — a reward transaction that records a payment
 * somebody already made. Those four facts are the four states.
 *
 * What this module deliberately does NOT do:
 *
 *  - It never invents a programme ceiling or a default award. Both are
 *    configuration on the `recognition_programs` record. No programme master is
 *    seeded anywhere in this repository and the workbook states no figure, so
 *    where the ceiling is absent the register reports "not configured" and
 *    enforces no limit. See `PROGRAMME_CONFIGURATION_NOTE`.
 *  - Marking an award paid writes a `reward_transactions` row. It raises no
 *    payroll input and contacts no bank. It records a payment completed outside
 *    this system, exactly as the statutory filing and bank disbursement screens
 *    do. See `PAYMENT_EFFECT`.
 *  - It never mixes referrals into the register. `referrals` and
 *    `referral_awards` are a separate process with their own bounty; a
 *    requisition code is not a recognition programme.
 */

/* ------------------------------------------------------------------ */
/* Rules stated as data                                                */
/* ------------------------------------------------------------------ */

/** FRM-EXP-02: the citation is mandatory and prints on the certificate. */
export const CITATION_MIN_LENGTH = 50;

export const PROGRAMME_CONFIGURATION_NOTE = {
  summary: "The award ceiling and the default award are programme configuration, not code.",
  detail:
    "This system seeds no recognition programme master and the workbook states no figure. Where a programme record carries an award ceiling the register enforces it; where it does not, the ceiling is reported as not configured and NO limit is applied. Nothing here invents an amount.",
} as const;

export const PAYMENT_EFFECT = {
  does:
    "Marking an award paid writes one reward transaction against it, with the amount, the currency, the payment reference and the date, and one audit row.",
  doesNot:
    "It moves no money. No payroll input is raised, no bank instruction is produced and no disbursement batch is touched. Nothing in this system pays a recognition award, so this records a payment somebody already completed outside it — the reference you enter is the evidence of that payment.",
} as const;

export const ANNOUNCEMENT_EFFECT = {
  does:
    "RL-492 / EXP-01.4: approving an award publishes an announcement that references it. The announcement is written through the existing announcement service as a `star` feed post, and its id is stored on the award so the register can link the two.",
  editorialOverride:
    "The approver may replace the generated headline and body, choose the audience, or hold the announcement back entirely. An award held back stays Approved and can be published later; it never shows as Published without a real feed post behind it.",
} as const;

export type RecognitionState = "nominated" | "approved" | "published" | "paid" | "rejected";

export const RECOGNITION_STATES: readonly RecognitionState[] = ["nominated", "approved", "published", "paid", "rejected"];

export type RecognitionAction = "approve" | "reject" | "publish" | "mark_paid";

export const RECOGNITION_TRANSITIONS: Record<
  RecognitionAction,
  { from: readonly RecognitionState[]; to: RecognitionState; label: string; effect: string; requiresReason: boolean }
> = {
  approve: {
    from: ["nominated"],
    to: "approved",
    label: "Approve award",
    effect: `Records the committee decision. ${ANNOUNCEMENT_EFFECT.does}`,
    requiresReason: false,
  },
  reject: {
    from: ["nominated"],
    to: "rejected",
    label: "Reject",
    effect: "Closes the nomination with no award. A reason is mandatory and is stored on the award and in the audit trail.",
    requiresReason: true,
  },
  publish: {
    from: ["approved"],
    to: "published",
    label: "Publish announcement",
    effect: "Publishes the announcement for an approved award that was held back at the decision.",
    requiresReason: false,
  },
  mark_paid: {
    from: ["published"],
    to: "paid",
    label: "Mark paid",
    effect: `${PAYMENT_EFFECT.does} ${PAYMENT_EFFECT.doesNot}`,
    requiresReason: false,
  },
};

export const RECOGNITION_ACTIONS: readonly RecognitionAction[] = ["approve", "reject", "publish", "mark_paid"];

/** The next state for an action, or null when the transition is illegal. */
export function recognitionTransition(current: RecognitionState, action: RecognitionAction): RecognitionState | null {
  const transition = RECOGNITION_TRANSITIONS[action];
  if (!transition) return null;
  return transition.from.includes(current) ? transition.to : null;
}

/* ------------------------------------------------------------------ */
/* Programme configuration                                             */
/* ------------------------------------------------------------------ */

export type ProgrammeConfig = {
  id: string;
  code: string | null;
  name: string;
  currency: string;
  /** Integer minor units, or null when the tenant has configured no ceiling. */
  awardCeilingMinor: number | null;
  ceilingConfigured: boolean;
  /** Integer minor units, or null when the programme carries no default award. */
  defaultAwardMinor: number | null;
  defaultConfigured: boolean;
  nominationOpensOn: string | null;
  nominationClosesOn: string | null;
  windowConfigured: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readDate(value: unknown): string | null {
  const text = readText(value);
  return text !== null && DATE_PATTERN.test(text) ? text : null;
}

/** Non-negative integer minor units, or null when the key is absent or unusable. */
function readMinor(...values: readonly unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

/**
 * Read a programme's configuration from its `attributes` envelope. Every figure
 * is optional: a missing ceiling is reported as missing, never defaulted.
 */
export function readProgrammeConfig(id: string, attributes: Record<string, unknown>): ProgrammeConfig {
  const ceiling = readMinor(attributes.award_ceiling_minor, attributes.awardCeilingMinor, attributes.ceiling_minor);
  const fallback = readMinor(attributes.default_award_minor, attributes.defaultAwardMinor);
  const opensOn = readDate(attributes.nomination_opens_on ?? attributes.nominationOpensOn ?? attributes.starts_on);
  const closesOn = readDate(attributes.nomination_closes_on ?? attributes.nominationClosesOn ?? attributes.ends_on);
  const currency = readText(attributes.currency);
  return {
    id,
    code: readText(attributes.code),
    name: readText(attributes.name) ?? "Recognition programme",
    currency: currency !== null && /^[A-Z]{3}$/.test(currency) ? currency : "INR",
    awardCeilingMinor: ceiling,
    ceilingConfigured: ceiling !== null,
    defaultAwardMinor: fallback,
    defaultConfigured: fallback !== null,
    nominationOpensOn: opensOn,
    nominationClosesOn: closesOn,
    windowConfigured: opensOn !== null || closesOn !== null,
  };
}

export type NominationWindowState = "not_configured" | "not_yet_open" | "open" | "closed";

/**
 * EXP-01: the nomination period must be an open nomination window. A programme
 * with no window configured returns `not_configured`, and nothing is refused on
 * the strength of a window nobody set.
 */
export function nominationWindowState(programme: ProgrammeConfig, today: string): NominationWindowState {
  if (!programme.windowConfigured) return "not_configured";
  if (programme.nominationOpensOn !== null && today < programme.nominationOpensOn) return "not_yet_open";
  if (programme.nominationClosesOn !== null && today > programme.nominationClosesOn) return "closed";
  return "open";
}

/* ------------------------------------------------------------------ */
/* Nomination validation                                               */
/* ------------------------------------------------------------------ */

export type ValidationIssue = { field: string; issue: string };

export type NominationInput = {
  nominatorEmployeeId: string | null;
  recipientEmployeeId: string;
  citation: string;
  /** Integer minor units, or null when the nomination carries no money (RL-490). */
  awardMinor: number | null;
  periodStart: string;
  periodEnd: string;
};

export type NominationContext = {
  /** True when the nominee holds an active assignment in this tenant. */
  recipientActive: boolean;
  programme: ProgrammeConfig | null;
  today: string;
};

export type NominationCheck = {
  issues: ValidationIssue[];
  ok: boolean;
  /** False when the programme configures no ceiling, so no limit was applied. */
  ceilingEnforced: boolean;
  /** False when the programme configures no window, so no period was refused. */
  windowEnforced: boolean;
};

/**
 * Every FRM-EXP-02 nomination rule, in one pure function the route and the page
 * both answer to. An unconfigured ceiling or window is reported, not invented.
 */
export function validateNomination(input: NominationInput, context: NominationContext): NominationCheck {
  const issues: ValidationIssue[] = [];
  const programme = context.programme;

  if (input.nominatorEmployeeId === null) {
    issues.push({ field: "nominator", issue: "Link this account to its employee profile before nominating anybody." });
  } else if (input.nominatorEmployeeId === input.recipientEmployeeId) {
    issues.push({ field: "nominee", issue: "Self-nomination is not allowed. Somebody else has to nominate you." });
  }

  if (!context.recipientActive) {
    issues.push({ field: "nominee", issue: "The nominee holds no active assignment. Only an actively assigned employee can be nominated." });
  }

  const citation = input.citation.trim();
  if (citation.length === 0) {
    issues.push({ field: "citation", issue: "The citation is mandatory. It prints on the certificate." });
  } else if (citation.length < CITATION_MIN_LENGTH) {
    issues.push({
      field: "citation",
      issue: `The citation must be at least ${CITATION_MIN_LENGTH} characters; it prints on the certificate. It is ${citation.length}.`,
    });
  }

  if (!DATE_PATTERN.test(input.periodStart) || !DATE_PATTERN.test(input.periodEnd)) {
    issues.push({ field: "period", issue: "A recognition award carries a period. Enter the period it covers as two dates (RL-490)." });
  } else if (input.periodEnd < input.periodStart) {
    issues.push({ field: "period", issue: "The period ends before it starts." });
  }

  let ceilingEnforced = false;
  let windowEnforced = false;

  if (programme === null) {
    issues.push({ field: "programme", issue: "Choose the recognition programme this award is made under." });
  } else {
    const window = nominationWindowState(programme, context.today);
    windowEnforced = window !== "not_configured";
    if (window === "not_yet_open") {
      issues.push({
        field: "programme",
        issue: `Nominations for ${programme.name} open on ${programme.nominationOpensOn}. Today is ${context.today}.`,
      });
    } else if (window === "closed") {
      issues.push({
        field: "programme",
        issue: `The nomination window for ${programme.name} closed on ${programme.nominationClosesOn}. Today is ${context.today}.`,
      });
    }

    ceilingEnforced = programme.ceilingConfigured;
    if (input.awardMinor !== null && programme.awardCeilingMinor !== null && input.awardMinor > programme.awardCeilingMinor) {
      issues.push({
        field: "awardValue",
        issue: `The award exceeds the ceiling configured for ${programme.name}: ${input.awardMinor} minor units against a ceiling of ${programme.awardCeilingMinor}.`,
      });
    }
  }

  if (input.awardMinor !== null && (!Number.isInteger(input.awardMinor) || input.awardMinor < 0)) {
    issues.push({ field: "awardValue", issue: "The award value must be a whole number of minor units." });
  }

  return { issues, ok: issues.length === 0, ceilingEnforced, windowEnforced };
}

/* ------------------------------------------------------------------ */
/* Action gating                                                       */
/* ------------------------------------------------------------------ */

export type RecognitionRecordState = {
  state: RecognitionState;
  nominatorEmployeeId: string | null;
  recipientEmployeeId: string | null;
  /** Integer minor units, or null when this award carries no monetary leg. */
  awardMinor: number | null;
  citationLength: number;
  announcementId: string | null;
  paymentRecorded: boolean;
};

export type RecognitionViewer = {
  employeeId: string | null;
  permissions: readonly string[];
};

export type RecognitionActionGate = {
  action: RecognitionAction;
  label: string;
  to: RecognitionState;
  requiresReason: boolean;
  allowed: boolean;
  /** What the action does when it is available, or exactly why it is refused. */
  reason: string;
};

function humanState(state: string): string {
  return state.replace(/_/g, " ");
}

function humanStates(states: readonly string[]): string {
  const labels = states.map(humanState);
  if (labels.length <= 1) return labels[0] ?? "no state";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/**
 * The refusal the server would produce, stated before the click. There is no
 * dedicated recognition-approval permission in this system: every recognition
 * write is `employee.write`, so committee separation is enforced on identity —
 * neither the nominator nor the nominee may decide the award.
 */
export function recognitionActionGates(record: RecognitionRecordState, viewer: RecognitionViewer): RecognitionActionGate[] {
  const canWrite = viewer.permissions.includes("employee.write");
  const isNominee = viewer.employeeId !== null && viewer.employeeId === record.recipientEmployeeId;
  const isNominator = viewer.employeeId !== null && viewer.employeeId === record.nominatorEmployeeId;

  return RECOGNITION_ACTIONS.map((action) => {
    const transition = RECOGNITION_TRANSITIONS[action];
    let reason = "";

    if (!transition.from.includes(record.state)) {
      reason = `${transition.label} is only possible from ${humanStates(transition.from)}. This award is ${humanState(record.state)}.`;
    } else if (!canWrite) {
      reason = `${transition.label} needs employee.write.`;
    } else if (viewer.employeeId === null) {
      reason = "Link this account to its employee profile before deciding a recognition award.";
    } else if ((action === "approve" || action === "reject") && isNominee) {
      reason = "Nobody may decide their own recognition award. Another member of the committee has to act on it.";
    } else if ((action === "approve" || action === "reject") && isNominator) {
      reason = "You raised this nomination, so you cannot also decide it. Another member of the committee has to act on it.";
    } else if (action === "approve" && record.citationLength < CITATION_MIN_LENGTH) {
      reason = `This award's citation is ${record.citationLength} characters, below the ${CITATION_MIN_LENGTH}-character minimum. It cannot be approved until the citation is fit to print on the certificate.`;
    } else if (action === "publish" && record.announcementId !== null) {
      reason = "An announcement is already published for this award.";
    } else if (action === "mark_paid" && (record.awardMinor === null || record.awardMinor <= 0)) {
      reason = "This award carries no monetary component, so there is nothing to record as paid (RL-490 makes the money optional).";
    } else if (action === "mark_paid" && record.paymentRecorded) {
      reason = "A reward transaction is already recorded against this award.";
    }

    return {
      action,
      label: transition.label,
      to: transition.to,
      requiresReason: transition.requiresReason,
      allowed: reason === "",
      reason: reason === "" ? transition.effect : reason,
    };
  });
}

/* ------------------------------------------------------------------ */
/* State timeline                                                      */
/* ------------------------------------------------------------------ */

export type RecognitionStageState = "done" | "current" | "pending" | "halted";

export type RecognitionTimelineStage = {
  id: RecognitionState;
  label: string;
  detail: string;
  state: RecognitionStageState;
};

const TIMELINE_STAGES: ReadonlyArray<{ id: RecognitionState; label: string; detail: string }> = [
  { id: "nominated", label: "Nominated", detail: "Raised against a programme with a citation and a period. Awaiting the committee." },
  { id: "approved", label: "Approved", detail: "The committee approved the award. The announcement may be held back for editing." },
  { id: "published", label: "Published", detail: "An announcement referencing this award exists in the feed (RL-492)." },
  { id: "paid", label: "Paid", detail: "A reward transaction records the monetary component as settled outside this system." },
];

/**
 * The award's own state timeline. `seen` carries the states the audit trail
 * already recorded, so an award that skipped straight through still shows it.
 */
export function recognitionTimeline(state: RecognitionState, seen: readonly RecognitionState[] = []): RecognitionTimelineStage[] {
  const currentIndex = TIMELINE_STAGES.findIndex((stage) => stage.id === state);
  const rejected = state === "rejected";
  return TIMELINE_STAGES.map((stage, index) => {
    const wasSeen = seen.includes(stage.id);
    let stageState: RecognitionStageState;
    if (index === currentIndex) stageState = "current";
    else if (currentIndex >= 0 && index < currentIndex) stageState = "done";
    else if (wasSeen) stageState = "done";
    else if (rejected) stageState = "halted";
    else stageState = "pending";
    return { id: stage.id, label: stage.label, detail: stage.detail, state: stageState };
  });
}

/* ------------------------------------------------------------------ */
/* Row projection                                                      */
/* ------------------------------------------------------------------ */

export type RecognitionAuditEntry = { action: string; reason: string | null; at: string };

export type RecognitionRegisterRaw = {
  id: string;
  version: number | string;
  created_at: string | Date;
  updated_at: string | Date | null;
  recipient_employee_id: string | null;
  nominator_employee_id: string | null;
  recognition_program_id: string | null;
  attributes: Record<string, unknown> | null;
  recipient_code: string | null;
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  recipient_designation: string | null;
  recipient_department: string | null;
  recipient_status: string | null;
  nominator_code: string | null;
  nominator_first_name: string | null;
  nominator_last_name: string | null;
  programme_attributes: Record<string, unknown> | null;
  recipient_has_assignment: boolean | null;
  announcement_id: string | null;
  announcement_attributes: Record<string, unknown> | null;
  announcement_created_at: string | Date | null;
  payment_id: string | null;
  payment_attributes: Record<string, unknown> | null;
  payment_created_at: string | Date | null;
  trail: unknown;
};

export type RecognitionRegisterRow = {
  id: string;
  version: number;
  state: RecognitionState;
  createdAt: string;
  updatedAt: string | null;
  nomineeEmployeeId: string | null;
  nomineeName: string | null;
  nomineeCode: string | null;
  nomineeDesignation: string | null;
  nomineeDepartment: string | null;
  nomineeEmploymentStatus: string | null;
  nomineeHasAssignmentRecord: boolean;
  nominatorEmployeeId: string | null;
  nominatorName: string | null;
  programme: ProgrammeConfig | null;
  programmeName: string;
  citation: string;
  citationLength: number;
  citationMeetsMinimum: boolean;
  /** Integer minor units, or null when this award carries no monetary leg. */
  awardMinor: number | null;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  decision: { outcome: "approved" | "rejected"; at: string | null; reason: string | null } | null;
  announcement: { id: string; title: string; body: string; audience: string; publishedAt: string | null } | null;
  payment: { id: string; amountMinor: number | null; currency: string; reference: string | null; paidOn: string | null; recordedAt: string | null } | null;
  /**
   * True when the row predates this register — a kudos post written by
   * `recognizeEmployee`, which stores only a free-text message and points and
   * carries no citation, programme ceiling, period or state.
   */
  legacyKudos: boolean;
  timeline: RecognitionTimelineStage[];
  audit: RecognitionAuditEntry[];
  actions: RecognitionActionGate[];
};

function timestamp(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function fullName(first: string | null, last: string | null): string | null {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name.length > 0 ? name : null;
}

function readState(value: unknown): RecognitionState {
  const text = typeof value === "string" ? value : "";
  return (RECOGNITION_STATES as readonly string[]).includes(text) ? (text as RecognitionState) : "nominated";
}

function readTrail(value: unknown): RecognitionAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
    return {
      action: typeof row.action === "string" ? row.action : "",
      reason: typeof row.reason === "string" ? row.reason : null,
      at: timestamp(typeof row.created_at === "string" ? row.created_at : null) ?? "",
    };
  });
}

/** The states the audit trail proves this award already reached. */
function seenStates(trail: readonly RecognitionAuditEntry[]): RecognitionState[] {
  const seen: RecognitionState[] = ["nominated"];
  for (const entry of trail) {
    if (entry.action === "engage.recognition_approve") seen.push("approved");
    if (entry.action === "engage.recognition_publish") seen.push("published");
    if (entry.action === "engage.recognition_paid") seen.push("paid");
  }
  return seen;
}

/** Pure projection of one register row, including its action gating. */
export function projectRecognitionRow(raw: RecognitionRegisterRaw, viewer: RecognitionViewer): RecognitionRegisterRow {
  const attributes = raw.attributes ?? {};
  const programme =
    raw.recognition_program_id !== null ? readProgrammeConfig(raw.recognition_program_id, raw.programme_attributes ?? {}) : null;

  const citationSource = readText(attributes.citation) ?? readText(attributes.message) ?? "";
  const citation = citationSource;
  const legacyKudos = readText(attributes.citation) === null && readText(attributes.message) !== null;

  const awardMinor = readMinor(attributes.award_minor, attributes.awardMinor);
  const currencyText = readText(attributes.currency);
  const currency = currencyText !== null && /^[A-Z]{3}$/.test(currencyText) ? currencyText : (programme?.currency ?? "INR");

  const decisionOutcome = readText(attributes.decision_outcome);
  const decision: RecognitionRegisterRow["decision"] =
    decisionOutcome === "approved" || decisionOutcome === "rejected"
      ? {
          outcome: decisionOutcome,
          at: readText(attributes.decision_at),
          reason: readText(attributes.decision_reason),
        }
      : null;

  const announcementAttributes = raw.announcement_attributes ?? {};
  const announcement =
    raw.announcement_id !== null
      ? {
          id: raw.announcement_id,
          title: readText(announcementAttributes.title) ?? "Recognition announcement",
          body: readText(announcementAttributes.body) ?? "",
          audience: readText(announcementAttributes.audience) ?? "all",
          publishedAt: timestamp(raw.announcement_created_at),
        }
      : null;

  const paymentAttributes = raw.payment_attributes ?? {};
  const payment =
    raw.payment_id !== null
      ? {
          id: raw.payment_id,
          amountMinor: readMinor(paymentAttributes.amount_minor, paymentAttributes.amountMinor),
          currency: readText(paymentAttributes.currency) ?? currency,
          reference: readText(paymentAttributes.payment_reference),
          paidOn: readDate(paymentAttributes.paid_on),
          recordedAt: timestamp(raw.payment_created_at),
        }
      : null;

  const trail = readTrail(raw.trail);
  const state = readState(attributes.state);
  const record: RecognitionRecordState = {
    state,
    nominatorEmployeeId: raw.nominator_employee_id,
    recipientEmployeeId: raw.recipient_employee_id,
    awardMinor,
    citationLength: citation.length,
    announcementId: raw.announcement_id,
    paymentRecorded: raw.payment_id !== null,
  };

  return {
    id: raw.id,
    version: Number(raw.version) || 1,
    state,
    createdAt: timestamp(raw.created_at) ?? "",
    updatedAt: timestamp(raw.updated_at),
    nomineeEmployeeId: raw.recipient_employee_id,
    nomineeName: fullName(raw.recipient_first_name, raw.recipient_last_name),
    nomineeCode: raw.recipient_code,
    nomineeDesignation: raw.recipient_designation,
    nomineeDepartment: raw.recipient_department,
    nomineeEmploymentStatus: raw.recipient_status,
    nomineeHasAssignmentRecord: raw.recipient_has_assignment === true,
    nominatorEmployeeId: raw.nominator_employee_id,
    nominatorName: fullName(raw.nominator_first_name, raw.nominator_last_name),
    programme,
    programmeName: programme?.name ?? "No programme linked",
    citation,
    citationLength: citation.length,
    citationMeetsMinimum: citation.length >= CITATION_MIN_LENGTH,
    awardMinor,
    currency,
    periodStart: readDate(attributes.period_start),
    periodEnd: readDate(attributes.period_end),
    decision,
    announcement,
    payment,
    legacyKudos,
    timeline: recognitionTimeline(state, seenStates(trail)),
    audit: trail,
    actions: recognitionActionGates(record, viewer),
  };
}

/* ------------------------------------------------------------------ */
/* Request contracts                                                   */
/* ------------------------------------------------------------------ */

const isoDate = z.string().regex(DATE_PATTERN, "Enter a date as YYYY-MM-DD.");
const currencyCode = z.string().regex(/^[A-Z]{3}$/, "Enter a three-letter currency code.");

export const recognitionRegisterQuery = z
  .object({
    state: z.enum(["nominated", "approved", "published", "paid", "rejected"]).optional(),
    programmeId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type RecognitionRegisterQuery = z.infer<typeof recognitionRegisterQuery>;

/**
 * EXP-02. The workbook's single `period` is the two dates this screen already carries, because
 * RL-490 makes an award cover a period rather than name a month. The committee decision and its
 * remarks are the approve and reject commands below, and `announce_on_publish` is
 * `publishAnnouncement` on the approval.
 */
export const nominateRecognitionSchema = z.object({
  action: z.literal("nominate"),
  recipientEmployeeId: z.string().uuid(),
  programmeId: z.string().uuid(),
  awardCategory: z.enum(picklistValues("PL_AWARD_CATEGORY")),
  citation: z.string().trim().min(1).max(4000),
  evidenceDocumentId: z.string().uuid().optional(),
  awardMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  nonMonetaryAward: z.string().trim().max(120).optional(),
  currency: currencyCode.optional(),
  periodStart: isoDate,
  periodEnd: isoDate,
});

export const approveRecognitionSchema = z.object({
  action: z.literal("approve"),
  recognitionEventId: z.string().uuid(),
  /** RL-492 publishes by default; the editorial override may hold it back. */
  publishAnnouncement: z.boolean().optional(),
  announcementTitle: z.string().trim().min(1).max(200).optional(),
  announcementBody: z.string().trim().min(1).max(5000).optional(),
  audience: z.string().trim().min(1).max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const rejectRecognitionSchema = z.object({
  action: z.literal("reject"),
  recognitionEventId: z.string().uuid(),
  reason: z.string().trim().min(10, "State why the committee rejected this nomination.").max(1000),
});

export const publishRecognitionSchema = z.object({
  action: z.literal("publish"),
  recognitionEventId: z.string().uuid(),
  announcementTitle: z.string().trim().min(1).max(200).optional(),
  announcementBody: z.string().trim().min(1).max(5000).optional(),
  audience: z.string().trim().min(1).max(120).optional(),
});

export const markRecognitionPaidSchema = z.object({
  action: z.literal("mark_paid"),
  recognitionEventId: z.string().uuid(),
  paymentReference: z.string().trim().min(1).max(120),
  paidOn: isoDate,
});

export const recognitionCommandSchema = z.discriminatedUnion("action", [
  nominateRecognitionSchema,
  approveRecognitionSchema,
  rejectRecognitionSchema,
  publishRecognitionSchema,
  markRecognitionPaidSchema,
]);

export type RecognitionCommand = z.infer<typeof recognitionCommandSchema>;

/* ------------------------------------------------------------------ */
/* Read model                                                          */
/* ------------------------------------------------------------------ */

export type RecognitionRegister = {
  items: RecognitionRegisterRow[];
  programmes: ProgrammeConfig[];
  nextCursor: string | null;
  count: number;
  viewerEmployeeId: string | null;
  canWrite: boolean;
  today: string;
  citationMinimum: number;
  programmeNote: typeof PROGRAMME_CONFIGURATION_NOTE;
  paymentEffect: typeof PAYMENT_EFFECT;
  announcementEffect: typeof ANNOUNCEMENT_EFFECT;
  /** True when at least one programme configures an award ceiling. */
  anyCeilingConfigured: boolean;
  /** True when anything at all writes `reward_transactions` other than this screen. */
  payrollPathAvailable: boolean;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function viewerEmployee(access: Access): Promise<string | null> {
  if (access.context.employeeId) return access.context.employeeId;
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
}

/**
 * The recognition register for the caller's tenant.
 *
 * Only `recognition_events` rows are returned. Referrals live in `referrals` /
 * `referral_awards` with their own bounty and their own workflow; a requisition
 * code is not a recognition programme, and mixing the two — as the reference
 * screen does — reports referral bounties as recognition awards.
 */
export async function loadRecognitionRegister(access: Access, query: RecognitionRegisterQuery): Promise<RecognitionRegister> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewerEmployeeId = await viewerEmployee(access);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const state = query.state ?? null;
  const programmeId = query.programmeId ?? null;
  const employeeId = query.employeeId ?? null;
  const search = `%${(query.search ?? "").slice(0, 100)}%`;

  const [programmeRows, eventRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes from recognition_programs
      where tenant_id = ${access.tenantId} and record_status = 'active'
      order by created_at desc limit 200
    `,
    sqlClient`
      select re.id, re.version, re.created_at, re.updated_at,
        re.recipient_employee_id, re.nominator_employee_id, re.recognition_program_id, re.attributes,
        rec.employee_code as recipient_code, rec.first_name as recipient_first_name, rec.last_name as recipient_last_name,
        rec.designation as recipient_designation, rec.department as recipient_department, rec.status as recipient_status,
        nom.employee_code as nominator_code, nom.first_name as nominator_first_name, nom.last_name as nominator_last_name,
        prog.attributes as programme_attributes,
        coalesce(assign.present, false) as recipient_has_assignment,
        fp.id as announcement_id, fp.attributes as announcement_attributes, fp.created_at as announcement_created_at,
        pay.id as payment_id, pay.attributes as payment_attributes, pay.created_at as payment_created_at,
        coalesce(audit.trail, '[]'::jsonb) as trail
      from recognition_events re
      left join employees rec on rec.tenant_id = re.tenant_id and rec.id = re.recipient_employee_id
      left join employees nom on nom.tenant_id = re.tenant_id and nom.id = re.nominator_employee_id
      left join recognition_programs prog on prog.tenant_id = re.tenant_id and prog.id = re.recognition_program_id
      left join lateral (
        select true as present
        from employments em
        join employee_assignments ea on ea.tenant_id = em.tenant_id and ea.employment_id = em.id and ea.record_status = 'active'
        where em.tenant_id = re.tenant_id and em.employee_id = re.recipient_employee_id
        limit 1
      ) assign on true
      left join feed_posts fp on fp.tenant_id = re.tenant_id and fp.id::text = re.attributes->>'announcement_id'
      left join lateral (
        select rt.id, rt.attributes, rt.created_at
        from reward_transactions rt
        where rt.tenant_id = re.tenant_id and rt.recognition_event_id = re.id
          and rt.record_status = 'active' and rt.reverses_transaction_id is null
        order by rt.created_at desc limit 1
      ) pay on true
      left join lateral (
        select jsonb_agg(to_jsonb(entry)) as trail from (
          select action, reason, created_at from audit_events
          where tenant_id = re.tenant_id and entity_type = 'recognition_event' and entity_id = re.id
          order by created_at desc limit 25
        ) entry
      ) audit on true
      where re.tenant_id = ${access.tenantId} and re.record_status = 'active'
        and (${state}::text is null or coalesce(re.attributes->>'state', 'nominated') = ${state})
        and (${programmeId}::uuid is null or re.recognition_program_id = ${programmeId}::uuid)
        and (${employeeId}::uuid is null or re.recipient_employee_id = ${employeeId}::uuid)
        and (
          ${search} = '%%'
          or coalesce(rec.employee_code, '') || ' ' || coalesce(rec.first_name, '') || ' ' || coalesce(rec.last_name, '')
             || ' ' || coalesce(prog.attributes->>'name', '') || ' ' || re.attributes::text ilike ${search}
        )
      order by re.created_at desc, re.id desc
      limit ${pageSize + 1} offset ${(page - 1) * pageSize}
    `,
  ]);

  const viewer: RecognitionViewer = { employeeId: viewerEmployeeId, permissions: access.context.permissions };
  const programmes = (programmeRows as Array<{ id: string; attributes: Record<string, unknown> | null }>).map((row) =>
    readProgrammeConfig(row.id, row.attributes ?? {}),
  );
  const projected = (eventRows as RecognitionRegisterRaw[]).map((row) => projectRecognitionRow(row, viewer));
  const items = projected.slice(0, pageSize);

  return {
    items,
    programmes,
    nextCursor: projected.length > pageSize ? Buffer.from(JSON.stringify({ page: page + 1 })).toString("base64url") : null,
    count: items.length,
    viewerEmployeeId,
    canWrite: access.context.permissions.includes("employee.write"),
    today: today(),
    citationMinimum: CITATION_MIN_LENGTH,
    programmeNote: PROGRAMME_CONFIGURATION_NOTE,
    paymentEffect: PAYMENT_EFFECT,
    announcementEffect: ANNOUNCEMENT_EFFECT,
    anyCeilingConfigured: programmes.some((programme) => programme.ceilingConfigured),
    // Nothing in this repository writes `reward_transactions` or raises a
    // payroll input for a recognition award. `recognitionPointsForSelf` reads
    // the table; no other module writes it. The screen states this plainly.
    payrollPathAvailable: false,
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

type EventFacts = {
  id: string;
  state: RecognitionState;
  recipientEmployeeId: string | null;
  nominatorEmployeeId: string | null;
  programme: ProgrammeConfig | null;
  citationLength: number;
  awardMinor: number | null;
  currency: string;
  announcementId: string | null;
  paymentRecorded: boolean;
  citation: string;
  nomineeName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

function notFound(): never {
  throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
}

async function loadEvent(access: Access, id: string): Promise<EventFacts> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select re.id, re.attributes, re.recipient_employee_id, re.nominator_employee_id, re.recognition_program_id,
        prog.attributes as programme_attributes,
        rec.first_name, rec.last_name,
        (select fp.id from feed_posts fp where fp.tenant_id = re.tenant_id and fp.id::text = re.attributes->>'announcement_id' limit 1) as announcement_id,
        (select rt.id from reward_transactions rt where rt.tenant_id = re.tenant_id and rt.recognition_event_id = re.id
          and rt.record_status = 'active' and rt.reverses_transaction_id is null limit 1) as payment_id
      from recognition_events re
      left join recognition_programs prog on prog.tenant_id = re.tenant_id and prog.id = re.recognition_program_id
      left join employees rec on rec.tenant_id = re.tenant_id and rec.id = re.recipient_employee_id
      where re.tenant_id = ${access.tenantId} and re.id = ${id} and re.record_status = 'active'
      limit 1
    `,
  ]);
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) notFound();
  const attributes = (row.attributes ?? {}) as Record<string, unknown>;
  const programmeId = typeof row.recognition_program_id === "string" ? row.recognition_program_id : null;
  const programme =
    programmeId !== null ? readProgrammeConfig(programmeId, (row.programme_attributes ?? {}) as Record<string, unknown>) : null;
  const citation = readText(attributes.citation) ?? readText(attributes.message) ?? "";
  const currencyText = readText(attributes.currency);
  return {
    id,
    state: readState(attributes.state),
    recipientEmployeeId: typeof row.recipient_employee_id === "string" ? row.recipient_employee_id : null,
    nominatorEmployeeId: typeof row.nominator_employee_id === "string" ? row.nominator_employee_id : null,
    programme,
    citation,
    citationLength: citation.length,
    awardMinor: readMinor(attributes.award_minor, attributes.awardMinor),
    currency: currencyText !== null && /^[A-Z]{3}$/.test(currencyText) ? currencyText : (programme?.currency ?? "INR"),
    announcementId: typeof row.announcement_id === "string" ? row.announcement_id : null,
    paymentRecorded: typeof row.payment_id === "string",
    nomineeName: fullName(
      typeof row.first_name === "string" ? row.first_name : null,
      typeof row.last_name === "string" ? row.last_name : null,
    ),
    periodStart: readDate(attributes.period_start),
    periodEnd: readDate(attributes.period_end),
  };
}

/** The gate a write must pass, refused with the same words the register shows. */
function assertAllowed(facts: EventFacts, viewer: RecognitionViewer, action: RecognitionAction): void {
  const gate = recognitionActionGates(
    {
      state: facts.state,
      nominatorEmployeeId: facts.nominatorEmployeeId,
      recipientEmployeeId: facts.recipientEmployeeId,
      awardMinor: facts.awardMinor,
      citationLength: facts.citationLength,
      announcementId: facts.announcementId,
      paymentRecorded: facts.paymentRecorded,
    },
    viewer,
  ).find((candidate) => candidate.action === action);
  if (!gate || gate.allowed) return;
  throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: gate.reason });
}

function mergeAttributes(id: string, access: Access, patch: Record<string, unknown>) {
  return sqlClient`
    update recognition_events
    set attributes = attributes || ${JSON.stringify(patch)}::jsonb, version = version + 1, updated_at = now()
    where tenant_id = ${access.tenantId} and id = ${id}
  `;
}

function auditRow(access: Access, action: string, id: string, reason: string, requestId: string) {
  return sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
      ${action}, 'recognition_event', ${id}, ${reason}, ${uuidOrNull(requestId)}::uuid)
  `;
}

function announcementCopy(facts: EventFacts, title?: string, body?: string) {
  const nominee = facts.nomineeName ?? "A colleague";
  const programme = facts.programme?.name ?? "the recognition programme";
  return {
    title: title ?? `${nominee} — ${programme}`,
    body: body ?? `${nominee} has been recognised under ${programme}.\n\n${facts.citation}`,
  };
}

async function publishFor(
  access: Access,
  facts: EventFacts,
  requestId: string,
  copy: { title?: string; body?: string; audience?: string },
): Promise<string> {
  const rendered = announcementCopy(facts, copy.title, copy.body);
  const announcement = await publishAnnouncement(
    access,
    {
      title: rendered.title,
      body: rendered.body,
      audience: copy.audience ?? "all",
      kind: "star",
    },
    requestId,
  );
  await tenantTx(access, [
    mergeAttributes(facts.id, access, { state: "published", announcement_id: announcement.id, published_at: new Date().toISOString() }),
    auditRow(access, "engage.recognition_publish", facts.id, `Announcement ${announcement.id} published for this award`, requestId),
  ]);
  return announcement.id;
}

export type RecognitionCommandResult = {
  id: string;
  state: RecognitionState;
  announcementId: string | null;
  rewardTransactionId: string | null;
  /** True when a rule was checked but no configuration existed to check it against. */
  notes: string[];
};

/**
 * Every recognition write. Nominations insert a `recognition_events` row with
 * the full FRM-EXP-02 envelope; decisions patch it; approval publishes an
 * announcement; marking paid writes a `reward_transactions` row.
 */
export async function executeRecognitionCommand(
  access: Access,
  command: RecognitionCommand,
  requestId: string,
): Promise<RecognitionCommandResult> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const viewerEmployeeId = await viewerEmployee(access);
  const viewer: RecognitionViewer = { employeeId: viewerEmployeeId, permissions: access.context.permissions };
  const notes: string[] = [];

  if (command.action === "nominate") {
    const [programmeRows, employeeRows] = await tenantTx(access, [
      sqlClient`select id, attributes from recognition_programs where tenant_id = ${access.tenantId} and id = ${command.programmeId} and record_status = 'active' limit 1`,
      sqlClient`
        select e.id, e.status,
          exists (
            select 1 from employments em
            join employee_assignments ea on ea.tenant_id = em.tenant_id and ea.employment_id = em.id and ea.record_status = 'active'
            where em.tenant_id = e.tenant_id and em.employee_id = e.id
          ) as has_assignment
        from employees e where e.tenant_id = ${access.tenantId} and e.id = ${command.recipientEmployeeId} limit 1
      `,
    ]);
    const programmeRow = (programmeRows as Array<{ id: string; attributes: Record<string, unknown> | null }>)[0];
    const employeeRow = (employeeRows as Array<{ id: string; status: string | null; has_assignment: boolean }>)[0];
    if (!employeeRow) notFound();

    const programme = programmeRow ? readProgrammeConfig(programmeRow.id, programmeRow.attributes ?? {}) : null;
    if (!programmeRow) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "That recognition programme does not exist in this tenant.",
        details: [{ field: "programme", issue: "Unknown recognition programme." }],
      });
    }

    const awardMinor =
      command.awardMinor === undefined || command.awardMinor === null
        ? (programme?.defaultAwardMinor ?? null)
        : command.awardMinor;

    const check = validateNomination(
      {
        nominatorEmployeeId: viewerEmployeeId,
        recipientEmployeeId: command.recipientEmployeeId,
        citation: command.citation,
        awardMinor,
        periodStart: command.periodStart,
        periodEnd: command.periodEnd,
      },
      { recipientActive: employeeRow.status === "active", programme, today: today() },
    );
    if (!check.ok) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: "This nomination does not satisfy the recognition rules.",
        details: check.issues,
      });
    }
    if (!check.ceilingEnforced && awardMinor !== null) {
      notes.push(`${programme?.name ?? "This programme"} configures no award ceiling, so no limit was applied to the award value.`);
    }
    if (!check.windowEnforced) {
      notes.push(`${programme?.name ?? "This programme"} configures no nomination window, so no period was refused.`);
    }
    if (!employeeRow.has_assignment) {
      notes.push("The nominee has no assignment record; the active check used the employee's employment status.");
    }

    const id = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        insert into recognition_events (id, tenant_id, nominator_employee_id, recipient_employee_id, recognition_program_id, attributes)
        values (${id}, ${access.tenantId}, ${viewerEmployeeId}, ${command.recipientEmployeeId}, ${command.programmeId},
          ${JSON.stringify({
            state: "nominated",
            award_category: command.awardCategory,
            citation: command.citation.trim(),
            evidence_document_id: command.evidenceDocumentId ?? null,
            non_monetary_award: command.nonMonetaryAward ?? null,
            award_minor: awardMinor,
            currency: command.currency ?? programme?.currency ?? "INR",
            period_start: command.periodStart,
            period_end: command.periodEnd,
            nominated_at: new Date().toISOString(),
            award_ceiling_minor_at_nomination: programme?.awardCeilingMinor ?? null,
          })}::jsonb)
      `,
      auditRow(access, "engage.recognition_nominate", id, "Recognition nomination raised", requestId),
    ]);
    return { id, state: "nominated", announcementId: null, rewardTransactionId: null, notes };
  }

  const facts = await loadEvent(access, command.recognitionEventId);

  if (command.action === "approve") {
    assertAllowed(facts, viewer, "approve");
    await tenantTx(access, [
      mergeAttributes(facts.id, access, {
        state: "approved",
        decision_outcome: "approved",
        decision_at: new Date().toISOString(),
        decision_reason: command.note ?? null,
      }),
      auditRow(access, "engage.recognition_approve", facts.id, command.note ?? "Recognition award approved", requestId),
    ]);

    // RL-492 / EXP-01.4: the announcement follows the approval automatically.
    // The editorial override is `publishAnnouncement: false`, which holds the
    // award at Approved so the copy can be edited and published deliberately.
    if (command.publishAnnouncement === false) {
      notes.push("The announcement was held back by the editorial override. This award stays Approved until it is published.");
      return { id: facts.id, state: "approved", announcementId: null, rewardTransactionId: null, notes };
    }
    const announcementId = await publishFor(access, { ...facts, state: "approved" }, requestId, {
      title: command.announcementTitle,
      body: command.announcementBody,
      audience: command.audience,
    });
    return { id: facts.id, state: "published", announcementId, rewardTransactionId: null, notes };
  }

  if (command.action === "reject") {
    assertAllowed(facts, viewer, "reject");
    await tenantTx(access, [
      mergeAttributes(facts.id, access, {
        state: "rejected",
        decision_outcome: "rejected",
        decision_at: new Date().toISOString(),
        decision_reason: command.reason,
      }),
      auditRow(access, "engage.recognition_reject", facts.id, command.reason, requestId),
    ]);
    return { id: facts.id, state: "rejected", announcementId: null, rewardTransactionId: null, notes };
  }

  if (command.action === "publish") {
    assertAllowed(facts, viewer, "publish");
    const announcementId = await publishFor(access, facts, requestId, {
      title: command.announcementTitle,
      body: command.announcementBody,
      audience: command.audience,
    });
    return { id: facts.id, state: "published", announcementId, rewardTransactionId: null, notes };
  }

  assertAllowed(facts, viewer, "mark_paid");
  if (facts.recipientEmployeeId === null) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This award has no nominee, so no reward transaction can be attributed." });
  }
  const transactionId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into reward_transactions (id, tenant_id, employee_id, recognition_event_id, attributes)
      values (${transactionId}, ${access.tenantId}, ${facts.recipientEmployeeId}, ${facts.id},
        ${JSON.stringify({
          amount_minor: facts.awardMinor,
          currency: facts.currency,
          payment_reference: command.paymentReference,
          paid_on: command.paidOn,
          recorded_outside_system: true,
        })}::jsonb)
    `,
    mergeAttributes(facts.id, access, { state: "paid", paid_on: command.paidOn, payment_reference: command.paymentReference }),
    auditRow(
      access,
      "engage.recognition_paid",
      facts.id,
      `Payment ${command.paymentReference} recorded as completed outside this system on ${command.paidOn}`,
      requestId,
    ),
  ]);
  notes.push(PAYMENT_EFFECT.doesNot);
  return { id: facts.id, state: "paid", announcementId: facts.announcementId, rewardTransactionId: transactionId, notes };
}
