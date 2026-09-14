import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { MIN_ANONYMITY_COHORT } from "@/server/performance/service";

/**
 * Talent review: 9-box calibration, the manager coaching register and the
 * succession bench.
 *
 * All three sit here because `okr.ts` and this file are the only server modules
 * this change owns; they share the same governing constraint, which is that the
 * numbers people expect on this screen do not exist anywhere and must not be
 * invented:
 *
 *  - The band boundaries that turn a rating into Low/Medium/High are defined in
 *    no workbook, no table and no reference. So a placement is an explicit human
 *    act recorded against a calibration session, and automatic banding runs ONLY
 *    when boundaries have been configured for the tenant.
 *  - A coaching note records who (or what) produced it. A note from a model run
 *    is stored and rendered as model-generated, never as if a person wrote it.
 *  - Readiness is a value from a closed vocabulary that a human records. No
 *    readiness percentage is published, because no formula for one exists.
 */

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/* ------------------------------------------------------------------ *
 * 9-box calibration
 * ------------------------------------------------------------------ */

export const NINE_BOX_BANDS = ["low", "medium", "high"] as const;
export type NineBoxBand = (typeof NINE_BOX_BANDS)[number];

export const NINE_BOX_BAND_LABELS: Record<NineBoxBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export type NineBoxCell = { key: string; performance: NineBoxBand; potential: NineBoxBand; label: string };

export function nineBoxCellKey(performance: NineBoxBand, potential: NineBoxBand): string {
  return `${performance}-performance/${potential}-potential`;
}

/**
 * The nine cells, named only by the two bands that define them. The reference's
 * cell names ("Star", "Enigma", …) are editorial labels nothing in this system
 * defines, and attaching one to a person is a judgement no code here may make.
 */
export const NINE_BOX_CELLS: NineBoxCell[] = ([...NINE_BOX_BANDS] as NineBoxBand[])
  .slice()
  .reverse()
  .flatMap((potential) =>
    NINE_BOX_BANDS.map((performance) => ({
      key: nineBoxCellKey(performance, potential),
      performance,
      potential,
      label: `${NINE_BOX_BAND_LABELS[performance]} performance · ${NINE_BOX_BAND_LABELS[potential]} potential`,
    })),
  );

export const nineBoxBoundariesSchema = z
  .object({
    ratingScaleMax: z.number().positive(),
    mediumAtOrAbove: z.number().min(0),
    highAtOrAbove: z.number().min(0),
  })
  .refine((value) => value.highAtOrAbove > value.mediumAtOrAbove, { message: "The high cut-off must sit above the medium cut-off." })
  .refine((value) => value.highAtOrAbove <= value.ratingScaleMax, { message: "The high cut-off must sit within the rating scale." });

export type NineBoxBoundaries = z.infer<typeof nineBoxBoundariesSchema>;

export const BANDING_NOT_CONFIGURED_REASON =
  "No 9-box band boundaries are configured for this tenant. A rating cannot be turned into Low, Medium or High without a recorded cut-off, so every placement must be made by a person.";

export type BandClassification =
  | { determined: true; band: NineBoxBand; basis: string }
  | { determined: false; reason: string };

/**
 * Turns a rating into a band. With no configured boundaries this refuses —
 * it never picks a cut-off, because this decides how a person is labelled.
 */
export function classifyRating(rating: number | null, boundaries: NineBoxBoundaries | null): BandClassification {
  if (!boundaries) return { determined: false, reason: BANDING_NOT_CONFIGURED_REASON };
  if (rating === null || !Number.isFinite(rating)) {
    return { determined: false, reason: "No rating is recorded for this person in this cycle." };
  }
  if (rating >= boundaries.highAtOrAbove) {
    return { determined: true, band: "high", basis: `Rating ${rating} is at or above the configured high cut-off of ${boundaries.highAtOrAbove}.` };
  }
  if (rating >= boundaries.mediumAtOrAbove) {
    return { determined: true, band: "medium", basis: `Rating ${rating} is at or above the configured medium cut-off of ${boundaries.mediumAtOrAbove}.` };
  }
  return { determined: true, band: "low", basis: `Rating ${rating} is below the configured medium cut-off of ${boundaries.mediumAtOrAbove}.` };
}

export function assertBandingConfigured(boundaries: NineBoxBoundaries | null): NineBoxBoundaries {
  if (!boundaries) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: BANDING_NOT_CONFIGURED_REASON,
      details: [{ field: "settings.performance.nine_box", issue: "Configure mediumAtOrAbove and highAtOrAbove before automatic banding can run." }],
    });
  }
  return boundaries;
}

export type PlacementSource = "manual" | "configured-bands";

export type PlacementView = {
  id: string;
  employeeId: string;
  calibrationSessionId: string;
  reviewSummaryId: string | null;
  performanceBand: NineBoxBand;
  potentialBand: NineBoxBand;
  cellKey: string;
  source: PlacementSource;
  rationale: string;
  adjustmentReason: string | null;
  placedByUserId: string | null;
  placedAt: string | null;
  /** Number of review respondents behind the linked summary, when known. */
  respondentCount: number | null;
  reviewRating: number | null;
  anonymised: boolean;
  anonymityNote: string | null;
};

/**
 * Applies the five-respondent anonymity floor to the review evidence carried
 * alongside a placement. The placement itself stays visible — calibration is a
 * named, accountable act — but a rating computed from fewer than five
 * respondents is withheld, because it would identify them.
 */
export function applyAnonymityFloor<T extends { respondentCount: number | null; reviewRating: number | null }>(
  entries: readonly T[],
): Array<T & { reviewRating: number | null; anonymised: boolean; anonymityNote: string | null }> {
  return entries.map((entry) => {
    const below = entry.respondentCount !== null && entry.respondentCount < MIN_ANONYMITY_COHORT;
    return {
      ...entry,
      reviewRating: below ? null : entry.reviewRating,
      anonymised: below,
      anonymityNote: below
        ? `Review evidence is withheld: fewer than ${MIN_ANONYMITY_COHORT} respondents contributed, so the aggregate would identify them.`
        : null,
    };
  });
}

export const recordPlacementSchema = z.object({
  calibrationSessionId: z.string().uuid(),
  employeeId: z.string().uuid(),
  reviewSummaryId: z.string().uuid().optional(),
  performanceBand: z.enum(NINE_BOX_BANDS),
  potentialBand: z.enum(NINE_BOX_BANDS),
  rationale: z.string().trim().min(1).max(1000),
  /** Present when this placement moves the person out of a cell recorded earlier. */
  adjustmentReason: z.string().trim().min(1).max(500).optional(),
});

export type RecordPlacementInput = z.infer<typeof recordPlacementSchema>;

/** Reads the tenant's configured 9-box cut-offs, or null when none are recorded. */
export async function readNineBoxBoundaries(access: Access): Promise<NineBoxBoundaries | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const settings = asRecord((rows as Array<{ settings: unknown }>)[0]?.settings);
  const nineBox = asRecord(asRecord(settings.performance).nine_box);
  const parsed = nineBoxBoundariesSchema.safeParse({
    ratingScaleMax: numberOrNull(nineBox.rating_scale_max),
    mediumAtOrAbove: numberOrNull(nineBox.medium_at_or_above),
    highAtOrAbove: numberOrNull(nineBox.high_at_or_above),
  });
  return parsed.success ? parsed.data : null;
}

async function assertEmployee(access: Access, employeeId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

async function readOpenCalibrationSession(access: Access, sessionId: string): Promise<{ id: string; attributes: UnknownRecord }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from calibration_sessions where tenant_id = ${access.tenantId} and id = ${sessionId} limit 1`,
  ]);
  const session = (rows as Array<{ id: string; attributes: UnknownRecord }>)[0];
  if (!session) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (stringOrNull(asRecord(session.attributes).status) !== "open") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The calibration session is closed." });
  }
  return session;
}

/**
 * Records a human 9-box placement against a calibration session. The row is the
 * `talent_placements` FK triple; who placed whom, when, and why is kept in its
 * attributes and mirrored into the audit trail.
 */
export async function recordTalentPlacement(
  access: Access,
  input: RecordPlacementInput,
  requestId: string,
): Promise<{ id: string; cellKey: string; replaced: string | null }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await readOpenCalibrationSession(access, input.calibrationSessionId);
  await assertEmployee(access, input.employeeId);

  const [priorRows] = await tenantTx(access, [
    sqlClient`select id, attributes from talent_placements where tenant_id = ${access.tenantId} and calibration_session_id = ${input.calibrationSessionId} and employee_id = ${input.employeeId} order by created_at desc limit 1`,
  ]);
  const prior = (priorRows as Array<{ id: string; attributes: UnknownRecord }>)[0] ?? null;
  const priorCell = prior ? stringOrNull(asRecord(prior.attributes).cell_key) : null;
  const cellKey = nineBoxCellKey(input.performanceBand, input.potentialBand);

  if (prior && priorCell !== null && priorCell !== cellKey && !input.adjustmentReason) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "Moving someone out of a recorded cell needs an adjustment reason.",
      details: [{ field: "adjustmentReason", issue: "State why the earlier placement is being changed." }],
    });
  }

  const id = crypto.randomUUID();
  const attributes = {
    performance_band: input.performanceBand,
    potential_band: input.potentialBand,
    cell_key: cellKey,
    // Placement is always a human act on this path; automatic banding, when the
    // tenant configures cut-offs, proposes a cell but a person still records it.
    source: "manual" satisfies PlacementSource,
    rationale: input.rationale,
    adjustment_reason: input.adjustmentReason ?? null,
    replaced_placement_id: prior?.id ?? null,
    replaced_cell_key: priorCell,
    placed_by_user_id: access.context.actorUserId,
    placed_by_membership_id: access.context.membershipId,
    placed_at: new Date().toISOString(),
  };

  await tenantTx(access, [
    sqlClient`
      insert into talent_placements (id, tenant_id, calibration_session_id, employee_id, review_summary_id, attributes)
      values (${id}, ${access.tenantId}, ${input.calibrationSessionId}, ${input.employeeId}, ${input.reviewSummaryId ?? null}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.talent_placement', 'talent_placement', ${id},
        ${input.adjustmentReason ?? input.rationale},
        ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, cellKey, replaced: prior?.id ?? null };
}

export type NineBoxGrid = {
  calibrationSessionId: string | null;
  bandingConfigured: boolean;
  bandingNote: string;
  boundaries: NineBoxBoundaries | null;
  placements: PlacementView[];
  cells: Array<NineBoxCell & { employeeIds: string[]; placementIds: string[] }>;
  unplacedNote: string;
};

/** Reads the 9-box grid for one calibration session. */
export async function listTalentPlacements(access: Access, calibrationSessionId: string | null): Promise<NineBoxGrid> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const boundaries = await readNineBoxBoundaries(access);

  let rows: Array<{ id: string; calibration_session_id: string; employee_id: string; review_summary_id: string | null; attributes: UnknownRecord; created_at: string }> = [];
  let summaries: Array<{ id: string; attributes: UnknownRecord }> = [];

  if (calibrationSessionId) {
    const [placementRows] = await tenantTx(access, [
      sqlClient`select id, calibration_session_id, employee_id, review_summary_id, attributes, created_at from talent_placements where tenant_id = ${access.tenantId} and calibration_session_id = ${calibrationSessionId} order by created_at asc, id asc`,
    ]);
    rows = placementRows as typeof rows;
    const summaryIds = rows.map((row) => row.review_summary_id).filter((value): value is string => value !== null);
    if (summaryIds.length > 0) {
      const [summaryRows] = await tenantTx(access, [
        sqlClient`select id, attributes from review_summaries where tenant_id = ${access.tenantId} and id = any(${summaryIds}::uuid[])`,
      ]);
      summaries = summaryRows as typeof summaries;
    }
  }

  const summaryById = new Map(summaries.map((summary) => [summary.id, asRecord(summary.attributes)]));

  // Only the latest placement per employee is the current cell; earlier rows are
  // history and stay in the table for the audit trail.
  const latestByEmployee = new Map<string, (typeof rows)[number]>();
  for (const row of rows) latestByEmployee.set(row.employee_id, row);

  const raw = [...latestByEmployee.values()].map((row) => {
    const attributes = asRecord(row.attributes);
    const summary = row.review_summary_id ? summaryById.get(row.review_summary_id) : undefined;
    const performanceBand = (stringOrNull(attributes.performance_band) ?? "low") as NineBoxBand;
    const potentialBand = (stringOrNull(attributes.potential_band) ?? "low") as NineBoxBand;
    return {
      id: row.id,
      employeeId: row.employee_id,
      calibrationSessionId: row.calibration_session_id,
      reviewSummaryId: row.review_summary_id,
      performanceBand,
      potentialBand,
      cellKey: stringOrNull(attributes.cell_key) ?? nineBoxCellKey(performanceBand, potentialBand),
      source: (stringOrNull(attributes.source) ?? "manual") as PlacementSource,
      rationale: stringOrNull(attributes.rationale) ?? "",
      adjustmentReason: stringOrNull(attributes.adjustment_reason),
      placedByUserId: stringOrNull(attributes.placed_by_user_id),
      placedAt: stringOrNull(attributes.placed_at) ?? row.created_at,
      respondentCount: summary ? numberOrNull(summary.respondent_count) : null,
      reviewRating: summary ? numberOrNull(summary.overall_rating) : null,
    };
  });

  const placements = applyAnonymityFloor(raw);
  const cells = NINE_BOX_CELLS.map((cell) => {
    const inCell = placements.filter((placement) => placement.cellKey === cell.key);
    return { ...cell, employeeIds: inCell.map((placement) => placement.employeeId), placementIds: inCell.map((placement) => placement.id) };
  });

  return {
    calibrationSessionId,
    bandingConfigured: boundaries !== null,
    bandingNote: boundaries
      ? `Automatic banding is configured: medium at or above ${boundaries.mediumAtOrAbove}, high at or above ${boundaries.highAtOrAbove} on a ${boundaries.ratingScaleMax}-point scale. A person still records every placement.`
      : BANDING_NOT_CONFIGURED_REASON,
    boundaries,
    placements,
    cells,
    unplacedNote: "Only people a facilitator has explicitly placed appear on the grid. Nobody is auto-placed.",
  };
}

/* ------------------------------------------------------------------ *
 * Manager coaching register
 * ------------------------------------------------------------------ */

export const COACHING_ORIGINS = ["human", "model-generated"] as const;
export type CoachingOrigin = (typeof COACHING_ORIGINS)[number];

export const COACHING_STATUSES = ["open", "action-created", "dismissed"] as const;
export type CoachingStatus = (typeof COACHING_STATUSES)[number];

export const recordCoachingNoteSchema = z
  .object({
    managerEmployeeId: z.string().uuid(),
    subjectEmployeeId: z.string().uuid(),
    note: z.string().trim().min(1).max(4000),
    suggestedGrowthAction: z.string().trim().min(1).max(500).optional(),
    origin: z.enum(COACHING_ORIGINS).default("human"),
    /** Required when the note came from a model run, so provenance is never lost. */
    aiRunId: z.string().uuid().optional(),
  })
  .refine((value) => value.origin !== "model-generated" || value.aiRunId !== undefined, {
    message: "A model-generated note must carry the ai_run_id it came from.",
    path: ["aiRunId"],
  })
  .refine((value) => value.origin !== "human" || value.aiRunId === undefined, {
    message: "A note attributed to a person must not carry a model run id.",
    path: ["aiRunId"],
  });

export type RecordCoachingNoteInput = z.infer<typeof recordCoachingNoteSchema>;

/** The provenance sentence rendered beside every note. Never omitted. */
export function describeCoachingOrigin(note: { origin: CoachingOrigin; aiRunId: string | null }): string {
  if (note.origin === "model-generated") {
    return `Generated by model run ${note.aiRunId ?? "(unrecorded)"} — not written by a person. Review before acting on it.`;
  }
  return "Written by a person.";
}

export type CoachingNoteView = {
  id: string;
  managerEmployeeId: string;
  subjectEmployeeId: string;
  note: string;
  suggestedGrowthAction: string | null;
  origin: CoachingOrigin;
  aiRunId: string | null;
  provenance: string;
  status: CoachingStatus;
  growthActionId: string | null;
  authorUserId: string | null;
  createdAt: string;
};

export async function recordCoachingNote(access: Access, input: RecordCoachingNoteInput, requestId: string): Promise<{ id: string }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.managerEmployeeId);
  await assertEmployee(access, input.subjectEmployeeId);
  const id = crypto.randomUUID();
  const attributes = {
    note: input.note,
    suggested_growth_action: input.suggestedGrowthAction ?? null,
    origin: input.origin,
    status: "open" satisfies CoachingStatus,
    growth_action_id: null,
    author_user_id: input.origin === "human" ? access.context.actorUserId : null,
    recorded_by_user_id: access.context.actorUserId,
    recorded_at: new Date().toISOString(),
  };
  await tenantTx(access, [
    sqlClient`
      insert into manager_coaching_notes (id, tenant_id, manager_employee_id, subject_employee_id, ai_run_id, attributes)
      values (${id}, ${access.tenantId}, ${input.managerEmployeeId}, ${input.subjectEmployeeId}, ${input.aiRunId ?? null}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.coaching_note', 'manager_coaching_note', ${id}, 'Coaching note recorded',
        ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

export async function listCoachingNotes(access: Access, subjectEmployeeId: string | null): Promise<CoachingNoteView[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    subjectEmployeeId
      ? sqlClient`select id, manager_employee_id, subject_employee_id, ai_run_id, attributes, created_at from manager_coaching_notes where tenant_id = ${access.tenantId} and subject_employee_id = ${subjectEmployeeId} order by created_at desc, id desc limit 200`
      : sqlClient`select id, manager_employee_id, subject_employee_id, ai_run_id, attributes, created_at from manager_coaching_notes where tenant_id = ${access.tenantId} order by created_at desc, id desc limit 200`,
  ]);
  return (rows as Array<{ id: string; manager_employee_id: string; subject_employee_id: string; ai_run_id: string | null; attributes: UnknownRecord; created_at: string }>).map((row) => {
    const attributes = asRecord(row.attributes);
    const origin = (stringOrNull(attributes.origin) ?? (row.ai_run_id ? "model-generated" : "human")) as CoachingOrigin;
    return {
      id: row.id,
      managerEmployeeId: row.manager_employee_id,
      subjectEmployeeId: row.subject_employee_id,
      note: stringOrNull(attributes.note) ?? "",
      suggestedGrowthAction: stringOrNull(attributes.suggested_growth_action),
      origin,
      aiRunId: row.ai_run_id,
      provenance: describeCoachingOrigin({ origin, aiRunId: row.ai_run_id }),
      status: (stringOrNull(attributes.status) ?? "open") as CoachingStatus,
      growthActionId: stringOrNull(attributes.growth_action_id),
      authorUserId: stringOrNull(attributes.author_user_id),
      createdAt: row.created_at,
    };
  });
}

export const applyGrowthActionSchema = z.object({
  coachingNoteId: z.string().uuid(),
  action: z.string().trim().min(1).max(500),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Turns a note's suggested growth action into a tracked check-in on the subject,
 * and moves the note to `action-created`. The note is never deleted or rewritten.
 */
export async function applyGrowthAction(
  access: Access,
  input: z.infer<typeof applyGrowthActionSchema>,
  requestId: string,
): Promise<{ id: string; coachingNoteId: string }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, subject_employee_id, ai_run_id, attributes from manager_coaching_notes where tenant_id = ${access.tenantId} and id = ${input.coachingNoteId} limit 1`,
  ]);
  const note = (rows as Array<{ id: string; subject_employee_id: string; ai_run_id: string | null; attributes: UnknownRecord }>)[0];
  if (!note) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const status = stringOrNull(asRecord(note.attributes).status) ?? "open";
  if (status !== "open") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This coaching note already has a tracked action." });
  }

  const actionId = crypto.randomUUID();
  const origin = stringOrNull(asRecord(note.attributes).origin) ?? (note.ai_run_id ? "model-generated" : "human");
  await tenantTx(access, [
    sqlClient`
      insert into checkins (id, tenant_id, employee_id, key_result_id, objective_id, attributes)
      values (${actionId}, ${access.tenantId}, ${note.subject_employee_id}, null, null,
        ${JSON.stringify({
          notes: input.action,
          progress_pct: null,
          kind: "growth-action",
          coaching_note_id: note.id,
          coaching_note_origin: origin,
          due_date: input.dueDate ?? null,
          created_by_user_id: access.context.actorUserId,
        })}::jsonb)
    `,
    sqlClient`
      update manager_coaching_notes
      set attributes = attributes || ${JSON.stringify({ status: "action-created", growth_action_id: actionId })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${note.id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.growth_action_apply', 'manager_coaching_note', ${note.id}, 'Growth action created from coaching note',
        ${JSON.stringify({ growth_action_id: actionId, action: input.action })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: actionId, coachingNoteId: note.id };
}

/* ------------------------------------------------------------------ *
 * Succession bench
 * ------------------------------------------------------------------ */

/**
 * The recorded readiness vocabulary. It matches `createSuccessionSchema` in
 * `service.ts` exactly so a bench recorded through the existing
 * `POST /api/v1/succession-plans` endpoint reads back through this module
 * without translation. Readiness is an assessment somebody makes, never a
 * computed number.
 */
export const READINESS_VOCABULARY = ["ready-now", "ready-1-2y", "ready-3y-plus"] as const;
export type Readiness = (typeof READINESS_VOCABULARY)[number];

export const READINESS_LABELS: Record<Readiness, string> = {
  "ready-now": "Ready now",
  "ready-1-2y": "Ready in 1–2 years",
  "ready-3y-plus": "Ready in 3 years or more",
};

export const readinessSchema = z.enum(READINESS_VOCABULARY);

export function isReadiness(value: unknown): value is Readiness {
  return typeof value === "string" && (READINESS_VOCABULARY as readonly string[]).includes(value);
}

export type BenchCandidate = { employeeId: string; readiness: Readiness | null; gaps: string[] };

export type BenchSummary = {
  candidateCount: number;
  assessedCount: number;
  counts: Record<Readiness, number>;
  unassessedCount: number;
  readyNowCount: number;
  /** Exactly how anything plan-level here was arrived at. No percentage is published. */
  derivation: string;
};

export const BENCH_DERIVATION_NOTE =
  "Counts are a tally of the readiness values people recorded against this plan. No readiness percentage is published, because no formula for one is defined anywhere in this system.";

export function summariseBench(candidates: readonly BenchCandidate[]): BenchSummary {
  const counts: Record<Readiness, number> = { "ready-now": 0, "ready-1-2y": 0, "ready-3y-plus": 0 };
  let unassessedCount = 0;
  for (const candidate of candidates) {
    if (candidate.readiness === null) unassessedCount += 1;
    else counts[candidate.readiness] += 1;
  }
  return {
    candidateCount: candidates.length,
    assessedCount: candidates.length - unassessedCount,
    counts,
    unassessedCount,
    readyNowCount: counts["ready-now"],
    derivation: BENCH_DERIVATION_NOTE,
  };
}

export const SPOF_DERIVED_CRITERION =
  "Single point of failure: the position has recorded candidates but none of them is recorded as ready now.";

export type SpofAssessment =
  | { source: "recorded"; flagged: boolean; criterion: string }
  | { source: "derived-coverage"; flagged: boolean; criterion: string }
  | { source: "not-assessed"; flagged: null; criterion: string };

/**
 * Single-point-of-failure status.
 *
 * A flag somebody recorded, with their own criterion, always wins. Failing
 * that, the only thing derivable from recorded data is coverage: a plan with
 * candidates but no ready-now successor. A plan with no candidates at all is
 * reported as not assessed — an empty bench is an absence of evidence, not
 * evidence of risk.
 */
export function assessSinglePointOfFailure(plan: {
  recordedSpof: boolean | null;
  recordedCriterion: string | null;
  candidates: readonly BenchCandidate[];
}): SpofAssessment {
  if (plan.recordedSpof !== null) {
    return {
      source: "recorded",
      flagged: plan.recordedSpof,
      criterion: plan.recordedCriterion ?? "Recorded by a person; no criterion was stated alongside the flag.",
    };
  }
  if (plan.candidates.length === 0) {
    return { source: "not-assessed", flagged: null, criterion: "No candidate has been recorded for this position, so nothing can be concluded about cover." };
  }
  return { source: "derived-coverage", flagged: summariseBench(plan.candidates).readyNowCount === 0, criterion: SPOF_DERIVED_CRITERION };
}

export type SuccessionPlanView = {
  id: string;
  positionId: string | null;
  positionCode: string | null;
  ownerEmployeeId: string | null;
  criticalRole: boolean | null;
  criticalRoleReason: string;
  candidates: BenchCandidate[];
  bench: BenchSummary;
  spof: SpofAssessment;
  createdAt: string;
};

export const CRITICAL_ROLE_NOT_RECORDED =
  "Not recorded. No criticality criterion is defined in this system, so a role is critical only when somebody records it as such.";

function readCandidates(value: unknown): BenchCandidate[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = asRecord(entry);
    const readiness = record.readiness;
    return {
      employeeId: stringOrNull(record.employeeId) ?? stringOrNull(record.employee_id) ?? "",
      readiness: isReadiness(readiness) ? readiness : null,
      gaps: Array.isArray(record.gaps) ? record.gaps.filter((gap): gap is string => typeof gap === "string") : [],
    };
  });
}

/**
 * Reads succession plans with their bench. Candidates are taken from
 * `succession_candidates` rows where they exist and fall back to the candidate
 * list `createSuccessionPlan` writes into the plan's attributes, which is the
 * only place any candidate has ever been recorded.
 */
export async function listSuccessionBench(access: Access): Promise<SuccessionPlanView[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [planRows, candidateRows] = await tenantTx(access, [
    sqlClient`select id, position_id, owner_employee_id, attributes, created_at from succession_plans where tenant_id = ${access.tenantId} order by created_at desc, id desc limit 200`,
    sqlClient`select id, succession_plan_id, employee_id, attributes from succession_candidates where tenant_id = ${access.tenantId}`,
  ]);

  const rowsByPlan = new Map<string, BenchCandidate[]>();
  for (const row of candidateRows as Array<{ succession_plan_id: string; employee_id: string; attributes: UnknownRecord }>) {
    const attributes = asRecord(row.attributes);
    const readiness = attributes.readiness;
    const candidate: BenchCandidate = {
      employeeId: row.employee_id,
      readiness: isReadiness(readiness) ? readiness : null,
      gaps: Array.isArray(attributes.gaps) ? attributes.gaps.filter((gap): gap is string => typeof gap === "string") : [],
    };
    const bucket = rowsByPlan.get(row.succession_plan_id);
    if (bucket) bucket.push(candidate);
    else rowsByPlan.set(row.succession_plan_id, [candidate]);
  }

  return (planRows as Array<{ id: string; position_id: string | null; owner_employee_id: string | null; attributes: UnknownRecord; created_at: string }>).map((row) => {
    const attributes = asRecord(row.attributes);
    const candidates = rowsByPlan.get(row.id) ?? readCandidates(attributes.candidates);
    const recordedSpof = typeof attributes.single_point_of_failure === "boolean" ? attributes.single_point_of_failure : null;
    const criticalRole = typeof attributes.critical_role === "boolean" ? attributes.critical_role : null;
    return {
      id: row.id,
      positionId: row.position_id,
      positionCode: stringOrNull(attributes.position_code),
      ownerEmployeeId: row.owner_employee_id,
      criticalRole,
      criticalRoleReason: criticalRole === null ? CRITICAL_ROLE_NOT_RECORDED : stringOrNull(attributes.critical_role_reason) ?? "Recorded by a person; no reason was stated.",
      candidates,
      bench: summariseBench(candidates),
      spof: assessSinglePointOfFailure({ recordedSpof, recordedCriterion: stringOrNull(attributes.spof_criterion), candidates }),
      createdAt: row.created_at,
    };
  });
}

/**
 * Records one bench candidate as a `succession_candidates` row.
 *
 * `succession_candidates` has never been written by anything; `createSuccessionPlan`
 * only nests candidates inside the plan's attributes. This is the write that
 * gives a candidate its own identity, assessor and timestamp.
 */
export const recordSuccessionCandidateSchema = z.object({
  successionPlanId: z.string().uuid(),
  employeeId: z.string().uuid(),
  readiness: readinessSchema,
  assessedByEmployeeId: z.string().uuid().optional(),
  gaps: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  rationale: z.string().trim().min(1).max(1000),
});

export async function recordSuccessionCandidate(
  access: Access,
  input: z.infer<typeof recordSuccessionCandidateSchema>,
  requestId: string,
): Promise<{ id: string }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertEmployee(access, input.employeeId);
  const [planRows] = await tenantTx(access, [
    sqlClient`select id from succession_plans where tenant_id = ${access.tenantId} and id = ${input.successionPlanId} limit 1`,
  ]);
  if ((planRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const id = crypto.randomUUID();
  const attributes = {
    readiness: input.readiness,
    readiness_label: READINESS_LABELS[input.readiness],
    gaps: input.gaps,
    rationale: input.rationale,
    assessed_by_employee_id: input.assessedByEmployeeId ?? null,
    recorded_by_user_id: access.context.actorUserId,
    recorded_at: new Date().toISOString(),
  };
  await tenantTx(access, [
    sqlClient`
      insert into succession_candidates (id, tenant_id, succession_plan_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.successionPlanId}, ${input.employeeId}, ${JSON.stringify(attributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'perf.succession_candidate', 'succession_candidate', ${id}, ${input.rationale},
        ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}
