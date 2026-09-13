import { describe, expect, it } from "vitest";
import { createExportSchema } from "@/server/exports/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("exports schemas", () => {
  it("validates export requests with bounded enums", () => {
    expect(createExportSchema.safeParse({ resource: "employees", format: "csv" }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "payroll-lines", format: "json", period: "2026-09", employeeId: UUID }).success).toBe(true);
    expect(createExportSchema.safeParse({ resource: "salaries", format: "csv" }).success).toBe(false);
    expect(createExportSchema.safeParse({ resource: "employees", format: "xml" }).success).toBe(false);
    expect(createExportSchema.safeParse({ resource: "employees", format: "csv", period: "Sep" }).success).toBe(false);
  });
});
