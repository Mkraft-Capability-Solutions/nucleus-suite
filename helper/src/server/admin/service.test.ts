import { describe, expect, it } from "vitest";
import {
  assignRolesSchema,
  createInviteSchema,
  createRoleSchema,
  grantPermissionsSchema,
  patchSettingsSchema,
} from "@/server/admin/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("admin schemas", () => {
  it("validates role codes, grants and assignments", () => {
    expect(createRoleSchema.safeParse({ code: "plant-hr", name: "Plant HR" }).success).toBe(true);
    expect(createRoleSchema.safeParse({ code: "Plant HR", name: "x" }).success).toBe(false);
    expect(grantPermissionsSchema.safeParse({ permissionKeys: ["employee.read", "leave.approve"] }).success).toBe(true);
    expect(grantPermissionsSchema.safeParse({ permissionKeys: [] }).success).toBe(false);
    expect(assignRolesSchema.safeParse({ membershipId: UUID, roleCodes: ["employee"] }).success).toBe(true);
    expect(assignRolesSchema.safeParse({ membershipId: UUID, roleCodes: [] }).success).toBe(false);
  });

  it("validates invitations and tenant settings", () => {
    expect(createInviteSchema.safeParse({ email: "new@example.test", roleCodes: ["employee"], expiresInHours: 72 }).success).toBe(true);
    expect(createInviteSchema.safeParse({ email: "bad", roleCodes: ["employee"] }).success).toBe(false);
    expect(patchSettingsSchema.safeParse({ locale: "en-IN", timezone: "Asia/Kolkata", currency: "INR" }).success).toBe(true);
    expect(patchSettingsSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
    expect(patchSettingsSchema.safeParse({ currency: "inr" }).success).toBe(false);
  });
});
