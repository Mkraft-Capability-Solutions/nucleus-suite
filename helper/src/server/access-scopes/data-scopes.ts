import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { DATA_SCOPE_DIMENSIONS, type DataScopeDimension } from "@/server/identity/authorization";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  DATA_SCOPES_SETTINGS_KEY,
  DEFAULT_SCOPE_DIMENSION,
  parseDataScopeSettings,
  type StoredRoleScope,
} from "./data-scope-settings";

/**
 * Role & Data Scope Setup (F-SEC-01) — the screen behind RL-24. The parsing and defaults
 * live in `data-scope-settings.ts`; this module is the permissioned read/write side.
 */
export type RoleDataScope = StoredRoleScope & {
  roleCode: string;
  roleName: string | null;
  /** False when the role has no scope row, so it is unscoped rather than scoped to nothing. */
  configured: boolean;
};

export const roleDataScopeSchema = z.object({
  roleCode: z.string().trim().min(1).max(80),
  scopeDimension: z.enum(DATA_SCOPE_DIMENSIONS).default(DEFAULT_SCOPE_DIMENSION),
  /**
   * An empty list is allowed and means the role is scoped to nothing. It is not shorthand
   * for "everything": a scope that widens when it is left blank is the failure RL-24 exists
   * to prevent.
   */
  scopeValues: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
  /** Both default off, per the configuration register's stated default of N. */
  canViewSalaryStructure: z.boolean().default(false),
  canViewRateStructure: z.boolean().default(false),
  reason: z.string().trim().min(3).max(500),
});

/** Every active role with its configured scope, or the register's defaults where none is set. */
export async function listRoleDataScopes(access: Access): Promise<RoleDataScope[]> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [roleRows, settingRows] = await tenantTx(access, [
    sqlClient`select code, name from roles where tenant_id = ${access.tenantId} and status = 'active' order by code asc limit 200`,
    sqlClient`select settings from tenant_settings where tenant_id = ${access.tenantId} limit 1`,
  ]);
  const configured = parseDataScopeSettings((settingRows as Array<{ settings: unknown }>)[0]?.settings);
  return (roleRows as Array<{ code: string; name: string | null }>).map((role) => {
    const scope = configured[role.code];
    return {
      roleCode: role.code,
      roleName: role.name,
      scopeDimension: scope?.scopeDimension ?? DEFAULT_SCOPE_DIMENSION,
      scopeValues: scope?.scopeValues ?? [],
      canViewSalaryStructure: scope?.canViewSalaryStructure ?? false,
      canViewRateStructure: scope?.canViewRateStructure ?? false,
      configured: scope !== undefined,
    };
  });
}

/**
 * The values a tenant can scope on, read from the records the dimension compares against,
 * so the setup screen offers the tenant's own sites rather than a hard-coded vocabulary.
 */
export async function listScopeDimensionValues(access: Access): Promise<Record<DataScopeDimension, string[]>> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select distinct location, payroll_owner from employees where tenant_id = ${access.tenantId} limit 500`,
  ]);
  const employees = rows as Array<{ location: string | null; payroll_owner: string | null }>;
  const unique = (values: Array<string | null>) =>
    [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim() !== ""))].sort();
  return {
    attendance_location: unique(employees.map((row) => row.location)),
    payroll_location: unique(employees.map((row) => row.payroll_owner)),
  };
}

export async function saveRoleDataScope(
  access: Access,
  input: z.infer<typeof roleDataScopeSchema>,
  requestId: string,
): Promise<RoleDataScope> {
  enforce(access.context, "membership.manage", { tenantId: access.tenantId });
  const [roleRows] = await tenantTx(access, [
    sqlClient`select code, name from roles where tenant_id = ${access.tenantId} and code = ${input.roleCode} and status = 'active' limit 1`,
  ]);
  const role = (roleRows as Array<{ code: string; name: string | null }>)[0];
  if (!role) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown role code: ${input.roleCode}.` });
  }
  const stored: StoredRoleScope = {
    scopeDimension: input.scopeDimension,
    scopeValues: [...new Set(input.scopeValues)],
    canViewSalaryStructure: input.canViewSalaryStructure,
    canViewRateStructure: input.canViewRateStructure,
  };
  await tenantTx(access, [
    // The merge happens one level down: `settings || patch` would replace the whole
    // dataScopes object and silently drop every other role's scope. The insert branch
    // covers a tenant whose settings row was never created.
    sqlClient`
      insert into tenant_settings (tenant_id, settings)
      values (${access.tenantId}, jsonb_build_object(${DATA_SCOPES_SETTINGS_KEY}::text, ${JSON.stringify({ [input.roleCode]: stored })}::jsonb))
      on conflict (tenant_id) do update
      set settings = jsonb_set(
            coalesce(tenant_settings.settings, '{}'::jsonb),
            array[${DATA_SCOPES_SETTINGS_KEY}]::text[],
            coalesce(tenant_settings.settings->${DATA_SCOPES_SETTINGS_KEY}::text, '{}'::jsonb) || ${JSON.stringify({ [input.roleCode]: stored })}::jsonb,
            true
          ),
          updated_at = now()
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'access.data_scope', 'role_data_scope', ${input.roleCode}, ${input.reason},
        ${JSON.stringify(stored)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { roleCode: role.code, roleName: role.name, ...stored, configured: true };
}
