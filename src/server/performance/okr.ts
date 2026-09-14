import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { createKeyResult, createObjective } from "@/server/performance/service";

/**
 * Cascading OKRs and KRAs.
 *
 * `objectives.parent_objective_id` and `goal_links` have existed since the
 * canonical topology landed but nothing read them, and no weight has ever been
 * recorded anywhere. This module is the derivation layer: it reads the cascade,
 * rolls key-result progress up through it by declared weight, and refuses a
 * parent chain that closes on itself.
 *
 * Two rules the screen depends on and that are deliberately NOT fudged:
 *
 *  1. An objective's progress is DERIVED. `objectives.attributes.progress_pct`
 *     is a stored literal written by `createObjective` (always 0) and never
 *     recomputed; it is reported as `storedProgressPct` next to the derived
 *     number, and `storedDisagrees` says when the two differ. Callers must
 *     render the derived value.
 *  2. Health (RAG) is derived only against a CONFIGURED threshold. No
 *     green/amber/red band is defined in the workbook, the repository or the
 *     reference, so with nothing configured this module reports
 *     `status: "undetermined"` rather than inventing cut-offs.
 */

/** Weights are compared with cent precision; declared percentages are rarely integral. */
export const WEIGHT_TOLERANCE_PCT = 0.01;

/** Declared weights of one sibling set must add up to this. */
export const REQUIRED_SIBLING_WEIGHT_PCT = 100;

export type WeightMode = "declared" | "equal-fallback";

export type KeyResultInput = {
  id: string;
  title: string;
  current: number;
  target: number;
  unit: string;
  /** `key_results.attributes.weight_pct`; null when nobody recorded one. */
  weightPct: number | null;
};

export type ObjectiveInput = {
  id: string;
  parentId: string | null;
  title: string;
  ownerEmployeeId: string | null;
  /** `objectives.attributes.weight_pct` — this objective's share of its parent. */
  weightPct: number | null;
  /**
   * Weight given to this objective's OWN key results when it also has children.
   * Absent means the own key results do not participate in the rollup, and that
   * exclusion is reported rather than silently applied.
   */
  ownWeightPct: number | null;
  /** `objectives.attributes.progress_pct` — a stored literal, never recomputed. */
  storedProgressPct: number | null;
  keyResults: KeyResultInput[];
};

export function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampPct(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Attainment of one key result. A non-positive target cannot produce a
 * percentage, so it returns null (undetermined) rather than 0 or 100.
 */
export function keyResultProgressPct(keyResult: Pick<KeyResultInput, "current" | "target">): number | null {
  if (!Number.isFinite(keyResult.target) || keyResult.target <= 0) return null;
  if (!Number.isFinite(keyResult.current)) return null;
  return roundPct(clampPct((keyResult.current / keyResult.target) * 100));
}

export type WeightedComponent = { weightPct: number | null; valuePct: number | null };

export type WeightedMeanResult = {
  pct: number | null;
  weightMode: WeightMode;
  /** Sum of the weights actually used. */
  usedWeightSum: number;
  /** Components dropped because their own value was undetermined. */
  skippedUndetermined: number;
};

/**
 * Weighted mean over the components whose value is determined.
 *
 * When every contributing component carries a declared weight the mean is
 * normalised by the weights actually present (`Σwv / Σw`). That is the only
 * arithmetic available once a component has been dropped as undetermined, and
 * it never invents a value for a missing one. When any contributing component
 * has no declared weight the whole set falls back to equal weighting and says
 * so through `weightMode`.
 */
export function weightedMean(components: WeightedComponent[]): WeightedMeanResult {
  const determined = components.filter((component) => component.valuePct !== null);
  const skippedUndetermined = components.length - determined.length;
  if (determined.length === 0) {
    return { pct: null, weightMode: "equal-fallback", usedWeightSum: 0, skippedUndetermined };
  }
  const allDeclared = determined.every((component) => component.weightPct !== null && Number.isFinite(component.weightPct));
  if (allDeclared) {
    const usedWeightSum = determined.reduce((total, component) => total + (component.weightPct ?? 0), 0);
    if (usedWeightSum <= 0) {
      return { pct: null, weightMode: "declared", usedWeightSum, skippedUndetermined };
    }
    const weighted = determined.reduce((total, component) => total + (component.weightPct ?? 0) * (component.valuePct ?? 0), 0);
    return { pct: roundPct(weighted / usedWeightSum), weightMode: "declared", usedWeightSum, skippedUndetermined };
  }
  const mean = determined.reduce((total, component) => total + (component.valuePct ?? 0), 0) / determined.length;
  return { pct: roundPct(mean), weightMode: "equal-fallback", usedWeightSum: determined.length, skippedUndetermined };
}

export type SiblingWeightStatus = "valid" | "unweighted" | "partial" | "mismatched";

export type SiblingWeightCheck = {
  /** null for the root set. */
  parentId: string | null;
  childIds: string[];
  declaredCount: number;
  sumPct: number;
  status: SiblingWeightStatus;
  message: string;
};

/**
 * Weights must sum to 100 within a sibling set.
 *
 * What happens when they do not: nothing is normalised behind the user's back
 * and no rollup is suppressed. The set is reported as `partial` (some children
 * carry no weight) or `mismatched` (they carry weights that do not add to 100),
 * the rollup proceeds over the weights actually declared — normalised by their
 * real sum, or by equal weighting for a partial set — and the caller is
 * expected to render the discrepancy beside the number it produced.
 */
export function checkSiblingWeights(objectives: ObjectiveInput[]): SiblingWeightCheck[] {
  const groups = new Map<string, ObjectiveInput[]>();
  for (const objective of objectives) {
    const key = objective.parentId ?? "";
    const existing = groups.get(key);
    if (existing) existing.push(objective);
    else groups.set(key, [objective]);
  }
  return [...groups.entries()].map(([key, children]) => {
    const parentId = key === "" ? null : key;
    const declared = children.filter((child) => child.weightPct !== null && Number.isFinite(child.weightPct));
    const sumPct = roundPct(declared.reduce((total, child) => total + (child.weightPct ?? 0), 0));
    const childIds = children.map((child) => child.id);
    const scope = parentId === null ? "top-level objectives" : "children of this objective";
    if (declared.length === 0) {
      return { parentId, childIds, declaredCount: 0, sumPct: 0, status: "unweighted" as const, message: `No weight is recorded for the ${scope}. The rollup weights them equally.` };
    }
    if (declared.length !== children.length) {
      return { parentId, childIds, declaredCount: declared.length, sumPct, status: "partial" as const, message: `${declared.length} of ${children.length} ${scope} carry a weight. A partly weighted set cannot be weighted meaningfully, so the rollup weights all of them equally until every sibling has one.` };
    }
    if (Math.abs(sumPct - REQUIRED_SIBLING_WEIGHT_PCT) > WEIGHT_TOLERANCE_PCT) {
      return { parentId, childIds, declaredCount: declared.length, sumPct, status: "mismatched" as const, message: `Weights for the ${scope} add up to ${sumPct}%, not 100%. The rollup divides by the ${sumPct}% actually declared; correct the weights so the number is trustworthy.` };
    }
    return { parentId, childIds, declaredCount: declared.length, sumPct, status: "valid" as const, message: `Weights add up to 100%.` };
  });
}

export type ParentEdge = { id: string; parentId: string | null };

/**
 * Returns one cycle in the parent chain as an ordered id list (first id repeated
 * conceptually at the end), or null when the cascade is a forest.
 */
export function findParentCycle(edges: readonly ParentEdge[]): string[] | null {
  const parentOf = new Map<string, string | null>();
  for (const edge of edges) parentOf.set(edge.id, edge.parentId);
  const state = new Map<string, "visiting" | "done">();

  for (const edge of edges) {
    if (state.get(edge.id) === "done") continue;
    const path: string[] = [];
    let cursor: string | null = edge.id;
    while (cursor !== null && parentOf.has(cursor)) {
      const seen = state.get(cursor);
      if (seen === "done") break;
      if (seen === "visiting") {
        const start = path.indexOf(cursor);
        return path.slice(start === -1 ? 0 : start);
      }
      state.set(cursor, "visiting");
      path.push(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
    for (const id of path) state.set(id, "done");
  }
  return null;
}

/** Would attaching `childId` under `parentId` close a loop in the current cascade? */
export function wouldCreateCycle(edges: readonly ParentEdge[], childId: string, parentId: string | null): boolean {
  if (parentId === null) return false;
  if (parentId === childId) return true;
  const next = edges.map((edge) => (edge.id === childId ? { id: edge.id, parentId } : edge));
  if (!next.some((edge) => edge.id === childId)) next.push({ id: childId, parentId });
  const cycle = findParentCycle(next);
  return cycle !== null && cycle.includes(childId);
}

export function assertAcyclicCascade(edges: readonly ParentEdge[]): void {
  const cycle = findParentCycle(edges);
  if (cycle) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The objective cascade contains a cycle and cannot be rolled up.",
      details: cycle.map((id) => ({ field: `objectives.${id}.parentObjectiveId`, issue: "This objective is its own ancestor." })),
    });
  }
}

export const okrHealthThresholdsSchema = z
  .object({
    greenAtOrAbovePct: z.number().min(0).max(100),
    amberAtOrAbovePct: z.number().min(0).max(100),
  })
  .refine((value) => value.greenAtOrAbovePct > value.amberAtOrAbovePct, {
    message: "The green threshold must sit above the amber threshold.",
  });

export type OkrHealthThresholds = z.infer<typeof okrHealthThresholdsSchema>;

export type HealthStatus = "green" | "amber" | "red" | "undetermined";

export type HealthVerdict = { status: HealthStatus; reason: string };

export const HEALTH_NOT_CONFIGURED_REASON =
  "No RAG threshold is configured for this tenant, so health cannot be determined. Record the green and amber cut-offs before this column means anything.";

/**
 * RAG is a policy decision, not a constant. Without configured cut-offs this
 * returns `undetermined` — it never guesses a band.
 */
export function deriveHealth(progressPct: number | null, thresholds: OkrHealthThresholds | null): HealthVerdict {
  if (!thresholds) return { status: "undetermined", reason: HEALTH_NOT_CONFIGURED_REASON };
  if (progressPct === null) {
    return { status: "undetermined", reason: "No key result on this branch carries a measurable target, so there is no progress to band." };
  }
  if (progressPct >= thresholds.greenAtOrAbovePct) {
    return { status: "green", reason: `Progress ${progressPct}% is at or above the configured green threshold of ${thresholds.greenAtOrAbovePct}%.` };
  }
  if (progressPct >= thresholds.amberAtOrAbovePct) {
    return { status: "amber", reason: `Progress ${progressPct}% is at or above the configured amber threshold of ${thresholds.amberAtOrAbovePct}% but below green at ${thresholds.greenAtOrAbovePct}%.` };
  }
  return { status: "red", reason: `Progress ${progressPct}% is below the configured amber threshold of ${thresholds.amberAtOrAbovePct}%.` };
}

export type ProgressSource = "key-results" | "children" | "children-and-own-key-results" | "none";

export type ObjectiveRollup = {
  id: string;
  parentId: string | null;
  title: string;
  ownerEmployeeId: string | null;
  depth: number;
  childIds: string[];
  weightPct: number | null;
  /** Aggregate of this objective's own key results, independent of the cascade. */
  ownKeyResultProgressPct: number | null;
  keyResultCount: number;
  derivedProgressPct: number | null;
  progressSource: ProgressSource;
  weightMode: WeightMode;
  storedProgressPct: number | null;
  storedDisagrees: boolean;
  health: HealthVerdict;
  notes: string[];
};

export type CascadeRollup = {
  nodes: ObjectiveRollup[];
  weightChecks: SiblingWeightCheck[];
  thresholdsConfigured: boolean;
};

/**
 * Rolls key-result progress up the cascade.
 *
 * A leaf takes the weighted mean of its own key results. A parent takes the
 * weighted mean of its children's derived progress; its own key results join
 * that set only when an explicit `ownWeightPct` says how much they are worth,
 * and are otherwise reported as excluded. Undetermined children drop out of the
 * mean instead of being counted as zero.
 */
export function rollupObjectives(objectives: readonly ObjectiveInput[], thresholds: OkrHealthThresholds | null): CascadeRollup {
  const list = [...objectives];
  assertAcyclicCascade(list.map((objective) => ({ id: objective.id, parentId: objective.parentId })));

  const byId = new Map(list.map((objective) => [objective.id, objective]));
  const childrenOf = new Map<string, ObjectiveInput[]>();
  for (const objective of list) {
    // A parent id pointing outside the tenant slice is treated as a root.
    const parentId = objective.parentId !== null && byId.has(objective.parentId) ? objective.parentId : null;
    const bucket = childrenOf.get(parentId ?? "");
    if (bucket) bucket.push(objective);
    else childrenOf.set(parentId ?? "", [objective]);
  }

  const computed = new Map<string, ObjectiveRollup>();

  function ownKeyResults(objective: ObjectiveInput): WeightedMeanResult {
    return weightedMean(objective.keyResults.map((keyResult) => ({ weightPct: keyResult.weightPct, valuePct: keyResultProgressPct(keyResult) })));
  }

  function compute(objective: ObjectiveInput, depth: number): ObjectiveRollup {
    const existing = computed.get(objective.id);
    if (existing) return existing;

    const children = childrenOf.get(objective.id) ?? [];
    const childRollups = children.map((child) => compute(child, depth + 1));
    const own = ownKeyResults(objective);
    const notes: string[] = [];

    let derived: WeightedMeanResult;
    let progressSource: ProgressSource;

    if (children.length === 0) {
      derived = own;
      progressSource = objective.keyResults.length === 0 ? "none" : "key-results";
      if (objective.keyResults.length === 0) {
        notes.push("No key result is recorded, so this objective contributes nothing to its parent's rollup.");
      }
    } else {
      const components: WeightedComponent[] = childRollups.map((child) => ({ weightPct: child.weightPct, valuePct: child.derivedProgressPct }));
      if (objective.keyResults.length > 0 && objective.ownWeightPct !== null) {
        components.push({ weightPct: objective.ownWeightPct, valuePct: own.pct });
        progressSource = "children-and-own-key-results";
      } else {
        progressSource = "children";
        if (objective.keyResults.length > 0) {
          notes.push("This objective's own key results are excluded from its rollup because no weight was recorded for them; its number comes from its children alone.");
        }
      }
      derived = weightedMean(components);
      if (derived.skippedUndetermined > 0) {
        notes.push(`${derived.skippedUndetermined} child objective${derived.skippedUndetermined === 1 ? "" : "s"} carry no measurable progress and were left out of the mean rather than counted as zero.`);
      }
    }

    if (derived.weightMode === "equal-fallback" && (children.length > 0 || objective.keyResults.length > 1)) {
      notes.push("Weighted equally: not every contributor carries a declared weight.");
    }

    const storedProgressPct = objective.storedProgressPct;
    const storedDisagrees =
      storedProgressPct !== null && derived.pct !== null && Math.abs(storedProgressPct - derived.pct) > WEIGHT_TOLERANCE_PCT;
    if (storedDisagrees) {
      notes.push(`The stored progress of ${storedProgressPct}% does not follow from this objective's own data; the derived ${derived.pct}% is shown instead.`);
    }

    const rollup: ObjectiveRollup = {
      id: objective.id,
      parentId: objective.parentId !== null && byId.has(objective.parentId) ? objective.parentId : null,
      title: objective.title,
      ownerEmployeeId: objective.ownerEmployeeId,
      depth,
      childIds: children.map((child) => child.id),
      weightPct: objective.weightPct,
      ownKeyResultProgressPct: own.pct,
      keyResultCount: objective.keyResults.length,
      derivedProgressPct: derived.pct,
      progressSource,
      weightMode: derived.weightMode,
      storedProgressPct,
      storedDisagrees,
      health: deriveHealth(derived.pct, thresholds),
      notes,
    };
    computed.set(objective.id, rollup);
    return rollup;
  }

  const roots = childrenOf.get("") ?? [];
  for (const root of roots) compute(root, 0);
  // Anything unreachable from a root (only possible for a malformed slice) is
  // still rendered rather than silently dropped.
  for (const objective of list) if (!computed.has(objective.id)) compute(objective, 0);

  const ordered: ObjectiveRollup[] = [];
  function walk(parentId: string | null): void {
    for (const child of childrenOf.get(parentId ?? "") ?? []) {
      const node = computed.get(child.id);
      if (node) ordered.push(node);
      walk(child.id);
    }
  }
  walk(null);
  for (const node of computed.values()) if (!ordered.includes(node)) ordered.push(node);

  return { nodes: ordered, weightChecks: checkSiblingWeights(list), thresholdsConfigured: thresholds !== null };
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

type UnknownRecord = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

/**
 * Reads the tenant's configured RAG cut-offs from
 * `tenant_settings.settings -> performance -> okr_health`. Returns null when
 * nothing is configured; callers must then report health as undetermined.
 */
export async function readOkrHealthThresholds(access: Access): Promise<OkrHealthThresholds | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const settings = asRecord((rows as Array<{ settings: unknown }>)[0]?.settings);
  const health = asRecord(asRecord(settings.performance).okr_health);
  const parsed = okrHealthThresholdsSchema.safeParse({
    greenAtOrAbovePct: numberOrNull(health.green_at_or_above_pct),
    amberAtOrAbovePct: numberOrNull(health.amber_at_or_above_pct),
  });
  return parsed.success ? parsed.data : null;
}

type ObjectiveRow = {
  id: string;
  parent_objective_id: string | null;
  owner_employee_id: string | null;
  goal_cycle_id: string | null;
  attributes: UnknownRecord;
  created_at: string;
};

type KeyResultRow = { id: string; objective_id: string; owner_employee_id: string | null; attributes: UnknownRecord };

type GoalLinkRow = { child_objective_id: string; parent_objective_id: string };

export type OkrTreeView = CascadeRollup & {
  keyResults: Array<{
    id: string;
    objectiveId: string;
    title: string;
    unit: string;
    current: number;
    target: number;
    weightPct: number | null;
    progressPct: number | null;
    ownerEmployeeId: string | null;
  }>;
  thresholds: OkrHealthThresholds | null;
  healthNote: string;
};

/** Full derived cascade for the screen: objectives, key results, weights, health. */
export async function loadObjectiveTree(access: Access): Promise<OkrTreeView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [objectiveRows, keyResultRows, linkRows] = await tenantTx(access, [
    sqlClient`select id, parent_objective_id, owner_employee_id, goal_cycle_id, attributes, created_at from objectives where tenant_id = ${access.tenantId} order by created_at asc, id asc`,
    sqlClient`select id, objective_id, owner_employee_id, attributes from key_results where tenant_id = ${access.tenantId} order by created_at asc, id asc`,
    sqlClient`select child_objective_id, parent_objective_id from goal_links where tenant_id = ${access.tenantId}`,
  ]);

  const objectives = objectiveRows as ObjectiveRow[];
  const keyResults = keyResultRows as KeyResultRow[];
  const links = linkRows as GoalLinkRow[];

  const linkParent = new Map(links.map((link) => [link.child_objective_id, link.parent_objective_id]));
  const keyResultsByObjective = new Map<string, KeyResultInput[]>();
  const flatKeyResults: OkrTreeView["keyResults"] = [];

  for (const row of keyResults) {
    const attributes = asRecord(row.attributes);
    const target = numberOrNull(attributes.target) ?? 0;
    const current = numberOrNull(attributes.current) ?? 0;
    const input: KeyResultInput = {
      id: row.id,
      title: typeof attributes.title === "string" ? attributes.title : "Untitled key result",
      current,
      target,
      unit: typeof attributes.unit === "string" ? attributes.unit : "pct",
      weightPct: numberOrNull(attributes.weight_pct),
    };
    const bucket = keyResultsByObjective.get(row.objective_id);
    if (bucket) bucket.push(input);
    else keyResultsByObjective.set(row.objective_id, [input]);
    flatKeyResults.push({
      id: row.id,
      objectiveId: row.objective_id,
      title: input.title,
      unit: input.unit,
      current: input.current,
      target: input.target,
      weightPct: input.weightPct,
      progressPct: keyResultProgressPct(input),
      ownerEmployeeId: row.owner_employee_id,
    });
  }

  const inputs: ObjectiveInput[] = objectives.map((row) => {
    const attributes = asRecord(row.attributes);
    return {
      id: row.id,
      parentId: row.parent_objective_id ?? linkParent.get(row.id) ?? null,
      title: typeof attributes.title === "string" ? attributes.title : "Untitled objective",
      ownerEmployeeId: row.owner_employee_id,
      weightPct: numberOrNull(attributes.weight_pct),
      ownWeightPct: numberOrNull(attributes.own_weight_pct),
      storedProgressPct: numberOrNull(attributes.progress_pct),
      keyResults: keyResultsByObjective.get(row.id) ?? [],
    };
  });

  const thresholds = await readOkrHealthThresholds(access);
  const rollup = rollupObjectives(inputs, thresholds);
  return {
    ...rollup,
    keyResults: flatKeyResults,
    thresholds,
    healthNote: thresholds
      ? `Health bands: green at or above ${thresholds.greenAtOrAbovePct}%, amber at or above ${thresholds.amberAtOrAbovePct}%, red below that.`
      : HEALTH_NOT_CONFIGURED_REASON,
  };
}

const weightPctSchema = z.number().min(0).max(100);

export const cascadeKeyResultSchema = z.object({
  title: z.string().trim().min(1).max(200),
  target: z.number().positive(),
  unit: z.string().trim().min(1).max(20).default("pct"),
  weightPct: weightPctSchema.optional(),
});

export const createCascadingObjectiveSchema = z.object({
  mode: z.literal("create"),
  title: z.string().trim().min(1).max(200),
  ownerEmployeeId: z.string().uuid(),
  parentObjectiveId: z.string().uuid().optional(),
  weightPct: weightPctSchema.optional(),
  ownWeightPct: weightPctSchema.optional(),
  keyResults: z.array(cascadeKeyResultSchema).max(20).default([]),
});

export const linkObjectiveSchema = z.object({
  mode: z.literal("link"),
  objectiveId: z.string().uuid(),
  parentObjectiveId: z.string().uuid().nullable(),
  weightPct: weightPctSchema.optional(),
  ownWeightPct: weightPctSchema.optional(),
});

export const okrTreeWriteSchema = z.discriminatedUnion("mode", [createCascadingObjectiveSchema, linkObjectiveSchema]);

export type OkrTreeWrite = z.infer<typeof okrTreeWriteSchema>;

async function readCascadeEdges(access: Access): Promise<ParentEdge[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, parent_objective_id from objectives where tenant_id = ${access.tenantId}`,
  ]);
  return (rows as Array<{ id: string; parent_objective_id: string | null }>).map((row) => ({ id: row.id, parentId: row.parent_objective_id }));
}

async function assertObjectiveExists(access: Access, objectiveId: string): Promise<void> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from objectives where tenant_id = ${access.tenantId} and id = ${objectiveId} limit 1`,
  ]);
  if ((rows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
}

function cycleRefusal(objectiveId: string): HttpError {
  return new HttpError({
    status: 422,
    code: "POLICY_VIOLATION",
    message: "That parent would make the objective its own ancestor.",
    details: [{ field: "parentObjectiveId", issue: `Objective ${objectiveId} cannot cascade into itself, directly or through its ancestors.` }],
  });
}

/** Records an objective's weight and, where given, its parent link in both places the cascade is read from. */
async function writeCascade(
  access: Access,
  objectiveId: string,
  parentObjectiveId: string | null,
  weightPct: number | undefined,
  ownWeightPct: number | undefined,
  requestId: string,
  action: string,
): Promise<void> {
  const patch: UnknownRecord = {};
  if (weightPct !== undefined) patch.weight_pct = weightPct;
  if (ownWeightPct !== undefined) patch.own_weight_pct = ownWeightPct;

  const statements = [
    sqlClient`update objectives set parent_objective_id = ${parentObjectiveId}, updated_at = now() where tenant_id = ${access.tenantId} and id = ${objectiveId}`,
    sqlClient`delete from goal_links where tenant_id = ${access.tenantId} and child_objective_id = ${objectiveId}`,
  ];
  if (parentObjectiveId !== null) {
    statements.push(
      sqlClient`insert into goal_links (id, tenant_id, child_objective_id, parent_objective_id, attributes) values (${crypto.randomUUID()}, ${access.tenantId}, ${objectiveId}, ${parentObjectiveId}, ${JSON.stringify({ declared_by: access.context.actorUserId })}::jsonb)`,
    );
  }
  if (Object.keys(patch).length > 0) {
    statements.push(
      sqlClient`update objectives set attributes = attributes || ${JSON.stringify(patch)}::jsonb, updated_at = now() where tenant_id = ${access.tenantId} and id = ${objectiveId}`,
    );
  }
  statements.push(
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${action}, 'objective', ${objectiveId}, 'Objective cascade recorded',
        ${JSON.stringify({ parent_objective_id: parentObjectiveId, ...patch })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  );
  await tenantTx(access, statements);
}

/** Creates an objective, its key results and its place in the cascade in one audited act. */
export async function createCascadingObjective(
  access: Access,
  input: z.infer<typeof createCascadingObjectiveSchema>,
  requestId: string,
): Promise<{ id: string; keyResultIds: string[]; parentObjectiveId: string | null; weightPct: number | null }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  if (input.parentObjectiveId) await assertObjectiveExists(access, input.parentObjectiveId);
  const created = await createObjective(access, {
    title: input.title,
    ownerEmployeeId: input.ownerEmployeeId,
    parentObjectiveId: input.parentObjectiveId,
  });
  const keyResultIds: string[] = [];
  for (const keyResult of input.keyResults) {
    const result = await createKeyResult(access, { objectiveId: created.id, title: keyResult.title, target: keyResult.target, unit: keyResult.unit });
    keyResultIds.push(result.id);
    if (keyResult.weightPct !== undefined) {
      await tenantTx(access, [
        sqlClient`update key_results set attributes = attributes || ${JSON.stringify({ weight_pct: keyResult.weightPct })}::jsonb, updated_at = now() where tenant_id = ${access.tenantId} and id = ${result.id}`,
      ]);
    }
  }
  await writeCascade(access, created.id, input.parentObjectiveId ?? null, input.weightPct, input.ownWeightPct, requestId, "perf.objective_cascade_create");
  return { id: created.id, keyResultIds, parentObjectiveId: input.parentObjectiveId ?? null, weightPct: input.weightPct ?? null };
}

/** Re-parents or re-weights an existing objective, refusing a cycle. */
export async function linkObjective(
  access: Access,
  input: z.infer<typeof linkObjectiveSchema>,
  requestId: string,
): Promise<{ id: string; parentObjectiveId: string | null; weightPct: number | null }> {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  await assertObjectiveExists(access, input.objectiveId);
  if (input.parentObjectiveId) await assertObjectiveExists(access, input.parentObjectiveId);
  const edges = await readCascadeEdges(access);
  if (wouldCreateCycle(edges, input.objectiveId, input.parentObjectiveId)) throw cycleRefusal(input.objectiveId);
  await writeCascade(access, input.objectiveId, input.parentObjectiveId, input.weightPct, input.ownWeightPct, requestId, "perf.objective_cascade_link");
  return { id: input.objectiveId, parentObjectiveId: input.parentObjectiveId, weightPct: input.weightPct ?? null };
}
