import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  deriveUiAccess,
  isPrivilegedRoleCode,
  isSuperAdminRoleCode,
  UI_CARD_KEYS,
  UI_PAGE_KEYS,
  type EffectiveUiAccess,
  type OverrideEffect,
  type UiResourceType,
} from "@/lib/access/ui-access-catalog";
import { asRoleUiConfig, loadRoleUiConfigs } from "@/server/access/role-admin";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Member access: the people in the tenant, the roles they hold (membership_roles)
 * and time-boxed page/card overrides for one member (resource_grants with
 * resource_type 'ui.page' / 'ui.card', actions ['allow'] or ['deny']).
 */

const RESOURCE_TYPE: Record<UiResourceType, string> = { page: "ui.page", card: "ui.card" };

export type MemberSummary = {
  id: string;
  status: string;
  name: string;
  email: string | null;
  employeeCode: string | null;
  department: string | null;
  roleCodes: string[];
  roleNames: string[];
  overrideCount: number;
};

export type MemberOverride = {
  id: string;
  type: UiResourceType;
  key: string;
  effect: OverrideEffect;
  reason: string;
  expiresAt: string;
  createdAt: string;
};

export type MemberAccess = {
  member: MemberSummary;
  roles: Array<{ id: string; code: string; name: string }>;
  permissions: string[];
  superAdmin: boolean;
  overrides: MemberOverride[];
  access: EffectiveUiAccess;
};

type MemberRow = {
  id: string; status: string; name: string; email: string | null; employee_code: string | null; department: string | null;
  role_codes: string[] | null; role_names: string[] | null; override_count: number | string | null;
};

function mapMember(row: MemberRow): MemberSummary {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    email: row.email,
    employeeCode: row.employee_code,
    department: row.department,
    roleCodes: row.role_codes ?? [],
    roleNames: row.role_names ?? [],
    overrideCount: Number(row.override_count ?? 0),
  };
}

async function selectMembers(access: Access, membershipId: string | null): Promise<MemberSummary[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select m.id, m.status, coalesce(nullif(u.name, ''), u.email, '') as name, u.email, e.employee_code, e.department,
        coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as role_codes,
        coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as role_names,
        (select count(*) from resource_grants g
          where g.tenant_id = m.tenant_id and g.membership_id = m.id and g.resource_type in ('ui.page', 'ui.card')
            and g.revoked_at is null and g.valid_from <= now() and g.expires_at > now())::int as override_count
      from memberships m
      join "user" u on u.id = m.user_id
      left join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
      left join membership_roles mr on mr.tenant_id = m.tenant_id and mr.membership_id = m.id
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
      left join roles r on r.tenant_id = m.tenant_id and r.id = mr.role_id and r.status = 'active'
      where m.tenant_id = ${access.tenantId} and (${membershipId}::uuid is null or m.id = ${membershipId}::uuid)
      group by m.id, u.id, e.id
      order by name asc, m.id asc
      limit 500
    `,
  ]);
  return (rows as MemberRow[]).map(mapMember);
}

export async function listMembers(access: Access): Promise<MemberSummary[]> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  return selectMembers(access, null);
}

async function loadMemberAccess(access: Access, membershipId: string): Promise<MemberAccess> {
  if (!z.string().uuid().safeParse(membershipId).success) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The member was not found in this tenant." });
  }
  const member = (await selectMembers(access, membershipId))[0];
  if (!member) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The member was not found in this tenant." });
  const [roleRows, permissionRows, overrideRows] = await tenantTx(access, [
    sqlClient`
      select distinct r.id, r.code, r.name from membership_roles mr
      join roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
      where mr.tenant_id = ${access.tenantId} and mr.membership_id = ${membershipId}
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    `,
    sqlClient`
      select distinct p.permission_key from membership_roles mr
      join roles r on r.tenant_id = mr.tenant_id and r.id = mr.role_id and r.status = 'active'
      join role_permissions rp on rp.tenant_id = mr.tenant_id and rp.role_id = r.id
      join permissions p on p.id = rp.permission_id and p.status = 'active'
      where mr.tenant_id = ${access.tenantId} and mr.membership_id = ${membershipId}
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    `,
    sqlClient`
      select id, resource_type, resource_id, actions, reason, expires_at::text as expires_at, created_at::text as created_at
      from resource_grants
      where tenant_id = ${access.tenantId} and membership_id = ${membershipId}
        and resource_type in ('ui.page', 'ui.card') and revoked_at is null and valid_from <= now() and expires_at > now()
      order by created_at desc
    `,
  ]);
  const roles = roleRows as Array<{ id: string; code: string; name: string }>;
  const superAdmin = roles.some((role) => isSuperAdminRoleCode(role.code));
  let permissions = (permissionRows as Array<{ permission_key: string }>).map((row) => row.permission_key);
  if (roles.some((role) => isPrivilegedRoleCode(role.code))) {
    const [all] = await tenantTx(access, [sqlClient`select permission_key from permissions where status = 'active'`]);
    permissions = [...new Set([...permissions, ...(all as Array<{ permission_key: string }>).map((row) => row.permission_key)])];
  }
  const overrides: MemberOverride[] = (overrideRows as Array<{
    id: string; resource_type: string; resource_id: string; actions: string[]; reason: string; expires_at: string; created_at: string;
  }>).map((row) => ({
    id: row.id,
    type: row.resource_type === "ui.card" ? "card" : "page",
    key: row.resource_id,
    effect: row.actions.includes("deny") ? "deny" : "allow",
    reason: row.reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
  const ui = await loadRoleUiConfigs(access);
  return {
    member,
    roles,
    permissions: permissions.sort(),
    superAdmin,
    overrides,
    access: deriveUiAccess({
      superAdmin,
      permissions,
      roleConfigs: roles.map((role) => asRoleUiConfig(ui.get(role.id))),
      overrides,
    }),
  };
}

export async function getMemberAccess(access: Access, membershipId: string): Promise<MemberAccess> {
  if (membershipId !== access.context.membershipId) {
    enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  }
  return loadMemberAccess(access, membershipId);
}

/** The caller's own effective page/card access; used by navigation to hide what the server would refuse. */
export async function getOwnUiAccess(access: Access): Promise<MemberAccess> {
  return loadMemberAccess(access, access.context.membershipId);
}

const overrideItem = z
  .object({ type: z.enum(["page", "card"]), key: z.string().trim().min(1).max(40), effect: z.enum(["allow", "deny"]) })
  .refine((item) => (item.type === "page" ? UI_PAGE_KEYS : UI_CARD_KEYS).includes(item.key), { message: "Unknown page or card.", path: ["key"] });

export const setOverridesSchema = z.object({
  items: z.array(overrideItem).min(1).max(40),
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters.").max(500),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an expiry date."),
});

export const clearOverridesSchema = z.object({
  items: z.array(z.object({ type: z.enum(["page", "card"]), key: z.string().trim().min(1).max(40) })).max(40).optional(),
  reason: z.string().trim().min(3, "Give a reason of at least 3 characters.").max(500),
});

function assertNotSelf(access: Access, membershipId: string): void {
  if (membershipId === access.context.membershipId) {
    throw new HttpError({ status: 422, code: "SELF_GRANT_FORBIDDEN", message: "You cannot change your own access. Ask another administrator." });
  }
}

/** Validates the expiry: a future date at most one year ahead. Returns the end-of-day timestamp. */
export function expiryTimestamp(expiresOn: string, now = new Date()): string {
  const end = new Date(`${expiresOn}T23:59:59.000Z`);
  const max = new Date(now.getTime() + 366 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(end.getTime()) || end <= now || end > max) {
    throw new HttpError({ status: 422, code: "INVALID_DATES", message: "The expiry must be a future date within one year.", details: [{ field: "expiresOn", issue: "range" }] });
  }
  return end.toISOString();
}

export async function setMemberOverrides(
  access: Access,
  membershipId: string,
  input: z.infer<typeof setOverridesSchema>,
  requestId: string,
): Promise<MemberAccess> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  assertNotSelf(access, membershipId);
  const before = await loadMemberAccess(access, membershipId);
  const expiresAt = expiryTimestamp(input.expiresOn);
  const statements = input.items.flatMap((item) => [
    sqlClient`
      update resource_grants set revoked_at = now()
      where tenant_id = ${access.tenantId} and membership_id = ${membershipId}
        and resource_type = ${RESOURCE_TYPE[item.type]} and resource_id = ${item.key} and revoked_at is null
    `,
    sqlClient`
      insert into resource_grants (tenant_id, membership_id, resource_type, resource_id, actions, reason, approved_by_membership_id, expires_at)
      values (${access.tenantId}, ${membershipId}, ${RESOURCE_TYPE[item.type]}, ${item.key}, ${[item.effect]},
        ${input.reason}, ${access.context.membershipId}, ${expiresAt}::timestamptz)
    `,
  ]);
  await tenantTx(access, [
    ...statements,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.member_override', 'membership', ${membershipId}, ${input.reason},
        ${JSON.stringify(before.overrides.map(({ type, key, effect }) => ({ type, key, effect })))}::jsonb,
        ${JSON.stringify({ items: input.items, expiresAt })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return loadMemberAccess(access, membershipId);
}

export async function clearMemberOverrides(
  access: Access,
  membershipId: string,
  input: z.infer<typeof clearOverridesSchema>,
  requestId: string,
): Promise<MemberAccess> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  assertNotSelf(access, membershipId);
  const before = await loadMemberAccess(access, membershipId);
  const items = input.items ?? [];
  const statements = items.length === 0
    ? [sqlClient`
        update resource_grants set revoked_at = now()
        where tenant_id = ${access.tenantId} and membership_id = ${membershipId}
          and resource_type in ('ui.page', 'ui.card') and revoked_at is null
      `]
    : items.map((item) => sqlClient`
        update resource_grants set revoked_at = now()
        where tenant_id = ${access.tenantId} and membership_id = ${membershipId}
          and resource_type = ${RESOURCE_TYPE[item.type]} and resource_id = ${item.key} and revoked_at is null
      `);
  await tenantTx(access, [
    ...statements,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.member_override_clear', 'membership', ${membershipId}, ${input.reason},
        ${JSON.stringify(before.overrides.map(({ type, key, effect }) => ({ type, key, effect })))}::jsonb,
        ${JSON.stringify({ cleared: items.length === 0 ? "all" : items })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return loadMemberAccess(access, membershipId);
}
