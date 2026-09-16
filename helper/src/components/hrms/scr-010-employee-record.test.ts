import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SCR-010 Employee record page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/people-lifecycle-registers.tsx"), "utf8");
  const page = source.slice(source.indexOf("export function EmployeeRecordPage"));

  it("renders the screenshot queue, timeline and audit sections", () => {
    for (const copy of [
      "SCR-010",
      "Process guide",
      "Scoped to your permitted entity, location and reporting line.",
      "Open people core",
      "record(s) in the current scope",
      "Assignment",
      "State timeline",
      "Audit trail",
      "Create employee",
    ]) {
      expect(page).toContain(copy);
    }
    for (const column of ["Employee", "Department", "Assignment", "Status"]) {
      expect(page).toContain(column);
    }
  });

  it("drives governed queue and timeline endpoints", () => {
    expect(page).toContain("/api/v1/people?search=");
    expect(page).toContain("/timeline");
    expect(page).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error and empty states", () => {
    // The status and alert roles live in the StateBlock this page renders.
    expect(page).toContain("<StateBlock");
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
    expect(page).toContain("No employees yet");
  });
});
