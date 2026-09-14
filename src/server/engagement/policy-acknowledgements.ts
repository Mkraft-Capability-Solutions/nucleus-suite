import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
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

/** Pure queue-state mapping shared by the acknowledgement contract (unit-tested). */
export function derivePolicyAckState(
  args: { acknowledgedByViewer: boolean; dueOn: string | null; audienceCount: number; acknowledgedCount: number },
  today: string = new Date().toISOString().slice(0, 10),
): PolicyAckState {
  if (args.acknowledgedByViewer) return "acknowledged";
  if (args.dueOn && args.dueOn < today) return "overdue";
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
  audience_count: number;
  acknowledged_count: number;
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
 * Canonical policy-version projection. `$1` tenant, `$2` the signed-in
 * employee id (nullable text) used only for the viewer's own acknowledgement.
 */
const POLICY_QUEUE_SELECT = `select d.id,
    coalesce(d.attributes->>'title', 'Untitled policy') as policy,
    coalesce(d.attributes->>'code', '') as policy_code,
    d.attributes->>'active_year' as version,
    coalesce(fp.audience_rule, fa.rule, fp.audience_legacy, 'All employees') as audience,
    fp.published_from as published_from,
    expiry.expires_on as due_on,
    (select count(*)::int from employees emp
       where emp.tenant_id = d.tenant_id and emp.status = 'active') as audience_count,
    (select count(*)::int from consent_records cr
       where cr.tenant_id = d.tenant_id
         and cr.attributes->>'consent_type' = 'policy_acknowledgement'
         and cr.attributes->>'policy_id' = d.id::text) as acknowledged_count,
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

/** Signed-in employee id, or null when the membership is not linked to one. */
async function actorEmployeeId(access: Access): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId}
      and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
}

function decorate(row: PolicyQueryRow): PolicyAcknowledgementRow {
  return {
    ...row,
    audience_count: Number(row.audience_count ?? 0),
    acknowledged_count: Number(row.acknowledged_count ?? 0),
    status: derivePolicyAckState({
      acknowledgedByViewer: row.acknowledged_on !== null && row.acknowledged_on !== undefined,
      dueOn: row.due_on ?? null,
      audienceCount: Number(row.audience_count ?? 0),
      acknowledgedCount: Number(row.acknowledged_count ?? 0),
    }),
  };
}

/** Policy acknowledgement queue: every published policy version with live coverage. */
export async function listPolicyAcknowledgements(access: Access, search: string): Promise<PolicyAcknowledgementRow[]> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewer = await actorEmployeeId(access);
  const like = `%${search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `${POLICY_QUEUE_SELECT}
        and ((coalesce(d.attributes->>'title', '') || ' ' || coalesce(d.attributes->>'code', '')) ilike $3)
       order by coalesce(d.attributes->>'title', '') asc limit 100`,
      [access.tenantId, viewer, like],
    ),
  ]);
  return (rows as PolicyQueryRow[]).map(decorate);
}

/** Single policy version with its acknowledgement roll and an isolated audit trail. */
export async function getPolicyAcknowledgementRecord(access: Access, id: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewer = await actorEmployeeId(access);
  const [rows] = await tenantTx(access, [
    sqlClient.query(`${POLICY_QUEUE_SELECT} and d.id = $3::uuid limit 1`, [access.tenantId, viewer, id]),
  ]);
  const found = (rows as PolicyQueryRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const record = decorate(found);
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
       order by cr.created_at desc limit 50`,
      [access.tenantId, id],
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
