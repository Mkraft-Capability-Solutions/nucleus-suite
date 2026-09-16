import { describe, expect, it } from "vitest";
import { createCourseSchema, createPathSchema, enrollSchema } from "@/server/learning/service";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("learning schemas", () => {
  it("validates courses with defaults", () => {
    const parsed = createCourseSchema.safeParse({ code: "LOOM-SAFETY", title: "Loom Safety" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.mandatory).toBe(false);
      expect(parsed.data.durationMinutes).toBe(120);
    }
    expect(createCourseSchema.safeParse({ code: "", title: "X" }).success).toBe(false);
  });

  it("validates paths and enrollments", () => {
    expect(createPathSchema.safeParse({ code: "P-OPS", title: "Operator path", courseCodes: ["LOOM-SAFETY"] }).success).toBe(true);
    expect(createPathSchema.safeParse({ code: "P", title: "T", courseCodes: [] }).success).toBe(false);
    expect(enrollSchema.safeParse({ employeeId: UUID, courseCode: "LOOM-SAFETY", dueDate: "2026-09-20" }).success).toBe(true);
    expect(enrollSchema.safeParse({ employeeId: UUID, courseCode: "C", dueDate: "20-09-2026" }).success).toBe(false);
  });
});
