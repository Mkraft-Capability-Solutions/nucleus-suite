import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/hrms/people-pages.tsx"), "utf8");
const primitives = readFileSync(resolve(process.cwd(), "src/components/hrms/register-primitives.tsx"), "utf8");
const page = source.slice(source.indexOf("const PEOPLE_CORE_TABS"), source.indexOf("type DepartmentOption"));

describe("People Core (System of Record)", () => {
  it("names the system of record and its purpose", () => {
    expect(page).toContain("People Core (System of Record)");
    expect(page).toContain("Single source of truth for organizational records");
  });

  it("renders the seven reference tabs", () => {
    for (const label of [
      "Employee Directory",
      "Legal Entities (SCR-001)",
      "Locations (SCR-002)",
      "Org Chart",
      "Positions (SCR-012)",
      "Document Vault (SCR-014)",
      "Audit Trail",
    ]) {
      expect(page, `missing the ${label} tab`).toContain(label);
    }
    expect(page).toContain("<ModuleTabs");
    expect(page).toContain("<TabPanel");
  });

  it("renders the four headline stats without inventing figures", () => {
    for (const label of ["Active employees", "Open headcount budget", "Document verification", "Audit event stream"]) {
      expect(page, `missing the ${label} stat`).toContain(label);
    }
    // ModuleStat renders an em dash when a source is unavailable.
    expect(primitives).toContain('{value === null ? "—" : value}');
  });

  it("renders the reference directory columns", () => {
    for (const column of ["Employee", "ID / Band", "Department", "Reporting manager", "Location", "Status", "Action"]) {
      expect(page, `missing the ${column} column`).toContain(column);
    }
    expect(page).toContain("View Dossier");
    // The reporting manager cell carries an inline change action that routes to
    // the governed assignment register rather than editing in place.
    expect(page).toMatch(/>\s*Change\s*</);
    expect(page).toContain('href="/assignment-policy-attributes"');
  });

  it("exposes the header actions from the reference screen", () => {
    for (const action of ["Bulk Onboarding", "Export CSV", "Add Employee"]) {
      expect(page, `missing the ${action} action`).toContain(action);
    }
  });

  it("drives only governed endpoints", () => {
    for (const endpoint of [
      "/api/v1/people/directory",
      "/api/v1/organization/positions/register",
      "/api/v1/documents/vault",
      // R-23: the org chart is derived from the reporting line now, not read from
      // a stored tree, so this screen drives the reporting-chart endpoint.
      "/api/v1/organization/reporting-chart",
    ]) {
      expect(page, `does not call ${endpoint}`).toContain(endpoint);
    }
    expect(page).not.toMatch(/Math\.random|placeholder data|faker/i);
  });

  it("covers loading, error and empty states for the directory", () => {
    expect(page).toContain("<RegisterStates");
    expect(page).toContain("No employees yet");
    expect(page).toContain("People directory unavailable");
    expect(page).toContain("No people found");
  });

  it("exports only the rows currently in view", () => {
    expect(page).toContain("toCsv(");
    expect(page).toContain("downloadCsv(");
    expect(page).toContain("from the current view");
  });
});

describe("module tab shell", () => {
  it("is operable from the keyboard and announced correctly", () => {
    expect(primitives).toContain('role="tablist"');
    expect(primitives).toContain('role="tab"');
    expect(primitives).toContain('role="tabpanel"');
    expect(primitives).toContain("aria-selected={selected}");
    expect(primitives).toContain("aria-controls={`panel-${tab.id}`}");
    expect(primitives).toContain('event.key === "ArrowRight"');
    expect(primitives).toContain('event.key === "ArrowLeft"');
    expect(primitives).toContain("tabIndex={selected ? 0 : -1}");
  });
});
