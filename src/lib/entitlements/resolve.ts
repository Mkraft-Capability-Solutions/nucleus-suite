import { MODULE_CATALOG } from "./catalog";
import { readConfig } from "./config";
import type {
  ConfigField,
  EntitlementScope,
  EntitlementState,
  ModuleDefinition,
  ModuleTier,
  ResolvedEntitlement,
  ResolvedEntitlements,
} from "./types";

/** One catalog entry, flattened, with its qualified key. */
export type CatalogEntry = {
  key: string;
  scope: EntitlementScope;
  name: string;
  description: string;
  parent: string | null;
  moduleKey: string;
  tier: ModuleTier;
  defaultEnabled: boolean;
  locked: boolean;
  requires: readonly string[];
  config: readonly ConfigField[];
  api: readonly string[];
  nav: readonly string[];
};

export function flattenCatalog(catalog: readonly ModuleDefinition[] = MODULE_CATALOG): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const mod of catalog) {
    const core = mod.tier === "core";
    entries.push({
      key: mod.key,
      scope: "module",
      name: mod.name,
      description: mod.description,
      parent: null,
      moduleKey: mod.key,
      tier: mod.tier,
      defaultEnabled: mod.tier !== "addon",
      locked: core,
      requires: mod.requires ?? [],
      config: [],
      api: mod.api ?? [],
      nav: mod.nav ?? [],
    });
    for (const sub of mod.submodules) {
      const subKey = `${mod.key}.${sub.key}`;
      entries.push({
        key: subKey,
        scope: "submodule",
        name: sub.name,
        description: sub.description,
        parent: mod.key,
        moduleKey: mod.key,
        tier: mod.tier,
        defaultEnabled: sub.locked ? true : sub.defaultEnabled,
        locked: Boolean(sub.locked),
        requires: sub.requires ?? [],
        config: sub.config ?? [],
        api: sub.api ?? [],
        nav: sub.nav ?? [],
      });
      for (const feature of sub.features ?? []) {
        entries.push({
          key: `${subKey}.${feature.key}`,
          scope: "feature",
          name: feature.name,
          description: feature.description,
          parent: subKey,
          moduleKey: mod.key,
          tier: mod.tier,
          defaultEnabled: feature.defaultEnabled,
          locked: false,
          requires: feature.requires ?? [],
          config: feature.config ?? [],
          api: feature.api ?? [],
          nav: feature.nav ?? [],
        });
      }
    }
  }
  return entries;
}

const DEFAULT_INDEX = new Map(flattenCatalog().map((entry) => [entry.key, entry]));

export function catalogEntry(key: string): CatalogEntry | undefined {
  return DEFAULT_INDEX.get(key);
}

export function catalogKeys(): string[] {
  return [...DEFAULT_INDEX.keys()];
}

/**
 * Effective entitlements for one tenant.
 *
 *   enabled = locked ? true : (stored value ?? catalog default)
 *   active  = enabled ∧ parent active ∧ every `requires` key active
 *
 * Stored rows for keys that are no longer in the catalog are ignored.
 */
export function resolveEntitlements(
  states: readonly EntitlementState[],
  catalog: readonly ModuleDefinition[] = MODULE_CATALOG,
): ResolvedEntitlements {
  const index = catalog === MODULE_CATALOG ? DEFAULT_INDEX : new Map(flattenCatalog(catalog).map((entry) => [entry.key, entry]));
  const stored = new Map(states.map((state) => [state.key, state]));

  const enabled = new Map<string, boolean>();
  for (const entry of index.values()) {
    const state = stored.get(entry.key);
    enabled.set(entry.key, entry.locked ? true : (state?.enabled ?? entry.defaultEnabled));
  }

  const blocked = new Map<string, string | null>();
  const visiting = new Set<string>();
  // Returns the key that stops `key` from being active (itself when switched off), or null if active.
  const blocker = (key: string): string | null => {
    if (blocked.has(key)) return blocked.get(key)!;
    const entry = index.get(key);
    if (!entry) return key;
    if (visiting.has(key)) return key; // dependency cycle: treat as inactive (catalog test forbids cycles)
    visiting.add(key);
    let result: string | null = enabled.get(key) ? null : key;
    if (result === null && entry.parent) result = blocker(entry.parent) === null ? null : entry.parent;
    if (result === null) {
      for (const requirement of entry.requires) {
        if (blocker(requirement) !== null) {
          result = requirement;
          break;
        }
      }
    }
    visiting.delete(key);
    blocked.set(key, result);
    return result;
  };

  const entries: Record<string, ResolvedEntitlement> = {};
  for (const entry of index.values()) {
    const block = blocker(entry.key);
    const state = stored.get(entry.key);
    entries[entry.key] = {
      key: entry.key,
      scope: entry.scope,
      name: entry.name,
      enabled: enabled.get(entry.key)!,
      active: block === null,
      blockedBy: block === null || block === entry.key ? null : block,
      locked: entry.locked,
      config: readConfig(entry.config, state?.config),
      customised: Boolean(state),
    };
  }
  return { entries };
}

export function isActive(resolved: ResolvedEntitlements, key: string): boolean {
  return resolved.entries[key]?.active ?? false;
}

export function configOf(resolved: ResolvedEntitlements, key: string) {
  const entry = resolved.entries[key];
  if (!entry) throw new Error(`Unknown entitlement key: ${key}`);
  return entry.config;
}

/** Keys that list `key` (or one of its descendants) in `requires`, and are currently enabled. */
export function enabledDependants(resolved: ResolvedEntitlements, key: string): string[] {
  const result: string[] = [];
  for (const entry of DEFAULT_INDEX.values()) {
    if (!resolved.entries[entry.key]?.enabled) continue;
    if (entry.key === key || entry.key.startsWith(`${key}.`)) continue;
    if (entry.requires.some((requirement) => requirement === key || requirement.startsWith(`${key}.`))) {
      result.push(entry.key);
    }
  }
  return result;
}

/** Compact form sent to the browser: the active keys and the config of active entries that have any. */
export type EntitlementSnapshot = {
  active: string[];
  config: Record<string, Record<string, unknown>>;
};

export function toSnapshot(resolved: ResolvedEntitlements): EntitlementSnapshot {
  const active: string[] = [];
  const config: EntitlementSnapshot["config"] = {};
  for (const entry of Object.values(resolved.entries)) {
    if (!entry.active) continue;
    active.push(entry.key);
    if (Object.keys(entry.config).length) config[entry.key] = entry.config;
  }
  return { active: active.sort(), config };
}
