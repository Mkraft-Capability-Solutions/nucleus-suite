import { describe, expect, it } from "vitest";
import { applyImportSchema } from "@/server/organization/import-apply";
import { createExportSchema } from "@/server/exports/service";
import { createTemplateSchema, updateTemplateSchema } from "@/server/lifecycle/templates";
import { enrollParticipantSchema, submitResponseSchema } from "@/server/performance/reviews";
import { requestRegularizationSchema, requestShiftSwapSchema } from "@/server/attendance/regularizations";
import { recordEvidenceSchema, verifyEvidenceSchema } from "@/server/skills/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("regularization and shift-swap schemas", () => {
  it("validates regularization requests with bounded reasons", () => {
    const valid = { employeeId: UUID, date: "2026-09-10", kind: "missing-punch", reason: "Forgot to punch out", claimedIn: "06:00 PM", claimedOut: "08:00 PM" };
    expect(requestRegularizationSchema.safeParse(valid).success).toBe(true);
    expect(requestRegularizationSchema.safeParse({ ...valid, kind: "overtime" }).success).toBe(false);
    expect(requestRegularizationSchema.safeParse({ ...valid, reason: "" }).success).toBe(false);
  });

  it("validates shift swaps between two employees and shifts", () => {
    const valid = { requesterEmployeeId: UUID, counterpartyEmployeeId: "223e4567-e89b-12d3-a456-426614174000", date: "2026-09-12", reason: "Family event" };
    expect(requestShiftSwapSchema.safeParse(valid).success).toBe(true);
    expect(requestShiftSwapSchema.safeParse({ ...valid, counterpartyEmployeeId: UUID }).success).toBe(true);
  });
});

describe("export job schemas", () => {
  it("restricts resources and filter shapes", () => {
    expect(createExportSchema.safeParse({ resource: "employees", format: "csv" }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "payroll-lines", format: "csv", period: "2026-09" }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "secrets", format: "csv" }).success).toBe(false);
    expect(createExportSchema.safeParse({ resource: "employees", format: "xlsx" }).success).toBe(false);
  });
});

describe("review response schemas", () => {
  it("validates participants and bounded ratings", () => {
    expect(enrollParticipantSchema.safeParse({ employeeId: UUID, cycleCode: "FY26-H2", templateCode: "STD-360" }).success).toBe(true);
    const response = { participantId: UUID, relationship: "peer", ratings: { delivery: 4 }, summary: "Strong" };
    expect(submitResponseSchema.safeParse(response).success).toBe(true);
    expect(submitResponseSchema.safeParse({ ...response, relationship: "stranger" }).success).toBe(false);
    expect(submitResponseSchema.safeParse({ ...response, ratings: {} }).success).toBe(false);
  });
});

describe("skill evidence schemas", () => {
  it("validates evidence sources and proficiency levels", () => {
    const valid = { employeeId: UUID, skillName: "Ring frames", source: "course-completion", level: "L3", reference: "course-9" };
    expect(recordEvidenceSchema.safeParse(valid).success).toBe(true);
    expect(recordEvidenceSchema.safeParse({ ...valid, level: "L9" }).success).toBe(false);
    expect(recordEvidenceSchema.safeParse({ ...valid, source: "vibes" }).success).toBe(false);
    expect(verifyEvidenceSchema.safeParse({ evidenceId: UUID, verdict: "verified" }).success).toBe(true);
    expect(verifyEvidenceSchema.safeParse({ evidenceId: UUID, verdict: "maybe" }).success).toBe(false);
  });
});

describe("onboarding template schemas", () => {
  it("validates template tasks and status transitions", () => {
    const valid = { code: "DAY1-STD", name: "Day 1", tasks: [{ key: "docs", title: "Documents", required: true, owner: "hr" }] };
    expect(createTemplateSchema.safeParse(valid).success).toBe(true);
    expect(createTemplateSchema.safeParse({ ...valid, tasks: [] }).success).toBe(false);
    expect(updateTemplateSchema.safeParse({ status: "archived" }).success).toBe(true);
    expect(updateTemplateSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});

describe("import apply schemas", () => {
  it("reuses the preview contract and requires an idempotency-bound plan", () => {
    const rows = [{ employeeCode: "HO-0002", firstName: "Rohan", lastName: "V", department: "Finance" }];
    expect(applyImportSchema.safeParse({ rows }).success).toBe(true);
    expect(applyImportSchema.safeParse({ rows: [] }).success).toBe(false);
  });
});
