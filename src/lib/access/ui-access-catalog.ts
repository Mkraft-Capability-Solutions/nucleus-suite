/**
 * UI access catalog shared by the access-control service (validation, preview)
 * and the admin screens (rendering). Client-safe: no server imports.
 *
 * - Pages are the workspace modules a role may open (keys match the workspace tabs).
 * - Cards are the dashboard consoles S1 - S10 from the cockpit catalog.
 * - Actions are the permission keys in the `permissions` table; they are loaded
 *   from the API, because the server enforces them on every request.
 *
 * Each page and card names the permissions its APIs enforce, so a preview can
 * flag a page that is visible but whose data the role cannot read.
 */

import { cockpitCatalog } from "@/lib/cockpit-catalog";

export type PageCategory = "core_hr" | "workforce" | "pay" | "talent" | "experience" | "platform";

export type UiPageDefinition = {
  key: string;
  category: PageCategory;
  /** Permissions the page's APIs enforce. All are needed to read its data. */
  requiredPermissions: readonly string[];
};

export type UiCardDefinition = {
  /** Console code S1 - S10. */
  key: string;
  /** Cockpit module id, also the route segment. */
  cockpitId: string;
  /** Any one of these permissions admits the principal (cockpit rule). */
  requiredPermissions: readonly string[];
};

export const UI_PAGES: readonly UiPageDefinition[] = [
  { key: "people_core", category: "core_hr", requiredPermissions: ["employee.read"] },
  { key: "team", category: "core_hr", requiredPermissions: ["employee.read"] },
  { key: "onboarding", category: "core_hr", requiredPermissions: ["employee.read"] },
  { key: "contract_workforce", category: "core_hr", requiredPermissions: ["employee.read"] },
  { key: "attendance", category: "workforce", requiredPermissions: ["attendance.read"] },
  { key: "leaves", category: "workforce", requiredPermissions: ["leave.read"] },
  { key: "projects", category: "workforce", requiredPermissions: ["workforce.projects.read"] },
  { key: "helpdesk", category: "workforce", requiredPermissions: ["hr.helpdesk.read"] },
  { key: "payroll", category: "pay", requiredPermissions: ["payroll.read"] },
  { key: "compensation", category: "pay", requiredPermissions: ["payroll.read"] },
  { key: "compliance", category: "pay", requiredPermissions: ["compliance.filing.read"] },
  { key: "recruitment", category: "talent", requiredPermissions: ["employee.read"] },
  { key: "performance", category: "talent", requiredPermissions: ["employee.read"] },
  { key: "learning", category: "talent", requiredPermissions: ["employee.read"] },
  { key: "analytics", category: "talent", requiredPermissions: ["employee.read"] },
  { key: "experience", category: "experience", requiredPermissions: ["employee.read"] },
  { key: "integrations", category: "platform", requiredPermissions: ["tenant.manage"] },
  { key: "settings", category: "platform", requiredPermissions: [] },
];

export const UI_CARDS: readonly UiCardDefinition[] = cockpitCatalog.map((cockpit) => ({
  key: cockpit.code,
  cockpitId: cockpit.id,
  requiredPermissions: cockpit.requiredPermissions,
}));

export const UI_PAGE_KEYS: readonly string[] = UI_PAGES.map((page) => page.key);
export const UI_CARD_KEYS: readonly string[] = UI_CARDS.map((card) => card.key);

export type UiResourceType = "page" | "card";
export type OverrideEffect = "allow" | "deny";

export type RoleUiConfig = { pages: readonly string[]; cards: readonly string[] } | null;
export type UiOverride = { type: UiResourceType; key: string; effect: OverrideEffect };

export type AccessSource = "super_admin" | "role" | "role_default" | "override_allow" | "override_deny" | "none";

export type EffectiveEntry = {
  key: string;
  visible: boolean;
  source: AccessSource;
  /** Required permissions the principal lacks: the item shows, but its data is refused. */
  missingPermissions: string[];
};

export type EffectiveUiAccess = { pages: EffectiveEntry[]; cards: EffectiveEntry[] };

function normalise(code: string): string {
  return code.toLowerCase().replace(/[-_\s]/g, "");
}

/** Matches the server's universal bypass in identity/authorization. */
export function isSuperAdminRoleCode(code: string): boolean {
  return normalise(code) === "superadmin";
}

/** Roles that receive every active permission at sign-in (identity/tenant-context rule). */
export function isPrivilegedRoleCode(code: string): boolean {
  return ["superadmin", "admin", "owner", "hrmanager", "payrolladmin"].includes(normalise(code));
}

function hasAll(permissions: ReadonlySet<string>, required: readonly string[]): boolean {
  return required.every((permission) => permissions.has(permission));
}

function hasAny(permissions: ReadonlySet<string>, required: readonly string[]): boolean {
  return required.length === 0 || required.some((permission) => permissions.has(permission));
}

/**
 * Effective page and card visibility for a principal.
 * A role with a saved configuration shows exactly its configured items; a role
 * without one falls back to the items whose permissions it holds. Overrides for
 * one member win over the role result. Super admins see everything.
 */
export function deriveUiAccess(input: {
  superAdmin: boolean;
  permissions: readonly string[];
  roleConfigs: readonly RoleUiConfig[];
  overrides?: readonly UiOverride[];
}): EffectiveUiAccess {
  const permissions = new Set(input.permissions);
  const overrides = input.overrides ?? [];
  const resolve = (
    type: UiResourceType,
    key: string,
    required: readonly string[],
    admits: (perms: ReadonlySet<string>, req: readonly string[]) => boolean,
  ): EffectiveEntry => {
    const missingPermissions = admits(permissions, required) ? [] : required.filter((permission) => !permissions.has(permission));
    if (input.superAdmin) return { key, visible: true, source: "super_admin", missingPermissions: [] };
    const override = overrides.find((item) => item.type === type && item.key === key);
    if (override) {
      return { key, visible: override.effect === "allow", source: override.effect === "allow" ? "override_allow" : "override_deny", missingPermissions };
    }
    const configs = input.roleConfigs.length > 0 ? input.roleConfigs : [null];
    const configured = configs.some((config) => config !== null && (type === "page" ? config.pages : config.cards).includes(key));
    if (configured) return { key, visible: true, source: "role", missingPermissions };
    const byDefault = configs.some((config) => config === null) && admits(permissions, required);
    if (byDefault) return { key, visible: true, source: "role_default", missingPermissions };
    return { key, visible: false, source: "none", missingPermissions };
  };
  return {
    pages: UI_PAGES.map((page) => resolve("page", page.key, page.requiredPermissions, hasAll)),
    cards: UI_CARDS.map((card) => resolve("card", card.key, card.requiredPermissions, hasAny)),
  };
}
