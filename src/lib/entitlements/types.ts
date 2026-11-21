/**
 * Tenant entitlement model: module → sub-module → feature.
 *
 * Keys are dotted and hierarchical:
 *   module      "leave"
 *   sub-module  "leave.requests"
 *   feature     "leave.requests.early_return"
 *
 * The catalog (what exists) lives in code; each tenant's choices (what is switched on and how it
 * is configured) live in the `tenant_features` table, one row per key that differs from the
 * catalog default. See MULTI_TENANCY.md.
 */

export type ConfigOption = { value: string; label: string };

type ConfigFieldBase = { key: string; label: string; description?: string };

export type ConfigField =
  | (ConfigFieldBase & { type: "boolean"; default: boolean })
  | (ConfigFieldBase & { type: "number"; default: number; min: number; max: number; unit?: string })
  | (ConfigFieldBase & { type: "select"; default: string; options: readonly ConfigOption[] })
  | (ConfigFieldBase & { type: "multiselect"; default: readonly string[]; options: readonly ConfigOption[]; minItems?: number });

export type ConfigValues = Record<string, boolean | number | string | string[]>;

export type EntitlementScope = "module" | "submodule" | "feature";

export type FeatureDefinition = {
  /** Local key, e.g. "early_return"; qualified as "<module>.<submodule>.<feature>". */
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  /** API path prefixes (relative to /api) that only work while this feature is on. */
  api?: readonly string[];
  /** Navigation item ids (navigation.catalog.json) shown only while this feature is on. */
  nav?: readonly string[];
  /** Qualified keys that must be active for this feature to be active. */
  requires?: readonly string[];
  config?: readonly ConfigField[];
};

export type SubmoduleDefinition = {
  /** Local key, e.g. "requests"; qualified as "<module>.<submodule>". */
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  /** Cannot be switched off: the rest of the product depends on it. */
  locked?: boolean;
  api?: readonly string[];
  nav?: readonly string[];
  requires?: readonly string[];
  config?: readonly ConfigField[];
  features?: readonly FeatureDefinition[];
};

export type ModuleTier = "core" | "standard" | "addon";

export type ModuleDefinition = {
  key: string;
  name: string;
  description: string;
  /** core modules are always on; standard modules are on for new organisations by default. */
  tier: ModuleTier;
  /** Workspace view keys (AppWorkspace `activeTab`) that belong to this module. */
  tabs: readonly string[];
  /** Navigation item ids that open the module as a whole (overview entries). */
  nav?: readonly string[];
  api?: readonly string[];
  requires?: readonly string[];
  submodules: readonly SubmoduleDefinition[];
};

/** One stored row: a tenant's choice for a single key. */
export type EntitlementState = {
  key: string;
  enabled: boolean;
  config: ConfigValues;
};

export type ResolvedEntitlement = {
  key: string;
  scope: EntitlementScope;
  name: string;
  /** Switched on for this tenant (stored value, or catalog default). */
  enabled: boolean;
  /** Enabled, its parents are active and everything it requires is active. */
  active: boolean;
  /** Why an enabled entry is not active: the first inactive parent or requirement. */
  blockedBy: string | null;
  locked: boolean;
  /** Stored config merged over defaults; always complete and valid. */
  config: ConfigValues;
  /** True when a row exists for this key (the value is not just the catalog default). */
  customised: boolean;
};

export type ResolvedEntitlements = {
  entries: Record<string, ResolvedEntitlement>;
};
