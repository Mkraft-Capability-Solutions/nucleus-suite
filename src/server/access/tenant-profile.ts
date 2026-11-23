import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { isValidTimezone } from "@/server/admin/service";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Organisation profile for the settings screen: tenants (name, legal_name) and
 * tenant_settings (locale, timezone, currency, settings.workWeek, settings.dataResidency).
 */

export const WORK_WEEKS = ["mon_fri", "mon_sat", "mon_thu_half_fri"] as const;
export type WorkWeek = (typeof WORK_WEEKS)[number];

export type TenantProfile = {
  name: string;
  legalName: string | null;
  slug: string;
  locale: string;
  timezone: string;
  currency: string;
  workWeek: WorkWeek | null;
  dataResidency: string | null;
  canManage: boolean;
};

type ProfileRow = {
  name: string; legal_name: string | null; slug: string; locale: string | null; timezone: string | null;
  currency: string | null; work_week: string | null; data_residency: string | null;
};

async function readProfile(access: Access): Promise<ProfileRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select t.name, t.legal_name, t.slug, s.locale, s.timezone, s.currency,
        s.settings->>'workWeek' as work_week, s.settings->>'dataResidency' as data_residency
      from tenants t left join tenant_settings s on s.tenant_id = t.id
      where t.id = ${access.tenantId}
      limit 1
    `,
  ]);
  const row = (rows as ProfileRow[])[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The organisation was not found." });
  if (!row.locale || !row.timezone || !row.currency) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Tenant settings are not initialized." });
  }
  return row;
}

function canManage(access: Access): boolean {
  try {
    enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
    return true;
  } catch {
    return false;
  }
}

function toProfile(row: ProfileRow, manage: boolean): TenantProfile {
  return {
    name: row.name,
    legalName: row.legal_name,
    slug: row.slug,
    locale: row.locale ?? "",
    timezone: row.timezone ?? "",
    currency: row.currency ?? "",
    workWeek: (WORK_WEEKS as readonly string[]).includes(row.work_week ?? "") ? (row.work_week as WorkWeek) : null,
    dataResidency: row.data_residency,
    canManage: manage,
  };
}

export async function getTenantProfile(access: Access): Promise<TenantProfile> {
  enforce(access.context, "tenant.read", { tenantId: access.tenantId });
  return toProfile(await readProfile(access), canManage(access));
}

export const patchTenantProfileSchema = z
  .object({
    legalName: z.string().trim().min(2, "Use at least 2 characters.").max(200, "Use at most 200 characters.").optional(),
    locale: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, "Use a locale such as en-IN.").optional(),
    timezone: z.string().refine((value) => isValidTimezone(value), "Choose a valid time zone.").optional(),
    currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code.").optional(),
    workWeek: z.enum(WORK_WEEKS).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), { message: "Change at least one setting." });

export async function patchTenantProfile(
  access: Access,
  input: z.infer<typeof patchTenantProfileSchema>,
  requestId: string,
): Promise<TenantProfile> {
  enforce(access.context, "tenant.manage", { tenantId: access.tenantId });
  const before = await readProfile(access);
  const statements = [];
  if (input.legalName !== undefined) {
    statements.push(sqlClient`update tenants set legal_name = ${input.legalName}, updated_at = now() where id = ${access.tenantId}`);
  }
  if (input.locale !== undefined) statements.push(sqlClient`update tenant_settings set locale = ${input.locale}, updated_at = now() where tenant_id = ${access.tenantId}`);
  if (input.timezone !== undefined) statements.push(sqlClient`update tenant_settings set timezone = ${input.timezone}, updated_at = now() where tenant_id = ${access.tenantId}`);
  if (input.currency !== undefined) statements.push(sqlClient`update tenant_settings set currency = ${input.currency}, updated_at = now() where tenant_id = ${access.tenantId}`);
  if (input.workWeek !== undefined) {
    statements.push(sqlClient`
      update tenant_settings set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{workWeek}', to_jsonb(${input.workWeek}::text), true), updated_at = now()
      where tenant_id = ${access.tenantId}
    `);
  }
  statements.push(sqlClient`
    insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
    values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
      'admin.settings_profile', 'tenant', ${access.tenantId}, 'Organisation settings updated',
      ${JSON.stringify({ legalName: before.legal_name, locale: before.locale, timezone: before.timezone, currency: before.currency, workWeek: before.work_week })}::jsonb,
      ${JSON.stringify(input)}::jsonb, ${uuidOrNull(requestId)}::uuid)
  `);
  await tenantTx(access, statements);
  return toProfile(await readProfile(access), true);
}
