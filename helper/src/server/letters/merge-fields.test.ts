import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MERGE_FIELD_KEYS,
  RECORD_MERGE_FIELD_KEYS,
  referencedMergeFields,
  renderTemplate,
  validateTemplateMergeFields,
  type MergeEmployee,
} from "./merge-fields";

const EMPLOYEE: MergeEmployee = {
  firstName: "Asha",
  lastName: "Rao",
  designation: "Spinning Operator",
  joiningDate: "2020-04-01",
  location: "Plant North",
  managerName: "R. Iyer",
  confirmationDate: "2020-10-01",
};

describe("the merge-field vocabulary is the client's own (R-22)", () => {
  it("covers every field the client's templates actually use", () => {
    const source = readFileSync(
      join(resolve(process.cwd()), "scripts/excel_data/32_letter_templates.json"),
      "utf8",
    );
    const rows = JSON.parse(source) as Array<Record<string, string | null>>;
    const used = new Set<string>();
    for (const row of rows) {
      for (const field of (row["Merge fields used"] ?? "").split(",")) {
        const key = field.trim();
        if (key !== "") used.add(key);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const key of used) expect(MERGE_FIELD_KEYS).toContain(key);
  });

  it("marks only what the employee record can actually answer as record-sourced", () => {
    expect([...RECORD_MERGE_FIELD_KEYS].sort()).toEqual(
      ["confirmation_date", "designation", "doj", "location", "name", "reporting_to"].sort(),
    );
    // A disciplinary history is not on the employee record and must never be derived.
    expect(RECORD_MERGE_FIELD_KEYS).not.toContain("prior_warnings");
    expect(RECORD_MERGE_FIELD_KEYS).not.toContain("ctc");
  });
});

describe("a bad merge field fails on save, not at issue (T-36)", () => {
  it("accepts a template built from the catalogue", () => {
    expect(validateTemplateMergeFields("Dear {{name}}, joining {{doj}} at {{location}}.")).toEqual([]);
    expect(validateTemplateMergeFields("No placeholders at all.")).toEqual([]);
    // Whitespace inside the braces is tolerated; the key is not guessed at.
    expect(validateTemplateMergeFields("Dear {{ name }}")).toEqual([]);
  });

  it("refuses a field the employee record cannot supply, naming it", () => {
    const issues = validateTemplateMergeFields("Dear {{name}}, your {{favourite_colour}} is noted.");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("favourite_colour");
    expect(issues[0]?.issue).toContain("not a merge field");
  });

  it("suggests the real field when the template misspells one", () => {
    const issues = validateTemplateMergeFields("{{Date Of Joining}} {{DOJ}}");
    expect(issues.map((issue) => issue.field)).toContain("DOJ");
    expect(issues.find((issue) => issue.field === "DOJ")?.issue).toContain("`doj`");
  });

  it("refuses an empty placeholder", () => {
    expect(validateTemplateMergeFields("Dear {{}}")[0]?.field).toBe("{{}}");
  });

  it("reports each distinct field once, in first-seen order", () => {
    expect(referencedMergeFields("{{name}} {{doj}} {{name}}")).toEqual(["name", "doj"]);
  });
});

describe("rendering a letter for one employee (T-36)", () => {
  it("fills record fields from the employee and manual fields from the issue", () => {
    const rendered = renderTemplate(
      "Dear {{name}}, {{designation}} since {{doj}} at {{location}}, reporting to {{reporting_to}}. Notice: {{notice_days}} days.",
      EMPLOYEE,
      { notice_days: "30" },
    );
    expect(rendered.unresolved).toEqual([]);
    expect(rendered.text).toBe(
      "Dear Asha Rao, Spinning Operator since 2020-04-01 at Plant North, reporting to R. Iyer. Notice: 30 days.",
    );
    // Every value that went into the text is captured, so the issue reproduces from it.
    expect(rendered.values).toMatchObject({ name: "Asha Rao", doj: "2020-04-01", notice_days: "30" });
  });

  it("leaves a hole reported rather than blank when a manual field is not supplied", () => {
    const rendered = renderTemplate("Incident on {{incident_date}}: {{incident}}.", EMPLOYEE, {});
    expect(rendered.unresolved.map((issue) => issue.field)).toEqual(["incident_date", "incident"]);
    // The placeholder is left intact, so nothing silently prints as an empty gap.
    expect(rendered.text).toContain("{{incident_date}}");
  });

  it("reports a blank record field instead of printing an empty name", () => {
    const rendered = renderTemplate("Dear {{name}}", { ...EMPLOYEE, firstName: null, lastName: null }, {});
    expect(rendered.unresolved).toHaveLength(1);
    expect(rendered.unresolved[0]?.issue).toContain("blank on this employee's record");
  });

  it("is a no-op over text that carries no placeholders, which is what a reprint reproduces", () => {
    const original = "Dear Asha Rao, Spinning Operator since 2020-04-01.";
    const rendered = renderTemplate(original, EMPLOYEE, {});
    expect(rendered.text).toBe(original);
    expect(rendered.unresolved).toEqual([]);
  });
});
