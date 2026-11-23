import { MODULE_CATALOG } from "./catalog";
import type { ConfigField, ConfigValues, EntitlementScope, ModuleTier, ResolvedEntitlements } from "./types";

/** One node of the module → sub-module → feature tree, as shown in the settings screens. */
export type EntitlementNode = {
  key: string;
  scope: EntitlementScope;
  name: string;
  description: string;
  tier: ModuleTier;
  enabled: boolean;
  active: boolean;
  blockedBy: string | null;
  locked: boolean;
  requires: readonly string[];
  fields: readonly ConfigField[];
  config: ConfigValues;
  children: EntitlementNode[];
};

export function buildEntitlementTree(resolved: ResolvedEntitlements): EntitlementNode[] {
  const node = (
    key: string,
    scope: EntitlementScope,
    def: { name: string; description: string; requires?: readonly string[]; config?: readonly ConfigField[] },
    tier: ModuleTier,
    children: EntitlementNode[],
  ): EntitlementNode => {
    const state = resolved.entries[key]!;
    return {
      key,
      scope,
      name: def.name,
      description: def.description,
      tier,
      enabled: state.enabled,
      active: state.active,
      blockedBy: state.blockedBy,
      locked: state.locked,
      requires: def.requires ?? [],
      fields: def.config ?? [],
      config: state.config,
      children,
    };
  };
  return MODULE_CATALOG.map((mod) =>
    node(
      mod.key,
      "module",
      mod,
      mod.tier,
      mod.submodules.map((sub) =>
        node(
          `${mod.key}.${sub.key}`,
          "submodule",
          sub,
          mod.tier,
          (sub.features ?? []).map((feature) => node(`${mod.key}.${sub.key}.${feature.key}`, "feature", feature, mod.tier, [])),
        ),
      ),
    ),
  );
}

/** Display name for a qualified key, "Module › Sub-module › Feature". */
export function entitlementLabel(key: string): string {
  const [moduleKey, subKey, featureKey] = key.split(".");
  const mod = MODULE_CATALOG.find((candidate) => candidate.key === moduleKey);
  if (!mod) return key;
  if (!subKey) return mod.name;
  const sub = mod.submodules.find((candidate) => candidate.key === subKey);
  if (!sub) return key;
  if (!featureKey) return `${mod.name} › ${sub.name}`;
  const feature = sub.features?.find((candidate) => candidate.key === featureKey);
  return feature ? `${mod.name} › ${sub.name} › ${feature.name}` : key;
}
