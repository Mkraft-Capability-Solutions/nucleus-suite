import { describe, expect, it } from "vitest";
import {
  authorizedCockpits,
  canAccessCockpit,
  cockpitById,
  cockpitCatalog,
  cockpitIds,
  isAdminPrincipal,
} from "./cockpit-catalog";

const superAdmin = { permissions: ["employee.read", "attendance.read", "payroll.read", "tenant.read", "tenant.manage"], roles: ["owner"] };
const employee = { permissions: ["employee.read", "attendance.read"], roles: ["employee"] };

describe("cockpit catalog", () => {
  it("registers the ten specified cockpits S1 to S10 exactly once", () => {
    expect(cockpitCatalog).toHaveLength(10);
    expect(cockpitCatalog.map((cockpit) => cockpit.code)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"]);
    expect(new Set(cockpitIds).size).toBe(10);
  });

  it("marks exactly one cockpit as the employee surface", () => {
    const employeeCockpits = cockpitCatalog.filter((cockpit) => cockpit.audience === "employee");
    expect(employeeCockpits.map((cockpit) => cockpit.code)).toEqual(["S8"]);
  });

  it("gives every cockpit an endpoint that matches its id", () => {
    for (const cockpit of cockpitCatalog) {
      expect(cockpit.endpoint).toBe(`/api/v1/cockpits/${cockpit.id}`);
    }
  });
});

describe("isAdminPrincipal", () => {
  it("recognises an administrative principal by permission", () => {
    expect(isAdminPrincipal(["tenant.manage"])).toBe(true);
    expect(isAdminPrincipal(["role.manage"])).toBe(true);
  });

  it("recognises a Super Admin by role even without the permission", () => {
    expect(isAdminPrincipal([], ["owner"])).toBe(true);
  });

  it("does not treat an ordinary employee as administrative", () => {
    expect(isAdminPrincipal(["employee.read"], ["employee"])).toBe(false);
  });
});

describe("cockpit access", () => {
  it("gives the Super Admin every cockpit except the employee home", () => {
    const allowed = authorizedCockpits(superAdmin.permissions, superAdmin.roles);
    expect(allowed.map((cockpit) => cockpit.code)).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S9", "S10"]);
    expect(allowed.some((cockpit) => cockpit.code === "S8")).toBe(false);
  });

  it("gives the employee only the employee home", () => {
    const allowed = authorizedCockpits(employee.permissions, employee.roles);
    expect(allowed.map((cockpit) => cockpit.code)).toEqual(["S8"]);
  });

  it("still enforces the cockpit's own permissions", () => {
    const withoutPayroll = authorizedCockpits(["employee.read", "tenant.manage"], ["owner"]);
    expect(withoutPayroll.some((cockpit) => cockpit.code === "S5")).toBe(false);
    expect(withoutPayroll.some((cockpit) => cockpit.code === "S1")).toBe(true);
  });

  it("refuses an unknown principal entirely", () => {
    expect(authorizedCockpits([], [])).toEqual([]);
  });

  it("resolves a cockpit by id and rejects an unknown one", () => {
    expect(cockpitById("employee-home")?.code).toBe("S8");
    expect(cockpitById("not-a-cockpit")).toBeUndefined();
  });

  it("never admits a cockpit the audience rule excludes, even with every permission", () => {
    const everything = cockpitCatalog.flatMap((cockpit) => cockpit.requiredPermissions).concat("tenant.manage");
    const home = cockpitById("employee-home")!;
    expect(canAccessCockpit(home, everything, ["owner"])).toBe(false);
  });
});
