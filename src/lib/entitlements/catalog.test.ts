import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import navigation from "@/config/ui/navigation.catalog.json";
import resources from "@/server/workflows/resources.json";
import { commandPermissions } from "@/lib/command-permissions";
import { OPERATIONAL_MODULES } from "@/server/ops/modules-service";
import { MODULE_CATALOG } from "./catalog";
import { fieldSchema } from "./config";
import { catalogEntry, flattenCatalog } from "./resolve";
import { entitlementForApiPath, entitlementForNavItem, entitlementForTab } from "./routes";

const entries = flattenCatalog();
const keys = entries.map((entry) => entry.key);

type NavItem = { id: string; targetTab?: string };
const navItems: NavItem[] = (navigation as { domains: Array<{ groups: Array<{ items: NavItem[] }> }> }).domains.flatMap((domain) =>
  domain.groups.flatMap((group) => group.items),
);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return /^route\.(t|j)sx?$/.test(name) ? [path] : [];
  });
}

describe("module catalog integrity", () => {
  it("has unique, well-formed keys", () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){0,2}$/);
  });

  it("only requires keys that exist, outside the entry's own subtree, without cycles", () => {
    for (const entry of entries) {
      for (const requirement of entry.requires) {
        expect(catalogEntry(requirement), `${entry.key} requires unknown ${requirement}`).toBeDefined();
        expect(requirement === entry.key || requirement.startsWith(`${entry.key}.`) || entry.key.startsWith(`${requirement}.`)).toBe(false);
      }
    }
    const visit = (key: string, path: string[]): void => {
      expect(path, `dependency cycle: ${[...path, key].join(" → ")}`).not.toContain(key);
      const entry = catalogEntry(key)!;
      for (const next of [...entry.requires, ...(entry.parent ? [entry.parent] : [])]) visit(next, [...path, key]);
    };
    for (const key of keys) visit(key, []);
  });

  it("gives every config field a unique key and a valid default", () => {
    for (const entry of entries) {
      const fieldKeys = entry.config.map((field) => field.key);
      expect(new Set(fieldKeys).size).toBe(fieldKeys.length);
      for (const field of entry.config) expect(fieldSchema(field).safeParse(field.default).success, `${entry.key}.${field.key}`).toBe(true);
    }
  });

  it("keeps core modules and locked sub-modules on", () => {
    for (const entry of entries.filter((candidate) => candidate.locked)) expect(entry.defaultEnabled).toBe(true);
    for (const mod of MODULE_CATALOG.filter((candidate) => candidate.tier === "core")) expect(catalogEntry(mod.key)!.locked).toBe(true);
  });
});

describe("catalog covers the existing application", () => {
  it("maps every navigation item to a module, sub-module or feature", () => {
    const unmapped = navItems.filter((item) => !entitlementForNavItem(item.id)).map((item) => item.id);
    expect(unmapped).toEqual([]);
  });

  it("maps every workspace view a navigation item opens", () => {
    const unmapped = [...new Set(navItems.map((item) => item.targetTab).filter(Boolean))].filter((tab) => !entitlementForTab(tab));
    expect(unmapped).toEqual([]);
  });

  it("maps each navigation id to exactly one entry", () => {
    const seen = new Map<string, string>();
    for (const entry of entries) {
      for (const id of entry.nav) {
        expect(seen.get(id), `${id} is listed by ${seen.get(id)} and ${entry.key}`).toBeUndefined();
        seen.set(id, entry.key);
      }
    }
  });

  it("classifies every API route", () => {
    const root = join(process.cwd(), "src", "app", "api");
    const dynamicByValue = ["/v1/operations/[resource]", "/v1/ops/modules/[moduleId]", "/v1/commands/[action]", "/v1/dashboards/[board]"];
    const unclassified = routeFiles(root)
      .map((file) => `/${relative(root, file).split(sep).slice(0, -1).join("/")}`)
      .filter((path) => !dynamicByValue.some((prefix) => path.startsWith(prefix)))
      .map((path) => path.replace(/\[[^\]]+\]/g, "sample"))
      .filter((path) => entitlementForApiPath(`/api${path}`).kind === "unclassified");
    expect(unclassified).toEqual([]);
  });

  it("classifies every generic operations resource, operational module and command", () => {
    const paths = [
      ...Object.keys(resources).map((resource) => `/api/v1/${resource}`),
      ...Object.keys(OPERATIONAL_MODULES).map((moduleId) => `/api/v1/ops/modules/${moduleId}/records`),
      ...Object.keys(commandPermissions).map((action) => `/api/v1/commands/${action}`),
      "/api/v1/commands/retro-arrears",
    ];
    expect(paths.filter((path) => entitlementForApiPath(path).kind !== "entitlement")).toEqual([]);
  });

  it("routes a feature's API to the feature, not its sub-module", () => {
    expect(entitlementForApiPath("/api/v1/leave/early-returns")).toMatchObject({ key: "leave.requests.early_return" });
    expect(entitlementForApiPath("/api/v1/leave/engine")).toMatchObject({ key: "leave.policies" });
    expect(entitlementForApiPath("/api/v1/leave-requests/abc")).toMatchObject({ key: "leave.requests" });
    expect(entitlementForApiPath("/api/v1/operations/shift-swaps")).toMatchObject({ key: "attendance.shifts.shift_swaps" });
    expect(entitlementForApiPath("/api/v1/operations/profile")).toMatchObject({ kind: "always-on" });
    expect(entitlementForApiPath("/api/v1/tenant/entitlements")).toMatchObject({ kind: "always-on" });
    expect(entitlementForApiPath("/api/v1/career-history/CAREER-001")).toMatchObject({ key: "people.records.career_history" });
    expect(entitlementForApiPath("/api/v1/organization/companies/abc")).toMatchObject({ key: "people.legal_entities.group_structure" });
    expect(entitlementForApiPath("/api/v1/organization/departments")).toMatchObject({ key: "people.organization" });
    expect(entitlementForApiPath("/api/v1/not-a-route").kind).toBe("unclassified");
  });
});

describe("migration 0027 backfill", () => {
  it("switches on exactly the non-core modules and the existing screens that are off by default", () => {
    const sql = readFileSync(join(process.cwd(), "db", "migrations", "0027_tenant_entitlements.sql"), "utf8");
    const list = /unnest\(ARRAY\[([\s\S]*?)\]\)/.exec(sql)![1]!;
    const backfilled = [...list.matchAll(/'([a-z0-9_.]+)'/g)].map((match) => match[1]).sort();
    // New behaviour, or deliberately off for existing organisations (sample data is opt-in per organisation).
    const newBehaviour = new Set(["attendance.punches.geofence_enforcement", "attendance.punches.selfie_required", "administration.sample_data"]);
    const expected = entries
      .filter((entry) => (entry.scope === "module" ? entry.tier !== "core" : !entry.defaultEnabled && !newBehaviour.has(entry.key)))
      .map((entry) => entry.key)
      .sort();
    expect(backfilled).toEqual(expected);
  });
});
