import { describe, expect, it } from "vitest";
import { isAadhaarChecksumValid, isIndividualPan } from "@/lib/statutory-ids";
import { createPersonSchema } from "./service";
import { derivedFullName, personProfileMetadata } from "./person-profile";
import { updateEmployeeSchema } from "./employee-update";

const BASE = { firstName: "Asha", lastName: "Nair" };

describe("createPersonSchema (FRM-PPL-01)", () => {
  it("still accepts the minimum the create form has always sent", () => {
    expect(createPersonSchema.safeParse(BASE).success).toBe(true);
  });

  it("limits a first name to letters, spaces, dot, apostrophe and hyphen", () => {
    expect(createPersonSchema.safeParse({ ...BASE, firstName: "Mary-Anne" }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, firstName: "D'Souza" }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, firstName: "Asha2" }).success).toBe(false);
  });

  it("takes every identity vocabulary from the workbook", () => {
    expect(createPersonSchema.safeParse({ ...BASE, gender: "prefer_not_to_say", bloodGroup: "not_known" }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, gender: "unspecified" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, socialCategory: "obc", religion: "not_disclosed" }).success).toBe(true);
  });

  it("requires the marriage block once marital status is married", () => {
    expect(createPersonSchema.safeParse({ ...BASE, maritalStatus: "married" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, maritalStatus: "married", marriageDate: "2020-02-14", spouseName: "R Nair" }).success).toBe(true);
  });

  it("refuses a marriage date less than eighteen years after the date of birth", () => {
    const married = { ...BASE, maritalStatus: "married", spouseName: "R Nair", dateOfBirth: "2004-05-01" };
    expect(createPersonSchema.safeParse({ ...married, marriageDate: "2021-06-01" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...married, marriageDate: "2023-06-01" }).success).toBe(true);
  });

  it("requires the disability block only when the person is differently abled", () => {
    expect(createPersonSchema.safeParse({ ...BASE, isDifferentlyAbled: true }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, isDifferentlyAbled: true, disabilityType: "locomotor", disabilityPercent: 45 }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, isDifferentlyAbled: true, disabilityType: "locomotor", disabilityPercent: 0 }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, isDifferentlyAbled: false }).success).toBe(true);
  });

  it("flags exactly one highest qualification", () => {
    const row = { level: "graduate", degree: "B.E.", institute: "VTU", yearOfPassing: 2015 };
    expect(createPersonSchema.safeParse({ ...BASE, education: [{ ...row, isHighest: true }] }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, education: [{ ...row, isHighest: false }] }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, education: [{ ...row, isHighest: true }, { ...row, isHighest: true }] }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, education: [{ ...row, yearOfPassing: 1949, isHighest: true }] }).success).toBe(false);
  });

  it("keeps a previous-employment period in order", () => {
    const stint = { employer: "Prior Ltd", designation: "Operator", fromDate: "2018-01-01", toDate: "2020-12-31" };
    expect(createPersonSchema.safeParse({ ...BASE, experience: [stint] }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...BASE, experience: [{ ...stint, toDate: "2017-01-01" }] }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...BASE, experience: [{ ...stint, previousUan: "12345" }] }).success).toBe(false);
  });
});

describe("updateEmployeeSchema (FRM-PPL-01 control)", () => {
  it("holds the change reason to ten characters", () => {
    expect(updateEmployeeSchema.safeParse({ designation: "Fitter", reason: "typo" }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ designation: "Fitter", reason: "Promotion approved" }).success).toBe(true);
  });

  it("edits the personal block through the same envelope", () => {
    expect(updateEmployeeSchema.safeParse({ bloodGroup: "o_positive", reason: "Corrected from the medical card" }).success).toBe(true);
  });
});

describe("derived identity values", () => {
  it("builds the full name from the parts and copies it to the bank name", () => {
    expect(derivedFullName({ firstName: "Asha", middleName: "R", lastName: "Nair" })).toBe("Asha R Nair");
    expect(derivedFullName({ firstName: "Asha", lastName: "Nair" })).toBe("Asha Nair");
    const metadata = personProfileMetadata({ middleName: "R" }, { firstName: "Asha", lastName: "Nair" });
    expect(metadata.fullName).toBe("Asha R Nair");
    expect(metadata.nameAsPerBank).toBe("Asha R Nair");
  });

  it("keeps a bank name the user supplied", () => {
    const metadata = personProfileMetadata({ nameAsPerBank: "A R NAIR" }, { firstName: "Asha", lastName: "Nair" });
    expect(metadata.nameAsPerBank).toBe("A R NAIR");
  });
});

describe("statutory identifier formats (FRM-PPL-01)", () => {
  it("checks the Aadhaar Verhoeff digit, not just the length", () => {
    // 234123412346 is the documented Verhoeff example for 23412341234.
    expect(isAadhaarChecksumValid("234123412346")).toBe(true);
    expect(isAadhaarChecksumValid("234123412347")).toBe(false);
    expect(isAadhaarChecksumValid("23412341234")).toBe(false);
    expect(isAadhaarChecksumValid("abcdefghijkl")).toBe(false);
  });

  it("accepts only a personal PAN", () => {
    expect(isIndividualPan("ABCPE1234F")).toBe(true);
    // The fourth character C is a company, not an individual.
    expect(isIndividualPan("ABCCE1234F")).toBe(false);
    expect(isIndividualPan("ABCPE1234")).toBe(false);
  });
});
