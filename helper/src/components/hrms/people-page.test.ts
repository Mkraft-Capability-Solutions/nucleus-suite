import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("People Core workspace", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/people-pages.tsx"), "utf8");
  const peoplePage = source.slice(source.indexOf("export function PeoplePage"), source.indexOf("type DepartmentOption"));

  // The tab shell replaced the full-height flex workspace, so the directory
  // scrolls within a bounded pane instead of filling the viewport.
  it("scrolls the directory inside its own pane rather than the page", () => {
    expect(peoplePage).toContain("max-h-[620px] overflow-auto");
    expect(peoplePage).toContain("overflow-hidden p-0");
  });

  it("shows lifecycle status in the directory and beside the selected name", () => {
    expect(peoplePage).toContain('<th className="px-3 py-3">Status</th>');
    expect(peoplePage).toContain("directoryName(selectedRow)");
    expect(peoplePage).toContain("<StatusPill tone={directoryTone(selectedRow.status)} dot>");
  });

  it("connects the dossier action to the governed employee endpoint", () => {
    expect(source).toContain("function EmployeeDossierSheet");
    expect(source).toContain("`/api/v1/people/${encodeURIComponent(person.id)}`");
    expect(source).toContain("<Sheet open onOpenChange={onOpenChange}>");
    expect(peoplePage).toContain("onClick={() => setDossierOpen(true)}");
  });

  it("enforces the salary boundary in the accessible number input and submit guard", () => {
    expect(source).toContain('type="number" min={0}');
    expect(source).toContain("!Number.isFinite(amount) || amount < 0");
    expect(source).toContain('localErrors.basicSalaryMinor = "Enter a non-negative amount."');
  });
});
