import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export type AccessScopeStatus = "active" | "scheduled" | "revoked";

/** Pure status derivation shared by the list query contract (unit-tested). */
export function deriveScopeStatus(
  row: { valid_from: string; valid_to: string | null; revoked_at: string | null },
  today = new Date().toISOString().slice(0, 10),
): AccessScopeStatus {
  if (row.revoked_at) return "revoked";
  const from = row.valid_from.slice(0, 10);
  const to = row.valid_to ? row.valid_to.slice(0, 10) : null;
  if (to && to < today) return "revoked";
  if (from > today) return "scheduled";
  return "active";
}

/** Full management needs membership.manage; otherwise the caller sees only their own grants. */
export function canManageScopes(access: Access): boolean {
  return authorize(access.context, { action: "membership.manage", resource: { tenantId: access.tenantId } }).allowed;
}

export type AccessScopeGrant = {
  id: string;
  membership_id: string;
  member_name: string;
  member_email: string;
  employee_code: string | null;
  role_id: string;
  role_code: string;
  role_name: string;
  effective_from: string;
  effective_to: string | null;
  revoked_at: string | null;
  status: AccessScopeStatus;
  created_at: string;
};

const STATUS_CASE = `case when mr.revoked_at is not null then 'revoked'
  when mr.valid_to is not null and mr.valid_to::date < current_date then 'revoked'
  when mr.valid_from::date > current_date then 'scheduled'
  else 'active' end`;

const GRANT_SELECT = `select mr.id, mr.membership_id, coalesce(u.name, u.email, 'Member') as member_name,
  u.email as member_email, e.employee_code,
  mr.role_id, r.code as role_code, r.name as role_name,
  to_char(mr.valid_from, 'YYYY-MM-DD') as effective_from,
  case when mr.valid_to is null then null else to_char(mr.valid_to, 'YYYY-MM-DD') end as effective_to,
  case when mr.revoked_at is null then null else mr.revoked_at::text end as revoked_at,
  (${STATUS_CASE}) as status, mr.created_at::text as created_at
from membership_roles mr
join memberships m on m.tenant_id = mr.tenant_id and m.id = mr.membership_id
join "user" u on u.id = m.user_id
join roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id
left join employees e on e.tenant_id = mr.tenant_id and e.id = m.employee_id`;

export async function listAccessScopes(
  access: Access,
  args: { status: string | null; search: string },
): Promise<AccessScopeGrant[]> {
  const manage = canManageScopes(access);
  const status = args.status && ["active", "scheduled", "revoked"].includes(args.status) ? args.status : null;
  const like = `%${args.search.replace(/[%_]/g, "").slice(0, 80)}%`;
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `with grants as (${GRANT_SELECT} where mr.tenant_id = $1 ${manage ? "" : "and mr.membership_id = $4::uuid"})
       select * from grants
       where ($2::text is null or status = $2)
         and ($3 = '%%' or (member_name || ' ' || coalesce(member_email, '') || ' ' || coalesce(employee_code, '') || ' ' || role_code) ilike $3)
       order by created_at desc, id desc limit 100`,
      manage ? [access.tenantId, status, like] : [access.tenantId, status, like, access.context.membershipId],
    ),
  ]);
  return rows as AccessScopeGrant[];
}

export async function getAccessScope(access: Access, id: string) {
  const manage = canManageScopes(access);
  const [grantRows] = await tenantTx(access, [
    sqlClient.query(
      `${GRANT_SELECT} where mr.tenant_id = $1 and mr.id = $2::uuid ${manage ? "" : "and mr.membership_id = $3::uuid"} limit 1`,
      manage ? [access.tenantId, id] : [access.tenantId, id, access.context.membershipId],
    ),
  ]);
  const grant = (grantRows as AccessScopeGrant[])[0];
  if (!grant) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const [auditRows] = await tenantTx(access, [
    sqlClient`
      select id, action, entity_type, entity_id, reason, created_at::text as created_at
      from audit_events
      where tenant_id = ${access.tenantId}
        and ((entity_type = 'access_scope' and entity_id = ${grant.id})
          or (entity_type = 'membership' and entity_id = ${grant.membership_id}))
      order by created_at desc, id desc limit 20
    `,
  ]);
  return { grant, auditTrail: auditRows as Array<Record<string, unknown>> };
}

export const grantScopeSchema = z.object({
  membershipId: z.string().uuid(),
  roleCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(5),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reason: z.string().trim().min(3).max(500),
});

export async function grantAccessScopes(access: Access, input: z.infer<typeof grantScopeSchema>, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const from = input.effectiveFrom ?? new Date().toISOString().slice(0, 10);
  const to = input.effectiveTo ?? null;
  if (to && to < from) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The effective end date cannot precede the start date." });
  }
  const [memberRows] = await tenantTx(access, [
    sqlClient`select id from memberships where tenant_id = ${access.tenantId} and id = ${input.membershipId} limit 1`,
  ]);
  if ((memberRows as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The member was not found in this tenant." });
  }
  const [roleRows] = await tenantTx(access, [
    sqlClient`select id, code from roles where tenant_id = ${access.tenantId} and code = any(${input.roleCodes}) and status = 'active'`,
  ]);
  const found = new Map((roleRows as Array<{ id: string; code: string }>).map((row) => [row.code, row.id]));
  const unknown = input.roleCodes.filter((code) => !found.has(code));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown role codes: ${unknown.join(", ")}.` });
  }
  const created: Array<{ id: string; roleCode: string }> = [];
  // Overlap checks run first so concurrent grants cannot double-cover the same period.
  const [overlapRows] = await tenantTx(access, [
    sqlClient`
      select r.code from membership_roles mr join roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id
      where mr.tenant_id = ${access.tenantId} and mr.membership_id = ${input.membershipId}
        and r.code = any(${input.roleCodes}) and mr.revoked_at is null
        and (mr.valid_to::date is null or mr.valid_to::date >= ${from}::date)
        and (${to}::date is null or mr.valid_from::date <= ${to}::date)
    `,
  ]);
  const overlapping = (overlapRows as Array<{ code: string }>).map((row) => row.code);
  if (overlapping.length > 0) {
    throw new HttpError({ status: 409, code: "SCOPE_OVERLAP", message: `Overlapping active scope already exists: ${overlapping.join(", ")}.` });
  }
  await tenantTx(access, [
    ...input.roleCodes.map((code) => {
      const id = crypto.randomUUID();
      created.push({ id, roleCode: code });
      return sqlClient`
        insert into membership_roles (id, tenant_id, membership_id, role_id, valid_from, valid_to)
        values (${id}, ${access.tenantId}, ${input.membershipId}, ${found.get(code)}, ${from}::timestamptz, ${to}::timestamptz)
      `;
    }),
    ...created.map((grant) => sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.grant', 'access_scope', ${grant.id}, ${input.reason},
        ${JSON.stringify({ membershipId: input.membershipId, roleCode: grant.roleCode, effectiveFrom: from, effectiveTo: to })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `),
  ]);
  return created.map((grant) => ({ ...grant, membershipId: input.membershipId, effectiveFrom: from, effectiveTo: to }));
}

export const revokeScopeSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function revokeAccessScope(access: Access, id: string, reason: string, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, membership_id, revoked_at from membership_roles where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const grant = (rows as Array<{ id: string; membership_id: string; revoked_at: string | null }>)[0];
  if (!grant) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (grant.revoked_at) {
    throw new HttpError({ status: 409, code: "ALREADY_REVOKED", message: "This scope is already revoked." });
  }
  await tenantTx(access, [
    sqlClient`update membership_roles set revoked_at = now() where tenant_id = ${access.tenantId} and id = ${id} and revoked_at is null`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.revoke', 'access_scope', ${id}, ${reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, membershipId: grant.membership_id, status: "revoked" as const };
}

export async function listScopeRoles(access: Access) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, code, name, status from roles where tenant_id = ${access.tenantId} order by code asc limit 100`,
  ]);
  return rows as Array<{ id: string; code: string; name: string; status: string }>;
}

export async function listScopeMembers(access: Access) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select m.id, m.status, coalesce(u.name, u.email, 'Member') as name, u.email,
      e.employee_code from memberships m join "user" u on u.id = m.user_id
      left join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
      where m.tenant_id = ${access.tenantId} order by name asc, m.id asc limit 100`,
  ]);
  return rows as Array<{ id: string; status: string; name: string; email: string; employee_code: string | null }>;
}
