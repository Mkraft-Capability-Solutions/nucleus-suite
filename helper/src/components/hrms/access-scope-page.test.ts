import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Access scope administration page (SCR-005)", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/org-registers.tsx"), "utf8");
  const page = source.slice(source.indexOf("export function AccessScopeAdministrationPage"));

  it("renders the screenshot's queue, timeline and audit sections", () => {
    for (const copy of [
      "Access scope administration",
      "Process guide",
      "Scoped to your permitted entity, location and reporting line.",
      "Open people core",
      "Principal",
      "Effective from",
      "Record detail",
      "State timeline",
      "Audit trail",
      "Grant scope",
      "Revoke scope",
    ]) {
      expect(page).toContain(copy);
    }
  });

  it("drives the governed access-scope endpoints", () => {
    for (const path of ["/api/v1/access-scopes", "/api/v1/memberships", "/api/v1/roles", "/revoke"]) {
      expect(page).toContain(path);
    }
    expect(page).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error, empty and restricted states", () => {
    expect(page).toContain('role="status"');
    expect(page).toContain('role="alert"');
    expect(page).toContain("No access to scope records");
  });
});
