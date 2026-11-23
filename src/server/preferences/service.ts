import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * A member's own workspace preferences (member_preferences, db/migrations/0033). Only the keys
 * below are accepted, each with its own shape; row-level security limits every read and write to
 * the signed-in member's rows.
 */
export const PREFERENCE_SCHEMAS = {
  /** Action ids pinned to the quick-actions menu, in order (src/modules/shell/quick-actions.ts). */
  quick_actions: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(8),
  /** The dashboard console to open by default (s1…s10), or null for the role's default. */
  default_dashboard: z.enum(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"]).nullable(),
  /** Areas on the redesigned side menu, in order (src/modules/shell/SideNav.tsx); the rest sit under More. */
  rail_items: z.array(z.enum(["dashboard", "core_hr", "talent", "payroll_finance", "workforce_ops", "analytics_ai", "platform"])).min(1).max(6)
    .refine((ids) => new Set(ids).size === ids.length, "Each area may appear once."),
  /** The company the workspace is scoped to, or every company of the group (src/server/organization/active-entity.ts). */
  active_entity: z.union([z.literal("ALL_GROUP_ENTITIES"), z.object({ companyId: z.string().uuid() }).strict()]),
} as const;

export type PreferenceKey = keyof typeof PREFERENCE_SCHEMAS;

export function isPreferenceKey(key: string): key is PreferenceKey {
  return Object.hasOwn(PREFERENCE_SCHEMAS, key);
}

export async function getPreference(access: Access, key: PreferenceKey): Promise<unknown | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select value from member_preferences
      where tenant_id = ${access.tenantId} and membership_id = ${access.context.membershipId} and preference_key = ${key} limit 1`,
  ]);
  return (rows as Array<{ value: unknown }>)[0]?.value ?? null;
}

export async function setPreference(access: Access, key: PreferenceKey, raw: unknown): Promise<unknown> {
  const parsed = PREFERENCE_SCHEMAS[key].safeParse(raw);
  if (!parsed.success) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: `The ${key.replace("_", " ")} preference is invalid.`, details: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || key, issue: issue.message })) });
  }
  const value = parsed.data;
  await tenantTx(access, [
    sqlClient`
      insert into member_preferences (tenant_id, membership_id, preference_key, value)
      values (${access.tenantId}, ${access.context.membershipId}, ${key}, ${JSON.stringify(value)}::jsonb)
      on conflict (tenant_id, membership_id, preference_key) do update set value = excluded.value, updated_at = now()`,
  ]);
  return value;
}
