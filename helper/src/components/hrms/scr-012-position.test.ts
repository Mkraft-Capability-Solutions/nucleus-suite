import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SCR-012 Position register page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
  const page = source.slice(source.indexOf("export function PositionRegisterPage"));

  it("renders the screenshot queue, timeline and audit sections", () => {
    for (const copy of [
      "SCR-012",
      "Process guide",
      "Scoped to your permitted entity, location and reporting line.",
      "Open people core",
      "record(s) in the current scope",
      "Incumbent",
      "Vacancy",
      "Effective from",
      "State timeline",
      "Audit trail",
      "Create position",
      "Freeze position",
    ]) {
      expect(page).toContain(copy);
    }
  });

  it("drives governed queue, detail and transition endpoints", () => {
    for (const path of [
      "/api/v1/organization/positions/register",
      "/api/v1/organization/positions/",
    ]) {
      expect(page).toContain(path);
    }
    for (const action of ['"freeze"', '"unfreeze"']) {
      expect(source).toContain(action);
    }
    expect(page).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error, empty, retry and confirmation states", () => {
    expect(page).toContain('role="status"');
    expect(page).toContain('role="alert"');
    expect(page).toContain("No positions yet");
    expect(page).toContain("Try again");
    expect(page).toContain("bg-success/10");
  });
});
