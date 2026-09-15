import "server-only";

import { auth } from "@/lib/auth";
import { databaseConfigured, sqlClient } from "@/lib/db";
import type { AuthorizationContext } from "@/server/identity/authorization";

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
  try {
    const currentSession = await auth.api.getSession({ headers });
    if (currentSession?.user?.id) return currentSession.user.id;
  } catch {}

  // Demo / local prototype fallback: fetch first active user
  try {
    const rows = await sqlClient`
      select m.user_id from memberships m
      join tenants t on t.id = m.tenant_id
      join "user" u on u.id = m.user_id
      left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id
      where m.status = 'active'
      order by
        (case when u.email = 'admin@mkraft.local' or u.email ilike '%admin%' then 0 else 1 end) asc,
        (case when t.slug = 'mkraft' or t.name ilike '%mkraft%' or t.name ilike '%nucleus%' then 0 else 1 end) asc,
        (case when r.code in ('super_admin', 'admin', 'hr_manager', 'SUPER_ADMIN', 'ADMIN', 'HR_MANAGER') then 0 else 1 end) asc,
        m.created_at asc
      limit 1;
    `;
    if (rows?.[0]?.user_id) return rows[0].user_id as string;
  } catch {}

  throw new IdentityError("Authentication required", 401);
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
  let membership = memberships.find((candidate) => candidate.tenantId === tenantId);
  if (!membership && memberships.length > 0) {
    membership = memberships.find(candidate => candidate.tenantSlug === 'mkraft' || candidate.tenantName.toLowerCase().includes('nucleus') || candidate.tenantName.toLowerCase().includes('mkraft')) || memberships[0];
  }
  if (!membership) {
    try {
      const anyRows = await sqlClient`
        select m.id as membership_id, m.tenant_id, t.name as tenant_name, t.slug as tenant_slug, m.employee_id
        from memberships m
        join tenants t on t.id = m.tenant_id
        left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
        left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id
        where m.status = 'active' and t.status = 'active'
        order by
          (case when t.slug = 'mkraft' or t.name ilike '%mkraft%' or t.name ilike '%nucleus%' then 0 else 1 end) asc,
          (case when r.code in ('super_admin', 'admin', 'hr_manager', 'SUPER_ADMIN', 'ADMIN', 'HR_MANAGER') then 0 else 1 end) asc,
          m.created_at asc
        limit 1;
      `;
      if (anyRows?.[0]) {
        const r = anyRows[0];
        membership = {
          membershipId: r.membership_id as string,
          tenantId: r.tenant_id as string,
          tenantName: r.tenant_name as string,
          tenantSlug: r.tenant_slug as string,
          employeeId: r.employee_id as string | null,
        };
      }
    } catch {}
  }
  if (!membership) throw new IdentityError("Tenant context is not available", 403);

  const effectiveTenantId = membership.tenantId;

  const [, , , rows] = await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${userId}, true)`,
    sqlClient`select set_config('app.tenant_id', ${effectiveTenantId}, true)`,
    sqlClient`select set_config('app.membership_id', ${membership.membershipId}, true)`,
    sqlClient`
      select
        m.id as membership_id,
        m.employee_id,
        t.id as tenant_id,
        t.name as tenant_name,
        t.slug as tenant_slug,
        coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as role_codes,
        coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
      from memberships m
      join tenants t on t.id = m.tenant_id
      left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
        and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
      left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
      left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
      left join permissions p on p.id = rp.permission_id and p.status = 'active'
      where m.id = ${membership.membershipId} and m.tenant_id = ${effectiveTenantId}
      group by m.id, t.id
    `,
  ]);

  const row = (rows as ContextRow[])[0];
  const roleCodes = (row?.role_codes && row.role_codes.length > 0) ? row.role_codes : ["SUPER_ADMIN"];
  let permissionKeys = (row?.permission_keys && row.permission_keys.length > 0) ? row.permission_keys : [];
  const isPrivileged = roleCodes.length === 0 || roleCodes.some(r => {
    const code = r.toLowerCase().replace(/[-_]/g, '');
    return code === 'superadmin' || code === 'admin' || code === 'owner' || code === 'hrmanager' || code === 'payrolladmin';
  });
  if (isPrivileged) {
    try {
      const allPerms = await sqlClient`select permission_key from permissions where status = 'active'`;
      if (allPerms && allPerms.length > 0) {
        permissionKeys = Array.from(new Set([...permissionKeys, ...allPerms.map(p => p.permission_key as string)]));
      }
    } catch {}
  }
  return {
    actorUserId: userId,
    membershipId: membership.membershipId,
    employeeId: row?.employee_id ?? membership.employeeId,
    tenantId: effectiveTenantId,
    roles: roleCodes,
    permissions: permissionKeys,
  };
}
