import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateFormFields } from "@/hooks/useFormValidation";
import { normaliseUiMode, redesignedModuleForTab, REDESIGNED_MODULES, usesRedesign } from "@/lib/ui-mode";
import { ALL_FORM_RULES, emptyEmployeeValues, FORM_SECTIONS } from "./form/fields";
import { buildPersonPayload, filledRows, suggestEmployeeCode, valuesFromRecord } from "./form/person-payload";

describe("interface mode", () => {
  it("defaults to classic and accepts only the two modes", () => {
    expect(normaliseUiMode(null)).toBe("classic");
    expect(normaliseUiMode("REDESIGNED")).toBe("classic");
    expect(normaliseUiMode("redesigned")).toBe("redesigned");
  });

  it("uses a redesign only in Redesigned mode and only for completed modules", () => {
    expect(usesRedesign("classic", "core_hr")).toBe(false);
    expect(usesRedesign("redesigned", "core_hr")).toBe(REDESIGNED_MODULES.core_hr!.status === "completed");
    expect(usesRedesign("redesigned", "payroll")).toBe(false);
    expect(redesignedModuleForTab("people_core")).toBe("core_hr");
    expect(redesignedModuleForTab("payroll")).toBeNull();
  });

  // docs/ is git-ignored in this repository, so the tracker exists only where it was written.
  const trackerPath = join(process.cwd(), "docs", "redesign", "MODULE_TRACKER.md");
  it.skipIf(!existsSync(trackerPath))("keeps the module tracker document in step with the code", () => {
    const tracker = readFileSync(trackerPath, "utf8");
    for (const [key, module] of Object.entries(REDESIGNED_MODULES)) {
      const label = { completed: "Completed", under_testing: "Under Testing", in_progress: "In Progress", not_started: "Not Started" }[module.status];
      expect(tracker, `${key} must be listed as ${label}`).toMatch(new RegExp(`\`${key}\`[^\\n]*\\| ${label} \\|`));
    }
  });
});

describe("employee form", () => {
  it("asks for the same required fields as the classic wizard", () => {
    const errors = validateFormFields(emptyEmployeeValues("2026-01-01"), ALL_FORM_RULES);
    expect(Object.keys(errors).sort()).toEqual([
      "bankName", "dateOfBirth", "department", "designation", "emergencyName", "emergencyPhone", "employeeCode", "firstName",
      "gender", "ifsc", "lastName", "location", "manager", "mobile", "personalEmail", "presentAddr1", "presentCity", "presentPin",
      "presentState", "accountConfirm", "accountToken", "workerClass",
    ].sort());
  });

  it("checks formats and the confirmed account number", () => {
    const errors = validateFormFields({ ...emptyEmployeeValues("2026-01-01"), mobile: "12345", panToken: "abc", accountToken: "123456789", accountConfirm: "123456780" }, ALL_FORM_RULES);
    expect(errors.mobile).toMatch(/10-digit/);
    expect(errors.panToken).toMatch(/PAN/);
    expect(errors.accountConfirm).toBeDefined();
  });

  it("gives every field a section and every key once", () => {
    const keys = FORM_SECTIONS.flatMap((section) => section.fields.map((field) => field.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const rule of ALL_FORM_RULES) expect(keys, rule.key).toContain(rule.key);
  });

  it("does not invent values: a new record starts without bank, email or job details", () => {
    const values = emptyEmployeeValues("2026-01-01");
    expect(values.bankName).toBe("");
    expect(values.ifsc).toBe("");
    expect(values.officialEmail).toBe("");
    expect(values.designation).toBe("");
  });
});

describe("person payload", () => {
  const values = {
    ...emptyEmployeeValues("2026-01-01"),
    employeeCode: "EMP-10002", firstName: " Asha ", lastName: "Rao", officialEmail: "", designation: "Engineer", department: "Plant",
    location: "Pune", joiningDate: "2026-01-01", aadhaarToken: "123456789012", ifsc: "hdfc0000123", accountToken: "123456789", accountConfirm: "123456789",
    education: [{ level: "Graduate", degree: "BE", institute: "", passingYear: "2020", score: "" }, { level: "", degree: "", institute: "", passingYear: "", score: "" }],
  };

  it("maps the form to the API fields without invented fallbacks", () => {
    const payload = buildPersonPayload(values, { id: "8c2a6d35-6a2c-4b13-9a37-0c5d2f2bb0d1", name: "Meera Iyer" });
    expect(payload).toMatchObject({
      employeeCode: "EMP-10002", firstName: "Asha", lastName: "Rao", designation: "Engineer", aadhaarLast4: "9012",
      bankIfsc: "HDFC0000123", managerEmployeeId: "8c2a6d35-6a2c-4b13-9a37-0c5d2f2bb0d1", manager: "Meera Iyer",
    });
    expect(payload.workEmail).toBeUndefined();
    expect(payload.accountConfirm).toBeUndefined();
    expect(payload.education).toEqual([expect.objectContaining({ degree: "BE", isHighest: true, yearOfPassing: "2020" })]);
    expect(Object.values(payload)).not.toContain("");
  });

  it("drops empty rows from repeating groups", () => {
    expect(filledRows([{ name: "", insured: true }, { name: "Kiran", insured: true }])).toEqual([{ name: "Kiran", insured: true }]);
  });

  it("suggests the next employee code in the series", () => {
    expect(suggestEmployeeCode([])).toBe("EMP-10001");
    expect(suggestEmployeeCode(["EMP-10001", "EMP-10007", "CAREER-001"])).toBe("EMP-10008");
  });

  it("reads an existing record back into the form", () => {
    const form = valuesFromRecord({
      employeeCode: "EMP-1", firstName: "A", lastName: "B", workEmail: "a@x.in", designation: "D", department: "P", location: "L", status: "active",
      joiningDate: "2024-01-15", metadata: { mobile: "9876543210", bankAccountNo: "1234567890", unknownKey: "x" },
    }, emptyEmployeeValues("2026-01-01"));
    expect(form).toMatchObject({ officialEmail: "a@x.in", mobile: "9876543210", accountToken: "1234567890", accountConfirm: "1234567890", status: "Active" });
    expect(form).not.toHaveProperty("unknownKey");
  });
});
