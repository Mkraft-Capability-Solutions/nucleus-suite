import { describe, expect, it } from "vitest";
import { isAdminPrincipal } from "./cockpit-catalog";
import {
  canAccessNavigationItem,
  getAuthorizedNavigation,
  navigationCatalog,
  navigationDomains,
  type NavigationItem,
} from "./navigation-catalog";

/**
 * The permissions a stock `employee` role actually holds: the base grant in
 * scripts/seeder/domain01-identity.ts plus the named self keys added by
 * db/migrations/0025_employee_self_service_grants.sql. Nothing here is
 * administrative, so `isAdminPrincipal` says no and the allowlist applies.
 */
const EMPLOYEE_PERMISSIONS = [
  "tenant.read",
  "employee.read",
  "attendance.read",
  "leave.read",
  "leave.write",
  "performance.read",
  "attendance.self.read",
  "attendance.self.write",
  "hr.helpdesk.self.read",
  "hr.helpdesk.self.write",
  "workforce.timesheets.self.read",
  "workforce.timesheets.self.write",
  "workforce.travel.self.read",
  "workforce.travel.self.write",
];
const EMPLOYEE_ROLES = ["employee"];

/** An owner: every permission the catalogue names, plus the admin markers. */
const ADMIN_PERMISSIONS = [
  ...new Set([
    ...navigationCatalog.flatMap((item) => item.requiredPermissions),
    "tenant.manage",
    "role.manage",
    "membership.manage",
  ]),
];
const ADMIN_ROLES = ["owner"];

/**
 * The rule as it stood before the allowlist: unmarked meant visible to
 * everybody. Kept here so the admin side can be proved unchanged rather than
 * asserted by hand against a list that would rot.
 */
function legacyCanAccess(item: NavigationItem, permissions: string[], roles: string[]): boolean {
  if (item.status !== "ready") return false;
  const permitted =
    item.requiredPermissions.length === 0 ||
    item.requiredPermissions.some((permission) => permissions.includes(permission));
  if (!permitted) return false;
  // "both" did not exist before; every item now carrying it was unmarked then,
  // so the old rule is replayed by reading it as unmarked.
  if (!item.audience || item.audience === "both") return true;
  const admin = isAdminPrincipal(permissions, roles);
  return item.audience === "admin" ? admin : !admin;
}

describe("navigation catalogue", () => {
  it("provides complete canonical metadata for every destination", () => {
    for (const item of navigationCatalog) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.icon).toBeTruthy();
      expect(item.keywords.length).toBeGreaterThan(0);
      expect(navigationDomains.some((domain) => domain.id === item.domain)).toBe(true);
    }
  });

  it("keeps destination IDs and routes unique", () => {
    expect(new Set(navigationCatalog.map((item) => item.id)).size).toBe(navigationCatalog.length);
    expect(new Set(navigationCatalog.map((item) => item.href)).size).toBe(navigationCatalog.length);
  });

  it("always exposes the command centre but filters restricted destinations", () => {
    const anonymous = getAuthorizedNavigation([]);
    expect(anonymous.map((item) => item.id)).toEqual(["overview"]);
    expect(anonymous.some((item) => item.id === "payroll")).toBe(false);
  });

  // Updated for the allowlist: `payroll` is unmarked, so it is admin-only now
  // and the permission half of the rule has to be read through an
  // administrative principal. The assertion is not weaker — it still proves
  // that one matching permission admits and a non-matching one refuses, and it
  // now also pins the default-deny half for the same item.
  it("grants a destination when at least one required permission is present", () => {
    const payroll = navigationCatalog.find((item) => item.id === "payroll");
    expect(payroll).toBeDefined();
    expect(canAccessNavigationItem(payroll!, ["payroll.read", "tenant.manage"], ADMIN_ROLES)).toBe(true);
    expect(canAccessNavigationItem(payroll!, ["employee.read", "tenant.manage"], ADMIN_ROLES)).toBe(false);
    // Unmarked, so no permission set makes it reachable for an employee.
    expect(canAccessNavigationItem(payroll!, ["payroll.read"], EMPLOYEE_ROLES)).toBe(false);
  });

  it("never exposes future destinations", () => {
    const future = { ...navigationCatalog[0], id: "future", href: "/future", status: "future" as const };
    expect(canAccessNavigationItem(future, [])).toBe(false);
  });

  it("gives an employee-level principal exactly the marked allowlist", () => {
    const visible = getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES).map((item) => item.id);
    expect([...visible].sort()).toEqual(
      [
        "assistant",
        "attendance",
        "attendance-day-detail",
        "check-in-out",
        "employee-home",
        "employee-home-actions",
        "engagement",
        "gate-pass-register",
        "helpdesk",
        "inbox",
        "learning",
        "leave",
        "leave-balance-ledger",
        "leave-requests",
        "my-attendance-history",
        "overview",
        "payslips",
        "performance",
        "policy-acknowledgements",
        "reimbursement-claims",
        "timesheets",
        "travel",
      ].sort(),
    );
    // The point of the exercise: far fewer than the catalogue.
    expect(visible.length).toBeLessThan(navigationCatalog.length / 2);
  });

  it("hides an unmarked destination from an employee by default", () => {
    const unmarked: NavigationItem = {
      ...navigationCatalog[0],
      id: "a-module-nobody-marked",
      href: "/a-module-nobody-marked",
      status: "ready",
      requiredPermissions: [],
      audience: undefined,
    };
    // Reachable on permissions alone, and still refused: absence of a mark is
    // a denial, not a shrug.
    expect(canAccessNavigationItem(unmarked, EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES)).toBe(false);
    expect(canAccessNavigationItem(unmarked, ADMIN_PERMISSIONS, ADMIN_ROLES)).toBe(true);

    // And the same holds for every real unmarked entry in the catalogue.
    for (const item of navigationCatalog) {
      if (item.audience) continue;
      expect(canAccessNavigationItem(item, EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES)).toBe(false);
    }
  });

  it("leaves the administrative principal's destinations unchanged", () => {
    const now = getAuthorizedNavigation(ADMIN_PERMISSIONS, ADMIN_ROLES).map((item) => item.id);
    const before = navigationCatalog
      .filter((item) => legacyCanAccess(item, ADMIN_PERMISSIONS, ADMIN_ROLES))
      .map((item) => item.id);
    expect([...now].sort()).toEqual([...before].sort());
    // The nine operational consoles and the platform registers are still there.
    expect(now).toContain("people-command-centre");
    expect(now).toContain("settings");
    expect(now).toContain("payroll");
    // ...and the self-service console is still not.
    expect(now).not.toContain("employee-home");
  });

  it("narrows but never widens: audience cannot admit what permissions refuse", () => {
    for (const item of navigationCatalog) {
      const permitted =
        item.status === "ready" &&
        (item.requiredPermissions.length === 0 ||
          item.requiredPermissions.some((permission) => EMPLOYEE_PERMISSIONS.includes(permission)));
      if (canAccessNavigationItem(item, EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES)) {
        expect(permitted, `${item.id} was admitted without a permission that allows it`).toBe(true);
      }
    }
    // Stated as a set relation too: the employee's destinations are a subset of
    // what the permission check alone would have allowed.
    const visible = new Set(getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES).map((item) => item.id));
    const permittedIds = new Set(
      navigationCatalog
        .filter(
          (item) =>
            item.status === "ready" &&
            (item.requiredPermissions.length === 0 ||
              item.requiredPermissions.some((permission) => EMPLOYEE_PERMISSIONS.includes(permission))),
        )
        .map((item) => item.id),
    );
    for (const id of visible) expect(permittedIds.has(id)).toBe(true);
  });
});
