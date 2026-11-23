import { ALWAYS_ON_API, MODULE_CATALOG } from "./catalog";
import { flattenCatalog } from "./resolve";
import type { EntitlementSnapshot } from "./resolve";

type ApiRule = { prefix: string; key: string | null };

/** Longest prefix first, so a feature's route wins over its sub-module's broader prefix. */
const API_RULES: ApiRule[] = [
  ...flattenCatalog().flatMap((entry) => entry.api.map((prefix) => ({ prefix, key: entry.key }))),
  ...ALWAYS_ON_API.map((prefix) => ({ prefix, key: null })),
].sort((a, b) => b.prefix.length - a.prefix.length);

/** `/v1/operations/<resource>` is a generic alias for `/v1/<resource>`, except these own routes. */
const OPERATIONS_OWN_ROUTES = new Set(["profile", "photos", "ctc-exceptions"]);

export function normaliseApiPath(pathname: string): string {
  let path = pathname.replace(/\/+$/, "");
  if (path.startsWith("/api/")) path = path.slice(4);
  const operations = /^\/v1\/operations\/([^/]+)(\/.*)?$/.exec(path);
  if (operations && !OPERATIONS_OWN_ROUTES.has(operations[1]!)) path = `/v1/${operations[1]}${operations[2] ?? ""}`;
  return path || "/";
}

function matches(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export type ApiEntitlement =
  | { kind: "entitlement"; key: string; prefix: string }
  | { kind: "always-on"; prefix: string }
  | { kind: "unclassified" };

/** Which entitlement guards an API path (`/api/v1/leave-requests/…`). */
export function entitlementForApiPath(pathname: string): ApiEntitlement {
  const path = normaliseApiPath(pathname);
  for (const rule of API_RULES) {
    if (!matches(path, rule.prefix)) continue;
    // The bare "/v1" rule only covers the API index itself, never an unclassified sub-path.
    if (rule.prefix === "/v1" && path !== "/v1") continue;
    return rule.key ? { kind: "entitlement", key: rule.key, prefix: rule.prefix } : { kind: "always-on", prefix: rule.prefix };
  }
  return { kind: "unclassified" };
}

const NAV_INDEX = new Map<string, string>();
for (const entry of flattenCatalog()) {
  for (const id of entry.nav) NAV_INDEX.set(id, entry.key);
}

const TAB_INDEX = new Map<string, string>();
for (const mod of MODULE_CATALOG) {
  for (const tab of mod.tabs) TAB_INDEX.set(tab, mod.key);
}

/** Entitlement key behind a navigation item id (navigation.catalog.json), if any. */
export function entitlementForNavItem(id: string | null | undefined): string | null {
  if (!id) return null;
  return NAV_INDEX.get(id) ?? NAV_INDEX.get(id.toLowerCase()) ?? null;
}

/** Module key behind a workspace view (AppWorkspace `activeTab`), if any. */
export function entitlementForTab(tab: string | null | undefined): string | null {
  if (!tab) return null;
  return TAB_INDEX.get(tab) ?? entitlementForNavItem(tab);
}

/** Browser-side check against the snapshot from /api/v1/tenant/entitlements. Unknown ids are visible. */
export function snapshotAllows(snapshot: EntitlementSnapshot | null | undefined, key: string | null): boolean {
  if (!key || !snapshot) return true;
  return snapshot.active.includes(key);
}
