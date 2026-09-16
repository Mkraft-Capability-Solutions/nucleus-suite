import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SCR-011 Assignment and policy attributes page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
  const page = source.slice(source.indexOf("export function AssignmentPolicyAttributesPage"));

  it("renders the screenshot queue, timeline and audit sections", () => {
    for (const copy of [
      "SCR-011",
      "Process guide",
      "Scoped to your permitted entity, location and reporting line.",
      "Open people core",
      "record(s) in the current scope",
      "Position",
      "Location",
      "Effective from",
      "State timeline",
      "Audit trail",
      "Add assignment",
    ]) {
      expect(page).toContain(copy);
    }
  });

  it("drives governed queue, history and assignment endpoints", () => {
    for (const path of [
      "/api/v1/employee-assignments",
      "/api/v1/dossier/assignments",
      "/api/v1/dossier/employments",
      "/api/v1/dossier-lookups/",
    ]) {
      expect(page).toContain(path);
    }
    expect(source).toContain("Idempotency-Key");
    expect(page).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error, empty and retry states", () => {
    expect(page).toContain('role="status"');
    expect(page).toContain('role="alert"');
    expect(page).toContain("No assignments yet");
    expect(page).toContain("Try again");
  });

  it("confirms successful actions with a success banner and refreshes the queue", () => {
    expect(page).toContain("bg-success/10");
    expect(page).toContain("audit entry is visible in this record detail");
    expect(page).toContain("queueState.refresh()");
    expect(page).toContain("historyState.refresh()");
  });
});
