import { describe, expect, it } from "vitest";
import { createDelegationSchema } from "@/server/delegation/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("delegation schemas", () => {
  it("validates delegation windows with ordered dates", () => {
    const valid = {
      delegateMembershipId: UUID,
      scopes: ["leave.read"],
      validFrom: "2026-09-14T00:00:00+05:30",
      validTo: "2026-09-16T00:00:00+05:30",
      reason: "HR offsite coverage",
    };
    expect(createDelegationSchema.safeParse(valid).success).toBe(true);
    expect(createDelegationSchema.safeParse({ ...valid, validTo: valid.validFrom }).success).toBe(false);
    expect(createDelegationSchema.safeParse({ ...valid, scopes: [] }).success).toBe(false);
    expect(createDelegationSchema.safeParse({ ...valid, delegateMembershipId: "nope" }).success).toBe(false);
  });
});
