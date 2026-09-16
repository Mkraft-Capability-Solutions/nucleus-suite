import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dossierResources } from "./dossier-catalog";
import { picklists } from "./picklists";
import type { Field } from "./workflow-catalog";
import { validator } from "@/server/workflows/operational-validation";

function fieldOf(resource: keyof typeof dossierResources, name: string): Field {
  const field = dossierResources[resource].fields.find((entry) => entry.name === name);
  if (!field) throw new Error(`${resource} has no field ${name}`);
  return field;
}

function schemaOf(resource: keyof typeof dossierResources) {
  return z.object(Object.fromEntries(dossierResources[resource].fields.map((field) => [field.name!, validator(field)]))).strict();
}

describe("dossier catalog vocabularies", () => {
  it("builds every choice from the picklist registry rather than a retyped list", () => {
    for (const resource of Object.values(dossierResources)) {
      for (const field of resource.fields) {
        if (!field.picklist) continue;
        expect(field.options ?? field.item?.options).toEqual(picklists[field.picklist].values.map((entry) => entry.value));
      }
    }
  });

  it("carries the workbook's employment types, not a narrower set", () => {
    expect(fieldOf("employments", "contractType").picklist).toBe("PL_EMPLOYMENT_TYPE");
    expect(fieldOf("employments", "contractType").options).toContain("apprentice_naps_nats");
  });
});

describe("assignment field rules (FRM-PPL-02)", () => {
  const schema = schemaOf("assignments");
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const base = {
    employmentId: uuid,
    departmentId: uuid,
    positionId: uuid,
    locationId: uuid,
    effectiveFrom: "2026-04-01",
    changeType: "new_hire",
    attendanceModes: ["biometric_device"],
    reason: "New hire placement",
  };

  it("accepts the minimum the workbook makes mandatory", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("no longer forces a grade, because the workbook derives the band from the designation", () => {
    expect(fieldOf("assignments", "gradeId").optional).toBe(true);
  });

  it("takes at least one attendance capture mode", () => {
    expect(schema.safeParse({ ...base, attendanceModes: [] }).success).toBe(false);
    expect(schema.safeParse({ ...base, attendanceModes: ["kiosk", "whatsapp"] }).success).toBe(true);
    expect(schema.safeParse({ ...base, attendanceModes: ["carrier_pigeon"] }).success).toBe(false);
  });

  it("keeps the policy overrides on the workbook vocabularies and the notice within range", () => {
    expect(schema.safeParse({ ...base, overrideWageType: "piece_rate", overrideOtEligibility: "none" }).success).toBe(true);
    expect(schema.safeParse({ ...base, overrideWageType: "fortnightly" }).success).toBe(false);
    expect(schema.safeParse({ ...base, noticePeriodDays: 90 }).success).toBe(true);
    expect(schema.safeParse({ ...base, noticePeriodDays: 200 }).success).toBe(false);
    expect(schema.safeParse({ ...base, pfApplicable: true, esiApplicable: false }).success).toBe(true);
    expect(schema.safeParse({ ...base, pfApplicable: "yes" }).success).toBe(false);
  });

  it("rejects a change type outside PL_ASSIGNMENT_CHANGE", () => {
    expect(schema.safeParse({ ...base, changeType: "secondment" }).success).toBe(false);
  });
});

describe("employment field rules (FRM-PPL-02)", () => {
  const schema = schemaOf("employments");
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const base = {
    employeeId: uuid,
    legalEntityId: uuid,
    workerCategoryId: uuid,
    contractType: "permanent",
    effectiveFrom: "2026-04-01",
    contractReference: "MK/2026/0001",
  };

  it("bounds probation at the workbook's two years", () => {
    expect(schema.safeParse({ ...base, probationMonths: 0 }).success).toBe(true);
    expect(schema.safeParse({ ...base, probationMonths: 24 }).success).toBe(true);
    expect(schema.safeParse({ ...base, probationMonths: 25 }).success).toBe(false);
  });

  it("records a rehire and the record it continues", () => {
    expect(schema.safeParse({ ...base, isRehire: true, priorEmployeeCode: "MK-00042" }).success).toBe(true);
  });
});
