import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const createRoleSchema = z.object({
  code: z.string().regex(/^[a-z0-9-]+$/).describe("lowercase kebab-case role code"),
  name: z.string().trim().min(1).max(120),
});

export async function createRole(access: Access, input: z.infer<typeof createRoleSchema>) {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id from roles where tenant_id = ${access.tenantId} and code = ${input.code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return { id: existing.id, duplicate: true };
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into roles (id, tenant_id, code, name, system_managed) values (${id}, ${access.tenantId}, ${input.code}, ${input.name}, false)`,
  ]);
  return { id, duplicate: false };
}

export const grantPermissionsSchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
});

export async function grantRolePermissions(access: Access, roleId: string, input: z.infer<typeof grantPermissionsSchema>, requestId: string) {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const [permissionRows] = await tenantTx(access, [
    sqlClient`select id, permission_key from permissions where permission_key = any(${input.permissionKeys}) and status = 'active'`,
  ]);
  const found = new Set((permissionRows as Array<{ id: string; permission_key: string }>).map((row) => row.permission_key));
  const unknown = input.permissionKeys.filter((key) => !found.has(key));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown permission keys: ${unknown.join(", ")}.` });
  }
  const permissionIds = (permissionRows as Array<{ id: string }>).map((row) => row.id);
  await tenantTx(access, [
    ...permissionIds.map((permissionId) => sqlClient`
      insert into role_permissions (tenant_id, role_id, permission_id)
      values (${access.tenantId}, ${roleId}, ${permissionId}) on conflict do nothing
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'admin.role_grant', 'role', ${roleId}, 'Role permissions granted',
        ${JSON.stringify({ permissionKeys: input.permissionKeys })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { roleId, granted: permissionIds.length };
}

export const assignRolesSchema = z.object({
  membershipId: z.string().uuid(),
  roleCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
});

export async function assignMemberRoles(access: Access, input: z.infer<typeof assignRolesSchema>, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [roleRows] = await tenantTx(access, [
    sqlClient`select id, code from roles where tenant_id = ${access.tenantId} and code = any(${input.roleCodes}) and status = 'active'`,
  ]);
  const found = new Map((roleRows as Array<{ id: string; code: string }>).map((row) => [row.code, row.id]));
  const unknown = input.roleCodes.filter((code) => !found.has(code));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown role codes: ${unknown.join(", ")}.` });
  }
  await tenantTx(access, [
    ...input.roleCodes.map((code) =>
      sqlClient`
        insert into membership_roles (tenant_id, membership_id, role_id)
        values (${access.tenantId}, ${input.membershipId}, ${found.get(code)})
        on conflict do nothing
      `,
    ),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'admin.membership_roles', 'membership', ${input.membershipId}, 'Member roles assigned',
        ${JSON.stringify({ roleCodes: input.roleCodes })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { membershipId: input.membershipId, roles: input.roleCodes };
}

export const createInviteSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  roleCodes: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  expiresInHours: z.number().int().min(1).max(24 * 30).default(72),
});

export async function createInvite(access: Access, input: z.infer<typeof createInviteSchema>, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [roleRows] = await tenantTx(access, [
    sqlClient`select code from roles where tenant_id = ${access.tenantId} and code = any(${input.roleCodes}) and status = 'active'`,
  ]);
  const found = new Set((roleRows as Array<{ code: string }>).map((row) => row.code));
  const unknown = input.roleCodes.filter((code) => !found.has(code));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown role codes: ${unknown.join(", ")}.` });
  }
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into invitations (id, tenant_id, email, token_hash, status, invited_by_user_id, expires_at)
      values (${id}, ${access.tenantId}, ${input.email}, ${tokenHash}, 'pending', ${access.context.actorUserId},
        now() + (${input.expiresInHours} || ' hours')::interval)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'admin.invite_create', 'invitation', ${id}, 'Invitation issued',
        ${JSON.stringify({ email: input.email, roleCodes: input.roleCodes })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  // The raw token is returned exactly once at issuance and never stored.
  return { id, token: rawToken, expiresInHours: input.expiresInHours };
}

export async function revokeInvite(access: Access, inviteId: string, requestId: string) {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, status from invitations where tenant_id = ${access.tenantId} and id = ${inviteId} limit 1`,
  ]);
  const invite = (rows as Array<{ id: string; status: string }>)[0];
  if (!invite) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (invite.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Invitation is ${invite.status}.` });
  }
  await tenantTx(access, [
    sqlClient`update invitations set status = 'revoked', revoked_at = now() where id = ${inviteId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'admin.invite_revoke', 'invitation', ${inviteId}, 'Invitation revoked', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: inviteId, status: "revoked" };
}

export function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const patchSettingsSchema = z.object({
  locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(),
  timezone: z.string().refine((value) => isValidTimezone(value)).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
});

export async function getSettings(access: Access) {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select locale, timezone, currency, policy_schema_version, settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const settings = (rows as Array<{ locale: string; timezone: string; currency: string; policy_schema_version: number; settings: unknown }>)[0];
  if (!settings) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Tenant settings are not initialized." });
  return settings;
}

export async function patchSettings(access: Access, input: z.infer<typeof patchSettingsSchema>, requestId: string) {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Unknown IANA timezone." });
  }
  const patch: Record<string, string> = {};
  if (input.locale) patch.locale = input.locale;
  if (input.timezone) patch.timezone = input.timezone;
  if (input.currency) patch.currency = input.currency;
  if (Object.keys(patch).length === 0) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "At least one setting is required." });
  }
  const statements = [];
  if (patch.locale) statements.push(sqlClient`update tenant_settings set locale = ${patch.locale} where tenant_id = ${access.tenantId}`);
  if (patch.timezone) statements.push(sqlClient`update tenant_settings set timezone = ${patch.timezone} where tenant_id = ${access.tenantId}`);
  if (patch.currency) statements.push(sqlClient`update tenant_settings set currency = ${patch.currency} where tenant_id = ${access.tenantId}`);
  statements.push(sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
      'admin.settings_patch', 'tenant', ${access.tenantId}, 'Tenant settings updated',
      ${JSON.stringify(patch)}::jsonb, ${uuidOrNull(requestId)}::uuid)
  `);
  await tenantTx(access, statements);
  return patch;
}
