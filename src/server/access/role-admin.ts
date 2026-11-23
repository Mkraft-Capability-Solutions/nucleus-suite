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
  type RoleUiConfig,
} from "@/lib/access/ui-access-catalog";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Role administration over roles, permissions and role_permissions, plus the
 * per-role page/card configuration kept in tenant_settings.settings.roleUiAccess.
 * Action permissions take effect on the next request: identity/tenant-context
 * reloads role_permissions for every call.
 */

export type PermissionEntry = { key: string; fieldDomain: string; risk: string };

export type RoleUiAccessRecord = { pages: string[]; cards: string[]; updatedAt: string | null };

export type RoleView = {
  id: string;
  code: string;
  name: string;
  status: string;
  systemManaged: boolean;
  memberCount: number;
  permissionKeys: string[];
  superAdmin: boolean;
  privileged: boolean;
  uiAccess: RoleUiAccessRecord | null;
};

type RoleRow = {
  id: string; code: string; name: string; status: string; system_managed: boolean;
  permission_keys: string[] | null; member_count: number | string | null;
};

const UI_KEY_SET = { page: new Set(UI_PAGE_KEYS), card: new Set(UI_CARD_KEYS) };

function toRecord(value: unknown): RoleUiAccessRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { pages?: unknown; cards?: unknown; updatedAt?: unknown };
  const pages = Array.isArray(raw.pages) ? raw.pages.filter((key): key is string => typeof key === "string" && UI_KEY_SET.page.has(key)) : [];
  const cards = Array.isArray(raw.cards) ? raw.cards.filter((key): key is string => typeof key === "string" && UI_KEY_SET.card.has(key)) : [];
  return { pages, cards, updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null };
}

/** Page/card configuration per role id, read from tenant_settings. */
export async function loadRoleUiConfigs(access: Access): Promise<Map<string, RoleUiAccessRecord>> {
  const [rows] = await tenantTx(access, [
    sqlClient`select settings->'roleUiAccess' as ui from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const ui = (rows as Array<{ ui: unknown }>)[0]?.ui;
  const map = new Map<string, RoleUiAccessRecord>();
  if (ui && typeof ui === "object") {
    for (const [roleId, value] of Object.entries(ui as Record<string, unknown>)) {
      const record = toRecord(value);
      if (record) map.set(roleId, record);
    }
  }
  return map;
}

export function asRoleUiConfig(record: RoleUiAccessRecord | null | undefined): RoleUiConfig {
  return record ? { pages: record.pages, cards: record.cards } : null;
}

export async function listPermissionCatalog(access: Access): Promise<PermissionEntry[]> {
  enforce(access.context, "role.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select permission_key, field_domain, risk from permissions where status = 'active' order by permission_key asc limit 500`,
  ]);
  return (rows as Array<{ permission_key: string; field_domain: string; risk: string }>).map((row) => ({
    key: row.permission_key, fieldDomain: row.field_domain, risk: row.risk,
  }));
}

function mapRole(row: RoleRow, ui: Map<string, RoleUiAccessRecord>): RoleView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    systemManaged: row.system_managed,
    memberCount: Number(row.member_count ?? 0),
    permissionKeys: [...(row.permission_keys ?? [])].sort(),
    superAdmin: isSuperAdminRoleCode(row.code),
    privileged: isPrivilegedRoleCode(row.code),
    uiAccess: ui.get(row.id) ?? null,
  };
}

async function selectRoles(access: Access, roleId: string | null): Promise<RoleRow[]> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.code, r.name, r.status, r.system_managed,
        coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys,
        (select count(distinct mr.membership_id) from membership_roles mr
          where mr.tenant_id = r.tenant_id and mr.role_id = r.id and mr.revoked_at is null
            and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now()))::int as member_count
      from roles r
      left join role_permissions rp on rp.tenant_id = r.tenant_id and rp.role_id = r.id
      left join permissions p on p.id = rp.permission_id and p.status = 'active'
      where r.tenant_id = ${access.tenantId} and (${roleId}::uuid is null or r.id = ${roleId}::uuid)
      group by r.id
      order by r.name asc, r.id asc
      limit 200
    `,
  ]);
  return rows as RoleRow[];
}

export async function listRoles(access: Access): Promise<RoleView[]> {
  enforce(access.context, "role.read", { tenantId: access.tenantId });
  const [rows, ui] = await Promise.all([selectRoles(access, null), loadRoleUiConfigs(access)]);
  return rows.map((row) => mapRole(row, ui));
}

async function requireRole(access: Access, roleId: string): Promise<RoleView> {
  if (!z.string().uuid().safeParse(roleId).success) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested role was not found." });
  }
  const [rows, ui] = await Promise.all([selectRoles(access, roleId), loadRoleUiConfigs(access)]);
  const row = rows[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested role was not found." });
  return mapRole(row, ui);
}

export async function getRole(access: Access, roleId: string): Promise<RoleView> {
  enforce(access.context, "role.read", { tenantId: access.tenantId });
  return requireRole(access, roleId);
}

export const createRoleSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,62}$/, "Use 2-63 lowercase letters, digits, - or _."),
  name: z.string().trim().min(1, "A role name is required.").max(120, "Use at most 120 characters."),
  copyFromRoleId: z.string().uuid().optional(),
});

export async function createRole(access: Access, input: z.infer<typeof createRoleSchema>, requestId: string): Promise<RoleView> {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const [existing] = await tenantTx(access, [
    sqlClient`select id from roles where tenant_id = ${access.tenantId} and lower(code) = lower(${input.code}) limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "ROLE_EXISTS", message: "A role with this code already exists.", details: [{ field: "code", issue: "duplicate" }] });
  }
  if (input.copyFromRoleId) await requireRole(access, input.copyFromRoleId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into roles (id, tenant_id, code, name, system_managed, status) values (${id}, ${access.tenantId}, ${input.code}, ${input.name}, false, 'active')`,
    ...(input.copyFromRoleId
      ? [sqlClient`
          insert into role_permissions (tenant_id, role_id, permission_id)
          select ${access.tenantId}, ${id}, rp.permission_id from role_permissions rp
          where rp.tenant_id = ${access.tenantId} and rp.role_id = ${input.copyFromRoleId}
          on conflict do nothing
        `]
      : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.role_create', 'role', ${id}, 'Role created',
        ${JSON.stringify({ code: input.code, name: input.name, copyFromRoleId: input.copyFromRoleId ?? null })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return requireRole(access, id);
}

const permissionKey = z.string().trim().min(1).max(80);

export const updateRolePermissionsSchema = z
  .object({
    grant: z.array(permissionKey).max(200).default([]),
    revoke: z.array(permissionKey).max(200).default([]),
  })
  .refine((value) => value.grant.length + value.revoke.length > 0, { message: "Choose at least one permission to change." })
  .refine((value) => !value.grant.some((key) => value.revoke.includes(key)), { message: "A permission cannot be granted and revoked at once." });

export async function updateRolePermissions(
  access: Access,
  roleId: string,
  input: z.infer<typeof updateRolePermissionsSchema>,
  requestId: string,
): Promise<RoleView> {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const role = await requireRole(access, roleId);
  if (role.privileged) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This role receives every permission automatically, so its actions cannot be edited." });
  }
  if (input.revoke.includes("role.manage") && access.context.roles.includes(role.code)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "You cannot remove role management from a role you hold." });
  }
  const requested = [...new Set([...input.grant, ...input.revoke])];
  const [known] = await tenantTx(access, [
    sqlClient`select permission_key from permissions where status = 'active' and permission_key = any(${requested})`,
  ]);
  const knownKeys = new Set((known as Array<{ permission_key: string }>).map((row) => row.permission_key));
  const unknown = requested.filter((key) => !knownKeys.has(key));
  if (unknown.length > 0) {
    throw new HttpError({ status: 422, code: "UNKNOWN_PERMISSION", message: `Unknown permissions: ${unknown.join(", ")}.`, details: unknown.map((key) => ({ field: "permissions", issue: key })) });
  }
  await tenantTx(access, [
    sqlClient`
      insert into role_permissions (tenant_id, role_id, permission_id)
      select ${access.tenantId}, ${role.id}, p.id from permissions p
      where p.status = 'active' and p.permission_key = any(${input.grant})
      on conflict do nothing
    `,
    sqlClient`
      delete from role_permissions
      where tenant_id = ${access.tenantId} and role_id = ${role.id}
        and permission_id in (select id from permissions where permission_key = any(${input.revoke}))
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.role_permissions', 'role', ${role.id}, 'Role actions updated',
        ${JSON.stringify({ permissionKeys: role.permissionKeys })}::jsonb,
        ${JSON.stringify({ grant: input.grant, revoke: input.revoke })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return requireRole(access, role.id);
}

export const roleUiAccessSchema = z.object({
  pages: z.array(z.string().refine((key) => UI_KEY_SET.page.has(key), { message: "Unknown page." })).max(UI_PAGE_KEYS.length),
  cards: z.array(z.string().refine((key) => UI_KEY_SET.card.has(key), { message: "Unknown card." })).max(UI_CARD_KEYS.length),
});

async function writeUiConfig(access: Access, role: RoleView, record: RoleUiAccessRecord | null, requestId: string): Promise<void> {
  const update = record
    ? sqlClient`
        update tenant_settings
        set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{roleUiAccess}',
              coalesce(settings->'roleUiAccess', '{}'::jsonb) || jsonb_build_object(${role.id}::text, ${JSON.stringify(record)}::jsonb), true),
            updated_at = now()
        where tenant_id = ${access.tenantId}
        returning tenant_id
      `
    : sqlClient`
        update tenant_settings
        set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{roleUiAccess}',
              coalesce(settings->'roleUiAccess', '{}'::jsonb) - ${role.id}::text, true),
            updated_at = now()
        where tenant_id = ${access.tenantId}
        returning tenant_id
      `;
  const [updated] = await tenantTx(access, [
    update,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${record ? "access.role_ui_access" : "access.role_ui_reset"}, 'role', ${role.id},
        ${record ? "Role page and card access updated" : "Role page and card access reset to permission defaults"},
        ${JSON.stringify(role.uiAccess)}::jsonb, ${JSON.stringify(record)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  if ((updated as unknown[]).length === 0) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Tenant settings are not initialized." });
  }
}

export async function setRoleUiAccess(
  access: Access,
  roleId: string,
  input: z.infer<typeof roleUiAccessSchema>,
  requestId: string,
): Promise<RoleView> {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const role = await requireRole(access, roleId);
  const record: RoleUiAccessRecord = {
    pages: [...new Set(input.pages)],
    cards: [...new Set(input.cards)],
    updatedAt: new Date().toISOString(),
  };
  await writeUiConfig(access, role, record, requestId);
  return requireRole(access, role.id);
}

export async function resetRoleUiAccess(access: Access, roleId: string, requestId: string): Promise<RoleView> {
  enforce(access.context, "role.manage", { tenantId: access.tenantId });
  const role = await requireRole(access, roleId);
  if (!role.uiAccess) return role;
  await writeUiConfig(access, role, null, requestId);
  return requireRole(access, role.id);
}

export type RolePreview = { role: RoleView; permissions: string[]; access: EffectiveUiAccess };

/** What a member holding only this role would see and be allowed to do. */
export async function previewRole(access: Access, roleId: string): Promise<RolePreview> {
  enforce(access.context, "role.read", { tenantId: access.tenantId });
  const role = await requireRole(access, roleId);
  const permissions = role.privileged
    ? (await listPermissionCatalog(access)).map((entry) => entry.key)
    : role.permissionKeys;
  return {
    role,
    permissions,
    access: deriveUiAccess({ superAdmin: role.superAdmin, permissions, roleConfigs: [asRoleUiConfig(role.uiAccess)] }),
  };
}
