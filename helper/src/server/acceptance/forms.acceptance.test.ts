import { afterAll, describe, expect, it } from "vitest";

import { createLegalEntity, legalEntitySchema, listLegalEntities, updateLegalEntity } from "@/server/organization/legal-entities";
import { createLocation, getLocation, listLocationLookups, updateLocation } from "@/server/organization/locations";
import { createPayComponent, getPayComponent, payComponentSchema } from "@/server/payroll/components-master";
import { listGlAccounts } from "@/server/payroll/gl";
import { accessFor, db, LIVE, tenantId } from "./fixture";

/**
 * The five forms built to close the workbook's remaining gaps, exercised against the live
 * tenant: created, read back, and edited. A form that only validates is not implemented —
 * these assert the round trip, because that is where the defects were (a create path with
 * no read-back, a NOT NULL column the form never supplied, a column migration 0023 added
 * that was journalled without ever running).
 *
 * Run with MKRAFT_LIVE_VERIFY=1 after `npx tsx scripts/seed-acceptance-demo.ts`.
 */

const rid = () => crypto.randomUUID();
const CODE = "ACCF";

const createdLocationIds: string[] = [];
const createdComponentIds: string[] = [];

/** A valid fixed-amount component, so each rule can be broken one at a time. */
function basePayComponent(debitId: string, creditId: string) {
  return {
    code: "accbase", name: "Acceptance base", payslipLabel: "Acceptance base", kind: "earning",
    calculationMethod: "fixed_amount", percentageOf: null, percentValue: null, formulaExpression: null,
    slabTableRef: null, rounding: "nearest_rupee", proratedOnAttendance: true, prorationBasis: "calendar_days",
    partOfPfWage: false, partOfEsiWage: true, partOfGratuityWage: false, partOfBonusWage: false,
    countsTowardWageFloor: true, taxable: true, exemptionSection: "not_exempt", exemptionLimitMinor: null,
    isPerquisite: false, glDebitAccountId: debitId, glCreditAccountId: creditId,
    glDimensions: ["cost_center"], printOnPayslipWhenZero: false, payslipSequence: 900,
    effectiveFrom: "2024-04-01", status: "active",
  };
}

describe.skipIf(!LIVE)("form round trips — live (opt-in)", () => {
  afterAll(async () => {
    const tenant = await tenantId();
    if (createdComponentIds.length > 0) {
      await db()`delete from pay_components where tenant_id = ${tenant} and id = any(${createdComponentIds}::uuid[])`;
    }
    if (createdLocationIds.length > 0) {
      await db()`delete from locations where tenant_id = ${tenant} and id = any(${createdLocationIds}::uuid[])`;
    }
    await db()`delete from legal_entities where tenant_id = ${tenant} and code like ${`${CODE}%`}`;
  }, 60_000);

  it("FRM-PLT-01 Legal Entity Master: every field survives create, read back and edit", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const entityCode = `${CODE}${Date.now().toString().slice(-4)}`;
    const created = await createLegalEntity(owner, {
      entityCode,
      registeredName: "Acceptance Forms Manufacturing Private Limited",
      tradeName: "Acceptance Forms",
      entityType: "private_limited",
      cinLlpin: "U29299MH2011PTC223089",
      entityPan: "AAACA1234F",
      tan: "MUMA12345E",
      gstin: "27AAACA1234F1Z5",
      pfCode: "MH/BAN/0012345/000",
      esiCode: "12345678901234567",
      ptRegNo: "PT-ACC-01",
      lwfRegNo: "LWF-ACC-01",
      establishmentLicence: "FAC/ACC/001",
      establishmentType: "factory",
      registeredAddress: { line1: "Plot 14, MIDC", line2: "Phase II", city: "Pune", state: "maharashtra", pin: "411019" },
      commAddress: null,
      fyStartMonth: "april",
      currencyCode: "inr",
      signatoryName: "Rohit Bhatia",
      signatoryDesignation: "Director",
      entityStatus: "active",
      effectiveFrom: "2024-04-01",
    }, rid());
    expect(created.id).toBeTruthy();

    // Read back: the statutory identifiers and both fiscal settings must come back as saved,
    // not merely have been accepted.
    const listed = await listLegalEntities(owner);
    const row = listed.find((entry) => entry.code === entityCode);
    expect(row, "the created entity must appear in the register").toBeTruthy();
    expect(row!.legal_name).toBe("Acceptance Forms Manufacturing Private Limited");
    expect(row!.attributes.cin_llpin).toBe("U29299MH2011PTC223089");
    expect(row!.attributes.entity_pan).toBe("AAACA1234F");
    expect(row!.attributes.tan).toBe("MUMA12345E");
    expect(row!.attributes.gstin).toBe("27AAACA1234F1Z5");
    expect(row!.attributes.pf_code).toBe("MH/BAN/0012345/000");
    expect(row!.attributes.esi_code).toBe("12345678901234567");
    expect(row!.attributes.establishment_type).toBe("factory");
    expect(row!.attributes.fy_start_month).toBe("april");
    expect(row!.attributes.signatory_name).toBe("Rohit Bhatia");
    expect(row!.attributes.registered_address).toMatchObject({ city: "Pune", state: "maharashtra", pin: "411019" });
    // Absent communication address means "same as registered", stored as null rather than
    // silently duplicated.
    expect(row!.attributes.comm_address).toBeNull();

    // Edit: one field changes, everything else is preserved by the merge.
    const edited = await updateLegalEntity(owner, row!.id, { signatoryDesignation: "Managing Director" }, rid());
    expect(edited.code).toBe(entityCode);
    const after = (await listLegalEntities(owner)).find((entry) => entry.code === entityCode);
    expect(after!.attributes.signatory_designation).toBe("Managing Director");
    expect(after!.attributes.cin_llpin, "an edit must not drop the fields it did not touch").toBe("U29299MH2011PTC223089");
    expect(after!.attributes.registered_address).toMatchObject({ city: "Pune" });
  });

  it("FRM-PLT-01 refuses a GSTIN whose state code contradicts the registered address", () => {
    // The rule lives on the schema, which is what the route parses with before the service
    // is ever called; the service takes an already-validated input. Asserting it here tests
    // the guard where it actually is rather than implying the service re-checks.
    const base = {
      entityCode: "ACCFX",
      registeredName: "Acceptance Forms Mismatch Private Limited",
      entityType: "private_limited",
      cinLlpin: "U29299MH2011PTC223089",
      entityPan: "AAACA1234F",
      tan: "MUMA12345E",
      establishmentType: "factory",
      registeredAddress: { line1: "Plot 14, MIDC", city: "Pune", state: "maharashtra", pin: "411019" },
      fyStartMonth: "april",
      currencyCode: "inr",
      signatoryName: "Rohit Bhatia",
      signatoryDesignation: "Director",
      entityStatus: "active",
    };
    // 27 is Maharashtra and matches the registered address; 29 is Karnataka and does not.
    expect(legalEntitySchema.safeParse({ ...base, gstin: "27AAACA1234F1Z5" }).success).toBe(true);
    const mismatch = legalEntitySchema.safeParse({ ...base, gstin: "29AAACA1234F1Z5" });
    expect(mismatch.success).toBe(false);
    expect(mismatch.success === false && mismatch.error.issues.some((issue) => issue.path[0] === "gstin")).toBe(true);
    // A PAN whose fourth character is not an entity class is refused too.
    expect(legalEntitySchema.safeParse({ ...base, entityPan: "AAAPA1234F" }).success).toBe(false);
  });

  it("FRM-PLT-02 Location Master: created, read back and edited without losing untouched fields", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const tenant = await tenantId();
    const lookups = await listLocationLookups(owner);
    const entity = (await listLegalEntities(owner))[0];
    const calendar = lookups.calendars[0];
    // The form's own lookup supplies the shift group: a location may only name a group an
    // active shift belongs to, which is what makes shift inference resolvable there.
    const shiftGroup = lookups.shiftGroups[0];
    if (!entity || !calendar || !shiftGroup) {
      throw new Error("Acceptance precondition: FRM-PLT-02 needs a legal entity, a work calendar and an active shift group.");
    }
    const code = `AL${Date.now().toString().slice(-6)}`;
    const created = await createLocation(owner, {
      locationCode: code,
      locationName: "Acceptance Location Master",
      legalEntityId: entity.id,
      locationType: "plant",
      parentLocationId: null,
      address: { line1: "Survey 42", line2: "Industrial Area", city: "Bengaluru", pin: "560058" },
      stateCode: "karnataka",
      district: "Bengaluru Rural",
      calendarId: calendar.id,
      shiftGroup,
      weekStartDay: "monday",
      geofencePoint: { lat: 13.0358, lng: 77.5052 },
      geofenceRadiusM: 250,
      timeZone: "Asia/Kolkata",
      lwfApplicable: true,
      esiCovered: true,
      factoryLicenceNo: "KA/FAC/9912",
      status: "active",
      effectiveFrom: "2024-04-01",
    }, rid());
    createdLocationIds.push(created.id);

    const stored = await getLocation(owner, created.id);
    expect(stored.code).toBe(code);
    expect(stored.district).toBe("Bengaluru Rural");
    expect(stored.shift_group).toBe(shiftGroup);
    expect(stored.geofence_radius_m).toBe(250);
    expect(Number(stored.geofence_lat)).toBeCloseTo(13.0358, 4);
    expect(Number(stored.geofence_lng)).toBeCloseTo(77.5052, 4);
    expect(stored.lwf_applicable).toBe(true);
    expect(stored.esi_covered).toBe(true);
    expect(stored.factory_licence_no).toBe("KA/FAC/9912");
    expect(stored.city).toBe("Bengaluru");
    expect(stored.pin).toBe("560058");
    expect(stored.week_start_day).toBe("monday");
    expect(stored.time_zone).toBe("Asia/Kolkata");
    // PT state is not asked for on the form; it follows the address state unless overridden.
    expect(stored.pt_state).toBe("karnataka");

    const edited = await updateLocation(owner, created.id, stored.version, { geofenceRadiusM: 400 }, rid());
    expect(edited.id).toBe(created.id);
    const after = await getLocation(owner, created.id);
    expect(after.geofence_radius_m).toBe(400);
    expect(after.district, "an edit must not drop the fields it did not touch").toBe("Bengaluru Rural");
    expect(Number(after.geofence_lat)).toBeCloseTo(13.0358, 4);

    // A stale version must not silently overwrite a concurrent edit.
    await expect(updateLocation(owner, created.id, stored.version, { district: "Stale" }, rid()))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    void tenant;
  });

  it("FRM-PAY-01 Pay Component Master: a percentage component round trips and its rules hold", { timeout: 120_000 }, async () => {
    const owner = await accessFor("owner");
    const accounts = await listGlAccounts(owner, {});
    const debit = accounts.find((row) => row.status === "active");
    const credit = accounts.find((row) => row.status === "active" && row.id !== debit?.id);
    if (!debit || !credit) {
      throw new Error("Acceptance precondition: FRM-PAY-01 needs two active GL accounts in the chart of accounts.");
    }
    const code = `acc_hra_${Date.now().toString().slice(-4)}`.slice(0, 15);
    const created = await createPayComponent(owner, {
      code,
      name: "Acceptance HRA",
      payslipLabel: "Acceptance HRA",
      kind: "earning",
      calculationMethod: "percentage_of_component",
      percentageOf: "basic",
      percentValue: 40,
      formulaExpression: null,
      slabTableRef: null,
      rounding: "nearest_rupee",
      proratedOnAttendance: true,
      prorationBasis: "calendar_days",
      partOfPfWage: false,
      partOfEsiWage: true,
      partOfGratuityWage: false,
      partOfBonusWage: false,
      countsTowardWageFloor: true,
      taxable: true,
      exemptionSection: "not_exempt",
      exemptionLimitMinor: null,
      isPerquisite: false,
      glDebitAccountId: debit.id,
      glCreditAccountId: credit.id,
      glDimensions: ["cost_center"],
      printOnPayslipWhenZero: false,
      payslipSequence: 210,
      effectiveFrom: "2024-04-01",
      status: "active",
    } as Parameters<typeof createPayComponent>[1], rid());
    createdComponentIds.push(created.id);

    const stored = await getPayComponent(owner, created.id);
    expect(stored.code).toBe(code);
    expect(stored.calculationMethod).toBe("percentage_of_component");
    expect(stored.percentageOf).toBe("basic");
    expect(stored.percentValue).toBe(40);
    expect(stored.payslipSequence).toBe(210);
    expect(stored.glDebitAccountId).toBe(debit.id);
    expect(stored.glCreditAccountId).toBe(credit.id);

    // A component cannot be a percentage of itself, and a percentage component must say
    // both what of and how much.
    expect(payComponentSchema.safeParse({ ...basePayComponent(debit.id, credit.id), code: "selfref", calculationMethod: "percentage_of_component", percentageOf: "selfref", percentValue: 10 }).success).toBe(false);
    expect(payComponentSchema.safeParse({ ...basePayComponent(debit.id, credit.id), code: "nopct", calculationMethod: "percentage_of_component", percentageOf: "basic", percentValue: null }).success).toBe(false);
    expect(payComponentSchema.safeParse({ ...basePayComponent(debit.id, credit.id), code: "noformula", calculationMethod: "formula", formulaExpression: null }).success).toBe(false);
  });
});
