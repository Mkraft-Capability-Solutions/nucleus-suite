import "server-only";

import { auth } from "@/lib/auth";
import { databaseConfigured, sqlClient } from "@/lib/db";
import type { AuthorizationContext } from "@/server/identity/authorization";
import { grantsForRoles, membershipScopeFor } from "@/server/access-scopes/data-scope-settings";

export class IdentityError extends Error {
  constructor(message: string, readonly status: 401 | 403 | 503) {
    super(message);
  }
}

type MembershipRow = {
  membership_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  employee_id: string | null;
};

type ContextRow = MembershipRow & {
  role_codes: string[] | null;
  permission_keys: string[] | null;
  data_scope_settings: unknown;
};

export type TenantMembership = {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  employeeId: string | null;
};

async function tenantMembershipsForUser(userId: string): Promise<TenantMembership[]> {
  const [, rows] = await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${userId}, true)`,
    sqlClient`
      select m.id as membership_id, t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, m.employee_id
      from memberships m
      join tenants t on t.id = m.tenant_id
      where m.user_id = ${userId} and m.status = 'active' and t.status = 'active'
      order by t.name asc
    `,
  ]);

  return (rows as MembershipRow[]).map((row) => ({
    membershipId: row.membership_id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
  }));
}

async function sessionUserId(headers: Headers) {
  if (!databaseConfigured) throw new IdentityError("Identity storage is not configured", 503);
  const currentSession = await auth.api.getSession({ headers });
  if (!currentSession?.user?.id) throw new IdentityError("Authentication required", 401);
  return currentSession.user.id;
}

export async function listTenantMemberships(headers: Headers): Promise<TenantMembership[]> {
  const userId = await sessionUserId(headers);
  return tenantMembershipsForUser(userId);
}

export async function resolveAuthorizationContext(
  headers: Headers,
  tenantId: string,
): Promise<AuthorizationContext> {
  const userId = await sessionUserId(headers);
  const memberships = await tenantMembershipsForUser(userId);
  const membership = memberships.find((candidate) => candidate.tenantId === tenantId);
  if (!membership) throw new IdentityError("Tenant context is not available", 403);

  const [, , , rows] = await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${userId}, true)`,
    sqlClient`select set_config('app.tenant_id', ${tenantId}, true)`,
    sqlClient`select set_config('app.membership_id', ${membership.membershipId}, true)`,
    sqlClient`
      select
        m.id as membership_id,
        m.employee_id,
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as role_codes,
        coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys,
        ts.settings as data_scope_settings
      from memberships m
      join tenants t on t.id = m.tenant_id
      left join tenant_settings ts on ts.tenant_id = m.tenant_id
      left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
      left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
      left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
      left join permissions p on p.id = rp.permission_id and p.status = 'active'
      where m.user_id = ${userId} and m.tenant_id = ${tenantId} and m.status = 'active' and t.status = 'active'
      group by m.id, t.id, ts.settings
    `,
  ]);

  const row = (rows as ContextRow[])[0];
  if (!row) throw new IdentityError("Tenant context is no longer available", 403);
  const roles = row.role_codes ?? [];
  return {
    actorUserId: userId,
    membershipId: row.membership_id,
    employeeId: row.employee_id,
    tenantId: row.tenant_id,
    roles,
    permissions: row.permission_keys ?? [],
    // RL-24: the data scopes configured for exactly the roles this caller holds right now.
    dataScopes: grantsForRoles(row.data_scope_settings, roles),
    // FRM-PLT-03: the caller's own scope grant, from the same settings row.
    membershipScope: membershipScopeFor(row.data_scope_settings, row.membership_id),
  };
}
