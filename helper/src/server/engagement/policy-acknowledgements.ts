import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isAdminPrincipal } from "@/lib/cockpit-catalog";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * SCR-062 — Policy acknowledgements.
 *
 * A policy version is a `documents` row whose `document_types` code is POLICY.
 * Its audience comes from the announcement (`feed_posts`) that published it when
 * one is linked through `feed_posts.document_id`, otherwise "All employees".
 * An acknowledgement is a `consent_records` row carrying
 * `consent_type = 'policy_acknowledgement'`. No new tables, no DDL.
 */

export type PolicyAckState = "published" | "pending_acknowledgement" | "acknowledged" | "overdue";

/**
 * Pure queue-state mapping shared by the acknowledgement contract (unit-tested).
 *
 * The counts are null when tenant-wide coverage is withheld from this reader
 * (see `resolvePolicyAckScope`). Withheld is not zero: rather than reading a
 * null as "nobody has to acknowledge this" and reporting `published`, the state
 * is decided from what the reader is actually entitled to know — their own
 * acknowledgement and the due date.
 */
export function derivePolicyAckState(
  args: { acknowledgedByViewer: boolean; dueOn: string | null; audienceCount: number | null; acknowledgedCount: number | null },
  today: string = new Date().toISOString().slice(0, 10),
): PolicyAckState {
  if (args.acknowledgedByViewer) return "acknowledged";
  if (args.dueOn && args.dueOn < today) return "overdue";
  if (args.audienceCount === null || args.acknowledgedCount === null) return "pending_acknowledgement";
  if (args.audienceCount > 0 && args.acknowledgedCount < args.audienceCount) return "pending_acknowledgement";
  return "published";
}

export type PolicyAcknowledgementRow = {
  id: string;
  policy: string;
  policy_code: string;
  version: string | null;
  audience: string;
  published_from: string | null;
  due_on: string | null;
  /** Null when tenant-wide coverage is withheld from this reader — never 0. */
  audience_count: number | null;
  acknowledged_count: number | null;
  acknowledged_on: string | null;
  status: PolicyAckState;
};

type PolicyQueryRow = Omit<PolicyAcknowledgementRow, "status">;

export type PolicyAcknowledgementEntry = {
  employee_code: string | null;
  employee_name: string | null;
  acknowledged_on: string | null;
  comment: string | null;
};

export const POLICY_ACK_CONSENT_TYPE = "policy_acknowledgement";

/**
 * Who is served the tenant's acknowledgement roll, and who is served only their
 * own line of it.
 *
 * This register enforced `employee.read` — which every employee holds — and then
 * returned, on every policy version, the whole tenant's coverage and, in the
 * detail, the named roll of who had acknowledged it and when. The narrowing rule
 * is the one `okr.ts` already uses for the same shape of problem: an
 * administrative principal, or the `employee.write` holder who publishes the
 * policies in the first place (src/server/engagement/service.ts), reads the
 * tenant; everybody else reads their own acknowledgement and is told plainly
 * that the coverage figures were withheld.
 *
 * The published policy VERSIONS themselves stay visible to everyone: the
 * audience is the whole workforce and an employee cannot acknowledge a policy
 * that is hidden from them — `listUnacknowledgedPoliciesForEmployee` already
 * lists every one of them to the employee. It is the other employees'
 * acknowledgements that are not theirs to read.
 */
export type PolicyAckScope = "tenant" | "self";

/** The permission that admits a caller to the whole acknowledgement roll. */
export const POLICY_ROLL_WIDE_PERMISSION = "employee.write";

/** Whether this caller may read acknowledgements belonging to other employees. */
export function canReadWholePolicyRoll(permissions: readonly string[], roles: readonly string[] = []): boolean {
  return isAdminPrincipal(permissions, roles) || permissions.includes(POLICY_ROLL_WIDE_PERMISSION);
}

/**
 * Canonical policy-version projection. `$1` tenant, `$2` the signed-in
 * employee id (nullable text) used only for the viewer's own acknowledgement.
 *
 * Tenant-wide coverage is part of the SELECT only for a reader entitled to it.
 * A self-scoped reader's statement does not count the tenant's employees or its
 * consent rows at all, so the figures are absent from the query rather than
 * fetched and dropped — and they arrive as null, never as a fabricated 0.
 */
function policyQueueSelect(scope: PolicyAckScope): string {
  const coverage =
    scope === "tenant"
      ? `(select count(*)::int from employees emp
       where emp.tenant_id = d.tenant_id and emp.status = 'active') as audience_count,
    (select count(*)::int from consent_records cr
       where cr.tenant_id = d.tenant_id
         and cr.attributes->>'consent_type' = 'policy_acknowledgement'
         and cr.attributes->>'policy_id' = d.id::text) as acknowledged_count,`
      : `null::int as audience_count,
    null::int as acknowledged_count,`;
  return `select d.id,
    coalesce(d.attributes->>'title', 'Untitled policy') as policy,
    coalesce(d.attributes->>'code', '') as policy_code,
    d.attributes->>'active_year' as version,
    coalesce(fp.audience_rule, fa.rule, fp.audience_legacy, 'All employees') as audience,
    fp.published_from as published_from,
    expiry.expires_on as due_on,
    ${coverage}
    (select mine.attributes->>'granted_at' from consent_records mine
       where mine.tenant_id = d.tenant_id
         and mine.attributes->>'consent_type' = 'policy_acknowledgement'
         and mine.attributes->>'policy_id' = d.id::text
         and mine.attributes->>'subject_id' = $2::text
       order by mine.created_at desc limit 1) as acknowledged_on
  from documents d
  join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
  left join lateral (
    select p.id as feed_post_id,
           p.attributes->>'audience_rule' as audience_rule,
           p.attributes->>'audience' as audience_legacy,
           coalesce(p.attributes->>'publish_from', p.created_at::text) as published_from
    from feed_posts p
    where p.tenant_id = d.tenant_id and p.document_id = d.id
    order by p.created_at desc limit 1
  ) fp on true
  left join lateral (
    select a.attributes->>'rule' as rule
    from feed_audiences a
    where a.tenant_id = d.tenant_id and a.feed_post_id = fp.feed_post_id
    order by a.created_at asc limit 1
  ) fa on true
  left join lateral (
    select x.attributes->>'expires_on' as expires_on
    from document_expiries x
    where x.tenant_id = d.tenant_id and x.document_id = d.id
      and x.attributes->>'expires_on' is not null
    order by x.attributes->>'expires_on' asc limit 1
  ) expiry on true
  where d.tenant_id = $1 and dt.attributes->>'code' = 'POLICY'`;
}

/** Signed-in employee id, or null when the membership is not linked to one. */
async function actorEmployeeId(access: Access): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId}
      and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
}

/**
 * The slice this caller reads, and the employee every self-scoped statement is
 * pinned to. An account that is not linked to an employee profile holds no
 * acknowledgements of its own, so it is refused rather than handed the tenant's.
 */
async function resolvePolicyAckScope(access: Access): Promise<{ scope: PolicyAckScope; viewerEmployeeId: string | null }> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewerEmployeeId = await actorEmployeeId(access);
  if (canReadWholePolicyRoll(access.context.permissions, access.context.roles)) {
    return { scope: "tenant", viewerEmployeeId };
  }
  if (!viewerEmployeeId) {
    throw new HttpError({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
      message: "Link this account to its employee profile to view its own policy acknowledgements.",
    });
  }
  return { scope: "self", viewerEmployeeId };
}

/** A count the query withheld stays null; only a count it returned is a number. */
function coverageCount(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function decorate(row: PolicyQueryRow): PolicyAcknowledgementRow {
  const audienceCount = coverageCount(row.audience_count);
  const acknowledgedCount = coverageCount(row.acknowledged_count);
  return {
    ...row,
    audience_count: audienceCount,
    acknowledged_count: acknowledgedCount,
    status: derivePolicyAckState({
      acknowledgedByViewer: row.acknowledged_on !== null && row.acknowledged_on !== undefined,
      dueOn: row.due_on ?? null,
      audienceCount,
      acknowledgedCount,
    }),
  };
}

/**
 * Policy acknowledgement queue: every published policy version, with live
 * coverage for a reader entitled to it and the reader's own acknowledgement for
 * everybody else.
 */
export async function listPolicyAcknowledgements(access: Access, search: string): Promise<PolicyAcknowledgementRow[]> {
  const { scope, viewerEmployeeId } = await resolvePolicyAckScope(access);
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${policyQueueSelect(scope)}
        and ((coalesce(d.attributes->>'title', '') || ' ' || coalesce(d.attributes->>'code', '')) ilike $3)
       order by coalesce(d.attributes->>'title', '') asc limit 100`,
      [access.tenantId, viewerEmployeeId, like],
    ),
  ]);
  return (rows as PolicyQueryRow[]).map(decorate);
}

/** Single policy version with its acknowledgement roll and an isolated audit trail. */
export async function getPolicyAcknowledgementRecord(access: Access, id: string) {
  const { scope, viewerEmployeeId } = await resolvePolicyAckScope(access);
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${policyQueueSelect(scope)} and d.id = $3::uuid limit 1`, [access.tenantId, viewerEmployeeId, id]),
  ]);
  const found = (rows as PolicyQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record = decorate(found);
  // The roll. `$3` is null for a reader entitled to the whole roll and the
  // reader's own employee id for everybody else, bound from the session rather
  // than from the request — so a self-scoped reader sees their own
  // acknowledgement line and no colleague's name, date or comment is fetched.
  const [ackRows] = await tenantTx(access, [
    sqlClient.query(
      `select ack.employee_code, ack.employee_name,
         cr.attributes->>'granted_at' as acknowledged_on,
         cr.attributes->>'comment' as comment
       from consent_records cr
       left join lateral (
         select emp.employee_code as employee_code,
                emp.first_name || ' ' || emp.last_name as employee_name
         from employees emp
         where emp.tenant_id = cr.tenant_id and emp.id::text = cr.attributes->>'subject_id'
         limit 1
       ) ack on true
       where cr.tenant_id = $1
         and cr.attributes->>'consent_type' = 'policy_acknowledgement'
         and cr.attributes->>'policy_id' = $2::text
         and ($3::text is null or cr.attributes->>'subject_id' = $3::text)
       order by cr.created_at desc limit 50`,
      [access.tenantId, id, scope === "self" ? viewerEmployeeId : null],
    ),
  ]);
  let auditTrail: Array<Record<string, unknown>> = [];
  try {
    const [auditRows] = await tenantTx(access, [
      sqlClient`select id, action, reason, created_at::text as created_at from audit_events
        where tenant_id = ${access.tenantId} and entity_type = 'policy' and entity_id = ${id}
        order by created_at desc limit 20`,
    ]);
    auditTrail = auditRows as Array<Record<string, unknown>>;
  } catch {
    auditTrail = [];
  }
  return { record, acknowledgements: ackRows as PolicyAcknowledgementEntry[], auditTrail };
}

export const acknowledgePolicySchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

/** Record the signed-in employee's acknowledgement of a policy version. */
export async function acknowledgePolicy(
  access: Access,
  id: string,
  input: z.infer<typeof acknowledgePolicySchema>,
  requestId: string,
) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const employeeId = await actorEmployeeId(access);
  if (!employeeId) {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "Your account is not linked to an employee record." });
  }
  const [policyRows] = await tenantTx(access, [
    sqlClient.query(
      `select d.id from documents d
       join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
       where d.tenant_id = $1 and d.id = $2::uuid and dt.attributes->>'code' = 'POLICY' limit 1`,
      [access.tenantId, id],
    ),
  ]);
  if ((policyRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  const [existingRows] = await tenantTx(access, [
    sqlClient.query(
      `select cr.id from consent_records cr
       where cr.tenant_id = $1
         and cr.attributes->>'consent_type' = 'policy_acknowledgement'
         and cr.attributes->>'policy_id' = $2::text
         and cr.attributes->>'subject_id' = $3::text
       limit 1`,
      [access.tenantId, id, employeeId],
    ),
  ]);
  if ((existingRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: "You have already acknowledged this policy version." });
  }
  const consentId = randomUUID();
  const comment = input.comment && input.comment.length > 0 ? input.comment : null;
  const auditAfter = JSON.stringify({ policy_id: id, subject_id: employeeId, consent_type: POLICY_ACK_CONSENT_TYPE, comment });
  const [insertedRows] = await tenantTx(access, [
    sqlClient.query(
      `insert into consent_records (id, tenant_id, attributes)
       values ($1::uuid, $2::uuid, jsonb_build_object(
         'consent_type', 'policy_acknowledgement',
         'policy_id', $3::text,
         'subject_id', $4::text,
         'granted', true,
         'granted_at', to_char(current_date, 'YYYY-MM-DD'),
         'comment', $5::text))
       returning attributes->>'granted_at' as acknowledged_on`,
      [consentId, access.tenantId, id, employeeId, comment],
    ),
    sqlClient.query(
      `insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
       values ($1::uuid, $2, $3, 'engagement.policy_acknowledge', 'policy', $4::uuid, $5, $6::jsonb, $7::uuid)`,
      [
        access.tenantId,
        access.context.actorUserId,
        access.context.membershipId,
        id,
        comment ?? "Policy acknowledged.",
        auditAfter,
        uuidOrNull(requestId),
      ],
    ),
  ]);
  const acknowledgedOn =
    (insertedRows as Array<{ acknowledged_on: string | null }>)[0]?.acknowledged_on ?? new Date().toISOString().slice(0, 10);
  return { id, policyId: id, acknowledgedOn };
}

export type UnacknowledgedPolicy = {
  id: string;
  title: string;
  code: string;
  due_on: string | null;
  updated_at: string | null;
};

/**
 * Policy versions this employee has not yet acknowledged. Shared with the
 * SCR-042 home queue so the consent model lives in exactly one place.
 */
export async function listUnacknowledgedPoliciesForEmployee(access: Access, employeeId: string): Promise<UnacknowledgedPolicy[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select d.id,
         coalesce(d.attributes->>'title', 'Untitled policy') as title,
         coalesce(d.attributes->>'code', '') as code,
         expiry.expires_on as due_on,
         d.updated_at::text as updated_at
       from documents d
       join document_types dt on dt.tenant_id = d.tenant_id and dt.id = d.document_type_id
       left join lateral (
         select x.attributes->>'expires_on' as expires_on
         from document_expiries x
         where x.tenant_id = d.tenant_id and x.document_id = d.id
           and x.attributes->>'expires_on' is not null
         order by x.attributes->>'expires_on' asc limit 1
       ) expiry on true
       where d.tenant_id = $1 and dt.attributes->>'code' = 'POLICY'
         and not exists (
           select 1 from consent_records cr
           where cr.tenant_id = d.tenant_id
             and cr.attributes->>'consent_type' = 'policy_acknowledgement'
             and cr.attributes->>'policy_id' = d.id::text
             and cr.attributes->>'subject_id' = $2::text
         )
       order by d.created_at desc limit 100`,
      [access.tenantId, employeeId],
    ),
  ]);
  return rows as UnacknowledgedPolicy[];
}
