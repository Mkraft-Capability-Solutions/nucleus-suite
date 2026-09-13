import { describe, expect, it } from "vitest";
import { createHoldSchema, openRightsSchema } from "@/server/privacy/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("privacy schemas", () => {
  it("validates rights cases", () => {
    const valid = { kind: "erase", subjectEmployeeId: UUID, details: "Remove my phone number", identityProofRef: "HR-verified PAN" };
    expect(openRightsSchema.safeParse(valid).success).toBe(true);
    expect(openRightsSchema.safeParse({ ...valid, kind: "forget-everything" }).success).toBe(false);
    expect(openRightsSchema.safeParse({ kind: "access", details: "", identityProofRef: "x" }).success).toBe(false);
  });

  it("validates legal holds", () => {
    const parsed = createHoldSchema.safeParse({ reason: "Ongoing labour tribunal matter" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.scope).toBe("tenant");
    expect(createHoldSchema.safeParse({ reason: "short" }).success).toBe(true);
    expect(createHoldSchema.safeParse({ reason: "" }).success).toBe(false);
  });
});
