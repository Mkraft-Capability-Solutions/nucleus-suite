import { describe, expect, it } from "vitest";
import { isAdminPrincipal } from "./cockpit-catalog";
import {
  activeEmployeeNavigationGroup,
  buildEmployeeNavigationGroups,
  employeeNavigationGroups,
  getEmployeeNavigationGroups,
  isEmployeeGroupActive,
} from "./employee-navigation";
import { getAuthorizedNavigation, navigationCatalog, navigationDomains } from "./navigation-catalog";

/**
 * The permissions a stock `employee` role actually holds — the same fixture the
 * catalogue suite uses, kept identical on purpose so the two files cannot drift
 * into disagreeing about who this reader is.
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

const ADMIN_PERMISSIONS = [
  ...new Set([
    ...navigationCatalog.flatMap((item) => item.requiredPermissions),
    "tenant.manage",
    "role.manage",
    "membership.manage",
  ]),
];
const ADMIN_ROLES = ["owner"];

describe("employee self-service navigation", () => {
  it("names only real modules and real icons", () => {
    const moduleIds = new Set(navigationCatalog.map((item) => item.id));
    for (const group of employeeNavigationGroups) {
      expect(group.label).toBeTruthy();
      expect(group.href.startsWith("/")).toBe(true);
      expect(group.members.length).toBeGreaterThan(0);
      for (const member of group.members) {
        expect(moduleIds.has(member), `${group.id} names a module that does not exist: ${member}`).toBe(true);
      }
      // The primary destination has to be one of the group's own members,
      // otherwise the group opens somewhere it does not speak for.
      const hrefs = group.members.map((id) => navigationCatalog.find((item) => item.id === id)?.href);
      expect(hrefs, `${group.id} opens ${group.href}, which is not one of its members`).toContain(group.href);
    }
  });

  it("declares each module once and orphans none of the employee's allowlist", () => {
    const declared = employeeNavigationGroups.flatMap((group) => group.members);
    expect(new Set(declared).size).toBe(declared.length);

    const allowlisted = getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES).map((item) => item.id);
    for (const id of allowlisted) {
      expect(declared, `${id} is authorised for an employee but appears in no group`).toContain(id);
    }
  });

  it("returns only groups that have an authorised member", () => {
    const authorised = getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES);
    const authorisedIds = new Set(authorised.map((item) => item.id));
    const groups = buildEmployeeNavigationGroups(authorised);

    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) {
        expect(authorisedIds.has(item.id), `${group.id} surfaced ${item.id}, which was not authorised`).toBe(true);
      }
    }
  });

  it("omits a group whose members are all unauthorised", () => {
    const authorised = getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES);
    const withoutLeave = authorised.filter(
      (item) => !["leave", "leave-requests", "leave-balance-ledger"].includes(item.id),
    );
    const ids = buildEmployeeNavigationGroups(withoutLeave).map((group) => group.id);

    expect(ids).not.toContain("my-leave");
    // The heading is gone, not merely emptied.
    expect(buildEmployeeNavigationGroups(withoutLeave).some((group) => group.items.length === 0)).toBe(false);
    // Nothing is authorised at all: no groups, rather than eight empty ones.
    expect(buildEmployeeNavigationGroups([])).toEqual([]);
  });

  it("gives a stock employee the expected ordered groups", () => {
    const groups = getEmployeeNavigationGroups(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES);
    expect(groups.map((group) => group.id)).toEqual([
      "home",
      "my-attendance",
      "my-leave",
      "my-work",
      "my-pay",
      "my-growth",
      "my-support",
      "my-actions",
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      "Home Dashboard",
      "My Attendance & Shifts",
      "My Leaves & Time Off",
      "My Projects & Tasks",
      "My Pay & Claims",
      "My Growth & Goals",
      "Policy & Helpdesk",
      "My Inbox & Actions",
    ]);

    // `projects` needs workforce.projects.*, which a stock employee does not
    // hold, so My Projects & Tasks legitimately collapses to Timesheets alone.
    const work = groups.find((group) => group.id === "my-work");
    expect(work?.items.map((item) => item.id)).toEqual(["timesheets"]);

    // And no directory module sneaks in through a group: those endpoints return
    // the whole tenant, so they are off the allowlist and must stay off.
    const surfaced = groups.flatMap((group) => group.items.map((item) => item.id));
    expect(surfaced).not.toContain("people");
    expect(surfaced).not.toContain("employee-record");
  });

  it("never widens the authorised set", () => {
    const authorisedIds = new Set(
      getAuthorizedNavigation(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES).map((item) => item.id),
    );
    const surfaced = getEmployeeNavigationGroups(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES)
      .flatMap((group) => group.items.map((item) => item.id));

    expect(surfaced.length).toBeGreaterThan(0);
    for (const id of surfaced) {
      expect(authorisedIds.has(id), `${id} reached the employee dock without being authorised`).toBe(true);
    }
    // Regrouping loses nothing either: every authorised destination is reachable.
    expect([...surfaced].sort()).toEqual([...authorisedIds].sort());
  });

  it("leaves the administrative principal on the domain dock", () => {
    expect(isAdminPrincipal(ADMIN_PERMISSIONS, ADMIN_ROLES)).toBe(true);
    // No self-service groups are offered to an admin, so the dock keeps the
    // enterprise domains and there is nothing to switch between.
    expect(getEmployeeNavigationGroups(ADMIN_PERMISSIONS, ADMIN_ROLES)).toEqual([]);

    // The admin's own destinations are untouched by any of this.
    const admin = getAuthorizedNavigation(ADMIN_PERMISSIONS, ADMIN_ROLES);
    const domains = new Set(admin.map((item) => item.domain));
    for (const domain of navigationDomains) {
      expect(domains.has(domain.id), `${domain.id} vanished from the admin dock`).toBe(true);
    }
    expect(admin.map((item) => item.id)).toContain("settings");
    expect(admin.map((item) => item.id)).toContain("payroll");
  });

  it("marks a group active from any of its members' paths", () => {
    const groups = getEmployeeNavigationGroups(EMPLOYEE_PERMISSIONS, EMPLOYEE_ROLES);
    const attendance = groups.find((group) => group.id === "my-attendance")!;

    expect(isEmployeeGroupActive(attendance, "/attendance")).toBe(true);
    // A member that is not the primary href still lights the group.
    expect(isEmployeeGroupActive(attendance, "/gate-pass-register")).toBe(true);
    expect(isEmployeeGroupActive(attendance, "/my-attendance-history/2026-09")).toBe(true);
    expect(isEmployeeGroupActive(attendance, "/leave")).toBe(false);

    expect(activeEmployeeNavigationGroup(groups, "/leave-balance-ledger")?.id).toBe("my-leave");
    expect(activeEmployeeNavigationGroup(groups, "/")?.id).toBe("home");
    // Home's "/" must not swallow every other path.
    expect(activeEmployeeNavigationGroup(groups, "/payslips")?.id).toBe("my-pay");
    expect(activeEmployeeNavigationGroup(groups, "/nowhere")).toBeUndefined();
  });
});
