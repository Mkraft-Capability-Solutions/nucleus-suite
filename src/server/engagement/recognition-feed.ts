import "server-only";

import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Peer recognition feed (kudos). Reads the tenant's `recognition_events` with nominator and recipient names.
 * A like ("high-five") is recorded once per person: the caller's employee id is appended to
 * `attributes.liked_by` by a guarded update, so a retry or double click can never count twice, and
 * `op: "withdraw"` removes it again.
 */

export type RecognitionFeedItem = {
  id: string;
  version: number;
  message: string;
  points: number | null;
  recipient: { employeeId: string; name: string };
  nominator: { employeeId: string | null; name: string | null };
  createdAt: string;
  likeCount: number;
  likedByViewer: boolean;
};

type Row = {
  id: string;
  attributes: Record<string, unknown>;
  created_at: string | Date;
  recipient_employee_id: string;
  nominator_employee_id: string | null;
  recipient_first: string | null;
  recipient_last: string | null;
  nominator_first: string | null;
  nominator_last: string | null;
};

const fullName = (first: string | null, last: string | null) => `${first ?? ""} ${last ?? ""}`.trim();

/** Distinct likers; legacy numeric `likes` counters (from the old unguarded route) are added to the count. */
export function likeState(attributes: Record<string, unknown>, viewerEmployeeId: string | null) {
  const likedBy = Array.isArray(attributes.liked_by) ? [...new Set(attributes.liked_by.filter((value): value is string => typeof value === "string"))] : [];
  const legacy = Number(attributes.likes);
  return {
    likeCount: likedBy.length + (Number.isInteger(legacy) && legacy > 0 ? legacy : 0),
    likedByViewer: viewerEmployeeId !== null && likedBy.includes(viewerEmployeeId),
  };
}

export function projectRecognition(row: Row, viewerEmployeeId: string | null): RecognitionFeedItem {
  const a = row.attributes ?? {};
  const points = Number(a.points);
  const nominatorName = fullName(row.nominator_first, row.nominator_last);
  return {
    id: row.id,
    version: 1,
    message: typeof a.message === "string" ? a.message : "",
    points: Number.isInteger(points) ? points : null,
    recipient: { employeeId: row.recipient_employee_id, name: fullName(row.recipient_first, row.recipient_last) },
    nominator: { employeeId: row.nominator_employee_id, name: nominatorName || null },
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    ...likeState(a, viewerEmployeeId),
  };
}

async function viewerEmployeeId(access: Access): Promise<string | null> {
  if (access.context.employeeId) return access.context.employeeId;
  const [rows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and id = ${access.context.membershipId} limit 1`,
  ]);
  return (rows as Array<{ employee_id: string | null }>)[0]?.employee_id ?? null;
}

export async function listRecognitionFeed(access: Access, options: { page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewer = await viewerEmployeeId(access);
  const offset = (options.page - 1) * options.pageSize;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.attributes, r.created_at, r.recipient_employee_id, r.nominator_employee_id,
             rec.first_name as recipient_first, rec.last_name as recipient_last,
             nom.first_name as nominator_first, nom.last_name as nominator_last
      from recognition_events r
        join employees rec on rec.tenant_id = r.tenant_id and rec.id = r.recipient_employee_id
        left join employees nom on nom.tenant_id = r.tenant_id and nom.id = r.nominator_employee_id
      where r.tenant_id = ${access.tenantId} and r.record_status = 'active'
      order by r.created_at desc, r.id desc
      limit ${options.pageSize + 1} offset ${offset}
    `,
  ]);
  const list = rows as Row[];
  return { items: list.slice(0, options.pageSize).map((row) => projectRecognition(row, viewer)), hasMore: list.length > options.pageSize };
}

export async function setRecognitionLike(access: Access, id: string, op: "like" | "withdraw", requestId: string) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const viewer = await viewerEmployeeId(access);
  if (!viewer) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Liking a recognition requires a linked employee profile." });
  const [existing] = await tenantTx(access, [
    sqlClient`select id from recognition_events where tenant_id = ${access.tenantId} and id = ${id} and record_status = 'active' limit 1`,
  ]);
  if ((existing as unknown[]).length === 0) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The recognition was not found." });
  const marker = JSON.stringify([viewer]);
  const action = op === "like" ? "engage.kudos_like" : "engage.kudos_unlike";
  const reason = op === "like" ? "Liked recognition event" : "Withdrew like on recognition event";
  // One statement: the guarded update and its audit row commit together, and nothing is written when the
  // caller's like is already in the requested state.
  const [updated] = await tenantTx(access, [
    op === "like"
      ? sqlClient`
          with changed as (
            update recognition_events
            set attributes = jsonb_set(coalesce(attributes, '{}'::jsonb), '{liked_by}', coalesce(attributes->'liked_by', '[]'::jsonb) || ${marker}::jsonb),
                updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${id}
              and not (coalesce(attributes->'liked_by', '[]'::jsonb) @> ${marker}::jsonb)
            returning id
          )
          insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
          select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, 'recognition_event', changed.id::text, ${reason}, ${uuidOrNull(requestId)}::uuid
          from changed
          returning entity_id
        `
      : sqlClient`
          with changed as (
            update recognition_events
            set attributes = jsonb_set(attributes, '{liked_by}', coalesce((
                  select jsonb_agg(liker.value) from jsonb_array_elements(coalesce(attributes->'liked_by', '[]'::jsonb)) as liker(value)
                  where liker.value <> to_jsonb(${viewer}::text)), '[]'::jsonb)),
                updated_at = now()
            where tenant_id = ${access.tenantId} and id = ${id}
              and coalesce(attributes->'liked_by', '[]'::jsonb) @> ${marker}::jsonb
            returning id
          )
          insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
          select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId}, ${action}, 'recognition_event', changed.id::text, ${reason}, ${uuidOrNull(requestId)}::uuid
          from changed
          returning entity_id
        `,
  ]);
  const changed = (updated as unknown[]).length > 0;
  const [rows] = await tenantTx(access, [
    sqlClient`select attributes from recognition_events where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const attributes = (rows as Array<{ attributes: Record<string, unknown> }>)[0]?.attributes ?? {};
  return { id, changed, ...likeState(attributes, viewer) };
}
