import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("VP readiness guided operations", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/hrms/vp-readiness-page.tsx"), "utf8");

  it("uses action-specific fields instead of exposing raw JSON", () => {
    expect(source).toContain("Guided operations");
    expect(source).toContain("activeCommand.fields.map");
    expect(source).not.toContain("<textarea");
    expect(source).not.toContain("Command payload");
  });

  it("validates required identifiers and preserves protected command submission", () => {
    expect(source).toContain("uuidPattern");
    expect(source).toContain("Complete the highlighted fields");
    expect(source).toContain("[aria-invalid=\"true\"]");
    expect(source).toContain('"Idempotency-Key": crypto.randomUUID()');
    expect(source).toContain("JSON.stringify(withoutBlankOptionals(payload))");
  });

  it("defines guided fields for every supported operation", () => {
    for (const action of ["save_rule_set", "grant_location", "evaluate_attendance", "run_leave_maintenance", "sync_erp_employee", "create_gl_posting", "ack_gl_posting", "generate_statutory_form", "record_feature", "approve_manpower", "controlled_requisition"]) {
      expect(source).toContain(`value: "${action}"`);
    }
  });
});
