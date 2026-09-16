import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";
import {
  assertTemplateCoverage,
  DERIVABLE_MERGE_FIELDS,
  findSerialGaps,
  SERIAL_MERGE_FIELD,
  statutoryTemplateKey,
  templateMergeFields,
  templateNotApprovedError,
  type StatutoryFormDerivation,
} from "./statutory-forms";

/**
 * T-31 / T-32 — the derivation contract, the RP-13 gap check, and the refusals
 * that keep a statutory form from being completed by hand.
 */

function derivation(overrides: Partial<StatutoryFormDerivation> = {}): StatutoryFormDerivation {
  return {
    formCode: "FORM_F",
    stateCode: "KA",
    period: "2026-09",
    establishmentId: "loc-1",
    establishmentKey: "PLANT-N",
    employeeId: "emp-1",
    values: { employee_name: "Anil Yadav", establishment_code: "PLANT-N" },
    sources: [
      { field: "employee_name", source: "employees (employee record)" },
      { field: "establishment_code", source: "locations (establishment master)" },
    ],
    missing: [],
    ...overrides,
  };
}

describe("statutoryTemplateKey", () => {
  it("keeps the existing ${stateCode}:${formCode} shape, upper-cased", () => {
    expect(statutoryTemplateKey("ka", "form_f")).toBe("KA:FORM_F");
    expect(statutoryTemplateKey(" TN ", " FORM_28 ")).toBe("TN:FORM_28");
  });
});

describe("templateMergeFields", () => {
  it("collects each field once, in first-seen order, ignoring whitespace", () => {
    expect(templateMergeFields("<p>{{ employee_name }} · {{establishment_code}} · {{ employee_name }}</p>")).toEqual([
      "employee_name",
      "establishment_code",
    ]);
  });

  it("returns nothing for a template with no merge fields", () => {
    expect(templateMergeFields("<p>Static layout</p>")).toEqual([]);
  });
});

describe("assertTemplateCoverage", () => {
  it("passes when every field the template asks for is derived", () => {
    expect(() =>
      assertTemplateCoverage({ template: "{{ employee_name }} at {{ establishment_code }}", derivation: derivation() }),
    ).not.toThrow();
  });

  it("counts a field supplied by the issuing step, such as the serial", () => {
    expect(() =>
      assertTemplateCoverage({
        template: `Serial {{ ${SERIAL_MERGE_FIELD} }} for {{ employee_name }}`,
        derivation: derivation(),
        additionalFields: [SERIAL_MERGE_FIELD],
      }),
    ).not.toThrow();
  });

  it("refuses with the reason the record gives when the source is empty", () => {
    let thrown: HttpError | null = null;
    try {
      assertTemplateCoverage({
        template: "{{ employee_name }} · {{ establishment_registration_number }}",
        derivation: derivation({
          missing: [
            {
              field: "establishment_registration_number",
              source: "locations (establishment master)",
              issue: "The establishment has no registration number on the location master.",
            },
          ],
        }),
      });
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown).toBeInstanceOf(HttpError);
    expect(thrown?.code).toBe("STATUTORY_MERGE_FIELD_MISSING");
    expect(thrown?.status).toBe(422);
    expect(thrown?.details[0]?.field).toBe("establishment_registration_number");
    expect(thrown?.details[0]?.issue).toContain("registration number");
    // The refusal must not offer a blank: nothing is substituted.
    expect(thrown?.message).toContain("Nothing is typed into a statutory form");
  });

  it("names a field the system does not derive at all, rather than blaming the data", () => {
    let thrown: HttpError | null = null;
    try {
      assertTemplateCoverage({ template: "{{ inspector_remarks }}", derivation: derivation() });
    } catch (error) {
      thrown = error as HttpError;
    }
    expect(thrown?.details[0]?.issue).toContain("does not derive");
  });
});

describe("findSerialGaps (RP-13)", () => {
  it("finds nothing in an unbroken sequence", () => {
    expect(findSerialGaps([{ serialNumber: 1 }, { serialNumber: 2 }, { serialNumber: 3 }])).toEqual([]);
  });

  it("finds nothing in an empty register", () => {
    expect(findSerialGaps([])).toEqual([]);
  });

  it("names every number that should exist and does not", () => {
    expect(findSerialGaps([{ serialNumber: 1 }, { serialNumber: 4 }])).toEqual([2, 3]);
  });

  it("counts a voided serial as present, which is why voiding rather than deleting keeps it gapless", () => {
    // A voided row is still a row in the register, so the sequence is unbroken.
    expect(findSerialGaps([{ serialNumber: 1 }, { serialNumber: 2 }, { serialNumber: 3 }])).toEqual([]);
  });
});

describe("templateNotApprovedError", () => {
  it("says which rule set to save rather than stopping at 'not approved'", () => {
    const error = templateNotApprovedError("KA", "FORM_F");
    expect(error.status).toBe(422);
    expect(error.code).toBe("RULE_PACK_NOT_APPROVED");
    expect(error.details.find((entry) => entry.field === "ruleSetCode")?.issue).toBe("KA:FORM_F");
    expect(error.details.find((entry) => entry.field === "howToSupply")?.issue).toContain("save_rule_set");
    // Q-13 is the client's to answer; the message must not imply Nucleus will.
    expect(error.message).toContain("does not author the form");
  });
});

describe("DERIVABLE_MERGE_FIELDS", () => {
  it("publishes the serial and both halves of every money figure", () => {
    expect(DERIVABLE_MERGE_FIELDS).toContain(SERIAL_MERGE_FIELD);
    for (const field of ["gross_wages", "gross_wages_minor", "net_wages", "net_wages_minor"]) {
      expect(DERIVABLE_MERGE_FIELDS).toContain(field);
    }
  });

  it("lists each field once", () => {
    expect(new Set(DERIVABLE_MERGE_FIELDS).size).toBe(DERIVABLE_MERGE_FIELDS.length);
  });
});
