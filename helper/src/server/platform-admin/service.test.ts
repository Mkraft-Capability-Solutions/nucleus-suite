import { describe, expect, it } from "vitest";
import {
  changeTenantStatusSchema,
  createTenantSchema,
  createTenantUserSchema,
} from "@/server/platform-admin/service";

describe("platform-admin schemas", () => {
  it("validates tenant creation", () => {
    const valid = { name: "Mkraft", slug: "mkraft", ownerName: "Arjun Mehta", ownerEmail: "arjun@mkraft.demo" };
    const parsed = createTenantSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.timezone).toBe("Asia/Kolkata");
      expect(parsed.data.currency).toBe("INR");
      expect(parsed.data.ownerEmail).toBe("arjun@mkraft.demo");
    }
    expect(createTenantSchema.safeParse({ ...valid, slug: "Bad Slug!" }).success).toBe(false);
    expect(createTenantSchema.safeParse({ ...valid, ownerEmail: "nope" }).success).toBe(false);
  });

  it("validates status changes and tenant users", () => {
    expect(changeTenantStatusSchema.safeParse({ status: "suspended", reason: "Non-payment for 60 days" }).success).toBe(true);
    expect(changeTenantStatusSchema.safeParse({ status: "deleted", reason: "Too short" }).success).toBe(false);
    expect(createTenantUserSchema.safeParse({ name: "HR Lead", email: "HR@Mkraft.Demo", roleCodes: ["hr-manager"] }).success).toBe(true);
  });
});
