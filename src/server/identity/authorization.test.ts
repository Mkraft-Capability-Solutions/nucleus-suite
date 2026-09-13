import { describe, expect, it } from "vitest";
import { authorize, type AuthorizationContext } from "@/server/identity/authorization";

const actor: AuthorizationContext = {
  actorUserId: "user_1",
  membershipId: "membership_1",
  tenantId: "tenant_1",
  roles: ["hr_admin"],
  permissions: ["employee.read"],
};

describe("authorize", () => {
  it("fails closed when a resource belongs to another tenant", () => {
    expect(authorize(actor, { action: "employee.read", resource: { tenantId: "tenant_2" } })).toMatchObject({
      allowed: false,
      reasonCode: "TENANT_CONTEXT_MISMATCH",
    });
  });

  it("fails closed when the action is not explicitly granted", () => {
    expect(authorize(actor, { action: "employee.update", resource: { tenantId: "tenant_1" } })).toMatchObject({
      allowed: false,
      reasonCode: "ACTION_FORBIDDEN",
    });
  });

  it("does not reveal protected fields without their independent permission", () => {
    expect(authorize(actor, {
      action: "employee.read",
      resource: { tenantId: "tenant_1" },
      requestedFields: ["ordinary", "compensation"],
    })).toMatchObject({ allowed: false, reasonCode: "FIELD_FORBIDDEN" });
  });

  it("permits an authorized projection", () => {
    expect(authorize({ ...actor, permissions: ["employee.read", "payroll.rate.read"] }, {
      action: "employee.read",
      resource: { tenantId: "tenant_1", sensitivity: ["compensation"] },
      requestedFields: ["ordinary", "compensation"],
    })).toEqual({ allowed: true, reasonCode: "ALLOWED", allowedFields: ["ordinary", "compensation"] });
  });
});
