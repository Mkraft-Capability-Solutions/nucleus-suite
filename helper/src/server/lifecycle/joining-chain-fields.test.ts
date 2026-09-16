import { describe, expect, it } from "vitest";
import {
  completeOnboardingTaskSchema,
  isOverdue,
  startOnboardingSchema,
} from "./service";

/**
 * FRM-LCY-01 field rules: the joining-date deviation reason, the chain item's
 * outcome vocabulary and the derived overdue flag.
 */
describe("startOnboardingSchema (FRM-LCY-01)", () => {
  const employeeId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a plain start and keeps the standard template", () => {
    const parsed = startOnboardingSchema.parse({ employeeId });
    expect(parsed.templateCode).toBe("DAY1-STD");
    expect(parsed.actualJoiningDate).toBeUndefined();
  });

  it("holds a joining deviation reason to ten characters when one is given", () => {
    expect(startOnboardingSchema.safeParse({ employeeId, actualJoiningDate: "2026-05-04", joiningDeviationReason: "late" }).success).toBe(false);
    expect(startOnboardingSchema.safeParse({ employeeId, actualJoiningDate: "2026-05-04", joiningDeviationReason: "Visa arrived late" }).success).toBe(true);
    expect(startOnboardingSchema.safeParse({ employeeId, actualJoiningDate: "04-05-2026" }).success).toBe(false);
  });

  it("takes candidate and offer references as record ids, not free text", () => {
    expect(startOnboardingSchema.safeParse({ employeeId, candidateId: "not-a-uuid" }).success).toBe(false);
    expect(startOnboardingSchema.safeParse({ employeeId, candidateId: employeeId, offerId: employeeId }).success).toBe(true);
  });
});

describe("completeOnboardingTaskSchema (FRM-LCY-01)", () => {
  it("defaults to done and refuses a status outside PL_TASK_STATUS", () => {
    expect(completeOnboardingTaskSchema.parse({}).status).toBe("done");
    expect(completeOnboardingTaskSchema.safeParse({ status: "skipped" }).success).toBe(false);
    expect(completeOnboardingTaskSchema.safeParse({ status: "in_progress" }).success).toBe(true);
  });

  it("refuses overdue as a recorded outcome because it is derived", () => {
    expect(completeOnboardingTaskSchema.safeParse({ status: "overdue" }).success).toBe(false);
  });

  it("requires a twenty-character reason to waive a chain item", () => {
    expect(completeOnboardingTaskSchema.safeParse({ status: "waived" }).success).toBe(false);
    expect(completeOnboardingTaskSchema.safeParse({ status: "waived", note: "Not applicable" }).success).toBe(false);
    expect(completeOnboardingTaskSchema.safeParse({ status: "waived", note: "Not applicable to a rehire on the same site" }).success).toBe(true);
  });
});

describe("isOverdue (FRM-LCY-01)", () => {
  it("only flags an outstanding item that has passed its due date", () => {
    expect(isOverdue("pending", "2026-01-01", "2026-02-01")).toBe(true);
    expect(isOverdue("pending", "2026-03-01", "2026-02-01")).toBe(false);
    expect(isOverdue("pending", null, "2026-02-01")).toBe(false);
    expect(isOverdue("done", "2026-01-01", "2026-02-01")).toBe(false);
    expect(isOverdue("waived", "2026-01-01", "2026-02-01")).toBe(false);
  });
});
