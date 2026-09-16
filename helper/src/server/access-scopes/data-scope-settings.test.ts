import { describe, expect, it } from "vitest";
import { authorize, type AuthorizationContext } from "@/server/identity/authorization";
import { grantsForRoles, parseDataScopeSettings } from "./data-scope-settings";

const SETTINGS = {
  dataScopes: {
    plant_hr: {
      scopeDimension: "payroll_location",
      scopeValues: ["Plant North"],
      canViewSalaryStructure: true,
      canViewRateStructure: false,
    },
    blank_scope: { scopeDimension: "payroll_location", scopeValues: [], canViewSalaryStructure: true },
    broken: { scopeDimension: "nonsense", scopeValues: ["Plant North"] },
  },
};

function actor(roles: string[], settings: unknown = SETTINGS): AuthorizationContext {
  return {
    actorUserId: "user-1",
    membershipId: "membership-1",
    tenantId: "tenant-1",
    permissions: ["employee.read", "payroll.rate.read"],
    roles,
    dataScopes: grantsForRoles(settings, roles),
  };
}

function readSalary(context: AuthorizationContext, payrollLocation: string | null) {
  return authorize(context, {
    action: "employee.read",
    resource: { tenantId: "tenant-1", scope: { attendance_location: "Plant North", payroll_location: payrollLocation } },
    requestedFields: ["compensation"],
  });
}

describe("parseDataScopeSettings", () => {
  it("drops a scope whose dimension is not one the employee record carries", () => {
    const parsed = parseDataScopeSettings(SETTINGS);
    expect(Object.keys(parsed).sort()).toEqual(["blank_scope", "plant_hr"]);
  });

  it("returns nothing for a tenant that has configured none", () => {
    expect(parseDataScopeSettings({})).toEqual({});
    expect(parseDataScopeSettings(null)).toEqual({});
  });
});

describe("RL-24 salary visibility by payroll location", () => {
  it("shows salary for an employee paid inside the role's scope", () => {
    expect(readSalary(actor(["plant_hr"]), "Plant North").allowed).toBe(true);
  });

  it("masks salary for an employee paid at head office (T-18)", () => {
    const decision = readSalary(actor(["plant_hr"]), "Head Office");
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe("SCOPE_FORBIDDEN");
  });

  it("masks salary when the record's payroll location was never resolved", () => {
    expect(readSalary(actor(["plant_hr"]), null).reasonCode).toBe("SCOPE_FORBIDDEN");
  });

  it("treats an empty value list as covering nothing, not everything", () => {
    expect(readSalary(actor(["blank_scope"]), "Plant North").reasonCode).toBe("SCOPE_FORBIDDEN");
  });

  it("leaves a role the tenant has not scoped exactly as its permissions say", () => {
    const unscoped = actor(["payroll_admin"]);
    expect(unscoped.dataScopes).toEqual([]);
    expect(readSalary(unscoped, "Head Office").allowed).toBe(true);
  });

  it("refuses the rate structure to a role scoped for salary only", () => {
    const decision = authorize(actor(["plant_hr"]), {
      action: "employee.read",
      resource: { tenantId: "tenant-1", scope: { payroll_location: "Plant North" } },
      requestedFields: ["rate"],
    });
    expect(decision.reasonCode).toBe("SCOPE_FORBIDDEN");
  });

  it("still refuses on the permission before it ever reaches the scope", () => {
    const noRatePermission = { ...actor(["plant_hr"]), permissions: ["employee.read"] };
    expect(readSalary(noRatePermission, "Plant North").reasonCode).toBe("FIELD_FORBIDDEN");
  });
});
