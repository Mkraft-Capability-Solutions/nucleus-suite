import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import {
  REFERRAL_MILESTONE_KEYS,
  STAGE_LABELS,
  isTerminalStage,
  parseReferralAwardScheme,
  planReferralAward,
  tenureDaysFrom,
  type ReferralAwardPlan,
  type ReferralAwardScheme,
  type ReferralMilestone,
  type ReferralMilestoneKey,
} from "@/server/talent/pipeline";

/**
 * Read model for SCR-091 "Referral tracking".
 *
 * This module adds NO new award rule and NO second scheme model. RL-470/471 are
 * already modelled in `@/server/talent/pipeline`: `referralAwardSchemeSchema`
 * reads the per-programme configuration out of
 * `tenant_settings.settings->'referral_award_scheme'`, and `planReferralAward`
 * is the two-part maturation (part on joining, balance on confirmation) as a
 * pure function. Everything below either calls those, or states plainly what the
 * repository does not hold.
 *
 * What it deliberately refuses to do:
 *
 *   1. It never invents an amount. The reference screen shows a 25,000 bounty
 *      split 10,000 / 15,000 at 90 days. Those figures exist only in a demo
 *      string file; the workbook marks the amount, the split and the
 *      confirmation tenure as per-programme configuration and states no value,
 *      and no scheme master table exists. When the tenant has configured no
 *      scheme, every amount here is `null` - never `0`, which would read as
 *      "nothing due" - and the gap is named.
 *   2. It never copies the candidate's stage. The stage column is read from the
 *      linked `applications` row, which `@/server/talent/service` owns through
 *      STAGE_FLOW. `referrals.attributes` carries no stage and none is written.
 *   3. It never mixes recognition into the referral register. `recognition_events`
 *      is a different resource with a different screen; a citation is not a
 *      referral and a requisition code is not a recognition programme.
 */

// ---------------------------------------------------------------------------
// The five tracking states the screen names (SCR-091 options.states)
// ---------------------------------------------------------------------------

export const REFERRAL_TRACKING_STATES = [
  "referred",
  "screening",
  "interviewing",
  "hired",
  "awarded",
] as const;
export type ReferralTrackingState = (typeof REFERRAL_TRACKING_STATES)[number];

export const REFERRAL_TRACKING_STATE_LABELS: Record<ReferralTrackingState, string> = {
  referred: "Referred",
  screening: "Screening",
  interviewing: "Interviewing",
  hired: "Hired",
  awarded: "Awarded",
};

/**
 * Which of the nine pipeline stages each tracking state covers. The screen's
 * five states are a coarser grouping of the stage contract, not a second copy
 * of it: the stage itself always comes from the application.
 */
const TRACKING_STATE_STAGES: Record<Exclude<ReferralTrackingState, "awarded">, readonly string[]> = {
  referred: ["applied"],
  screening: ["screening", "shortlisted"],
  interviewing: ["interview", "background", "offer_review", "offered", "accepted"],
  hired: ["converted"],
};

export type ReferralTrackingStateInput = {
  /** The stage on the linked application, or null when the referral has no application. */
  applicationStage: string | null;
  /** True once any `referral_awards` row exists for this referral. */
  awarded: boolean;
  /** True once the referred candidate is linked to an employee record. */
  joined: boolean;
};

/**
 * The register's Status column.
 *
 * `awarded` outranks everything: a paid referral is reported as paid whatever
 * the application now says. Otherwise the state follows the application stage,
 * with employment as the fallback for a referral whose application row is
 * missing (a candidate can be hired through a path that never carried an
 * application id on the referral).
 */
export function referralTrackingState(input: ReferralTrackingStateInput): ReferralTrackingState {
  if (input.awarded) return "awarded";
  const stage = input.applicationStage;
  if (stage) {
    // A terminal stage is not one of the five states. It is reported through
    // `pipelineTerminal` and the stage label, never dressed up as progress.
    if (!isTerminalStage(stage)) {
      for (const state of ["hired", "interviewing", "screening", "referred"] as const) {
        if (TRACKING_STATE_STAGES[state].includes(stage)) return state;
      }
    }
  }
  if (input.joined) return "hired";
  return "referred";
}

// ---------------------------------------------------------------------------
// Award maturation (RL-471) - the five positions the screen must distinguish
// ---------------------------------------------------------------------------

export const AWARD_MATURATION_STATES = [
  "not_due",
  "part_paid_on_joining",
  "balance_pending_confirmation",
  "fully_matured",
  "forfeited",
] as const;
export type AwardMaturationState = (typeof AWARD_MATURATION_STATES)[number];

export const AWARD_MATURATION_LABELS: Record<AwardMaturationState, string> = {
  not_due: "Not yet due",
  part_paid_on_joining: "Part paid on joining",
  balance_pending_confirmation: "Balance pending confirmation",
  fully_matured: "Fully matured",
  forfeited: "Forfeited",
};

/**
 * The decision table, written out so the reading is not a matter of opinion.
 * The two legs each hold one of `pending | earned | disbursed` (or
 * `not_configured` when no scheme exists), which is nine combinations; these
 * five states partition them, and the per-leg truth stays visible on
 * `milestones` so nothing is hidden behind the summary word.
 *
 *   forfeited                    maturation ended before both legs were paid
 *   fully_matured                both legs disbursed
 *   part_paid_on_joining         joining leg disbursed, balance leg not
 *   balance_pending_confirmation joining leg earned but unpaid: the candidate
 *                                has joined and the award is now running
 *                                against the confirmation gate
 *   not_due                      the joining leg is not earned - the candidate
 *                                has not joined, so nothing is payable
 */
export type AwardMaturationInput = {
  plan: ReferralAwardPlan;
  /** Why maturation ended, when it has. Null when the referral is still live. */
  forfeitedReason: string | null;
};

export type AwardMaturation = {
  state: AwardMaturationState;
  label: string;
  /** The leg the award is waiting on, or null when nothing is outstanding. */
  outstandingMilestone: ReferralMilestoneKey | null;
  /** What that leg is waiting on, in the user's terms. */
  blockedBy: string | null;
  /** null whenever no scheme configures an amount. Never 0. */
  eligibleMinor: number | null;
  disbursedMinor: number | null;
  currency: string | null;
};

function milestoneOf(plan: ReferralAwardPlan, key: ReferralMilestoneKey): ReferralMilestone | null {
  return plan.milestones.find((milestone) => milestone.key === key) ?? null;
}

export function deriveAwardMaturation(input: AwardMaturationInput): AwardMaturation {
  const { plan } = input;
  const joining = milestoneOf(plan, "joining");
  const confirmation = milestoneOf(plan, "confirmation");
  const joiningDisbursed = joining?.state === "disbursed";
  const confirmationDisbursed = confirmation?.state === "disbursed";
  const joiningEarned = joiningDisbursed || joining?.state === "earned";

  const outstanding = plan.milestones.find((milestone) => milestone.state !== "disbursed") ?? null;
  const base = {
    outstandingMilestone: outstanding?.key ?? null,
    blockedBy: outstanding?.blockedBy ?? null,
    // `planReferralAward` already returns null for every amount when the scheme
    // is absent; `configured` is checked so an unconfigured tenant can never
    // fall through to a summed 0.
    eligibleMinor: plan.configured ? plan.eligibleMinor : null,
    disbursedMinor: plan.configured ? plan.disbursedMinor : null,
    currency: plan.currency,
  };

  if (joiningDisbursed && confirmationDisbursed) {
    return { state: "fully_matured", label: AWARD_MATURATION_LABELS.fully_matured, ...base };
  }
  if (input.forfeitedReason) {
    return {
      state: "forfeited",
      label: AWARD_MATURATION_LABELS.forfeited,
      ...base,
      blockedBy: input.forfeitedReason,
    };
  }
  if (joiningDisbursed) {
    return { state: "part_paid_on_joining", label: AWARD_MATURATION_LABELS.part_paid_on_joining, ...base };
  }
  if (joiningEarned) {
    return {
      state: "balance_pending_confirmation",
      label: AWARD_MATURATION_LABELS.balance_pending_confirmation,
      ...base,
    };
  }
  return { state: "not_due", label: AWARD_MATURATION_LABELS.not_due, ...base };
}

// ---------------------------------------------------------------------------
// The award action - what the button may do, and why it may not
// ---------------------------------------------------------------------------

/**
 * Both legs now have an endpoint. The statement is kept as a named constant because
 * the screen quotes it, and because a referral awarded before the milestone key
 * existed still reads as the joining leg - see `disbursedMilestonesByReferral`.
 */
export const AWARD_ENDPOINT_POSTURE =
  "POST /api/v1/referrals/:id/award settles one leg per call, named by `milestone`. Each leg raises a `payroll_inputs` row for the referrer and links it back through `referral_awards.payroll_input_id`, so the payout reaches payroll as an input rather than a manual entry. The tenure threshold is the configured scheme's, never a number sent with the request.";

export type AwardActionInput = {
  maturation: AwardMaturation;
  scheme: ReferralAwardScheme | null;
  /** `referrals.attributes.status`: referred, part_awarded or awarded. */
  referralStatus: string;
  /** Completed tenure in days, or null when no joining date is recorded. */
  tenureDays: number | null;
};

export type AwardAction = {
  enabled: boolean;
  /** Why the action is unavailable. Null only when `enabled` is true. */
  reason: string | null;
  /** The exact body the award endpoint needs, or null when it cannot be stated. */
  request: { milestone: ReferralMilestoneKey; tenureDays: number; requiredDays: number } | null;
};

/**
 * The award button is offered only when every input it needs is real. It never
 * guesses `requiredDays`: that number is the configured confirmation tenure, and
 * with no scheme there is nothing to send.
 */
export function awardActionFor(input: AwardActionInput): AwardAction {
  const disabled = (reason: string): AwardAction => ({ enabled: false, reason, request: null });
  const scheme = input.scheme;

  if (!scheme) {
    return disabled(
      "The referral award scheme (amount, split and confirmation tenure) is not configured for this tenant, so no amount or tenure threshold can be stated.",
    );
  }
  if (input.maturation.state === "forfeited") {
    return disabled(input.maturation.blockedBy ?? "This referral can no longer mature.");
  }
  if (input.maturation.state === "fully_matured") {
    return disabled("Both legs of this award have already been paid.");
  }
  if (input.referralStatus === "awarded") {
    return disabled("Both legs of this award have already been processed.");
  }
  const outstanding = input.maturation.outstandingMilestone;
  if (!outstanding) return disabled("Nothing is outstanding on this award.");
  if (input.maturation.blockedBy) return disabled(input.maturation.blockedBy);
  if (input.tenureDays === null) {
    return disabled("No joining date is recorded for the referred candidate, so tenure cannot be evidenced to the award endpoint.");
  }
  return {
    enabled: true,
    reason: null,
    request: {
      milestone: outstanding,
      tenureDays: input.tenureDays,
      // What the endpoint will check this leg against. The joining leg is earned by
      // joining, not by tenure, so its threshold is zero; the confirmation leg's is
      // the scheme's own. The endpoint reads both from the scheme either way - this
      // is what the screen shows, not a figure the request gets to set.
      requiredDays: outstanding === "confirmation" ? scheme.confirmationTenureDays : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Forfeiture - derived from what the repository actually records
// ---------------------------------------------------------------------------

export type ForfeitureInput = {
  applicationStage: string | null;
  joined: boolean;
  /** `employees.status` for the linked employee, or null when none is linked. */
  employmentStatus: string | null;
};

/**
 * There is no forfeiture event anywhere in this repository: no column, no
 * status value, no audit action. The two signals below are the only evidence
 * that exists, and each is named on the row rather than asserted silently.
 */
export function forfeitureReason(input: ForfeitureInput): string | null {
  if (!input.joined && input.applicationStage && isTerminalStage(input.applicationStage)) {
    const label = STAGE_LABELS[input.applicationStage] ?? input.applicationStage;
    return `The application ended as "${label}" and the candidate never joined, so no leg of the award can mature.`;
  }
  if (input.joined && input.employmentStatus !== null && input.employmentStatus !== "active") {
    return `The referred employee's record is "${input.employmentStatus}", so the balance leg cannot reach confirmation.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function attributesOf(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isoOf(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

const READ_LIMIT = 200;


export type ReferralTrackingRow = {
  referralId: string;
  candidateId: string;
  candidateName: string;
  applicationId: string | null;
  /** The linked requisition's role title, when the referral carries an application. */
  roleTitle: string | null;
  /** The position the referral was filed against, from the requisition the referral names. */
  positionCode: string | null;
  /** That requisition's own reference, so the opening can be found from the register. */
  requisitionCode: string | null;
  referrerEmployeeId: string | null;
  referrerName: string | null;
  referrerCode: string | null;
  referredOn: string | null;
  /** Read from `applications.attributes.stage`. Never a copy held on the referral. */
  pipelineStage: string | null;
  pipelineStageLabel: string | null;
  pipelineTerminal: boolean;
  trackingState: ReferralTrackingState;
  trackingStateLabel: string;
  award: ReferralAwardPlan;
  maturation: AwardMaturation;
  action: AwardAction;
};

export type ReferralTrackingRegister = {
  schemeConfigured: boolean;
  schemeCode: string | null;
  currency: string | null;
  /** Named once for the screen, not repeated on every row. */
  configurationGaps: string[];
  states: Array<{ id: ReferralTrackingState; label: string }>;
  maturationStates: Array<{ id: AwardMaturationState; label: string }>;
  rows: ReferralTrackingRow[];
};

type ReferralQueryRow = {
  id: string;
  candidate_id: string;
  application_id: string | null;
  attributes: unknown;
  created_at: string | Date | null;
  candidate_attributes: unknown;
  application_attributes: unknown;
  requisition_attributes: unknown;
  referral_requisition_attributes: unknown;
  position_code: string | null;
  referrer_employee_id: string | null;
  referrer_first_name: string | null;
  referrer_last_name: string | null;
  referrer_code: string | null;
  hired_employee_id: string | null;
  hired_joining_date: string | null;
  hired_confirmation_date: string | null;
  hired_status: string | null;
};

function referrerNameOf(row: ReferralQueryRow): string | null {
  const name = [row.referrer_first_name, row.referrer_last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

/** The milestone each existing `referral_awards` row settled, keyed by referral. */
function disbursedMilestonesByReferral(
  rows: ReadonlyArray<{ referral_id: string; attributes: unknown }>,
): Map<string, string[]> {
  const byReferral = new Map<string, string[]>();
  for (const row of rows) {
    // Award rows written before the milestone key existed carry none. One of those is
    // read as the joining leg, which is the only leg the old single tenure gate settled.
    const milestone = text(attributesOf(row.attributes).milestone) ?? "joining";
    const bucket = byReferral.get(row.referral_id) ?? [];
    if (!bucket.includes(milestone)) bucket.push(milestone);
    byReferral.set(row.referral_id, bucket);
  }
  return byReferral;
}

function buildRow(
  row: ReferralQueryRow,
  scheme: ReferralAwardScheme | null,
  disbursed: readonly string[],
  asOf: Date,
): ReferralTrackingRow {
  const referralAttributes = attributesOf(row.attributes);
  const candidate = attributesOf(row.candidate_attributes);
  const application = attributesOf(row.application_attributes);
  // The requisition on the application, and the one the referral itself names. The
  // referral's own `requisition_id` is the authoritative link - `referCandidate`
  // insists the opening is approved before it will file the referral at all.
  const requisition = attributesOf(row.requisition_attributes);
  const referralRequisition = attributesOf(row.referral_requisition_attributes);
  const stage = text(application.stage);
  const joined = row.hired_employee_id !== null;
  const tenureDays = tenureDaysFrom(row.hired_joining_date, asOf);

  const award = planReferralAward({
    scheme,
    joinedOn: row.hired_joining_date,
    confirmedOn: row.hired_confirmation_date,
    // `employees` carries no confirmation column. `metadata->>'confirmation_date'`
    // is read in case a deployment writes one; absence is reported, never assumed.
    confirmationCaptured: row.hired_confirmation_date !== null,
    tenureDays,
    disbursedMilestones: disbursed,
  });

  const maturation = deriveAwardMaturation({
    plan: award,
    forfeitedReason: forfeitureReason({
      applicationStage: stage,
      joined,
      employmentStatus: row.hired_status,
    }),
  });

  const referralStatus = text(referralAttributes.status) ?? "referred";
  const trackingState = referralTrackingState({
    applicationStage: stage,
    awarded: disbursed.length > 0 || referralStatus === "awarded",
    joined,
  });

  return {
    referralId: row.id,
    candidateId: row.candidate_id,
    candidateName: text(candidate.name) ?? "Unnamed candidate",
    applicationId: row.application_id,
    roleTitle: text(referralRequisition.title) ?? text(requisition.title),
    positionCode: text(row.position_code),
    requisitionCode: text(referralRequisition.code) ?? text(requisition.code),
    referrerEmployeeId: row.referrer_employee_id,
    referrerName: referrerNameOf(row),
    referrerCode: text(row.referrer_code),
    referredOn: isoOf(row.created_at),
    pipelineStage: stage,
    pipelineStageLabel: stage ? (STAGE_LABELS[stage] ?? stage) : null,
    pipelineTerminal: stage !== null && isTerminalStage(stage),
    trackingState,
    trackingStateLabel: REFERRAL_TRACKING_STATE_LABELS[trackingState],
    award,
    maturation,
    action: awardActionFor({ maturation, scheme, referralStatus, tenureDays }),
  };
}

/** The register behind the Candidate / Referrer / Stage / Status table. */
export async function loadReferralTracking(access: Access): Promise<ReferralTrackingRegister> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [referralRows, awardRows, settingsRows] = await tenantTx(access, [
    sqlClient`
      select
        ref.id, ref.candidate_id, ref.application_id, ref.attributes, ref.created_at,
        ref.referrer_employee_id,
        c.attributes as candidate_attributes,
        app.attributes as application_attributes,
        req.attributes as requisition_attributes,
        refreq.attributes as referral_requisition_attributes,
        pos.attributes->>'code' as position_code,
        referrer.first_name as referrer_first_name,
        referrer.last_name as referrer_last_name,
        referrer.employee_code as referrer_code,
        hired.id as hired_employee_id,
        hired.joining_date::text as hired_joining_date,
        hired.metadata->>'confirmation_date' as hired_confirmation_date,
        hired.status as hired_status
      from referrals ref
      left join candidates c on c.tenant_id = ref.tenant_id and c.id = ref.candidate_id
      left join applications app on app.tenant_id = ref.tenant_id and app.id = ref.application_id
      left join requisitions req on req.tenant_id = ref.tenant_id and req.id = app.requisition_id
      left join requisitions refreq on refreq.tenant_id = ref.tenant_id
        -- Guarded rather than cast blindly: a malformed stored id reads as "no
        -- requisition" instead of failing the whole register.
        and refreq.id = case when ref.attributes->>'requisition_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (ref.attributes->>'requisition_id')::uuid end
      left join positions pos on pos.tenant_id = ref.tenant_id
        and pos.id = coalesce(refreq.position_id, req.position_id)
      left join employees referrer on referrer.tenant_id = ref.tenant_id and referrer.id = ref.referrer_employee_id
      left join candidate_employee_links link on link.tenant_id = ref.tenant_id and link.candidate_id = ref.candidate_id
      left join employees hired on hired.tenant_id = ref.tenant_id and hired.id = link.employee_id
      where ref.tenant_id = ${access.tenantId}
      order by ref.created_at desc
      limit ${READ_LIMIT}
    `,
    sqlClient`select referral_id, attributes from referral_awards where tenant_id = ${access.tenantId}`,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);

  const settings = attributesOf((settingsRows as Array<{ settings: unknown }>)[0]?.settings);
  const scheme = parseReferralAwardScheme(settings.referral_award_scheme);
  const disbursed = disbursedMilestonesByReferral(awardRows as Array<{ referral_id: string; attributes: unknown }>);
  const asOf = new Date();

  const rows = (referralRows as ReferralQueryRow[]).map((row) =>
    buildRow(row, scheme, disbursed.get(row.id) ?? [], asOf),
  );

  const gaps = new Set<string>();
  for (const row of rows) for (const gap of row.award.missing) gaps.add(gap);
  if (!scheme) {
    gaps.add(
      "No referral award scheme exists for this tenant: `tenant_settings.settings->'referral_award_scheme'` is unset and there is no scheme master table. Until it is set, the award amount, the joining/confirmation split and the confirmation tenure are all unknown and no figure is shown.",
    );
  }
  gaps.add(AWARD_ENDPOINT_POSTURE);

  return {
    schemeConfigured: scheme !== null,
    schemeCode: scheme?.code ?? null,
    currency: scheme?.currency ?? null,
    configurationGaps: [...gaps],
    states: REFERRAL_TRACKING_STATES.map((id) => ({ id, label: REFERRAL_TRACKING_STATE_LABELS[id] })),
    maturationStates: AWARD_MATURATION_STATES.map((id) => ({ id, label: AWARD_MATURATION_LABELS[id] })),
    rows,
  };
}

export type ReferralTrackingDetail = {
  row: ReferralTrackingRow;
  note: string | null;
  /** TAL-05 `relationship`, as the referrer declared it. Null on referrals filed before it was captured. */
  relationship: string | null;
  /** The opening this referral was filed against. Null when the referral names none. */
  requisition: { code: string | null; positionCode: string | null; title: string | null } | null;
  referralStatus: string;
  candidate: { id: string; name: string; email: string | null; source: string | null };
  application: { id: string; stage: string | null; stageLabel: string | null; terminal: boolean } | null;
  employment: { employeeId: string; joiningDate: string | null; confirmationDate: string | null; status: string | null; tenureDays: number | null } | null;
  /** Each leg with what it is waiting on, in order. */
  milestones: ReferralMilestone[];
  auditTrail: Array<{ action: string; reason: string | null; createdAt: string | null }>;
};

/** The detail panel: the referral, the candidate, the referrer, the legs and the trail. */
export async function loadReferralTrackingDetail(
  access: Access,
  referralId: string,
): Promise<ReferralTrackingDetail | null> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [referralRows, awardRows, settingsRows, auditRows] = await tenantTx(access, [
    sqlClient`
      select
        ref.id, ref.candidate_id, ref.application_id, ref.attributes, ref.created_at,
        ref.referrer_employee_id,
        c.attributes as candidate_attributes,
        app.attributes as application_attributes,
        req.attributes as requisition_attributes,
        refreq.attributes as referral_requisition_attributes,
        pos.attributes->>'code' as position_code,
        referrer.first_name as referrer_first_name,
        referrer.last_name as referrer_last_name,
        referrer.employee_code as referrer_code,
        hired.id as hired_employee_id,
        hired.joining_date::text as hired_joining_date,
        hired.metadata->>'confirmation_date' as hired_confirmation_date,
        hired.status as hired_status
      from referrals ref
      left join candidates c on c.tenant_id = ref.tenant_id and c.id = ref.candidate_id
      left join applications app on app.tenant_id = ref.tenant_id and app.id = ref.application_id
      left join requisitions req on req.tenant_id = ref.tenant_id and req.id = app.requisition_id
      left join requisitions refreq on refreq.tenant_id = ref.tenant_id
        -- Guarded rather than cast blindly: a malformed stored id reads as "no
        -- requisition" instead of failing the whole register.
        and refreq.id = case when ref.attributes->>'requisition_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (ref.attributes->>'requisition_id')::uuid end
      left join positions pos on pos.tenant_id = ref.tenant_id
        and pos.id = coalesce(refreq.position_id, req.position_id)
      left join employees referrer on referrer.tenant_id = ref.tenant_id and referrer.id = ref.referrer_employee_id
      left join candidate_employee_links link on link.tenant_id = ref.tenant_id and link.candidate_id = ref.candidate_id
      left join employees hired on hired.tenant_id = ref.tenant_id and hired.id = link.employee_id
      where ref.tenant_id = ${access.tenantId} and ref.id = ${referralId}
      limit 1
    `,
    sqlClient`select referral_id, attributes from referral_awards where tenant_id = ${access.tenantId} and referral_id = ${referralId}`,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
    sqlClient`
      select action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId}
        and (
          (entity_type = 'referral' and entity_id = ${referralId})
          or (entity_type = 'referral_award' and entity_id in (
            select id::text from referral_awards where tenant_id = ${access.tenantId} and referral_id = ${referralId}
          ))
        )
      order by created_at
      limit 50
    `,
  ]);

  const row = (referralRows as ReferralQueryRow[])[0];
  if (!row) return null;

  const settings = attributesOf((settingsRows as Array<{ settings: unknown }>)[0]?.settings);
  const scheme = parseReferralAwardScheme(settings.referral_award_scheme);
  const disbursed =
    disbursedMilestonesByReferral(awardRows as Array<{ referral_id: string; attributes: unknown }>).get(referralId) ?? [];
  const asOf = new Date();
  const built = buildRow(row, scheme, disbursed, asOf);

  const referralAttributes = attributesOf(row.attributes);
  const candidate = attributesOf(row.candidate_attributes);
  const stage = built.pipelineStage;

  return {
    row: built,
    note: text(referralAttributes.note),
    relationship: text(referralAttributes.relationship),
    requisition:
      built.requisitionCode !== null || built.positionCode !== null
        ? { code: built.requisitionCode, positionCode: built.positionCode, title: built.roleTitle }
        : null,
    referralStatus: text(referralAttributes.status) ?? "referred",
    candidate: {
      id: row.candidate_id,
      name: built.candidateName,
      email: text(candidate.email),
      source: text(candidate.source),
    },
    application: row.application_id
      ? {
          id: row.application_id,
          stage,
          stageLabel: built.pipelineStageLabel,
          terminal: built.pipelineTerminal,
        }
      : null,
    employment: row.hired_employee_id
      ? {
          employeeId: row.hired_employee_id,
          joiningDate: row.hired_joining_date,
          confirmationDate: row.hired_confirmation_date,
          status: row.hired_status,
          tenureDays: tenureDaysFrom(row.hired_joining_date, asOf),
        }
      : null,
    milestones: REFERRAL_MILESTONE_KEYS.map(
      (key) => built.award.milestones.find((milestone) => milestone.key === key),
    ).filter((milestone): milestone is ReferralMilestone => milestone !== undefined),
    auditTrail: (auditRows as Array<{ action: string; reason: string | null; created_at: string | Date | null }>).map(
      (entry) => ({ action: entry.action, reason: entry.reason, createdAt: isoOf(entry.created_at) }),
    ),
  };
}
