import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import type { PlatformAdmin } from "@/server/platform-admin/access";
import { HttpError } from "@/server/platform/http";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.").min(3).max(80);
const email = z.string().email().transform((value) => value.trim().toLowerCase());

export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().min(2).max(220).optional(),
  slug,
  timezone: z.string().trim().min(1).max(80).default("Asia/Kolkata"),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: email,
});

export const changeTenantStatusSchema = z.object({
  status: z.enum(["active", "suspended", "archived"]),
  reason: z.string().trim().min(8).max(500),
});

export const createTenantUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  roleCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
});

const standardRoles = {
  "hr-manager": ["tenant.read", "employee.read", "employee.write", "attendance.read", "attendance.write", "leave.read", "leave.approve", "role.manage", "membership.manage"],
  "payroll-admin": ["tenant.read", "employee.read", "attendance.read", "payroll.read", "payroll.run"],
  employee: ["tenant.read", "employee.read", "attendance.read", "leave.read"],
} as const;

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  default_currency: string;
  timezone: string;
  status: "active" | "suspended" | "archived";
  created_at: string;
  member_count: number;
  owner_name: string | null;
  owner_email: string | null;
};

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}

/** Executes global queries only after the request has passed the email allowlist. */
async function platformTx<T>(admin: PlatformAdmin, statements: ReturnType<typeof sqlClient>[]) {
  const results = await sqlClient.transaction([
    sqlClient`select set_config('app.user_id', ${admin.userId}, true)`,
    sqlClient`select set_config('app.platform_admin', 'true', true)`,
    ...statements,
  ]);
  return results.slice(2) as T[];
}

export async function listPlatformTenants(admin: PlatformAdmin) {
  const [rows] = await platformTx<TenantRow[]>(admin, [
    sqlClient`
      select
        t.id, t.name, t.slug, t.legal_name, t.default_currency, t.timezone, t.status,
        t.created_at::text as created_at,
        count(m.id)::int as member_count,
        max(u.name) filter (where m.role = 'owner' and m.status = 'active') as owner_name,
        max(u.email) filter (where m.role = 'owner' and m.status = 'active') as owner_email
      from tenants t
      left join memberships m on m.tenant_id = t.id
      left join "user" u on u.id = m.user_id
      group by t.id
      order by t.created_at desc
    `,
  ]);
  return rows;
}

export async function createPlatformTenant(admin: PlatformAdmin, input: z.infer<typeof createTenantSchema>) {
  const [slugRows, userRows] = await platformTx<unknown>(admin, [
    sqlClient`select id from tenants where slug = ${input.slug} limit 1`,
    sqlClient`select id, name, email from "user" where lower(email) = ${input.ownerEmail} limit 1`,
  ]);
  if ((slugRows as Array<{ id: string }>)[0]) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "That company URL slug is already in use." });
  }

  const existingOwner = (userRows as Array<{ id: string; name: string; email: string }>)[0];
  const tenantId = randomUUID();
  const membershipId = randomUUID();
  const ownerRoleId = randomUUID();
  const standardRoleIds = Object.fromEntries(Object.keys(standardRoles).map((code) => [code, randomUUID()])) as Record<keyof typeof standardRoles, string>;
  const userId = existingOwner?.id ?? randomUUID();
  const oneTimePassword = existingOwner ? null : temporaryPassword();
  const passwordHash = oneTimePassword ? await hashPassword(oneTimePassword) : null;
  const invitationHash = createHash("sha256").update(randomBytes(32)).digest("hex");

  await platformTx(admin, [
    ...(existingOwner ? [] : [
      sqlClient`insert into "user" (id, name, email, email_verified, status) values (${userId}, ${input.ownerName}, ${input.ownerEmail}, true, 'active')`,
      sqlClient`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})`,
    ]),
    sqlClient`insert into tenants (id, name, slug, legal_name, default_currency, timezone, status) values (${tenantId}, ${input.name}, ${input.slug}, ${input.legalName ?? null}, ${input.currency}, ${input.timezone}, 'active')`,
    sqlClient`insert into memberships (id, tenant_id, user_id, role, status) values (${membershipId}, ${tenantId}, ${userId}, 'owner', 'active')`,
    sqlClient`insert into tenant_settings (tenant_id, locale, timezone, currency) values (${tenantId}, 'en-IN', ${input.timezone}, ${input.currency})`,
    sqlClient`insert into roles (id, tenant_id, code, name, system_managed) values (${ownerRoleId}, ${tenantId}, 'owner', 'Workspace Owner', true)`,
    ...Object.entries(standardRoles).map(([code]) => sqlClient`insert into roles (id, tenant_id, code, name, system_managed) values (${standardRoleIds[code as keyof typeof standardRoles]}, ${tenantId}, ${code}, ${code.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}, true)`),
    sqlClient`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${ownerRoleId}, id from permissions where status = 'active'`,
    ...Object.entries(standardRoles).map(([code, permissionKeys]) => sqlClient`insert into role_permissions (tenant_id, role_id, permission_id) select ${tenantId}, ${standardRoleIds[code as keyof typeof standardRoles]}, id from permissions where permission_key = any(${permissionKeys}) and status = 'active'`),
    sqlClient`insert into membership_roles (tenant_id, membership_id, role_id) values (${tenantId}, ${membershipId}, ${ownerRoleId})`,
    sqlClient`insert into invitations (id, tenant_id, email, token_hash, status, invited_by_user_id, accepted_user_id, expires_at, accepted_at) values (${randomUUID()}, ${tenantId}, ${input.ownerEmail}, ${invitationHash}, 'accepted', ${admin.userId}, ${userId}, now() + interval '1 day', now())`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, after) values (${tenantId}, ${admin.userId}, 'platform.tenant_create', 'tenant', ${tenantId}, 'Platform administrator provisioned client company', ${JSON.stringify({ name: input.name, slug: input.slug, ownerEmail: input.ownerEmail, existingOwner: Boolean(existingOwner) })}::jsonb)`,
  ]);

  return { id: tenantId, name: input.name, slug: input.slug, ownerEmail: input.ownerEmail, oneTimePassword, reusedExistingUser: Boolean(existingOwner) };
}

export async function changePlatformTenantStatus(admin: PlatformAdmin, tenantId: string, input: z.infer<typeof changeTenantStatusSchema>) {
  const [currentRows] = await platformTx<Array<Pick<TenantRow, "id" | "name" | "status">>>(admin, [
    sqlClient`select id, name, status from tenants where id = ${tenantId} limit 1`,
  ]);
  const current = currentRows[0];
  if (!current) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Company not found." });
  if (current.status === input.status) return { ...current, unchanged: true };

  await platformTx(admin, [
    sqlClient`update tenants set status = ${input.status}, updated_at = now() where id = ${tenantId}`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, before, after) values (${tenantId}, ${admin.userId}, 'platform.tenant_status_change', 'tenant', ${tenantId}, ${input.reason}, ${JSON.stringify({ status: current.status })}::jsonb, ${JSON.stringify({ status: input.status })}::jsonb)`,
  ]);
  return { id: current.id, name: current.name, status: input.status, unchanged: false };
}

export async function listPlatformTenantUsers(admin: PlatformAdmin, tenantId: string) {
  const [tenantRows, roleRows, memberRows] = await platformTx<unknown>(admin, [
    sqlClient`select id, name, status from tenants where id = ${tenantId} limit 1`,
    sqlClient`select code, name from roles where tenant_id = ${tenantId} and status = 'active' order by system_managed desc, name`,
    sqlClient`
      select m.id as membership_id, u.id as user_id, u.name, u.email, m.status,
        coalesce(array_agg(distinct r.code) filter (where r.code is not null and mr.revoked_at is null), '{}') as role_codes
      from memberships m
      join "user" u on u.id = m.user_id
      left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id
      where m.tenant_id = ${tenantId}
      group by m.id, u.id
      order by u.name
    `,
  ]);
  if (!(tenantRows as Array<{ id: string }>)[0]) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Company not found." });
  return { tenant: (tenantRows as Array<{ id: string; name: string; status: string }>)[0], roles: roleRows, members: memberRows };
}

export async function createPlatformTenantUser(admin: PlatformAdmin, tenantId: string, input: z.infer<typeof createTenantUserSchema>) {
  const [tenantRows, roleRows, userRows] = await platformTx<unknown>(admin, [
    sqlClient`select id, name, status from tenants where id = ${tenantId} limit 1`,
    sqlClient`select id, code from roles where tenant_id = ${tenantId} and code = any(${input.roleCodes}) and status = 'active'`,
    sqlClient`select id from "user" where lower(email) = ${input.email} limit 1`,
  ]);
  const tenant = (tenantRows as Array<{ id: string; name: string; status: string }>)[0];
  if (!tenant) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Company not found." });
  if (tenant.status !== "active") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Reactivate the company before adding users." });
  const roles = roleRows as Array<{ id: string; code: string }>;
  const foundCodes = new Set(roles.map((role) => role.code));
  const unknownCodes = input.roleCodes.filter((code) => !foundCodes.has(code));
  if (unknownCodes.length) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown role codes: ${unknownCodes.join(", ")}.` });

  const existingUser = (userRows as Array<{ id: string }>)[0];
  const userId = existingUser?.id ?? randomUUID();
  const [membershipRows] = await platformTx<Array<{ id: string }>>(admin, [
    sqlClient`select id from memberships where tenant_id = ${tenantId} and user_id = ${userId} limit 1`,
  ]);
  if (membershipRows[0]) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "This user already belongs to the company." });

  const membershipId = randomUUID();
  const oneTimePassword = existingUser ? null : temporaryPassword();
  const passwordHash = oneTimePassword ? await hashPassword(oneTimePassword) : null;
  const invitationHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  await platformTx(admin, [
    ...(existingUser ? [] : [
      sqlClient`insert into "user" (id, name, email, email_verified, status) values (${userId}, ${input.name}, ${input.email}, true, 'active')`,
      sqlClient`insert into account (id, account_id, provider_id, user_id, password) values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash})`,
    ]),
    sqlClient`insert into memberships (id, tenant_id, user_id, role, status) values (${membershipId}, ${tenantId}, ${userId}, 'employee', 'active')`,
    ...roles.map((role) => sqlClient`insert into membership_roles (tenant_id, membership_id, role_id) values (${tenantId}, ${membershipId}, ${role.id})`),
    sqlClient`insert into invitations (id, tenant_id, email, token_hash, status, invited_by_user_id, accepted_user_id, expires_at, accepted_at) values (${randomUUID()}, ${tenantId}, ${input.email}, ${invitationHash}, 'accepted', ${admin.userId}, ${userId}, now() + interval '1 day', now())`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, action, entity_type, entity_id, reason, after) values (${tenantId}, ${admin.userId}, 'platform.user_provision', 'membership', ${membershipId}, 'Platform administrator provisioned tenant user', ${JSON.stringify({ email: input.email, roleCodes: input.roleCodes, existingUser: Boolean(existingUser) })}::jsonb)`,
  ]);
  return { membershipId, userId, tenantId, tenantName: tenant.name, email: input.email, roleCodes: input.roleCodes, oneTimePassword, reusedExistingUser: Boolean(existingUser) };
}
