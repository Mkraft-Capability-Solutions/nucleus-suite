import { describe, expect, it } from "vitest";
import { recordEvidenceSchema, verifyEvidenceSchema } from "@/server/skills/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("skills schemas", () => {
  it("validates evidence recording with bounded enums", () => {
    const valid = { employeeId: UUID, skillName: "Loom Operation", source: "manager-assessment", level: "L3", reference: "Q2 review notes" };
    expect(recordEvidenceSchema.safeParse(valid).success).toBe(true);
    expect(recordEvidenceSchema.safeParse({ ...valid, source: "vibes" }).success).toBe(false);
    expect(recordEvidenceSchema.safeParse({ ...valid, level: "L9" }).success).toBe(false);
  });

  it("validates evidence verdicts", () => {
    expect(verifyEvidenceSchema.safeParse({ evidenceId: UUID, verdict: "verified", note: "Confirmed on floor" }).success).toBe(true);
    expect(verifyEvidenceSchema.safeParse({ evidenceId: UUID, verdict: "maybe" }).success).toBe(false);
  });
});
