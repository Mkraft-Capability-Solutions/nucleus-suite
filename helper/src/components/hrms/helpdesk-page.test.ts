import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("HR Operations helpdesk page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/helpdesk-page.tsx"), "utf8");
  const moduleView = readFileSync(resolve(process.cwd(), "src/components/hrms/module-view.tsx"), "utf8");

  it("wires /helpdesk to the bespoke page", () => {
    expect(source).toContain("export function HelpdeskPage");
    expect(moduleView).toContain("helpdesk: HelpdeskPage");
  });

  it("uses governed ticket endpoints with audited actions", () => {
    for (const path of [
      "/api/v1/operations/tickets",
      "/history?pageSize=100",
      "/api/v1/people?search=&page=1&pageSize=100",
    ]) {
      expect(source).toContain(path);
    }
    for (const action of ["assign", "reply", "resolve", "close", "reopen"]) {
      expect(source).toContain(`"${action}"`);
    }
    expect(source).toContain("Idempotency-Key");
    expect(source).toContain("If-Match");
  });

  it("derives overdue client-side without inventing server state", () => {
    expect(source).toContain("Overdue");
    expect(source).toContain("dueDate");
    expect(source).not.toMatch(/Math\.random|sample|demo/i);
  });

  it("covers loading, error, empty and grievance states", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
    expect(source).toContain("No tickets in this view");
    expect(source).toContain("grievance");
  });
});
