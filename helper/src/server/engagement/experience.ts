import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { MIN_ANONYMITY_COHORT } from "@/server/engagement/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Employee experience read/write surface: capability index (read-only view of
 * a persisted `mci/v2` run), self-recorded wellbeing with server-side cohort
 * suppression, and the social feed with one-reaction-per-person semantics.
 *
 * Privacy invariants enforced here, not in the UI:
 *  - Wellbeing check-ins are addressed ONLY by the caller's own employee id,
 *    resolved from the session membership. No request field can name another
 *    person, so no manager, HR or payroll surface can read an individual's
 *    wellbeing through this module at all.
 *  - The only non-self wellbeing read is a tenant-wide aggregate that returns
 *    means and a cohort size. It is suppressed below MIN_ANONYMITY_COHORT and
 *    never carries employee ids, names, departments, dates or free text. There
 *    is no department, manager or team slice, so the cohort cannot be narrowed
 *    until it identifies someone.
 *  - The capability index is development-planning-only and carries
 *    `automated_decision: false`. Nothing here ranks or compares people: reads
 *    are one employee at a time and there is no multi-employee index list.
 */

/* ------------------------------------------------------------------ */
/* Pure logic (no database, no session). Colocated tests cover these.  */
/* ------------------------------------------------------------------ */

/** The persisted `mci/v2` weights. Mirrors analytics MCI_WEIGHTS; never edited here. */
export const CAPABILITY_COMPONENT_ORDER = ["performance", "skills", "learning", "engagement", "tenure"] as const;

export type CapabilityComponentKey = (typeof CAPABILITY_COMPONENT_ORDER)[number];

/**
 * Display labels. The fifth dimension of `mci/v2` is tenure, and it is labelled
 * tenure. It is NOT leadership readiness: nothing in the formula measures
 * leadership, and relabelling it would misrepresent the number.
 */
export const CAPABILITY_COMPONENT_LABELS: Record<CapabilityComponentKey, string> = {
  performance: "Performance",
  skills: "Skills",
  learning: "Learning",
  engagement: "Engagement",
  tenure: "Tenure",
};

export type CapabilityComponent = {
  key: CapabilityComponentKey;
  label: string;
  value: number;
  weight: number;
  contribution: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Build the displayed components from a run's persisted inputs and weights. */
export function capabilityComponents(
  inputs: Partial<Record<CapabilityComponentKey, number>>,
  weights: Partial<Record<CapabilityComponentKey, number>>,
): CapabilityComponent[] {
  return CAPABILITY_COMPONENT_ORDER.filter((key) => typeof inputs[key] === "number" && typeof weights[key] === "number").map((key) => {
    const value = inputs[key] as number;
    const weight = weights[key] as number;
    return { key, label: CAPABILITY_COMPONENT_LABELS[key], value, weight, contribution: round2((value * weight) / 100) };
  });
}

/**
 * Recompute Σ(value × weight)/100 from the components that are displayed, so a
 * headline number can never disagree with the rows printed underneath it.
 */
export function weightedIndex(components: readonly CapabilityComponent[]): number {
  return round2(components.reduce((sum, component) => sum + (component.value * component.weight) / 100, 0));
}

/** A displayed index must be the persisted value AND agree with its components. */
export function reconcileIndex(
  persistedIndex: number,
  components: readonly CapabilityComponent[],
): { index: number; recomputed: number; weightTotal: number; agrees: boolean } {
  const recomputed = weightedIndex(components);
  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  return { index: persistedIndex, recomputed, weightTotal, agrees: round2(persistedIndex) === recomputed };
}

export type WellbeingSample = { energy: number | null; stress: number | null; workload: number | null };

export type WellbeingAggregate = {
  cohortSize: number;
  threshold: number;
  suppressed: boolean;
  averages: { energy: number | null; stress: number | null; workload: number | null } | null;
};

function meanOf(values: readonly (number | null)[]): number | null {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (present.length === 0) return null;
  return round2(present.reduce((sum, value) => sum + value, 0) / present.length);
}

/**
 * Aggregate one sample per distinct person. Below the anonymity threshold the
 * averages are dropped entirely — the caller receives `null`, not a rounded or
 * noised number, so nothing downstream can reconstruct an individual's answers.
 */
export function aggregateWellbeing(
  samples: readonly WellbeingSample[],
  threshold: number = MIN_ANONYMITY_COHORT,
): WellbeingAggregate {
  const cohortSize = samples.length;
  if (cohortSize < threshold) {
    return { cohortSize, threshold, suppressed: true, averages: null };
  }
  return {
    cohortSize,
    threshold,
    suppressed: false,
    averages: {
      energy: meanOf(samples.map((sample) => sample.energy)),
      stress: meanOf(samples.map((sample) => sample.stress)),
      workload: meanOf(samples.map((sample) => sample.workload)),
    },
  };
}

export type ReactionRow = { id: string; kind: string; state: "active" | "withdrawn" } | null;

export type ReactionEffect = "insert" | "reinstate" | "change_kind" | "withdraw" | "noop";

/**
 * One reaction per person per post. The reducer never yields a second row: an
 * existing row is reinstated, re-kinded or withdrawn in place. Repeating the
 * same command is a no-op, so a retried request cannot inflate a count.
 */
export function reduceReaction(current: ReactionRow, command: { op: "react" | "withdraw"; kind: string }): {
  effect: ReactionEffect;
  kind: string;
  reacted: boolean;
} {
  if (command.op === "withdraw") {
    if (!current || current.state === "withdrawn") return { effect: "noop", kind: current?.kind ?? command.kind, reacted: false };
    return { effect: "withdraw", kind: current.kind, reacted: false };
  }
  if (!current) return { effect: "insert", kind: command.kind, reacted: true };
  if (current.state === "withdrawn") return { effect: "reinstate", kind: command.kind, reacted: true };
  if (current.kind !== command.kind) return { effect: "change_kind", kind: command.kind, reacted: true };
  return { effect: "noop", kind: current.kind, reacted: true };
}

export type PointsScheme = { programId: string; name: string; points: number };

export type RewardTransaction = { id: string; points: number | null; reversesTransactionId: string | null };

export type PointsBalance = {
  configured: boolean;
  balance: number | null;
  awarded: number;
  reversed: number;
  transactionCount: number;
  unpricedCount: number;
};

/**
 * A balance is reported only from real `reward_transactions`, and only when the
 * tenant actually has a points scheme configured on a recognition program. With
 * no scheme the balance is `null` — not zero — so the UI shows no points at all
 * rather than inventing a number.
 */
export function pointsBalance(schemes: readonly PointsScheme[], transactions: readonly RewardTransaction[]): PointsBalance {
  const transactionCount = transactions.length;
  const unpricedCount = transactions.filter((transaction) => !Number.isInteger(transaction.points)).length;
  if (schemes.length === 0) {
    return { configured: false, balance: null, awarded: 0, reversed: 0, transactionCount, unpricedCount };
  }
  const reversedIds = new Set(
    transactions.map((transaction) => transaction.reversesTransactionId).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  let awarded = 0;
  let reversed = 0;
  for (const transaction of transactions) {
    if (transaction.reversesTransactionId) continue;
    if (!Number.isInteger(transaction.points)) continue;
    const points = transaction.points as number;
    if (reversedIds.has(transaction.id)) reversed += points;
    else awarded += points;
  }
  return { configured: true, balance: awarded, awarded, reversed, transactionCount, unpricedCount };
}

/* ------------------------------------------------------------------ */
/* Request schemas                                                     */
/* ------------------------------------------------------------------ */

export const createFeedPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  kind: z.enum(["update", "milestone", "kudos", "notice"]).default("update"),
  audience: z
    .object({
      departmentIds: z.array(z.string().uuid()).max(20).default([]),
      locationIds: z.array(z.string().uuid()).max(20).default([]),
      roleIds: z.array(z.string().uuid()).max(20).default([]),
    })
    .default({ departmentIds: [], locationIds: [], roleIds: [] }),
});

export const reactionSchema = z.object({
  op: z.enum(["react", "withdraw"]).default("react"),
  kind: z.enum(["like", "celebrate", "support", "kudos"]).default("like"),
});

export const wellbeingCheckinSchema = z.object({
  energy: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  workload: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).optional(),
});

/* ------------------------------------------------------------------ */
/* Session-scoped helpers                                              */
/* ------------------------------------------------------------------ */

/**
 * The caller's own employee id, taken from the session membership only. Nothing
 * in a request body or query string can influence it.
 */
async function selfEmployeeId(access: Access): Promise<string | null> {
  if (access.context.employeeId) return access.context.employeeId;
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
}

function requireSelf(employeeId: string | null): string {
  if (!employeeId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This action requires a linked employee profile." });
  }
  return employeeId;
}

type ViewerScope = { employeeId: string | null; departmentId: string | null; locationId: string | null; roleIds: string[] };

/** Resolve the viewer's audience scope: department and location by name, roles by grant. */
async function viewerScope(access: Access): Promise<ViewerScope> {
  const employeeId = await selfEmployeeId(access);
  const [profileRows, roleRows] = await tenantTx(access, [
    sqlClient`
      select d.id as department_id, l.id as location_id
      from employees e
        left join departments d on d.tenant_id = e.tenant_id and lower(d.attributes->>'name') = lower(e.department)
        left join locations l on l.tenant_id = e.tenant_id and lower(l.attributes->>'name') = lower(e.location)
      where e.tenant_id = ${access.tenantId} and e.id = ${employeeId}
      limit 1
    `,
    sqlClient`
      select role_id from membership_roles
      where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId} and revoked_at is null
    `,
  ]);
  const profile = (profileRows as Array<{ department_id: string | null; location_id: string | null }>)[0];
  return {
    employeeId,
    departmentId: profile?.department_id ?? null,
    locationId: profile?.location_id ?? null,
    roleIds: (roleRows as Array<{ role_id: string }>).map((row) => row.role_id),
  };
}

/* ------------------------------------------------------------------ */
/* Capability index                                                    */
/* ------------------------------------------------------------------ */

export type CapabilityIndexView = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  run: {
    id: string;
    index: number;
    recomputedIndex: number;
    agrees: boolean;
    formula: string;
    permittedUse: string;
    automatedDecision: boolean;
    computedAt: string;
    components: CapabilityComponent[];
    weightTotal: number;
  } | null;
  runCount: number;
};

/**
 * The latest persisted capability index run for exactly one employee. Returns
 * `run: null` when no run exists — the caller must say so rather than render a
 * headline number with nothing behind it. There is deliberately no list form.
 */
export async function capabilityIndexForEmployee(access: Access, requestedEmployeeId: string | null): Promise<CapabilityIndexView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = requestedEmployeeId ?? requireSelf(await selfEmployeeId(access));
  const [employeeRows, runRows, countRows] = await tenantTx(access, [
    sqlClient`select id, first_name, last_name, employee_code from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
    sqlClient`
      select r.id, r.attributes, r.created_at, v.attributes as version_attributes
      from capability_index_runs r
        left join capability_index_versions v on v.tenant_id = r.tenant_id and v.id = r.capability_index_version_id
      where r.tenant_id = ${access.tenantId} and r.employee_id = ${employeeId} and r.record_status = 'active'
      order by r.created_at desc, r.id desc
      limit 1
    `,
    sqlClient`select count(*)::int as total from capability_index_runs where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and record_status = 'active'`,
  ]);
  const employee = (employeeRows as Array<{ id: string; first_name: string; last_name: string; employee_code: string }>)[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const runCount = (countRows as Array<{ total: number }>)[0]?.total ?? 0;
  const row = (
    runRows as Array<{
      id: string;
      attributes: {
        inputs?: Partial<Record<CapabilityComponentKey, number>>;
        weights?: Partial<Record<CapabilityComponentKey, number>>;
        index?: number;
        formula?: string;
        automated_decision?: boolean;
      };
      created_at: string;
      version_attributes: { permitted_use?: string } | null;
    }>
  )[0];
  const base = { employeeId, employeeName: `${employee.first_name} ${employee.last_name}`.trim(), employeeCode: employee.employee_code, runCount };
  if (!row) return { ...base, run: null };
  const components = capabilityComponents(row.attributes.inputs ?? {}, row.attributes.weights ?? {});
  const reconciled = reconcileIndex(Number(row.attributes.index ?? 0), components);
  return {
    ...base,
    run: {
      id: row.id,
      index: reconciled.index,
      recomputedIndex: reconciled.recomputed,
      agrees: reconciled.agrees,
      formula: row.attributes.formula ?? "mci/v2",
      permittedUse: row.version_attributes?.permitted_use ?? "development-planning-only",
      automatedDecision: row.attributes.automated_decision === true,
      computedAt: row.created_at,
      components,
      weightTotal: reconciled.weightTotal,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Wellbeing                                                           */
/* ------------------------------------------------------------------ */

export type WellbeingView = {
  self: { checkins: Array<{ id: string; energy: number | null; stress: number | null; workload: number | null; note: string | null; recordedAt: string }> } | null;
  aggregate: WellbeingAggregate;
};

/**
 * The caller's own check-ins plus the tenant-wide suppressed aggregate.
 * `self` is addressed by the session membership only; the aggregate is reduced
 * to means over one sample per distinct person and is dropped below the
 * threshold before it leaves this function.
 */
export async function wellbeingForSelf(access: Access): Promise<WellbeingView> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = await selfEmployeeId(access);
  const [selfRows, cohortRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes, created_at from wellbeing_checkins
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and record_status = 'active'
      order by created_at desc limit 30
    `,
    // One latest sample per distinct person. The employee id is discarded below
    // and never reaches the response, on either branch.
    sqlClient`
      select distinct on (employee_id) employee_id, attributes
      from wellbeing_checkins
      where tenant_id = ${access.tenantId} and record_status = 'active' and created_at >= now() - interval '90 days'
      order by employee_id, created_at desc
    `,
  ]);
  const samples = (cohortRows as Array<{ attributes: Record<string, unknown> }>).map((row) => ({
    energy: numberOrNull(row.attributes.energy_score),
    stress: numberOrNull(row.attributes.stress_score),
    workload: numberOrNull(row.attributes.workload_score),
  }));
  const aggregate = aggregateWellbeing(samples);
  if (!employeeId) return { self: null, aggregate };
  const checkins = (selfRows as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>).map((row) => ({
    id: row.id,
    energy: numberOrNull(row.attributes.energy_score),
    stress: numberOrNull(row.attributes.stress_score),
    workload: numberOrNull(row.attributes.workload_score),
    note: typeof row.attributes.note === "string" ? row.attributes.note : null,
    recordedAt: row.created_at,
  }));
  return { self: { checkins }, aggregate };
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Record a self check-in. The subject is always the caller. */
export async function recordWellbeingCheckin(access: Access, input: z.infer<typeof wellbeingCheckinSchema>, requestId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = requireSelf(await selfEmployeeId(access));
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into wellbeing_checkins (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${employeeId},
        ${JSON.stringify({
          energy_score: input.energy,
          stress_score: input.stress,
          workload_score: input.workload,
          note: input.note ?? null,
          self_recorded: true,
          checkin_date: new Date().toISOString().slice(0, 10),
        })}::jsonb)
    `,
    // The audit row records that a check-in happened; it never carries the scores.
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'engage.wellbeing_checkin', 'wellbeing_checkin', ${id}, 'Self-recorded wellbeing check-in', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id };
}

/* ------------------------------------------------------------------ */
/* Social feed                                                         */
/* ------------------------------------------------------------------ */

export type FeedPostView = {
  id: string;
  title: string;
  body: string;
  kind: string;
  authorName: string;
  authorInitials: string;
  authorEmployeeId: string | null;
  createdAt: string;
  reactionCount: number;
  commentCount: number;
  viewerReaction: string | null;
  audienceScoped: boolean;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Audience-scoped feed. A post with no audience rows is all-hands. */
export async function listSocialFeed(access: Access, options: { page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const scope = await viewerScope(access);
  const offset = (options.page - 1) * options.pageSize;
  const roleIdsJson = JSON.stringify(scope.roleIds);
  const [postRows, reactionRows, commentRows, mineRows] = await tenantTx(access, [
    sqlClient`
      select p.id, p.attributes, p.created_at, p.author_employee_id,
             e.first_name, e.last_name,
             exists (select 1 from feed_audiences a where a.tenant_id = p.tenant_id and a.feed_post_id = p.id) as audience_scoped
      from feed_posts p
        left join employees e on e.tenant_id = p.tenant_id and e.id = p.author_employee_id
      where p.tenant_id = ${access.tenantId} and p.record_status = 'active'
        and (
          not exists (select 1 from feed_audiences a where a.tenant_id = p.tenant_id and a.feed_post_id = p.id)
          or exists (
            select 1 from feed_audiences a
            where a.tenant_id = p.tenant_id and a.feed_post_id = p.id
              and (
                (a.department_id is null and a.location_id is null and a.role_id is null)
                or a.department_id = ${scope.departmentId}::uuid
                or a.location_id = ${scope.locationId}::uuid
                or a.role_id::text in (select jsonb_array_elements_text(${roleIdsJson}::jsonb))
              )
          )
        )
      order by p.created_at desc, p.id desc
      limit ${options.pageSize + 1} offset ${offset}
    `,
    sqlClient`
      select feed_post_id, count(*)::int as total from post_reactions
      where tenant_id = ${access.tenantId} and record_status = 'active' group by feed_post_id
    `,
    sqlClient`
      select feed_post_id, count(*)::int as total from post_comments
      where tenant_id = ${access.tenantId} and record_status = 'active' group by feed_post_id
    `,
    sqlClient`
      select feed_post_id, attributes->>'kind' as kind from post_reactions
      where tenant_id = ${access.tenantId} and employee_id = ${scope.employeeId} and record_status = 'active'
    `,
  ]);
  const reactionCounts = new Map((reactionRows as Array<{ feed_post_id: string; total: number }>).map((row) => [row.feed_post_id, row.total]));
  const commentCounts = new Map((commentRows as Array<{ feed_post_id: string; total: number }>).map((row) => [row.feed_post_id, row.total]));
  const mine = new Map((mineRows as Array<{ feed_post_id: string; kind: string | null }>).map((row) => [row.feed_post_id, row.kind ?? "like"]));
  const rows = postRows as Array<{
    id: string;
    attributes: Record<string, unknown>;
    created_at: string;
    author_employee_id: string | null;
    first_name: string | null;
    last_name: string | null;
    audience_scoped: boolean;
  }>;
  const items: FeedPostView[] = rows.slice(0, options.pageSize).map((row) => {
    const authorName = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Workspace";
    return {
      id: row.id,
      title: typeof row.attributes.title === "string" ? row.attributes.title : "",
      body: typeof row.attributes.body === "string" ? row.attributes.body : "",
      kind: typeof row.attributes.kind === "string" ? row.attributes.kind : typeof row.attributes.category === "string" ? row.attributes.category : "update",
      authorName,
      authorInitials: initialsOf(authorName),
      authorEmployeeId: row.author_employee_id,
      createdAt: row.created_at,
      reactionCount: reactionCounts.get(row.id) ?? 0,
      commentCount: commentCounts.get(row.id) ?? 0,
      viewerReaction: mine.get(row.id) ?? null,
      audienceScoped: row.audience_scoped === true,
    };
  });
  return { items, hasMore: rows.length > options.pageSize };
}

export async function createFeedPost(access: Access, input: z.infer<typeof createFeedPostSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });
  const authorEmployeeId = requireSelf(await selfEmployeeId(access));
  const id = crypto.randomUUID();
  const audienceRows = [
    ...input.audience.departmentIds.map((value) => ({ departmentId: value, locationId: null as string | null, roleId: null as string | null })),
    ...input.audience.locationIds.map((value) => ({ departmentId: null as string | null, locationId: value, roleId: null as string | null })),
    ...input.audience.roleIds.map((value) => ({ departmentId: null as string | null, locationId: null as string | null, roleId: value })),
  ];
  await tenantTx(access, [
    sqlClient`
      insert into feed_posts (id, tenant_id, author_employee_id, attributes)
      values (${id}, ${access.tenantId}, ${authorEmployeeId},
        ${JSON.stringify({ title: input.title, body: input.body, kind: input.kind, published_at: new Date().toISOString() })}::jsonb)
    `,
    ...audienceRows.map(
      (row) => sqlClient`
        insert into feed_audiences (id, tenant_id, feed_post_id, department_id, location_id, role_id, attributes)
        values (${crypto.randomUUID()}, ${access.tenantId}, ${id}, ${row.departmentId}, ${row.locationId}, ${row.roleId}, '{}'::jsonb)
      `,
    ),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'engage.feed_post', 'feed_post', ${id}, 'Social feed post published', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, audienceScoped: audienceRows.length > 0 };
}

/**
 * Set the caller's reaction on a post. At most one row per (post, person)
 * exists: the insert is guarded by a NOT EXISTS on the same statement and the
 * update rewrites that one row in place. Repeating a request is a no-op, and
 * withdrawing is the reversal.
 */
export async function setPostReaction(access: Access, postId: string, input: z.infer<typeof reactionSchema>, requestId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = requireSelf(await selfEmployeeId(access));
  const [postRows, existingRows] = await tenantTx(access, [
    sqlClient`select id from feed_posts where tenant_id = ${access.tenantId} and id = ${postId} and record_status = 'active' limit 1`,
    sqlClient`select id, record_status, attributes->>'kind' as kind from post_reactions where tenant_id = ${access.tenantId} and feed_post_id = ${postId} and employee_id = ${employeeId} limit 1`,
  ]);
  if ((postRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const existing = (existingRows as Array<{ id: string; record_status: string; kind: string | null }>)[0];
  const current: ReactionRow = existing ? { id: existing.id, kind: existing.kind ?? "like", state: existing.record_status === "active" ? "active" : "withdrawn" } : null;
  const decision = reduceReaction(current, input);
  const nextState = decision.reacted ? "active" : "withdrawn";
  if (decision.effect !== "noop") {
    await tenantTx(access, [
      // Guarded insert: a second row for the same person can never be created.
      sqlClient`
        insert into post_reactions (id, tenant_id, feed_post_id, employee_id, record_status, attributes)
        select ${crypto.randomUUID()}, ${access.tenantId}, ${postId}, ${employeeId}, ${nextState}, ${JSON.stringify({ kind: decision.kind })}::jsonb
        where not exists (
          select 1 from post_reactions where tenant_id = ${access.tenantId} and feed_post_id = ${postId} and employee_id = ${employeeId}
        )
      `,
      sqlClient`
        update post_reactions
        set record_status = ${nextState}, attributes = attributes || ${JSON.stringify({ kind: decision.kind })}::jsonb, version = version + 1, updated_at = now()
        where tenant_id = ${access.tenantId} and feed_post_id = ${postId} and employee_id = ${employeeId}
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          ${decision.reacted ? "engage.post_react" : "engage.post_unreact"}, 'post_reaction', ${postId},
          ${decision.reacted ? "Reaction recorded" : "Reaction withdrawn"}, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
  }
  const [countRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from post_reactions where tenant_id = ${access.tenantId} and feed_post_id = ${postId} and record_status = 'active'`,
  ]);
  return {
    postId,
    effect: decision.effect,
    reacted: decision.reacted,
    kind: decision.reacted ? decision.kind : null,
    reactionCount: (countRows as Array<{ total: number }>)[0]?.total ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Recognition points                                                  */
/* ------------------------------------------------------------------ */

/**
 * The caller's own recognition points. Schemes come from the tenant's
 * recognition programmes; the balance comes only from `reward_transactions`.
 * With no scheme configured the balance is null and the UI shows no points.
 */
export async function recognitionPointsForSelf(access: Access): Promise<PointsBalance & { schemes: PointsScheme[] }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = await selfEmployeeId(access);
  const [programRows, transactionRows] = await tenantTx(access, [
    sqlClient`select id, attributes from recognition_programs where tenant_id = ${access.tenantId} and record_status = 'active'`,
    sqlClient`
      select id, reverses_transaction_id, attributes from reward_transactions
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and record_status = 'active'
      order by created_at desc limit 200
    `,
  ]);
  const schemes: PointsScheme[] = (programRows as Array<{ id: string; attributes: Record<string, unknown> }>)
    .map((row) => ({ programId: row.id, name: typeof row.attributes.name === "string" ? row.attributes.name : "Recognition programme", points: Number(row.attributes.reward_points) }))
    .filter((scheme) => Number.isInteger(scheme.points) && scheme.points > 0);
  const transactions: RewardTransaction[] = (transactionRows as Array<{ id: string; reverses_transaction_id: string | null; attributes: Record<string, unknown> }>).map((row) => {
    const raw = Number(row.attributes.points_awarded ?? row.attributes.points);
    return { id: row.id, points: Number.isInteger(raw) ? raw : null, reversesTransactionId: row.reverses_transaction_id };
  });
  return { ...pointsBalance(schemes, transactions), schemes };
}
