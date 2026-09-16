import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import {
  OVERRIDE_REASON_MIN_LENGTH,
  REQUISITION_TYPES,
  decideRequisition,
  establishmentAdopted,
  listEstablishment,
  type EstablishmentLine,
  type EstablishmentState,
  type HeadroomCounts,
  type RequisitionDecision,
  type RequisitionType,
} from "./establishment";

/**
 * Read model for SCR-090 "Recruitment requisitions".
 *
 * The register's four columns are Requisition, Position, Headroom and Status.
 * Three of those are transcription; the Headroom and Status columns are the two
 * that have to be *derived*, and both are derived here from rules that already
 * exist rather than from anything stored:
 *
 *   Headroom  RL-056/057 say filled and open are derived and never persisted, so
 *             the column cannot read a number off the requisition row. It resolves
 *             the requisition's sanction key against `listEstablishment` and shows
 *             the live figures. `requisitions.attributes.headroom_after` IS stored,
 *             but it is a snapshot taken at approval; it is reported separately in
 *             the detail panel and clearly labelled as historic.
 *
 *   Status    RL-462 blocks an addition AT APPROVAL. A hiring manager therefore
 *             finds out that a requisition cannot be approved only once they try.
 *             `evaluateRequisitionGate` runs the same gate `approveRequisition`
 *             runs, against the same inputs, so the register can say "Blocked"
 *             and give the figures and the reason *before* the button is pressed.
 *
 * This module adds NO new hiring rule. `decideRequisition` is the rule; every
 * function here either feeds it, mirrors the branches `approveRequisition` takes
 * around it, or states plainly what the repository does not record.
 *
 * WHAT IS NOT BACKED BY DATA - see `REQUISITION_STATE_PROVENANCE`:
 *   "Submitted" has no writer anywhere in this product. `createRequisition`
 *   writes `draft`, `approveRequisition` writes `approved`, and nothing else
 *   touches `requisitions.attributes.status`. The state is therefore declared,
 *   labelled as not recorded, and never counted. It is honoured if a row ever
 *   literally carries it, because refusing to display real data would be a
 *   second kind of lie.
 */

// ---------------------------------------------------------------------------
// Display states
// ---------------------------------------------------------------------------

/** SCR-090's five states, in workbook order. */
export const REQUISITION_DISPLAY_STATES = ["draft", "blocked", "submitted", "approved", "filled"] as const;
export type RequisitionDisplayState = (typeof REQUISITION_DISPLAY_STATES)[number];

export const REQUISITION_DISPLAY_STATE_LABELS: Record<RequisitionDisplayState, string> = {
  draft: "Draft",
  blocked: "Blocked",
  submitted: "Submitted",
  approved: "Approved",
  filled: "Filled",
};

export const SUBMITTED_NOT_RECORDED =
  "No server path writes a submitted status: a requisition is drafted and then approved. Until a submit-for-approval transition exists, this state is never reached and is never counted.";

/** Where each of the five states comes from, so the screen can show its own basis. */
export const REQUISITION_STATE_PROVENANCE: Record<RequisitionDisplayState, { backed: boolean; source: string }> = {
  draft: { backed: true, source: "requisitions.attributes.status = 'draft', written by createRequisition." },
  blocked: {
    backed: true,
    source:
      "Derived: the same establishment gate approveRequisition runs (decideRequisition, RL-461/462/463) refuses this draft right now.",
  },
  submitted: { backed: false, source: SUBMITTED_NOT_RECORDED },
  approved: { backed: true, source: "requisitions.attributes.status = 'approved', written by approveRequisition." },
  filled: {
    backed: true,
    source:
      "Derived: a candidate_employee_links row reaches this requisition through its application, which is written only when an offer is accepted and the candidate becomes an employee.",
  },
};

// ---------------------------------------------------------------------------
// Headroom projection
// ---------------------------------------------------------------------------

export type HeadroomProjectionKind =
  | "known"
  | "not_configured"
  | "no_sanction_key"
  | "designation_missing"
  | "not_applicable";

export type HeadroomProjection = {
  kind: HeadroomProjectionKind;
  /** Short cell text for the Headroom column. Never "0" when the figure is unknown. */
  label: string;
  /** One sentence the detail panel and the cell title can both use. */
  detail: string;
  counts: HeadroomCounts | null;
  headroom: number | null;
  utilisationPercent: number | null;
  state: EstablishmentState | null;
};

/**
 * The Headroom cell.
 *
 * An unconfigured ceiling is not a ceiling of zero, and a sanction key with no
 * approved line is not an unlimited one. Each of those is a distinct `kind` with
 * its own sentence, and none of them returns a number.
 */
export function projectHeadroom(input: {
  requisitionType: RequisitionType;
  /** True once ANY approved manpower line exists for the plan year. */
  controlConfigured: boolean;
  designation: string | null;
  line: EstablishmentLine | null;
  planYear: number;
}): HeadroomProjection {
  if (input.requisitionType === "replacement") {
    return {
      kind: "not_applicable",
      label: "Not consumed",
      detail:
        "RL-461: a replacement backfills a named vacated position and consumes no fresh sanctioned strength, so no headroom is drawn down.",
      counts: null,
      headroom: null,
      utilisationPercent: null,
      state: null,
    };
  }

  if (!input.controlConfigured) {
    return {
      kind: "not_configured",
      label: "Not configured",
      detail:
        `No approved manpower lines exist for ${input.planYear}, so establishment control is not in force for this tenant. ` +
        `Headroom is unknown, not zero, and no ceiling is being enforced at approval.`,
      counts: null,
      headroom: null,
      utilisationPercent: null,
      state: null,
    };
  }

  if (!input.designation) {
    return {
      kind: "designation_missing",
      label: "Key incomplete",
      detail:
        "Sanctioned strength is held by org unit, designation and location. This addition carries no designation, so its sanction key cannot be resolved and approval will be refused until one is recorded.",
      counts: null,
      headroom: null,
      utilisationPercent: null,
      state: null,
    };
  }

  if (!input.line) {
    return {
      kind: "no_sanction_key",
      label: "No sanction",
      detail:
        `Establishment control is in force but no approved manpower line exists for "${input.designation}" in this department. ` +
        `An unsanctioned key is not an unlimited one: approval is refused until sanctioned strength is approved for it.`,
      counts: null,
      headroom: null,
      utilisationPercent: null,
      state: null,
    };
  }

  const counts: HeadroomCounts = { sanctioned: input.line.sanctioned, filled: input.line.filled, open: input.line.open };
  return {
    kind: "known",
    label: `${input.line.headroom} of ${counts.sanctioned}`,
    detail:
      `Sanctioned ${counts.sanctioned} · filled ${counts.filled} · open ${counts.open} · headroom ${input.line.headroom}` +
      `${input.line.utilisationPercent === null ? "" : ` · ${input.line.utilisationPercent}% committed`}. ` +
      `Filled and open are derived live (RL-056); neither is stored.`,
    counts,
    headroom: input.line.headroom,
    utilisationPercent: input.line.utilisationPercent,
    state: input.line.state,
  };
}

// ---------------------------------------------------------------------------
// The gate, mirrored
// ---------------------------------------------------------------------------

export type RequisitionGateInput = {
  requisitionType: RequisitionType;
  positions: number;
  designation: string | null;
  /** From `establishmentControlFor`: false when the tenant has adopted no ceilings. */
  controlActive: boolean;
  /** Why the control is inactive, verbatim, when it is. */
  controlReason: string | null;
  line: Pick<EstablishmentLine, "sanctioned" | "filled" | "open" | "approvedByMembershipId"> | null;
  againstPositionCode: string | null;
  againstPositionVacant: boolean;
  override: boolean;
  overrideReason: string | null;
  /** Caller holds `workforce.manpower.approve`. */
  overriderAuthorised: boolean;
  membershipId: string;
};

export type RequisitionGate = {
  allowed: boolean;
  /** Machine code for a refusal, matching what the approval endpoint would return. */
  code: string | null;
  message: string | null;
  /** True when an establishment ceiling was actually consulted. */
  checked: boolean;
  /** Set when the ceiling was NOT consulted, saying why. */
  uncheckedReason: string | null;
  decision: RequisitionDecision | null;
  warnings: string[];
  /** True once an authorised override with a long enough reason could clear the refusal. */
  overridable: boolean;
};

/**
 * The branch structure of `approveRequisition`, as a pure function.
 *
 * Two of approval's refusals happen BEFORE `decideRequisition` is reached - an
 * addition with no designation, and an addition whose sanction key has no
 * approved line - and both are thrown as 422s. A register that only ran the rule
 * would call those requisitions "Draft" and let a hiring manager walk into a
 * refusal, so they are reproduced here with the same codes.
 *
 * `decideRequisition` itself is never reimplemented; it is called.
 */
export function evaluateRequisitionGate(input: RequisitionGateInput): RequisitionGate {
  const base = { warnings: [] as string[], overridable: false };

  if (input.requisitionType === "addition") {
    if (!input.controlActive) {
      // Establishment control is not adopted. Approval proceeds UNCHECKED; saying
      // "allowed" without saying "unchecked" would imply a ceiling was honoured.
      return {
        allowed: true,
        code: null,
        message: null,
        checked: false,
        uncheckedReason:
          input.controlReason ??
          "Establishment control is not in force for this tenant, so no ceiling was consulted.",
        decision: null,
        ...base,
      };
    }
    if (!input.designation) {
      return {
        allowed: false,
        code: "SANCTION_KEY_INCOMPLETE",
        message:
          "An addition must carry a designation: sanctioned strength is held by org unit, designation and location, so headroom cannot be resolved without it.",
        checked: true,
        uncheckedReason: null,
        decision: null,
        ...base,
      };
    }
    if (!input.line) {
      return {
        allowed: false,
        code: "SANCTION_MISSING",
        message:
          `No approved manpower line exists for "${input.designation}" in this department. An unsanctioned key is not an unlimited one: approve sanctioned strength for it first.`,
        checked: true,
        uncheckedReason: null,
        decision: null,
        ...base,
      };
    }
  }

  const line = input.line;
  const decision = decideRequisition({
    requisitionType: input.requisitionType,
    positions: input.positions,
    counts: line
      ? { sanctioned: line.sanctioned, filled: line.filled, open: line.open }
      : { sanctioned: 0, filled: 0, open: 0 },
    againstPositionCode: input.againstPositionCode,
    againstPositionVacant: input.againstPositionVacant,
    override: input.override,
    overrideReason: input.overrideReason,
    overriderAuthorised: input.overriderAuthorised,
    overriderDistinctFromApprover: line?.approvedByMembershipId !== input.membershipId,
  });

  if (decision.allowed) {
    return {
      allowed: true,
      code: null,
      message: null,
      checked: true,
      uncheckedReason: null,
      decision,
      warnings: decision.warnings,
      overridable: false,
    };
  }

  return {
    allowed: false,
    code: decision.code,
    message: decision.message,
    checked: true,
    uncheckedReason: null,
    decision,
    warnings: [],
    // Only a ceiling breach is waivable. A replacement naming no vacant seat, or
    // an override the caller may not record, is not cleared by ticking a box.
    overridable: decision.code === "SANCTION_EXCEEDED" && input.overriderAuthorised,
  };
}

// ---------------------------------------------------------------------------
// Display state
// ---------------------------------------------------------------------------

export type DisplayStateInput = {
  /** The literal `attributes.status` on the row. */
  storedStatus: string;
  /** Candidates who became employees through an application against this requisition. */
  conversionCount: number;
  /** Null when no gate was evaluated (the row is already approved and settled). */
  gate: RequisitionGate | null;
};

export type DisplayStateResult = {
  state: RequisitionDisplayState;
  /** Why the register shows this state, in the reader's terms. */
  reason: string;
  /** False when the state is shown from a stored value nothing in this product writes. */
  derived: boolean;
};

/**
 * The Status column.
 *
 * A conversion outranks the stored status: an employee who exists against this
 * requisition is a fact, and a requisition still reading "approved" while
 * somebody is sitting in the seat is the less useful of the two truths.
 */
export function deriveDisplayState(input: DisplayStateInput): DisplayStateResult {
  const stored = input.storedStatus.trim().toLowerCase();

  if (input.conversionCount > 0) {
    return {
      state: "filled",
      reason:
        `${input.conversionCount} candidate${input.conversionCount === 1 ? " has" : "s have"} been converted to an employee against this requisition.`,
      derived: true,
    };
  }

  if (stored === "approved") {
    return { state: "approved", reason: "Approved: the establishment gate was passed at approval.", derived: false };
  }

  // Honoured if present, though nothing in this product writes it.
  if (stored === "submitted") {
    return { state: "submitted", reason: SUBMITTED_NOT_RECORDED, derived: false };
  }

  if (input.gate && !input.gate.allowed) {
    return {
      state: "blocked",
      reason: input.gate.message ?? "Approval would be refused by the establishment gate.",
      derived: true,
    };
  }

  if (stored !== "draft") {
    // An unrecognised status is data this screen does not model. Say so rather
    // than silently mapping it onto one of the five.
    return {
      state: "draft",
      reason: `The stored status is "${input.storedStatus}", which SCR-090 does not define. It is shown as a draft because it has not been approved.`,
      derived: false,
    };
  }

  return {
    state: "draft",
    reason: input.gate?.checked
      ? "Draft: the establishment gate currently permits approval."
      : (input.gate?.uncheckedReason ?? "Draft: not yet submitted for approval."),
    derived: false,
  };
}

// ---------------------------------------------------------------------------
// State timeline
// ---------------------------------------------------------------------------

export type TimelineStepStatus = "done" | "current" | "blocked" | "cleared" | "todo" | "not_recorded";

export type StateTimelineStep = {
  state: RequisitionDisplayState;
  label: string;
  status: TimelineStepStatus;
  at: string | null;
  note: string;
};

export function buildStateTimeline(input: {
  displayState: RequisitionDisplayState;
  storedStatus: string;
  draftedAt: string | null;
  approvedAt: string | null;
  filledAt: string | null;
  gate: RequisitionGate | null;
  blockedReason: string | null;
}): StateTimelineStep[] {
  const approved = input.displayState === "approved" || input.displayState === "filled";
  const blocked = input.displayState === "blocked";

  return [
    {
      state: "draft",
      label: REQUISITION_DISPLAY_STATE_LABELS.draft,
      status: "done",
      at: input.draftedAt,
      note: "Raised by the hiring manager. A draft may be created freely; the ceiling is checked at approval (RL-462).",
    },
    {
      state: "blocked",
      label: REQUISITION_DISPLAY_STATE_LABELS.blocked,
      status: blocked ? "blocked" : "cleared",
      at: null,
      note: blocked
        ? (input.blockedReason ?? "The establishment gate currently refuses this requisition.")
        : approved
          ? "Never refused: the gate passed when this requisition was approved."
          : (input.gate?.checked === false
              ? (input.gate.uncheckedReason ?? "No ceiling is being enforced, so there is nothing to block against.")
              : "Not blocked: the establishment gate currently permits approval."),
    },
    {
      state: "submitted",
      label: REQUISITION_DISPLAY_STATE_LABELS.submitted,
      status: input.storedStatus.trim().toLowerCase() === "submitted" ? "current" : "not_recorded",
      at: null,
      note: SUBMITTED_NOT_RECORDED,
    },
    {
      state: "approved",
      label: REQUISITION_DISPLAY_STATE_LABELS.approved,
      status: approved ? "done" : blocked ? "blocked" : "current",
      at: input.approvedAt,
      note: approved
        ? "Approved against the establishment ceiling."
        : blocked
          ? "Approval is refused while the requisition is blocked."
          : "Awaiting approval.",
    },
    {
      state: "filled",
      label: REQUISITION_DISPLAY_STATE_LABELS.filled,
      status: input.displayState === "filled" ? "done" : "todo",
      at: input.filledAt,
      note:
        input.displayState === "filled"
          ? "A candidate was converted to an employee against this requisition."
          : "Reached only when an offer against this requisition is accepted and the candidate becomes an employee.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export const REQUISITION_AUDIT_ACTIONS = [
  "talent.requisition_create",
  "talent.requisition_approve",
  "talent.requisition_override",
] as const;

export const REQUISITION_AUDIT_LABELS: Record<string, string> = {
  "talent.requisition_create": "Requisition raised",
  "talent.requisition_approve": "Requisition approved",
  "talent.requisition_override": "Approved under establishment override",
};

export type RequisitionAuditEntry = {
  action: string;
  label: string;
  reason: string | null;
  actor: string | null;
  at: string | null;
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type RequisitionConversion = {
  employeeId: string;
  employeeCode: string | null;
  name: string | null;
  joiningDate: string | null;
  linkedAt: string | null;
};

export type RequisitionRegisterRow = {
  id: string;
  /** The Requisition column. */
  code: string;
  title: string | null;
  /** The Position column. */
  position: string;
  positionCode: string | null;
  designation: string | null;
  positionStatus: string | null;
  departmentId: string;
  department: string | null;
  hiringManager: string | null;
  requisitionType: RequisitionType;
  requisitionTypeLabel: string;
  positions: number;
  againstPositionCode: string | null;
  replacingEmployee: string | null;
  /** The TAL-01 terms the requisition was raised on. Null on rows raised before they were captured. */
  terms: {
    locationCode: string | null;
    workerClass: string | null;
    employmentType: string | null;
    requiredBy: string | null;
    ctcMinMinor: number | null;
    ctcMaxMinor: number | null;
    qualificationRequired: string | null;
    experienceMinYears: number | null;
    experienceMaxYears: number | null;
    skills: string[];
    justification: string | null;
  };
  /** The Headroom column: live, derived, never read off the row. */
  headroom: HeadroomProjection;
  /** The Status column. */
  displayState: RequisitionDisplayState;
  displayStateLabel: string;
  displayStateReason: string;
  storedStatus: string;
  /** What approval would do if it were attempted right now, with no override. */
  gate: RequisitionGate;
  /** True when an authorised override could clear the current refusal. */
  overridable: boolean;
  /** The snapshot approval recorded. Historic, not the live figure above. */
  approvalSnapshot: {
    headroomAfter: number | null;
    consumesSanction: boolean | null;
    override: boolean;
    overrideReason: string | null;
    establishmentChecked: boolean;
    establishmentNote: string | null;
    /** TAL-01 `recruiter_id`: who owns the opening from approval onwards. */
    recruiterEmployeeId: string | null;
    approvedAt: string | null;
  };
  conversions: RequisitionConversion[];
  timeline: StateTimelineStep[];
  auditTrail: RequisitionAuditEntry[];
  createdAt: string | null;
};

export type RequisitionRegisterScreen = {
  planYear: number;
  /** False when the tenant has adopted no approved manpower lines at all. */
  controlConfigured: boolean;
  controlNote: string | null;
  overrideReasonMinLength: number;
  overrideRequiredPermission: string;
  overriderAuthorised: boolean;
  stateLabels: Record<RequisitionDisplayState, string>;
  stateProvenance: Record<RequisitionDisplayState, { backed: boolean; source: string }>;
  /** Named gaps between the workbook's five states and what the server records. */
  notes: string[];
  counts: Record<RequisitionDisplayState, number>;
  departments: Array<{ id: string; name: string }>;
  rows: RequisitionRegisterRow[];
};

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

function integerOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function stamp(value: string | Date | null): string | null {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

function personName(first: string | null, last: string | null, code: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  if (!name) return code;
  return code ? `${name} (${code})` : name;
}

const READ_LIMIT = 200;
const AUDIT_LIMIT = 1000;

const OVERRIDE_PERMISSION = "workforce.manpower.approve";

function planYearOf(value?: number): number {
  return value ?? new Date().getUTCFullYear();
}

/**
 * The register, with a live headroom and a live gate on every row.
 *
 * `listEstablishment` is read once for the plan year and each requisition is
 * matched to its sanction key in memory, so a hundred-row register costs one
 * establishment read rather than a hundred.
 */
export async function loadRequisitionRegisterScreen(
  access: Access,
  args: { planYear?: number } = {},
): Promise<RequisitionRegisterScreen> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const planYear = planYearOf(args.planYear);

  const [lines, adopted, [requisitionRows, conversionRows, auditRows, departmentRows]] = await Promise.all([
    listEstablishment(access, { planYear }),
    establishmentAdopted(access),
    tenantTx(access, [
      sqlClient`
        select
          r.id, r.attributes, r.created_at, r.department_id,
          coalesce(d.attributes->>'name', '') as department_name,
          p.attributes->>'code' as position_code,
          p.record_status as position_status,
          backfill.record_status as backfill_status,
          (backfill.id is not null) as backfill_found,
          hm.first_name as manager_first_name, hm.last_name as manager_last_name, hm.employee_code as manager_code,
          rep.first_name as replacing_first_name, rep.last_name as replacing_last_name, rep.employee_code as replacing_code
        from requisitions r
        left join departments d on d.tenant_id = r.tenant_id and d.id = r.department_id
        left join positions p on p.tenant_id = r.tenant_id and p.id = r.position_id
        left join positions backfill on backfill.tenant_id = r.tenant_id and backfill.attributes->>'code' = r.attributes->>'against_position_code'
        left join employees hm on hm.tenant_id = r.tenant_id and hm.id = r.hiring_manager_employee_id
        left join employees rep on rep.tenant_id = r.tenant_id and rep.id::text = r.attributes->>'replacing_employee_id'
        where r.tenant_id = ${access.tenantId}
        order by r.created_at desc
        limit ${READ_LIMIT}
      `,
      // RL "Filled": the only place this repository records that a requisition
      // produced a person is the conversion link written when an offer is
      // accepted. Nothing sets a `filled` status, so this is the evidence.
      sqlClient`
        select
          a.requisition_id, l.employee_id, l.created_at,
          e.employee_code, e.first_name, e.last_name, e.joining_date::text as joining_date
        from candidate_employee_links l
        join applications a on a.tenant_id = l.tenant_id and a.id = l.application_id
        left join employees e on e.tenant_id = l.tenant_id and e.id = l.employee_id
        where l.tenant_id = ${access.tenantId} and a.requisition_id is not null
      `,
      sqlClient`
        select
          a.entity_id, a.action, a.reason, a.created_at,
          e.first_name as actor_first_name, e.last_name as actor_last_name, e.employee_code as actor_code
        from audit_events a
        left join memberships m on m.tenant_id = a.tenant_id and m.id = a.membership_id
        left join employees e on e.tenant_id = a.tenant_id and e.id = m.employee_id
        where a.tenant_id = ${access.tenantId}
          and a.entity_type = 'requisition'
          and a.action in ('talent.requisition_create', 'talent.requisition_approve', 'talent.requisition_override')
        order by a.created_at asc
        limit ${AUDIT_LIMIT}
      `,
      sqlClient`
        select id, coalesce(attributes->>'name', '') as name
        from departments where tenant_id = ${access.tenantId}
        order by name
      `,
    ]),
  ]);

  // Adoption is a tenant-wide question, as it is at approval: a tenant that ran the control
  // last year has not abandoned it just because this plan year's lines are not approved yet.
  const controlConfigured = lines.length > 0 || adopted;
  const overriderAuthorised = access.context.permissions.includes(OVERRIDE_PERMISSION);

  const conversions = new Map<string, RequisitionConversion[]>();
  for (const row of conversionRows as Array<{
    requisition_id: string; employee_id: string; created_at: string | Date;
    employee_code: string | null; first_name: string | null; last_name: string | null; joining_date: string | null;
  }>) {
    const bucket = conversions.get(row.requisition_id) ?? [];
    bucket.push({
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      name: personName(row.first_name, row.last_name, null),
      joiningDate: row.joining_date,
      linkedAt: stamp(row.created_at),
    });
    conversions.set(row.requisition_id, bucket);
  }

  const audits = new Map<string, RequisitionAuditEntry[]>();
  for (const row of auditRows as Array<{
    entity_id: string; action: string; reason: string | null; created_at: string | Date;
    actor_first_name: string | null; actor_last_name: string | null; actor_code: string | null;
  }>) {
    const bucket = audits.get(row.entity_id) ?? [];
    bucket.push({
      action: row.action,
      label: REQUISITION_AUDIT_LABELS[row.action] ?? row.action,
      reason: row.reason,
      actor: personName(row.actor_first_name, row.actor_last_name, row.actor_code),
      at: stamp(row.created_at),
    });
    audits.set(row.entity_id, bucket);
  }

  const rows: RequisitionRegisterRow[] = (requisitionRows as Array<{
    id: string; attributes: unknown; created_at: string | Date; department_id: string;
    department_name: string; position_code: string | null; position_status: string | null;
    backfill_status: string | null; backfill_found: boolean;
    manager_first_name: string | null; manager_last_name: string | null; manager_code: string | null;
    replacing_first_name: string | null; replacing_last_name: string | null; replacing_code: string | null;
  }>).map((row) => {
    const attributes = attributesOf(row.attributes);
    const requisitionType: RequisitionType = attributes.requisition_type === "replacement" ? "replacement" : "addition";
    const designation = text(attributes.designation);
    const positions = integerOrNull(attributes.positions) ?? 1;
    const againstPositionCode = text(attributes.against_position_code);
    const storedStatus = text(attributes.status) ?? "draft";
    const line = matchSanctionLine(lines, row.department_id, designation);

    // The same four inputs approveRequisition builds, so the register's verdict
    // and the endpoint's verdict cannot disagree. `override` is false because
    // nobody has typed a reason yet - the panel offers the override once the
    // refusal is shown. The row's own draft is taken back out of `open` for
    // exactly the reason approval excludes it: the gate subtracts its positions
    // below, and leaving it in `open` would charge the ceiling for it twice.
    const gate = evaluateRequisitionGate({
      requisitionType,
      positions,
      designation,
      controlActive: controlConfigured,
      controlReason: controlConfigured ? null : unconfiguredReason(planYear),
      line: lineWithoutOwnDraft(line, { requisitionType, storedStatus }),
      againstPositionCode,
      againstPositionVacant:
        text(attributes.requisition_type) !== "replacement"
          ? true
          : row.backfill_found && row.backfill_status !== "filled" && row.backfill_status !== "frozen",
      override: false,
      overrideReason: null,
      overriderAuthorised,
      membershipId: access.context.membershipId,
    });

    const conversionsForRow = conversions.get(row.id) ?? [];
    const auditForRow = audits.get(row.id) ?? [];
    const display = deriveDisplayState({
      storedStatus,
      conversionCount: conversionsForRow.length,
      // A settled requisition is not re-gated: the gate is a forecast of the next
      // approval, and there is no next approval once it has happened.
      gate: storedStatus === "approved" ? null : gate,
    });

    const approvedAt =
      text(attributes.approved_at) ??
      auditForRow.find((entry) => entry.action !== "talent.requisition_create")?.at ??
      null;
    const draftedAt =
      auditForRow.find((entry) => entry.action === "talent.requisition_create")?.at ?? stamp(row.created_at);
    const filledAt = conversionsForRow[0]?.linkedAt ?? null;

    const positionLabel =
      [text(row.position_code), designation].filter(Boolean).join(" · ") ||
      text(attributes.title) ||
      "Position not recorded";

    return {
      id: row.id,
      code: text(attributes.code) ?? `REQ-${row.id.slice(0, 8)}`,
      title: text(attributes.title),
      position: positionLabel,
      positionCode: text(row.position_code),
      designation,
      positionStatus: row.position_status,
      departmentId: row.department_id,
      department: text(row.department_name),
      hiringManager: personName(row.manager_first_name, row.manager_last_name, row.manager_code),
      requisitionType,
      requisitionTypeLabel: requisitionType === "replacement" ? "Replacement" : "Addition",
      positions,
      againstPositionCode,
      replacingEmployee: personName(row.replacing_first_name, row.replacing_last_name, row.replacing_code),
      terms: {
        locationCode: text(attributes.location_code),
        workerClass: text(attributes.worker_class),
        employmentType: text(attributes.employment_type),
        requiredBy: text(attributes.required_by),
        ctcMinMinor: integerOrNull(attributes.ctc_min_minor),
        ctcMaxMinor: integerOrNull(attributes.ctc_max_minor),
        qualificationRequired: text(attributes.qualification_required),
        experienceMinYears: typeof attributes.experience_min_years === "number" ? attributes.experience_min_years : null,
        experienceMaxYears: typeof attributes.experience_max_years === "number" ? attributes.experience_max_years : null,
        skills: Array.isArray(attributes.skills) ? attributes.skills.filter((skill): skill is string => typeof skill === "string") : [],
        justification: text(attributes.justification),
      },
      headroom: projectHeadroom({ requisitionType, controlConfigured, designation, line, planYear }),
      displayState: display.state,
      displayStateLabel: REQUISITION_DISPLAY_STATE_LABELS[display.state],
      displayStateReason: display.reason,
      storedStatus,
      gate,
      overridable: gate.overridable,
      approvalSnapshot: {
        headroomAfter: integerOrNull(attributes.headroom_after),
        consumesSanction:
          attributes.consumes_sanction === undefined ? null : attributes.consumes_sanction === true,
        override: attributes.override === true,
        overrideReason: text(attributes.override_reason),
        establishmentChecked: attributes.establishment_checked === true,
        establishmentNote: text(attributes.establishment_note),
        recruiterEmployeeId: text(attributes.recruiter_employee_id),
        approvedAt,
      },
      conversions: conversionsForRow,
      timeline: buildStateTimeline({
        displayState: display.state,
        storedStatus,
        draftedAt,
        approvedAt,
        filledAt,
        gate: storedStatus === "approved" ? null : gate,
        blockedReason: display.state === "blocked" ? display.reason : null,
      }),
      auditTrail: auditForRow,
      createdAt: stamp(row.created_at),
    };
  });

  const counts = REQUISITION_DISPLAY_STATES.reduce(
    (total, state) => ({ ...total, [state]: rows.filter((row) => row.displayState === state).length }),
    {} as Record<RequisitionDisplayState, number>,
  );

  const notes: string[] = [SUBMITTED_NOT_RECORDED];
  if (!controlConfigured) notes.push(unconfiguredReason(planYear));

  return {
    planYear,
    controlConfigured,
    controlNote: controlConfigured ? null : unconfiguredReason(planYear),
    overrideReasonMinLength: OVERRIDE_REASON_MIN_LENGTH,
    overrideRequiredPermission: OVERRIDE_PERMISSION,
    overriderAuthorised,
    stateLabels: REQUISITION_DISPLAY_STATE_LABELS,
    stateProvenance: REQUISITION_STATE_PROVENANCE,
    notes,
    counts,
    departments: (departmentRows as Array<{ id: string; name: string }>).map((row) => ({
      id: row.id,
      name: row.name || "Unnamed department",
    })),
    rows,
  };
}

/**
 * `open` counts every live addition against the key, including the draft being gated. The
 * approval path excludes that draft from the count because `decideRequisition` subtracts its
 * positions; the register's forecast has to make the same adjustment or it will show a
 * refusal the endpoint would not give. One draft contributes exactly one to `open`, so the
 * adjustment is one.
 */
export function lineWithoutOwnDraft<T extends { open: number }>(
  line: T | null,
  row: { requisitionType: RequisitionType; storedStatus: string },
): T | null {
  if (!line || row.requisitionType !== "addition" || row.storedStatus !== "draft") return line;
  return { ...line, open: Math.max(line.open - 1, 0) };
}

export function unconfiguredReason(planYear: number): string {
  return (
    `No approved manpower lines exist for ${planYear}, so establishment control is not in force. ` +
    `Headroom is unknown rather than zero, and requisition approvals are not being checked against a ceiling. ` +
    `Approve sanctioned strength to enable the check.`
  );
}

/** Sanction keys are matched on org unit and designation, case-insensitively, as `headroomForKey` does. */
export function matchSanctionLine(
  lines: readonly EstablishmentLine[],
  departmentId: string,
  designation: string | null,
): EstablishmentLine | null {
  if (!designation) return null;
  const needle = designation.toLowerCase();
  return lines.find((line) => line.departmentId === departmentId && line.designation.toLowerCase() === needle) ?? null;
}

// ---------------------------------------------------------------------------
// Live preview behind the raise-requisition form
// ---------------------------------------------------------------------------

export type RequisitionPreview = {
  planYear: number;
  controlConfigured: boolean;
  headroom: HeadroomProjection;
  gate: RequisitionGate;
  overriderAuthorised: boolean;
  overrideReasonMinLength: number;
  overrideRequiredPermission: string;
};

/**
 * The headroom and verdict for a requisition that has not been raised yet.
 *
 * It runs the same gate as the register and as approval, so the form cannot
 * promise an approval the endpoint will refuse. The rule is never restated in
 * the browser: the client posts the form's fields and renders what comes back.
 */
export async function previewRequisition(
  access: Access,
  input: {
    requisitionType: RequisitionType;
    departmentId: string;
    designation: string | null;
    positions: number;
    againstPositionCode: string | null;
    override: boolean;
    overrideReason: string | null;
    planYear?: number;
  },
): Promise<RequisitionPreview> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const planYear = planYearOf(input.planYear);
  const [lines, adopted] = await Promise.all([listEstablishment(access, { planYear }), establishmentAdopted(access)]);
  const controlConfigured = lines.length > 0 || adopted;
  const overriderAuthorised = access.context.permissions.includes(OVERRIDE_PERMISSION);

  let againstPositionVacant = true;
  if (input.requisitionType === "replacement") {
    const code = input.againstPositionCode?.trim() ?? "";
    againstPositionVacant = false;
    if (code) {
      const [positionRows] = await tenantTx(access, [
        sqlClient`
          select record_status from positions
          where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1
        `,
      ]);
      const position = (positionRows as Array<{ record_status: string | null }>)[0];
      againstPositionVacant = position ? position.record_status !== "filled" && position.record_status !== "frozen" : false;
    }
  }

  const line = matchSanctionLine(lines, input.departmentId, input.designation);
  return {
    planYear,
    controlConfigured,
    headroom: projectHeadroom({
      requisitionType: input.requisitionType,
      controlConfigured,
      designation: input.designation,
      line,
      planYear,
    }),
    gate: evaluateRequisitionGate({
      requisitionType: input.requisitionType,
      positions: input.positions,
      designation: input.designation,
      controlActive: controlConfigured,
      controlReason: controlConfigured ? null : unconfiguredReason(planYear),
      line,
      againstPositionCode: input.againstPositionCode,
      againstPositionVacant,
      override: input.override,
      overrideReason: input.overrideReason,
      overriderAuthorised,
      membershipId: access.context.membershipId,
    }),
    overriderAuthorised,
    overrideReasonMinLength: OVERRIDE_REASON_MIN_LENGTH,
    overrideRequiredPermission: OVERRIDE_PERMISSION,
  };
}

// ---------------------------------------------------------------------------
// Query contract
// ---------------------------------------------------------------------------

export const requisitionRegisterQuerySchema = z.object({
  planYear: z.coerce.number().int().min(2000).max(2200).optional(),
  state: z.enum(REQUISITION_DISPLAY_STATES).optional(),
  /** Present only while the raise form is being filled in. */
  previewRequisitionType: z.enum(REQUISITION_TYPES).optional(),
  previewDepartmentId: z.string().uuid().optional(),
  previewDesignation: z.string().trim().min(1).max(120).optional(),
  previewPositions: z.coerce.number().int().min(1).max(99).optional(),
  previewAgainstPositionCode: z.string().trim().max(40).optional(),
  previewOverride: z.enum(["true", "false"]).optional(),
  previewOverrideReason: z.string().trim().max(1000).optional(),
});

export type RequisitionRegisterQuery = z.infer<typeof requisitionRegisterQuerySchema>;

/**
 * A preview is only worth computing once the form carries the fields the gate
 * actually reads: a replacement needs the vacated position code, an addition
 * needs the sanction key.
 */
export function wantsPreview(query: RequisitionRegisterQuery): boolean {
  if (query.previewRequisitionType === "replacement") return Boolean(query.previewAgainstPositionCode);
  if (query.previewRequisitionType === "addition") return Boolean(query.previewDepartmentId);
  return false;
}
