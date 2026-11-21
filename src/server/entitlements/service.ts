import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { MODULE_CATALOG } from "@/lib/entitlements/catalog";
import { configWriteSchema, describeConfigErrors } from "@/lib/entitlements/config";
import {
  catalogEntry,
  resolveEntitlements,
  type CatalogEntry,
} from "@/lib/entitlements/resolve";
import type { ConfigValues, EntitlementState, ResolvedEntitlements } from "@/lib/entitlements/types";
import { HttpError } from "@/server/platform/http";
import type { Access } from "@/server/platform/access";

type StoredRow = { feature_key: string; enabled: boolean; config: unknown };

function toStates(rows: readonly StoredRow[]): EntitlementState[] {
  return rows.map((row) => ({
    key: row.feature_key,
    enabled: row.enabled,
    config: (row.config && typeof row.config === "object" ? row.config : {}) as ConfigValues,
  }));
}

const selectRows = (tenantId: string) =>
  sqlClient`select feature_key, enabled, config from tenant_features where tenant_id = ${tenantId}`;

/**
 * Loads a tenant's stored choices inside a transaction that carries the caller's tenant context,
 * so row-level security applies. `prelude` is the statement list that sets that context.
 */
async function loadRows(prelude: unknown[], tenantId: string): Promise<StoredRow[]> {
  const results = (await sqlClient.transaction([...prelude, selectRows(tenantId)])) as unknown[];
  return results[results.length - 1] as StoredRow[];
}

function tenantPreludeFor(access: Access) {
  return [
    sqlClient`select set_config('app.user_id', ${access.context.actorUserId}, true)`,
    sqlClient`select set_config('app.tenant_id', ${access.tenantId}, true)`,
    sqlClient`select set_config('app.membership_id', ${access.context.membershipId}, true)`,
  ];
}

function platformPrelude(actorUserId: string) {
  return [
    sqlClient`select set_config('app.user_id', ${actorUserId}, true)`,
    sqlClient`select set_config('app.platform_admin', 'true', true)`,
  ];
}

/** Effective entitlements for the caller's active tenant (memoised on the Access object). */
export async function entitlementsFor(access: Access): Promise<ResolvedEntitlements> {
  if (access.entitlements) return access.entitlements;
  const rows = await loadRows(tenantPreludeFor(access), access.tenantId);
  access.entitlements = resolveEntitlements(toStates(rows));
  return access.entitlements;
}

/** Effective entitlements for any tenant, read by a platform administrator. */
export async function entitlementsForTenantAsPlatform(actorUserId: string, tenantId: string): Promise<ResolvedEntitlements> {
  const rows = await loadRows(platformPrelude(actorUserId), tenantId);
  return resolveEntitlements(toStates(rows));
}

function label(key: string) {
  const entry = catalogEntry(key);
  if (!entry) return key;
  const parent = entry.parent ? catalogEntry(entry.parent) : undefined;
  return parent ? `${parent.name} › ${entry.name}` : entry.name;
}

/** Fails with 403 FEATURE_DISABLED unless `key` is active for the caller's tenant. */
export async function requireEntitlement(access: Access, key: string): Promise<void> {
  const resolved = await entitlementsFor(access);
  const entry = resolved.entries[key];
  if (!entry) throw new Error(`Unknown entitlement key: ${key}`);
  if (entry.active) return;
  const reason = entry.blockedBy && entry.blockedBy !== key ? ` (requires ${label(entry.blockedBy)})` : "";
  throw new HttpError({
    status: 403,
    code: "FEATURE_DISABLED",
    message: `${label(key)} is not enabled for this organisation${reason}.`,
  });
}

export async function isEntitled(access: Access, key: string): Promise<boolean> {
  return (await entitlementsFor(access)).entries[key]?.active ?? false;
}

export async function entitlementConfig(access: Access, key: string): Promise<ConfigValues> {
  const entry = (await entitlementsFor(access)).entries[key];
  if (!entry) throw new Error(`Unknown entitlement key: ${key}`);
  return entry.config;
}

// ── Changes ───────────────────────────────────────────────────────────────────────────────────

export const entitlementChangeSchema = z.object({
  key: z.string().trim().min(1).max(120),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const entitlementChangesSchema = z.object({
  changes: z.array(entitlementChangeSchema).min(1).max(200),
  reason: z.string().trim().max(500).optional(),
});

export type EntitlementChange = z.infer<typeof entitlementChangeSchema>;

/**
 * platform: the platform operator; may change anything.
 * tenant:   an organisation administrator; may switch features and edit settings inside
 *           sub-modules the platform has enabled, but cannot enable or disable modules or
 *           sub-modules (that is the organisation's plan).
 */
export type ChangeAuthority = "platform" | "tenant";

type PlannedChange = {
  entry: CatalogEntry;
  enabled: boolean;
  config: ConfigValues;
  before: { enabled: boolean; config: ConfigValues; customised: boolean };
};

function reject(details: Array<{ field: string; issue: string }>, message = "Some changes could not be applied.") {
  return new HttpError({ status: 422, code: "POLICY_VIOLATION", message, details });
}

/**
 * Validates a batch of changes against the catalog, the caller's authority and the dependency
 * rules, evaluated on the state the tenant would end up in. Switching something on requires what it
 * depends on to be on. Switching something off is always allowed: whatever depends on it stays
 * enabled but becomes inactive (the tree shows it as "blocked by") and comes back with it. Pure apart from its inputs, so the
 * same rules apply to the platform console, the organisation settings page and tests.
 */
export function planEntitlementChanges(
  current: ResolvedEntitlements,
  storedConfig: ReadonlyMap<string, ConfigValues>,
  changes: readonly EntitlementChange[],
  authority: ChangeAuthority,
): PlannedChange[] {
  const problems: Array<{ field: string; issue: string }> = [];
  const planned = new Map<string, PlannedChange>();

  for (const change of changes) {
    const entry = catalogEntry(change.key);
    if (!entry) {
      problems.push({ field: change.key, issue: "Unknown module, sub-module or feature." });
      continue;
    }
    const existing = current.entries[entry.key]!;
    const previous = planned.get(entry.key);
    let enabled = previous?.enabled ?? existing.enabled;
    let config = previous?.config ?? { ...(storedConfig.get(entry.key) ?? {}) };

    if (change.enabled !== undefined && change.enabled !== existing.enabled) {
      if (entry.locked && !change.enabled) {
        problems.push({ field: entry.key, issue: `${label(entry.key)} is always on.` });
        continue;
      }
      if (authority === "tenant" && entry.scope !== "feature") {
        problems.push({ field: entry.key, issue: "Modules and sub-modules are part of your plan. Ask the platform administrator to change them." });
        continue;
      }
      enabled = change.enabled;
    }

    if (change.config !== undefined) {
      if (entry.config.length === 0) {
        problems.push({ field: entry.key, issue: `${label(entry.key)} has no settings.` });
        continue;
      }
      const parsed = configWriteSchema(entry.config).safeParse(change.config);
      if (!parsed.success) {
        problems.push(...describeConfigErrors(entry.config, parsed.error).map((problem) => ({ field: `${entry.key}.${problem.field}`, issue: problem.issue })));
        continue;
      }
      config = { ...config, ...(Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)) as ConfigValues) };
    }

    planned.set(entry.key, {
      entry,
      enabled,
      config,
      before: { enabled: existing.enabled, config: existing.config, customised: existing.customised },
    });
  }
  if (problems.length) throw reject(problems);

  // Evaluate the resulting state once, so a batch can switch on a module and what depends on it together.
  const nextStates: EntitlementState[] = Object.values(current.entries)
    .filter((entry) => entry.customised || planned.has(entry.key))
    .map((entry) => {
      const plan = planned.get(entry.key);
      return { key: entry.key, enabled: plan?.enabled ?? entry.enabled, config: plan?.config ?? storedConfig.get(entry.key) ?? {} };
    });
  const next = resolveEntitlements(nextStates);

  for (const plan of planned.values()) {
    const key = plan.entry.key;
    // Settings can only be changed where the organisation actually has the sub-module.
    if (authority === "tenant") {
      const submoduleKey = plan.entry.scope === "feature" ? plan.entry.parent! : key;
      if (!current.entries[submoduleKey]?.active) {
        problems.push({ field: key, issue: `${label(submoduleKey)} is not part of your plan.` });
        continue;
      }
    }
    if (plan.enabled && !plan.before.enabled) {
      const missing = plan.entry.requires.filter((requirement) => !next.entries[requirement]?.enabled);
      if (missing.length) problems.push({ field: key, issue: `Turn on ${missing.map(label).join(", ")} first.` });
    }
  }
  if (problems.length) throw reject(problems);
  return [...planned.values()];
}

/**
 * Applies changes for one tenant in a single transaction and writes one audit event per changed
 * key. Rows are upserted; a row whose value equals the catalog default is still kept, so that a
 * later change of default in code does not silently change an organisation's plan.
 */
export async function applyEntitlementChanges(args: {
  tenantId: string;
  actorUserId: string;
  membershipId?: string | null;
  authority: ChangeAuthority;
  changes: readonly EntitlementChange[];
  reason?: string;
  requestId?: string | null;
}): Promise<ResolvedEntitlements> {
  const prelude =
    args.authority === "platform"
      ? platformPrelude(args.actorUserId)
      : [
          sqlClient`select set_config('app.user_id', ${args.actorUserId}, true)`,
          sqlClient`select set_config('app.tenant_id', ${args.tenantId}, true)`,
          sqlClient`select set_config('app.membership_id', ${args.membershipId ?? ""}, true)`,
        ];
  const rows = await loadRows(prelude, args.tenantId);
  const current = resolveEntitlements(toStates(rows));
  const storedConfig = new Map(toStates(rows).map((state) => [state.key, state.config]));
  const plan = planEntitlementChanges(current, storedConfig, args.changes, args.authority);

  const writes = plan.flatMap((change) => {
    const changed =
      change.enabled !== change.before.enabled ||
      JSON.stringify(change.config) !== JSON.stringify(storedConfig.get(change.entry.key) ?? {}) ||
      !change.before.customised;
    if (!changed) return [];
    return [
      sqlClient`
        insert into tenant_features (tenant_id, feature_key, enabled, config, updated_by, updated_at)
        values (${args.tenantId}, ${change.entry.key}, ${change.enabled}, ${JSON.stringify(change.config)}::jsonb, ${args.actorUserId}, now())
        on conflict (tenant_id, feature_key) do update
          set enabled = excluded.enabled, config = excluded.config, updated_by = excluded.updated_by, updated_at = now()
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, before, after, request_id)
        values (
          ${args.tenantId}, ${args.actorUserId}, ${args.membershipId ?? null},
          ${args.authority === "platform" ? "platform.entitlement_update" : "tenant.entitlement_update"},
          'tenant_entitlement', ${change.entry.key}, ${args.reason ?? null},
          ${JSON.stringify(change.before)}::jsonb,
          ${JSON.stringify({ enabled: change.enabled, config: change.config })}::jsonb,
          ${args.requestId ?? null}::uuid
        )
      `,
    ];
  });
  if (writes.length) await sqlClient.transaction([...prelude, ...writes]);
  return resolveEntitlements(
    toStates(await loadRows(prelude, args.tenantId)),
  );
}

/** Module rows written when a platform administrator creates an organisation. */
export function initialModuleStatements(tenantId: string, actorUserId: string, moduleKeys: readonly string[]) {
  const chosen = new Set(moduleKeys);
  return MODULE_CATALOG.map((mod) => {
    const enabled = mod.tier === "core" || chosen.has(mod.key);
    return sqlClient`
      insert into tenant_features (tenant_id, feature_key, enabled, config, updated_by)
      values (${tenantId}, ${mod.key}, ${enabled}, '{}'::jsonb, ${actorUserId})
      on conflict (tenant_id, feature_key) do nothing
    `;
  });
}

/** Validates the module list chosen when creating an organisation; dependencies must be included. */
export function validateInitialModules(moduleKeys: readonly string[]): string[] {
  const known = new Set(MODULE_CATALOG.map((mod) => mod.key));
  const unknown = moduleKeys.filter((key) => !known.has(key));
  if (unknown.length) throw reject(unknown.map((key) => ({ field: "modules", issue: `Unknown module: ${key}.` })));
  const chosen = new Set([...moduleKeys, ...MODULE_CATALOG.filter((mod) => mod.tier === "core").map((mod) => mod.key)]);
  const problems = MODULE_CATALOG.filter((mod) => chosen.has(mod.key)).flatMap((mod) =>
    (mod.requires ?? [])
      .filter((requirement) => !chosen.has(requirement.split(".")[0]!))
      .map((requirement) => ({ field: "modules", issue: `${mod.name} needs ${label(requirement)}.` })),
  );
  if (problems.length) throw reject(problems);
  return [...chosen];
}
