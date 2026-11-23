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

/** Tenant roles whose members hold every active permission in their own organisation. */
const OWNER_ROLE_CODES = new Set(["owner", "admin", "super_admin"]);

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

/** The signed-in user's id from the Better Auth session. No session, no identity. */
export async function sessionUserId(headers: Headers): Promise<string> {
  if (!databaseConfigured) throw new IdentityError("Identity storage is not configured", 503);
  const currentSession = await auth.api.getSession({ headers }).catch(() => null);
  if (currentSession?.user?.id) return currentSession.user.id;
  throw new IdentityError("Authentication required", 401);
}

export async function listTenantMemberships(headers: Headers): Promise<TenantMembership[]> {
  const userId = await sessionUserId(headers);
  return tenantMembershipsForUser(userId);
}

/**
 * Authorization context for the signed-in user in one tenant.
 *
 * `tenantId` is the tenant the caller asked for. When the user is not an active member of it, a
 * non-strict call uses the user's first active membership (a stale active-tenant cookie after a
 * different user signs in on the same browser); a strict call (switching tenant) refuses with 403.
 * A user without any active membership gets 403.
 */
export async function resolveAuthorizationContext(
  headers: Headers,
  tenantId: string | null,
  options: { strict?: boolean } = {},
): Promise<AuthorizationContext> {
  const userId = await sessionUserId(headers);
  const memberships = await tenantMembershipsForUser(userId);
  const requested = tenantId ? memberships.find((candidate) => candidate.tenantId === tenantId) : undefined;
  if (!requested && tenantId && options.strict) {
    throw new IdentityError("You are not a member of that organisation", 403);
  }
  const membership = requested ?? memberships[0];
  if (!membership) throw new IdentityError("You are not a member of any active organisation", 403);

  const [, , , rows] = await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${userId}, true)`,
    sqlClient`select set_config('app.tenant_id', ${membership.tenantId}, true)`,
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
      where m.id = ${membership.membershipId} and m.tenant_id = ${membership.tenantId}
      group by m.id, t.id
    `,
  ]);

  const row = (rows as ContextRow[])[0];
  const roleCodes = row?.role_codes ?? [];
  let permissionKeys = row?.permission_keys ?? [];
  // Organisation owners hold every permission in their own organisation, including permissions
  // added to the catalogue after their role was created.
  if (roleCodes.some((code) => OWNER_ROLE_CODES.has(code.toLowerCase().replace(/-/g, "_")))) {
    const allPermissions = (await sqlClient`select permission_key from permissions where status = 'active'`) as Array<{ permission_key: string }>;
    permissionKeys = [...new Set([...permissionKeys, ...allPermissions.map((permission) => permission.permission_key)])];
  }
  return {
    actorUserId: userId,
    membershipId: membership.membershipId,
    employeeId: row?.employee_id ?? membership.employeeId,
    tenantId: membership.tenantId,
    roles: roleCodes,
    permissions: permissionKeys,
  };
}
