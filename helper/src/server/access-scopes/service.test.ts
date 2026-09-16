import { describe, expect, it } from "vitest";
import { deriveScopeStatus, grantScopeSchema, revokeScopeSchema } from "./service";

describe("access scope status derivation", () => {
  it("marks revoked grants regardless of dates", () => {
    expect(deriveScopeStatus({ valid_from: "2026-09-01", valid_to: null, revoked_at: "2026-09-14 10:00:00+00" }, "2026-09-14")).toBe("revoked");
  });

  it("marks expired grants as revoked", () => {
    expect(deriveScopeStatus({ valid_from: "2026-08-01", valid_to: "2026-09-01", revoked_at: null }, "2026-09-14")).toBe("revoked");
  });

  it("marks future grants as scheduled", () => {
    expect(deriveScopeStatus({ valid_from: "2026-10-01", valid_to: null, revoked_at: null }, "2026-09-14")).toBe("scheduled");
  });

  it("marks current grants as active", () => {
    expect(deriveScopeStatus({ valid_from: "2026-09-01", valid_to: null, revoked_at: null }, "2026-09-14")).toBe("active");
    expect(deriveScopeStatus({ valid_from: "2026-09-14", valid_to: "2026-12-31", revoked_at: null }, "2026-09-14")).toBe("active");
  });
});

describe("access scope schemas", () => {
  const member = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a minimal grant with reason", () => {
    expect(grantScopeSchema.safeParse({ membershipId: member, roleCodes: ["employee"], reason: "Joining scope" }).success).toBe(true);
  });

  it("rejects grants without a reason or roles", () => {
    expect(grantScopeSchema.safeParse({ membershipId: member, roleCodes: ["employee"], reason: "no" }).success).toBe(false);
    expect(grantScopeSchema.safeParse({ membershipId: member, roleCodes: [], reason: "Joining scope" }).success).toBe(false);
    expect(grantScopeSchema.safeParse({ membershipId: "nope", roleCodes: ["employee"], reason: "Joining scope" }).success).toBe(false);
  });

  it("requires a reason to revoke", () => {
    expect(revokeScopeSchema.safeParse({ reason: "Role no longer needed" }).success).toBe(true);
    expect(revokeScopeSchema.safeParse({ reason: "no" }).success).toBe(false);
    expect(revokeScopeSchema.safeParse({}).success).toBe(false);
  });
});
