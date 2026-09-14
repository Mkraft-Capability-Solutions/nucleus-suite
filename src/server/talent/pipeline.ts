import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import {
  decideRequisition,
  establishmentControlFor,
  type EstablishmentLine,
  type RequisitionDecision,
  type RequisitionType,
} from "./establishment";

/**
 * Read models for SCR-090 "Talent acquisition, establishment and referrals".
 *
 * This module adds NO new hiring rules. The stage contract, the one-score policy
 * and the establishment gate all live in `./service.ts` and `./establishment.ts`;
 * everything here either groups what those already produce for a board, or states
 * plainly what the repository does not hold.
 *
 * Three things it deliberately refuses to do:
 *   1. It never orders candidates against one another. The workbook says three
 *      times that the assistive score does not reject anybody, and the API
 *      boundary rejects every derived second number. A board that sorted cards by
 *      score would reintroduce exactly the comparison the policy forbids.
 *   2. It never invents an amount. The referral award scheme is per-programme
 *      configuration (RL-470/471) and no scheme master is seeded, so an absent
 *      scheme is reported as absent and names what is missing.
 *   3. It never manufactures a fairness number. No protected attribute is
 *      captured anywhere in this repository, so an adverse-impact ratio has no
 *      inputs and `adverseImpactReadiness` says so instead of returning a figure.
 */

// ---------------------------------------------------------------------------
// Stage contract (mirrors ./service.ts)
// ---------------------------------------------------------------------------

/**
 * A verbatim mirror of the stage order in `./service.ts`, which does not export
 * it. `pipeline.test.ts` reads that file and fails if the two ever diverge, so
 * the duplication cannot rot silently. Exporting it from the service instead
 * would be better and is listed as a follow-up.
 */
export const PIPELINE_STAGE_FLOW = [
  "applied", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGE_FLOW)[number];

export const PIPELINE_TERMINAL_STAGES = ["withdrawn", "rejected", "declined", "closed"] as const;
export type TerminalStage = (typeof PIPELINE_TERMINAL_STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  background: "Background check",
  offer_review: "Offer review",
  offered: "Offered",
  accepted: "Accepted",
  converted: "Converted to employee",
  withdrawn: "Withdrawn",
  rejected: "Rejected",
  declined: "Declined",
  closed: "Closed",
};

export function isTerminalStage(stage: string): boolean {
  return (PIPELINE_TERMINAL_STAGES as readonly string[]).includes(stage);
}

/**
 * The reference board shows four columns; the contract has nine ordered stages.
 * The grouping below is the mapping, and each group's `caption` says why those
 * stages belong together:
 *
 *   Sourced and applied   applied                        - in the funnel, not yet assessed
 *   Assisted screening    screening, shortlisted         - the assistive score exists and a human has read it
 *   Interview and scoring interview, background          - panels and pre-offer verification
 *   Offer and pre-board   offer_review, offered,
 *                         accepted, converted            - commercials through to employee conversion
 *
 * Terminal stages belong to no column: an application that ended is not a column
 * of work, and `buildBoard` returns those separately rather than hiding them.
 */
export const BOARD_COLUMNS = [
  {
    id: "sourced_applied",
    label: "Sourced and applied",
    caption: "In the funnel, not yet assessed.",
    stages: ["applied"] as readonly string[],
  },
  {
    id: "assisted_screening",
    label: "Assisted screening",
    caption: "An advisory match score exists and a person has read it.",
    stages: ["screening", "shortlisted"] as readonly string[],
  },
  {
    id: "interview_scoring",
    label: "Interview and scoring",
    caption: "Panel rounds and pre-offer verification.",
    stages: ["interview", "background"] as readonly string[],
  },
  {
    id: "offer_preboard",
    label: "Offer and pre-board",
    caption: "Commercials through to conversion into an employee record.",
    stages: ["offer_review", "offered", "accepted", "converted"] as readonly string[],
  },
] as const;

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]["id"];

export function boardColumnOf(stage: string): BoardColumnId | null {
  for (const column of BOARD_COLUMNS) {
    if (column.stages.includes(stage)) return column.id;
  }
  return null;
}

/**
 * The single legal next stage, or null where there is none.
 *
 * `advanceApplication` accepts exactly `fromIndex + 1` and refuses any move out
 * of a terminal stage, so a board can offer at most ONE forward action per card.
 * That is why the screen has a "Move next" button and no free placement: an
 * arbitrary column drop would be a 409 the user could not have predicted.
 */
export function nextStageOf(stage: string): PipelineStage | null {
  if (isTerminalStage(stage)) return null;
  const index = (PIPELINE_STAGE_FLOW as readonly string[]).indexOf(stage);
  if (index === -1 || index === PIPELINE_STAGE_FLOW.length - 1) return null;
  return PIPELINE_STAGE_FLOW[index + 1]!;
}

export function canAdvance(stage: string): boolean {
  return nextStageOf(stage) !== null;
}

// ---------------------------------------------------------------------------
// Board cards
// ---------------------------------------------------------------------------

/** One finding behind the single score: what was asked, what was judged, where the proof sits. */
export type PipelineFinding = {
  requirementRef: string;
  judgment: string;
  provenance: string;
  evidence: Array<{ locator: string; excerptHash: string }>;
};

export type PipelineCard = {
  applicationId: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string | null;
  requisitionCode: string | null;
  roleTitle: string | null;
  department: string | null;
  stage: string;
  stageLabel: string;
  nextStage: PipelineStage | null;
  nextStageLabel: string | null;
  terminal: boolean;
  /** The one permitted integer, 0-100, or null when nobody has assessed this application. */
  matchScore: number | null;
  /** Where the score came from, so the card can always show its basis. */
  scoreBasis: {
    resultId: string;
    jdVersion: string | null;
    rubricVersion: string | null;
    promptVersion: string | null;
    modelVersion: string | null;
    extractionChecksum: string | null;
    findings: PipelineFinding[];
  } | null;
  skills: string[];
  /**
   * TAL-02 `total_experience`, from the candidate record. Still nullable: candidates
   * created before the field existed carry no value, and the card must say "not
   * captured" for those rather than print a zero it never measured.
   */
  experienceYears: number | null;
  source: string | null;
  appliedAt: string | null;
};

export type BoardColumn = {
  id: BoardColumnId;
  label: string;
  caption: string;
  stages: readonly string[];
  cards: PipelineCard[];
};

export type PipelineBoard = {
  columns: BoardColumn[];
  /** Applications that ended. Not a column of work, but not hidden either. */
  closed: PipelineCard[];
  /** Cards whose stage is neither in the flow nor terminal: a data fault, surfaced. */
  unmapped: PipelineCard[];
  totals: { active: number; closed: number; scored: number; unscored: number };
};

/**
 * Groups cards into board columns.
 *
 * Input order is preserved exactly. There is no comparator anywhere in this
 * function: candidates are never placed in an order derived from their score.
 */
export function buildBoard(cards: readonly PipelineCard[]): PipelineBoard {
  const columns: BoardColumn[] = BOARD_COLUMNS.map((column) => ({
    id: column.id,
    label: column.label,
    caption: column.caption,
    stages: column.stages,
    cards: [],
  }));
  const closed: PipelineCard[] = [];
  const unmapped: PipelineCard[] = [];

  for (const card of cards) {
    if (isTerminalStage(card.stage)) {
      closed.push(card);
      continue;
    }
    const columnId = boardColumnOf(card.stage);
    if (!columnId) {
      unmapped.push(card);
      continue;
    }
    columns.find((column) => column.id === columnId)!.cards.push(card);
  }

  const active = columns.reduce((total, column) => total + column.cards.length, 0);
  const scored = cards.filter((card) => card.matchScore !== null).length;
  return {
    columns,
    closed,
    unmapped,
    totals: { active, closed: closed.length, scored, unscored: cards.length - scored },
  };
}

// ---------------------------------------------------------------------------
// Referral award scheme (RL-470/471) - configuration, never a seeded default
// ---------------------------------------------------------------------------

/**
 * RL-470 leaves the award amount to per-programme configuration and RL-471
 * requires the award to mature in two parts: a part on joining, the balance on
 * confirmation. No scheme master table exists, so this shape is read from
 * `tenant_settings.settings->'referral_award_scheme'` and is absent until an
 * administrator sets it. There is no default, and none may be added: a number
 * invented here would be paid to a real person.
 */
export const referralAwardSchemeSchema = z.object({
  code: z.string().trim().min(1).max(40),
  currency: z.string().regex(/^[A-Z]{3}$/),
  joiningAmountMinor: z.number().int().min(0),
  confirmationAmountMinor: z.number().int().min(0),
  confirmationTenureDays: z.number().int().min(0).max(3650),
});
export type ReferralAwardScheme = z.infer<typeof referralAwardSchemeSchema>;

/** Returns the configured scheme, or null when the tenant has not configured one. */
export function parseReferralAwardScheme(raw: unknown): ReferralAwardScheme | null {
  if (raw === null || raw === undefined) return null;
  const parsed = referralAwardSchemeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const REFERRAL_MILESTONE_KEYS = ["joining", "confirmation"] as const;
export type ReferralMilestoneKey = (typeof REFERRAL_MILESTONE_KEYS)[number];

export type ReferralMilestoneState = "not_configured" | "pending" | "earned" | "disbursed";

export type ReferralMilestone = {
  key: ReferralMilestoneKey;
  label: string;
  /** null when no scheme configures it - never 0, which would read as "nothing due". */
  amountMinor: number | null;
  state: ReferralMilestoneState;
  /** Why it is not yet payable, in the user's terms. */
  blockedBy: string | null;
};

export type ReferralAwardPlan = {
  configured: boolean;
  /** Exactly what has to be configured or captured before an amount can be stated. */
  missing: string[];
  currency: string | null;
  schemeCode: string | null;
  milestones: ReferralMilestone[];
  eligibleMinor: number | null;
  disbursedMinor: number | null;
  nextMilestone: { key: ReferralMilestoneKey; label: string; requirement: string } | null;
};

export type ReferralProgressInput = {
  scheme: ReferralAwardScheme | null;
  /** Set once the referred candidate exists as an employee. */
  joinedOn: string | null;
  /** The confirmation date, when the tenant records one. */
  confirmedOn: string | null;
  /**
   * False when this deployment captures no confirmation event at all. That is a
   * different failure from "not yet confirmed" and is reported differently.
   */
  confirmationCaptured: boolean;
  /** Completed tenure in days, or null when there is no joining date to count from. */
  tenureDays: number | null;
  /** Milestones already paid, from `referral_awards`. */
  disbursedMilestones: readonly string[];
};

const MILESTONE_LABELS: Record<ReferralMilestoneKey, string> = {
  joining: "Part on joining",
  confirmation: "Balance on confirmation",
};

const SCHEME_MISSING =
  "Referral award scheme (amount, split and confirmation tenure) is not configured for this tenant.";

const CONFIRMATION_NOT_CAPTURED =
  "No confirmation event is captured: `employees` carries a joining date but no confirmation date, so the balance leg can never mature until one is recorded.";

/**
 * RL-471 two-part maturation, as a pure function.
 *
 * The joining leg matures when the referred candidate becomes an employee. The
 * confirmation leg matures only when BOTH a confirmation is recorded and the
 * configured tenure is complete - the existing `awardReferral` gates on tenure
 * alone and pays once, which is a single gate, not this model.
 */
export function planReferralAward(input: ReferralProgressInput): ReferralAwardPlan {
  const disbursed = new Set(input.disbursedMilestones);

  if (!input.scheme) {
    const missing = [SCHEME_MISSING];
    if (!input.confirmationCaptured) missing.push(CONFIRMATION_NOT_CAPTURED);
    return {
      configured: false,
      missing,
      currency: null,
      schemeCode: null,
      milestones: REFERRAL_MILESTONE_KEYS.map((key) => ({
        key,
        label: MILESTONE_LABELS[key],
        amountMinor: null,
        state: "not_configured" as const,
        blockedBy: SCHEME_MISSING,
      })),
      eligibleMinor: null,
      disbursedMinor: null,
      nextMilestone: {
        key: "joining",
        label: MILESTONE_LABELS.joining,
        requirement: "Configure the referral award scheme before any amount can be stated or paid.",
      },
    };
  }

  const scheme = input.scheme;
  const joiningEarned = input.joinedOn !== null;
  const tenureMet = input.tenureDays !== null && input.tenureDays >= scheme.confirmationTenureDays;
  const confirmationEarned = input.confirmationCaptured && input.confirmedOn !== null && tenureMet;

  const joining: ReferralMilestone = {
    key: "joining",
    label: MILESTONE_LABELS.joining,
    amountMinor: scheme.joiningAmountMinor,
    state: disbursed.has("joining") ? "disbursed" : joiningEarned ? "earned" : "pending",
    blockedBy: joiningEarned ? null : "The referred candidate has not joined as an employee.",
  };

  let confirmationBlockedBy: string | null = null;
  if (!joiningEarned) {
    confirmationBlockedBy = "The referred candidate has not joined as an employee.";
  } else if (!input.confirmationCaptured) {
    confirmationBlockedBy = CONFIRMATION_NOT_CAPTURED;
  } else if (input.confirmedOn === null) {
    confirmationBlockedBy = "Confirmation has not been recorded for this employee.";
  } else if (!tenureMet) {
    confirmationBlockedBy =
      input.tenureDays === null
        ? "No joining date is recorded, so tenure cannot be counted."
        : `Tenure is ${input.tenureDays} of the ${scheme.confirmationTenureDays} days the scheme requires.`;
  }

  const confirmation: ReferralMilestone = {
    key: "confirmation",
    label: MILESTONE_LABELS.confirmation,
    amountMinor: scheme.confirmationAmountMinor,
    state: disbursed.has("confirmation") ? "disbursed" : confirmationEarned ? "earned" : "pending",
    blockedBy: confirmationEarned ? null : confirmationBlockedBy,
  };

  const milestones = [joining, confirmation];
  const eligibleMinor = milestones
    .filter((milestone) => milestone.state === "earned" || milestone.state === "disbursed")
    .reduce((total, milestone) => total + (milestone.amountMinor ?? 0), 0);
  const disbursedMinor = milestones
    .filter((milestone) => milestone.state === "disbursed")
    .reduce((total, milestone) => total + (milestone.amountMinor ?? 0), 0);

  const outstanding = milestones.find((milestone) => milestone.state !== "disbursed") ?? null;
  const missing = input.confirmationCaptured ? [] : [CONFIRMATION_NOT_CAPTURED];

  return {
    configured: true,
    missing,
    currency: scheme.currency,
    schemeCode: scheme.code,
    milestones,
    eligibleMinor,
    disbursedMinor,
    nextMilestone: outstanding
      ? {
          key: outstanding.key,
          label: outstanding.label,
          requirement: outstanding.blockedBy ?? "Payable now; raise the payroll input for this leg.",
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Adverse impact - what it needs, and what this repository holds
// ---------------------------------------------------------------------------

/**
 * The inputs an adverse impact ratio actually requires. None of them exist here:
 * `employees` carries code, names, work email, designation, department,
 * location, category, payroll owner, manager, joining date, status, salary and
 * currency, and no candidate or employee table records a protected attribute.
 *
 * This list is not decoration. It is the acceptance criteria for the tab: the
 * screen may report the ratio only once every entry below is satisfied.
 */
export const ADVERSE_IMPACT_INPUTS = [
  {
    key: "protected_attribute_set",
    label: "A defined protected-attribute set",
    requirement:
      "The attributes the ratio is measured across must be named and version-controlled (for example sex, disability status, or another lawful category) before any rate can be grouped.",
  },
  {
    key: "consent_bound_capture",
    label: "Consent-bound collection under the DPDP Act",
    requirement:
      "Each attribute must be collected from the data principal with specific, informed, purpose-bound notice and consent, stored separately from selection decisions, and withdrawable.",
  },
  {
    key: "stage_selection_rates",
    label: "Per-stage selection rates by group",
    requirement:
      "For every stage transition the count entering and the count selected, split by group, so a selection rate exists per group per stage.",
  },
  {
    key: "reference_group",
    label: "A declared reference group and minimum cohort size",
    requirement:
      "The group the ratio is taken against must be declared, together with a minimum cohort below which no rate is published, or the figure identifies individuals.",
  },
] as const;

export type AdverseImpactInputKey = (typeof ADVERSE_IMPACT_INPUTS)[number]["key"];

export type AdverseImpactReadiness = {
  computable: boolean;
  available: AdverseImpactInputKey[];
  missing: Array<{ key: AdverseImpactInputKey; label: string; requirement: string }>;
  /** Plain statement for the screen. Never a number. */
  statement: string;
};

/**
 * A real readiness check over whatever inputs the caller can actually supply.
 * Called with the repository's present capability it returns nothing available
 * and everything missing, which is the honest answer.
 */
export function adverseImpactReadiness(available: readonly string[]): AdverseImpactReadiness {
  const present = ADVERSE_IMPACT_INPUTS.filter((input) => available.includes(input.key));
  const missing = ADVERSE_IMPACT_INPUTS.filter((input) => !available.includes(input.key));
  return {
    computable: missing.length === 0,
    available: present.map((input) => input.key),
    missing: missing.map((input) => ({ key: input.key, label: input.label, requirement: input.requirement })),
    statement:
      missing.length === 0
        ? "Every input an adverse impact ratio requires is present; the ratio may be computed and published subject to the declared minimum cohort."
        : "An adverse impact ratio cannot be computed. No protected attribute is captured anywhere in this product, so no per-group selection rate exists and no ratio has any inputs. No figure is shown.",
  };
}

/** What this deployment can actually supply today. Deliberately empty. */
export const ADVERSE_IMPACT_AVAILABLE_INPUTS: readonly AdverseImpactInputKey[] = [];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function attributesOf(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function integerOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

const READ_LIMIT = 200;

/**
 * The board for SCR-090 tab one: every application with the candidate, the
 * requisition, the single score and the findings behind it.
 */
export async function loadPipelineBoard(
  access: Access,
  args: { requisitionId?: string | null } = {},
): Promise<PipelineBoard> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const requisitionFilter = args.requisitionId ?? null;
  const [applicationRows, resultRows, evidenceRows, skillRows] = await tenantTx(access, [
    sqlClient`
      select
        a.id, a.candidate_id, a.requisition_id, a.attributes, a.created_at,
        c.attributes as candidate_attributes,
        r.attributes as requisition_attributes,
        coalesce(d.attributes->>'name', '') as department_name
      from applications a
      left join candidates c on c.tenant_id = a.tenant_id and c.id = a.candidate_id
      left join requisitions r on r.tenant_id = a.tenant_id and r.id = a.requisition_id
      left join departments d on d.tenant_id = a.tenant_id and d.id = r.department_id
      where a.tenant_id = ${access.tenantId}
        and (${requisitionFilter}::uuid is null or a.requisition_id = ${requisitionFilter}::uuid)
      order by a.created_at desc
      limit ${READ_LIMIT}
    `,
    sqlClient`
      select distinct on (m.application_id)
        m.application_id, res.id as result_id, res.attributes
      from candidate_match_runs m
      join candidate_match_results res
        on res.tenant_id = m.tenant_id and res.candidate_match_run_id = m.id
      where m.tenant_id = ${access.tenantId}
        and coalesce((res.attributes->>'superseded')::boolean, false) = false
      order by m.application_id, res.created_at desc
    `,
    sqlClient`
      select candidate_match_result_id, attributes
      from match_evidence
      where tenant_id = ${access.tenantId}
    `,
    sqlClient`
      select cs.candidate_id, s.attributes->>'name' as skill_name
      from candidate_skills cs
      join skills s on s.tenant_id = cs.tenant_id and s.id = cs.skill_id
      where cs.tenant_id = ${access.tenantId}
    `,
  ]);

  const results = new Map<string, { resultId: string; attributes: UnknownRecord }>();
  for (const row of resultRows as Array<{ application_id: string; result_id: string; attributes: unknown }>) {
    results.set(row.application_id, { resultId: row.result_id, attributes: attributesOf(row.attributes) });
  }

  const findings = new Map<string, PipelineFinding[]>();
  for (const row of evidenceRows as Array<{ candidate_match_result_id: string; attributes: unknown }>) {
    const attributes = attributesOf(row.attributes);
    const evidence = Array.isArray(attributes.evidence) ? (attributes.evidence as UnknownRecord[]) : [];
    const bucket = findings.get(row.candidate_match_result_id) ?? [];
    bucket.push({
      requirementRef: text(attributes.requirement_ref) ?? "unnamed requirement",
      judgment: text(attributes.judgment) ?? "not_evidenced",
      provenance: text(attributes.provenance) ?? "unrecorded",
      evidence: evidence.map((item) => ({
        locator: text(item.locator) ?? "",
        excerptHash: text(item.excerptHash) ?? text(item.excerpt_hash) ?? "",
      })),
    });
    findings.set(row.candidate_match_result_id, bucket);
  }

  const skills = new Map<string, string[]>();
  for (const row of skillRows as Array<{ candidate_id: string; skill_name: string | null }>) {
    const name = text(row.skill_name);
    if (!name) continue;
    const bucket = skills.get(row.candidate_id) ?? [];
    if (!bucket.includes(name)) bucket.push(name);
    skills.set(row.candidate_id, bucket);
  }

  const cards: PipelineCard[] = (applicationRows as Array<{
    id: string; candidate_id: string; requisition_id: string | null;
    attributes: unknown; created_at: string | Date;
    candidate_attributes: unknown; requisition_attributes: unknown; department_name: string;
  }>).map((row) => {
    const applicationAttributes = attributesOf(row.attributes);
    const candidate = attributesOf(row.candidate_attributes);
    const requisition = attributesOf(row.requisition_attributes);
    const stage = text(applicationAttributes.stage) ?? "applied";
    const next = nextStageOf(stage);
    const result = results.get(row.id) ?? null;
    const scoreValue = result ? integerOrNull(result.attributes.score_value) : null;
    return {
      applicationId: row.id,
      candidateId: row.candidate_id,
      candidateName: text(candidate.name) ?? "Unnamed candidate",
      requisitionId: row.requisition_id,
      requisitionCode: text(requisition.code),
      roleTitle: text(requisition.title),
      department: text(row.department_name),
      stage,
      stageLabel: STAGE_LABELS[stage] ?? stage,
      nextStage: next,
      nextStageLabel: next ? (STAGE_LABELS[next] ?? next) : null,
      terminal: isTerminalStage(stage),
      matchScore: scoreValue,
      scoreBasis: result
        ? {
            resultId: result.resultId,
            jdVersion: text(result.attributes.jd_version),
            rubricVersion: text(result.attributes.rubric_version),
            promptVersion: text(result.attributes.prompt_version),
            modelVersion: text(result.attributes.model_version),
            extractionChecksum: text(result.attributes.extraction_checksum),
            findings: findings.get(result.resultId) ?? [],
          }
        : null,
      skills: skills.get(row.candidate_id) ?? [],
      experienceYears: typeof candidate.total_experience_years === "number" ? candidate.total_experience_years : null,
      source: text(candidate.source),
      appliedAt: row.created_at instanceof Date ? row.created_at.toISOString() : text(row.created_at),
    };
  });

  return buildBoard(cards);
}

export type RequisitionRegisterRow = {
  id: string;
  code: string | null;
  title: string | null;
  department: string | null;
  positionCode: string | null;
  requisitionType: RequisitionType;
  designation: string | null;
  positions: number;
  againstPositionCode: string | null;
  incumbent: string | null;
  status: string;
  headroomAfter: number | null;
  override: boolean;
  overrideReason: string | null;
  establishmentChecked: boolean;
  establishmentNote: string | null;
  /**
   * The reference screen's Budget column, from TAL-01 `ctc_max` - the top of the budgeted
   * range one position is authorised to cost. Null on requisitions raised before the range
   * was captured, so the screen says "not captured" rather than printing a figure nobody
   * entered. It is deliberately not multiplied by `positions`: the workbook states no rule
   * for a whole-requisition budget.
   */
  budgetMinor: number | null;
  /** The budgeted range as raised, both ends in minor units. */
  ctcMinMinor: number | null;
  ctcMaxMinor: number | null;
  locationCode: string | null;
  workerClass: string | null;
  employmentType: string | null;
  requiredBy: string | null;
  recruiterEmployeeId: string | null;
  createdAt: string | null;
};

export async function loadRequisitionRegister(access: Access): Promise<RequisitionRegisterRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select
        r.id, r.attributes, r.created_at,
        coalesce(d.attributes->>'name', '') as department_name,
        p.attributes->>'code' as position_code,
        emp.first_name, emp.last_name, emp.employee_code
      from requisitions r
      left join departments d on d.tenant_id = r.tenant_id and d.id = r.department_id
      left join positions p on p.tenant_id = r.tenant_id and p.id = r.position_id
      left join employees emp on emp.tenant_id = r.tenant_id and emp.id::text = r.attributes->>'replacing_employee_id'
      where r.tenant_id = ${access.tenantId}
      order by r.created_at desc
      limit ${READ_LIMIT}
    `,
  ]);
  return (rows as Array<{
    id: string; attributes: unknown; created_at: string | Date; department_name: string;
    position_code: string | null; first_name: string | null; last_name: string | null; employee_code: string | null;
  }>).map((row) => {
    const attributes = attributesOf(row.attributes);
    const incumbentName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    return {
      id: row.id,
      code: text(attributes.code),
      title: text(attributes.title),
      department: text(row.department_name),
      positionCode: text(row.position_code),
      requisitionType: attributes.requisition_type === "replacement" ? "replacement" : "addition",
      designation: text(attributes.designation),
      positions: integerOrNull(attributes.positions) ?? 1,
      againstPositionCode: text(attributes.against_position_code),
      incumbent: incumbentName ? `${incumbentName}${row.employee_code ? ` (${row.employee_code})` : ""}` : null,
      status: text(attributes.status) ?? "draft",
      headroomAfter: integerOrNull(attributes.headroom_after),
      override: attributes.override === true,
      overrideReason: text(attributes.override_reason),
      establishmentChecked: attributes.establishment_checked === true,
      establishmentNote: text(attributes.establishment_note),
      budgetMinor: integerOrNull(attributes.ctc_max_minor),
      ctcMinMinor: integerOrNull(attributes.ctc_min_minor),
      ctcMaxMinor: integerOrNull(attributes.ctc_max_minor),
      locationCode: text(attributes.location_code),
      workerClass: text(attributes.worker_class),
      employmentType: text(attributes.employment_type),
      requiredBy: text(attributes.required_by),
      recruiterEmployeeId: text(attributes.recruiter_employee_id),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : text(row.created_at),
    };
  });
}

export type RequisitionPreviewInput = {
  requisitionType: RequisitionType;
  departmentId: string;
  designation: string;
  positions: number;
  againstPositionCode: string | null;
  override: boolean;
  overrideReason: string | null;
  planYear?: number;
};

export type RequisitionPreview = {
  controlActive: boolean;
  controlNote: string | null;
  line: EstablishmentLine | null;
  decision: RequisitionDecision | null;
  /** True when the caller holds `workforce.manpower.approve`. */
  overriderAuthorised: boolean;
  overriderDistinctFromApprover: boolean;
};

/**
 * The live headroom preview behind the create-requisition form.
 *
 * It calls the same `decideRequisition` the approval path calls, with the same
 * inputs, so the panel cannot drift from the gate. The rule is never restated in
 * the browser.
 */
export async function previewRequisitionDecision(
  access: Access,
  input: RequisitionPreviewInput,
): Promise<RequisitionPreview> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const overriderAuthorised = access.context.permissions.includes("workforce.manpower.approve");

  if (input.requisitionType === "replacement") {
    const code = input.againstPositionCode?.trim() ?? "";
    let vacant = false;
    if (code) {
      const [positionRows] = await tenantTx(access, [
        sqlClient`
          select record_status from positions
          where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1
        `,
      ]);
      const position = (positionRows as Array<{ record_status: string | null }>)[0];
      vacant = position ? position.record_status !== "filled" && position.record_status !== "frozen" : false;
    }
    return {
      controlActive: true,
      controlNote: null,
      line: null,
      decision: decideRequisition({
        requisitionType: "replacement",
        positions: input.positions,
        counts: { sanctioned: 0, filled: 0, open: 0 },
        againstPositionCode: code || null,
        againstPositionVacant: vacant,
        override: false,
        overrideReason: null,
        overriderAuthorised,
        overriderDistinctFromApprover: true,
      }),
      overriderAuthorised,
      overriderDistinctFromApprover: true,
    };
  }

  const control = await establishmentControlFor(access, {
    departmentId: input.departmentId,
    designation: input.designation,
    planYear: input.planYear,
  });
  if (control.active === false) {
    return {
      controlActive: false,
      controlNote: control.reason,
      line: null,
      decision: null,
      overriderAuthorised,
      overriderDistinctFromApprover: true,
    };
  }
  const line = control.line;
  if (!line) {
    return {
      controlActive: true,
      controlNote:
        `No approved manpower line exists for "${input.designation}" in this department. An unsanctioned key is not an unlimited one: approve sanctioned strength for it before raising an addition.`,
      line: null,
      decision: null,
      overriderAuthorised,
      overriderDistinctFromApprover: true,
    };
  }
  const overriderDistinctFromApprover = line.approvedByMembershipId !== access.context.membershipId;
  return {
    controlActive: true,
    controlNote: null,
    line,
    decision: decideRequisition({
      requisitionType: "addition",
      positions: input.positions,
      counts: { sanctioned: line.sanctioned, filled: line.filled, open: line.open },
      againstPositionCode: null,
      againstPositionVacant: true,
      override: input.override,
      overrideReason: input.overrideReason,
      overriderAuthorised,
      overriderDistinctFromApprover,
    }),
    overriderAuthorised,
    overriderDistinctFromApprover,
  };
}

export type ReferralLedgerRow = {
  referralId: string;
  reference: string;
  candidateId: string;
  candidateName: string;
  roleTitle: string | null;
  department: string | null;
  referredBy: string | null;
  referredOn: string | null;
  pipelineStage: string | null;
  pipelineStageLabel: string | null;
  status: string;
  award: ReferralAwardPlan;
};

export type ReferralLedger = {
  schemeConfigured: boolean;
  schemeCode: string | null;
  currency: string | null;
  /** Named gaps, once, for the whole tab rather than repeated on every row. */
  configurationGaps: string[];
  rows: ReferralLedgerRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Completed days of service as at `asOf`. Shared with the referral register. */
export function tenureDaysFrom(joiningDate: string | null, asOf: Date): number | null {
  if (!joiningDate) return null;
  const joined = Date.parse(`${joiningDate}T00:00:00Z`);
  if (Number.isNaN(joined)) return null;
  return Math.max(0, Math.floor((asOf.getTime() - joined) / DAY_MS));
}

export async function loadReferralLedger(access: Access): Promise<ReferralLedger> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [referralRows, awardRows, settingsRows] = await tenantTx(access, [
    sqlClient`
      select
        ref.id, ref.candidate_id, ref.application_id, ref.attributes, ref.created_at,
        c.attributes as candidate_attributes,
        app.attributes as application_attributes,
        req.attributes as requisition_attributes,
        coalesce(dep.attributes->>'name', '') as department_name,
        referrer.first_name as referrer_first_name,
        referrer.last_name as referrer_last_name,
        referrer.employee_code as referrer_code,
        hired.joining_date::text as hired_joining_date,
        hired.metadata->>'confirmation_date' as hired_confirmation_date
      from referrals ref
      left join candidates c on c.tenant_id = ref.tenant_id and c.id = ref.candidate_id
      left join applications app on app.tenant_id = ref.tenant_id and app.id = ref.application_id
      left join requisitions req on req.tenant_id = ref.tenant_id and req.id = app.requisition_id
      left join departments dep on dep.tenant_id = ref.tenant_id and dep.id = req.department_id
      left join employees referrer on referrer.tenant_id = ref.tenant_id and referrer.id = ref.referrer_employee_id
      left join candidate_employee_links link on link.tenant_id = ref.tenant_id and link.candidate_id = ref.candidate_id
      left join employees hired on hired.tenant_id = ref.tenant_id and hired.id = link.employee_id
      where ref.tenant_id = ${access.tenantId}
      order by ref.created_at desc
      limit ${READ_LIMIT}
    `,
    sqlClient`
      select referral_id, attributes from referral_awards where tenant_id = ${access.tenantId}
    `,
    sqlClient`
      select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1
    `,
  ]);

  const settings = attributesOf((settingsRows as Array<{ settings: unknown }>)[0]?.settings);
  const scheme = parseReferralAwardScheme(settings.referral_award_scheme);

  const disbursedByReferral = new Map<string, string[]>();
  for (const row of awardRows as Array<{ referral_id: string; attributes: unknown }>) {
    const attributes = attributesOf(row.attributes);
    // The existing one-shot award records no milestone key. It is read as the
    // joining leg, which is the only leg that function can have satisfied.
    const milestone = text(attributes.milestone) ?? "joining";
    const bucket = disbursedByReferral.get(row.referral_id) ?? [];
    if (!bucket.includes(milestone)) bucket.push(milestone);
    disbursedByReferral.set(row.referral_id, bucket);
  }

  const asOf = new Date();
  const rows: ReferralLedgerRow[] = (referralRows as Array<{
    id: string; candidate_id: string; application_id: string | null; attributes: unknown; created_at: string | Date;
    candidate_attributes: unknown; application_attributes: unknown; requisition_attributes: unknown;
    department_name: string; referrer_first_name: string | null; referrer_last_name: string | null;
    referrer_code: string | null; hired_joining_date: string | null; hired_confirmation_date: string | null;
  }>).map((row, index) => {
    const attributes = attributesOf(row.attributes);
    const candidate = attributesOf(row.candidate_attributes);
    const application = attributesOf(row.application_attributes);
    const requisition = attributesOf(row.requisition_attributes);
    const stage = text(application.stage);
    const referrerName = [row.referrer_first_name, row.referrer_last_name].filter(Boolean).join(" ").trim();
    return {
      referralId: row.id,
      reference: `REF-${String(index + 1).padStart(4, "0")}`,
      candidateId: row.candidate_id,
      candidateName: text(candidate.name) ?? "Unnamed candidate",
      roleTitle: text(requisition.title),
      department: text(row.department_name),
      referredBy: referrerName ? `${referrerName}${row.referrer_code ? ` (${row.referrer_code})` : ""}` : null,
      referredOn: row.created_at instanceof Date ? row.created_at.toISOString() : text(row.created_at),
      pipelineStage: stage,
      pipelineStageLabel: stage ? (STAGE_LABELS[stage] ?? stage) : null,
      status: text(attributes.status) ?? "referred",
      award: planReferralAward({
        scheme,
        joinedOn: row.hired_joining_date,
        confirmedOn: row.hired_confirmation_date,
        // `employees` has no confirmation column; `metadata` is read in case a
        // deployment writes one, and absence is reported rather than assumed.
        confirmationCaptured: row.hired_confirmation_date !== null,
        tenureDays: tenureDaysFrom(row.hired_joining_date, asOf),
        disbursedMilestones: disbursedByReferral.get(row.id) ?? [],
      }),
    };
  });

  const gaps = new Set<string>();
  for (const row of rows) for (const gap of row.award.missing) gaps.add(gap);
  if (!scheme) gaps.add(SCHEME_MISSING);

  return {
    schemeConfigured: scheme !== null,
    schemeCode: scheme?.code ?? null,
    currency: scheme?.currency ?? null,
    configurationGaps: [...gaps],
    rows,
  };
}

export type InterviewPanelSeat = { membershipId: string; name: string | null; submitted: boolean };

export type InterviewSessionView = {
  sessionId: string;
  applicationId: string | null;
  candidateName: string | null;
  planId: string | null;
  planTitle: string | null;
  round: string | null;
  mode: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  status: string;
  debriefed: boolean;
  competencies: string[];
  panel: InterviewPanelSeat[];
  cardsSubmitted: number;
  /**
   * Empty while the session is sealed. Individual panel ratings are released
   * only at debrief, matching `sessionScores`; the caller's own card is returned
   * before then so a panel member can see what they filed.
   */
  cards: Array<{
    panelMemberId: string;
    own: boolean;
    competencyRatings: Array<{ competency: string; rating: number; remark: string | null }>;
    overallRating: string | null;
    strengths: string | null;
    concerns: string | null;
    recommendedBand: string | null;
  }>;
};

/** The TAL-03 competency table as stored on a card, with anything malformed dropped. */
function competencyRatingsOf(raw: unknown): Array<{ competency: string; rating: number; remark: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const row = attributesOf(entry);
    const competency = text(row.competency);
    if (competency === null || typeof row.rating !== "number") return [];
    return [{ competency, rating: row.rating, remark: text(row.remark) }];
  });
}

export type InterviewOverview = {
  plans: Array<{
    planId: string;
    title: string | null;
    status: string;
    rounds: string[];
    competencies: string[];
    requisitionId: string | null;
    requisitionTitle: string | null;
    sessionCount: number;
  }>;
  sessions: InterviewSessionView[];
};

export async function loadInterviewOverview(access: Access): Promise<InterviewOverview> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [planRows, sessionRows, panelRows, scoreRows, mineRows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.requisition_id, p.attributes, p.scorecard_id,
             sc.attributes as scorecard_attributes,
             req.attributes as requisition_attributes
      from interview_plans p
      left join scorecards sc on sc.tenant_id = p.tenant_id and sc.id = p.scorecard_id
      left join requisitions req on req.tenant_id = p.tenant_id and req.id = p.requisition_id
      where p.tenant_id = ${access.tenantId}
      order by p.created_at desc
      limit ${READ_LIMIT}
    `,
    sqlClient`
      select s.id, s.application_id, s.interview_plan_id, s.attributes,
             c.attributes as candidate_attributes,
             p.attributes as plan_attributes,
             sc.attributes as scorecard_attributes
      from interview_sessions s
      left join applications a on a.tenant_id = s.tenant_id and a.id = s.application_id
      left join candidates c on c.tenant_id = s.tenant_id and c.id = a.candidate_id
      left join interview_plans p on p.tenant_id = s.tenant_id and p.id = s.interview_plan_id
      left join scorecards sc on sc.tenant_id = s.tenant_id and sc.id = p.scorecard_id
      where s.tenant_id = ${access.tenantId}
      order by s.created_at desc
      limit ${READ_LIMIT}
    `,
    sqlClient`
      select pm.id, pm.interview_session_id, pm.membership_id, e.first_name, e.last_name
      from interview_panel_members pm
      left join memberships m on m.tenant_id = pm.tenant_id and m.id = pm.membership_id
      left join employees e on e.tenant_id = pm.tenant_id and e.id = m.employee_id
      where pm.tenant_id = ${access.tenantId}
    `,
    sqlClient`
      select interview_session_id, panel_member_id, attributes
      from interview_scores where tenant_id = ${access.tenantId}
    `,
    sqlClient`
      select id from interview_panel_members
      where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId}
    `,
  ]);

  const myPanelIds = new Set(
    (mineRows as Array<{ id: string }>).map((row) => row.id),
  );

  const seatsBySession = new Map<string, Array<{ id: string; membershipId: string; name: string | null }>>();
  for (const row of panelRows as Array<{
    id: string; interview_session_id: string; membership_id: string; first_name: string | null; last_name: string | null;
  }>) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
    const bucket = seatsBySession.get(row.interview_session_id) ?? [];
    bucket.push({ id: row.id, membershipId: row.membership_id, name: name || null });
    seatsBySession.set(row.interview_session_id, bucket);
  }

  const scoresBySession = new Map<string, Array<{ panelMemberId: string; attributes: UnknownRecord }>>();
  for (const row of scoreRows as Array<{ interview_session_id: string; panel_member_id: string; attributes: unknown }>) {
    const bucket = scoresBySession.get(row.interview_session_id) ?? [];
    bucket.push({ panelMemberId: row.panel_member_id, attributes: attributesOf(row.attributes) });
    scoresBySession.set(row.interview_session_id, bucket);
  }

  const sessions: InterviewSessionView[] = (sessionRows as Array<{
    id: string; application_id: string | null; interview_plan_id: string | null; attributes: unknown;
    candidate_attributes: unknown; plan_attributes: unknown; scorecard_attributes: unknown;
  }>).map((row) => {
    const attributes = attributesOf(row.attributes);
    const plan = attributesOf(row.plan_attributes);
    const scorecard = attributesOf(row.scorecard_attributes);
    const candidate = attributesOf(row.candidate_attributes);
    const debriefed = attributes.debriefed === true;
    const seats = seatsBySession.get(row.id) ?? [];
    const cards = scoresBySession.get(row.id) ?? [];
    const submitted = new Set(cards.map((card) => card.panelMemberId));
    const visible = debriefed ? cards : cards.filter((card) => myPanelIds.has(card.panelMemberId));
    return {
      sessionId: row.id,
      applicationId: row.application_id,
      candidateName: text(candidate.name),
      planId: row.interview_plan_id,
      planTitle: text(plan.title),
      round: text(attributes.round),
      mode: text(attributes.mode),
      scheduledAt: text(attributes.scheduled_at),
      durationMinutes: typeof attributes.duration_minutes === "number" ? attributes.duration_minutes : null,
      status: text(attributes.status) ?? "scheduled",
      debriefed,
      competencies: Array.isArray(scorecard.rubric) ? (scorecard.rubric as unknown[]).map(String) : [],
      panel: seats.map((seat) => ({ membershipId: seat.membershipId, name: seat.name, submitted: submitted.has(seat.id) })),
      cardsSubmitted: cards.length,
      cards: visible.map((card) => ({
        panelMemberId: card.panelMemberId,
        own: myPanelIds.has(card.panelMemberId),
        competencyRatings: competencyRatingsOf(card.attributes.competency_ratings),
        overallRating: text(card.attributes.overall_rating),
        strengths: text(card.attributes.strengths),
        concerns: text(card.attributes.concerns),
        recommendedBand: text(card.attributes.recommended_band),
      })),
    };
  });

  const sessionCounts = new Map<string, number>();
  for (const session of sessions) {
    if (!session.planId) continue;
    sessionCounts.set(session.planId, (sessionCounts.get(session.planId) ?? 0) + 1);
  }

  const plans = (planRows as Array<{
    id: string; requisition_id: string | null; attributes: unknown;
    scorecard_attributes: unknown; requisition_attributes: unknown;
  }>).map((row) => {
    const attributes = attributesOf(row.attributes);
    const scorecard = attributesOf(row.scorecard_attributes);
    const requisition = attributesOf(row.requisition_attributes);
    return {
      planId: row.id,
      title: text(attributes.title),
      status: text(attributes.status) ?? "active",
      rounds: Array.isArray(attributes.rounds) ? (attributes.rounds as unknown[]).map(String) : [],
      competencies: Array.isArray(scorecard.rubric) ? (scorecard.rubric as unknown[]).map(String) : [],
      requisitionId: row.requisition_id,
      requisitionTitle: text(requisition.title),
      sessionCount: sessionCounts.get(row.id) ?? 0,
    };
  });

  return { plans, sessions };
}

// ---------------------------------------------------------------------------
// Screen query contracts
// ---------------------------------------------------------------------------

export const TALENT_PIPELINE_VIEWS = ["board", "referrals", "interviews", "fairness"] as const;
export type TalentPipelineView = (typeof TALENT_PIPELINE_VIEWS)[number];
