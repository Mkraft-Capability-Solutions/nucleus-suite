import { describe, expect, it } from "vitest";
import { deriveAssignmentStatus } from "./service";

describe("deriveAssignmentStatus", () => {
  it("marks future-dated assignments as scheduled", () => {
    expect(deriveAssignmentStatus("2026-10-01", null, "2026-09-14")).toBe("scheduled");
  });

  it("marks ended assignments as superseded", () => {
    expect(deriveAssignmentStatus("2026-08-01", "2026-09-01", "2026-09-14")).toBe("superseded");
  });

  it("marks current assignments as effective", () => {
    expect(deriveAssignmentStatus("2026-09-01", null, "2026-09-14")).toBe("effective");
    expect(deriveAssignmentStatus("2026-09-14", "2026-12-31", "2026-09-14")).toBe("effective");
  });

  it("falls back to effective when dates are missing", () => {
    expect(deriveAssignmentStatus(null, null, "2026-09-14")).toBe("effective");
    expect(deriveAssignmentStatus("", "", "2026-09-14")).toBe("effective");
  });
});
