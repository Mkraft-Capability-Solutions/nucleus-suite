import { describe, expect, it } from "vitest";
import { picklistValues } from "@/lib/picklists";
import {
  defaultOwnersForMode,
  ERP_MANDATORY_SYNC_FIELDS,
  ERP_SETTINGS_DEFAULTS,
  ERP_SYNC_FIELDS,
  erpMatchTarget,
  erpOwnedFields,
  erpOwnershipCoverage,
  ErpOwnershipError,
  erpSettingsSchema,
  planErpFieldWrites,
  type ErpFieldOwners,
} from "./erp-field-ownership";

/**
 * FRM-FIN-02 — the rules behind the ERP Integration and Field Ownership form,
 * and the Q-15 posture the inbound sync takes from it.
 */

const connectionId = "5d2c1a1e-9b7a-4c1c-8f4e-1b2c3d4e5f60";

const allErp = defaultOwnersForMode("erp_owns");

const complete = {
  connectionId,
  masterMode: "co_owned",
  erpSystem: "sap",
  syncFrequency: "daily",
  fieldOwners: { ...allErp, firstName: "nucleus", lastName: "nucleus" },
  conflictPolicy: "hold_for_review",
  matchKey: "employee_code",
  unmatchedAction: "hold",
} as const;

describe("erpSettingsSchema (the nine workbook fields)", () => {
  it("accepts a complete form and keeps the map one-owner-per-field", () => {
    const parsed = erpSettingsSchema.safeParse(complete);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.fieldOwners.firstName).toBe("nucleus");
  });

  it("draws every vocabulary from the picklist registry, never a retyped list", () => {
    for (const value of picklistValues("PL_MASTER_MODE")) expect(erpSettingsSchema.safeParse({ ...complete, masterMode: value }).success).toBe(true);
    for (const value of picklistValues("PL_ERP_SYSTEM")) expect(erpSettingsSchema.safeParse({ ...complete, erpSystem: value }).success).toBe(true);
    for (const value of picklistValues("PL_SYNC_FREQUENCY")) expect(erpSettingsSchema.safeParse({ ...complete, syncFrequency: value }).success).toBe(true);
    for (const value of picklistValues("PL_CONFLICT_POLICY")) expect(erpSettingsSchema.safeParse({ ...complete, conflictPolicy: value }).success).toBe(true);
    for (const value of picklistValues("PL_UNMATCHED_ACTION")) expect(erpSettingsSchema.safeParse({ ...complete, unmatchedAction: value }).success).toBe(true);
    expect(erpSettingsSchema.safeParse({ ...complete, erpSystem: "netsuite" }).success).toBe(false);
    expect(erpSettingsSchema.safeParse({ ...complete, fieldOwners: { ...allErp, department: "both" } }).success).toBe(false);
  });

  it("blocks the save while any mandatory field is unowned (the coverage panel)", () => {
    const { department: _dropped, ...owners } = complete.fieldOwners;
    void _dropped;
    const parsed = erpSettingsSchema.safeParse({ ...complete, fieldOwners: owners });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].message).toContain("Department");
  });

  it("lets an optional field stay unowned at save time", () => {
    const { workEmail: _dropped, ...owners } = complete.fieldOwners;
    void _dropped;
    expect(erpSettingsSchema.safeParse({ ...complete, fieldOwners: owners }).success).toBe(true);
  });

  it("carries the workbook's defaults and no default for the ERP system", () => {
    expect(ERP_SETTINGS_DEFAULTS).toEqual({ masterMode: "co_owned", syncFrequency: "daily", conflictPolicy: "hold_for_review", matchKey: "employee_code", unmatchedAction: "hold" });
    expect(erpSettingsSchema.safeParse({ ...complete, erpSystem: undefined }).success).toBe(false);
  });
});

describe("field catalogue and mode defaults", () => {
  it("lists the mandatory fields as the ones an employee row cannot exist without", () => {
    expect(ERP_MANDATORY_SYNC_FIELDS).toEqual(["firstName", "lastName", "department", "location", "designation", "joiningDate"]);
    for (const field of ERP_MANDATORY_SYNC_FIELDS) expect(ERP_SYNC_FIELDS).toContain(field);
  });

  it("pre-fills a single-owner mode and leaves co-owned to be chosen field by field", () => {
    expect(Object.values(defaultOwnersForMode("nucleus_owns"))).toEqual(ERP_SYNC_FIELDS.map(() => "nucleus"));
    expect(Object.values(defaultOwnersForMode("erp_owns"))).toEqual(ERP_SYNC_FIELDS.map(() => "erp"));
    expect(defaultOwnersForMode("co_owned")).toEqual({});
    expect(erpOwnershipCoverage(defaultOwnersForMode("co_owned")).complete).toBe(false);
    expect(erpOwnedFields(complete.fieldOwners)).toEqual(["workEmail", "department", "location", "designation", "joiningDate", "basicSalaryMinor"]);
  });
});

describe("planErpFieldWrites (field_owner + conflict_policy on an inbound record)", () => {
  const owners: ErpFieldOwners = { ...allErp, firstName: "nucleus", designation: "nucleus" };
  const current = { firstName: "Anil", lastName: "Yadav", department: "Weaving", location: "PLANT-N", designation: "Weaving Operator", joiningDate: "2021-02-01", basicSalaryMinor: "1800000" };

  it("writes ERP-owned fields and leaves a Nucleus-owned field that agrees alone", () => {
    const plan = planErpFieldWrites({ owners, conflictPolicy: "owner_wins", incoming: { ...current, department: "Dyeing", basicSalaryMinor: 1800000 }, current });
    expect(plan.action).toBe("apply");
    expect(plan.writes).toEqual({ lastName: "Yadav", department: "Dyeing", location: "PLANT-N", joiningDate: "2021-02-01", basicSalaryMinor: 1800000 });
    expect(plan.writes).not.toHaveProperty("firstName");
    expect(plan.conflicts).toEqual([]);
  });

  it("owner_wins: keeps the Nucleus value and records the disagreement", () => {
    const plan = planErpFieldWrites({ owners, conflictPolicy: "owner_wins", incoming: { ...current, firstName: "Anil Kumar" }, current });
    expect(plan.action).toBe("apply");
    expect(plan.writes).not.toHaveProperty("firstName");
    expect(plan.conflicts).toEqual([{ field: "firstName", nucleusValue: "Anil", erpValue: "Anil Kumar", resolution: "nucleus_kept" }]);
  });

  it("hold_for_review: writes nothing at all and names the held fields for the monitor", () => {
    const plan = planErpFieldWrites({ owners, conflictPolicy: "hold_for_review", incoming: { ...current, firstName: "Anil Kumar", department: "Dyeing" }, current });
    expect(plan.action).toBe("hold");
    expect(plan.writes).toEqual({});
    if (plan.action === "hold") expect(plan.reason).toContain("First name");
    expect(plan.conflicts[0].resolution).toBe("held");
  });

  it("latest_wins: compares the two change times", () => {
    const newer = planErpFieldWrites({ owners, conflictPolicy: "latest_wins", incoming: { ...current, firstName: "Anil Kumar" }, current, erpChangedAt: "2026-09-10T10:00:00Z", nucleusChangedAt: "2026-09-01T10:00:00Z" });
    expect(newer.writes.firstName).toBe("Anil Kumar");
    expect(newer.conflicts[0].resolution).toBe("erp_applied");
    const older = planErpFieldWrites({ owners, conflictPolicy: "latest_wins", incoming: { ...current, firstName: "Anil Kumar" }, current, erpChangedAt: "2026-08-10T10:00:00Z", nucleusChangedAt: "2026-09-01T10:00:00Z" });
    expect(older.writes).not.toHaveProperty("firstName");
    expect(older.conflicts[0].resolution).toBe("nucleus_kept");
  });

  it("latest_wins: refuses to guess when the ERP sent no change time", () => {
    expect(() => planErpFieldWrites({ owners, conflictPolicy: "latest_wins", incoming: { ...current, firstName: "Anil Kumar" }, current, nucleusChangedAt: "2026-09-01T10:00:00Z" }))
      .toThrowError(expect.objectContaining({ code: "ERP_CHANGE_TIME_REQUIRED" }));
  });

  it("refuses a field the ERP sent that nobody owns, rather than overwriting it", () => {
    const { workEmail: _dropped, ...partial } = allErp;
    void _dropped;
    expect(() => planErpFieldWrites({ owners: partial, conflictPolicy: "owner_wins", incoming: { ...current, workEmail: "anil@example.test" }, current }))
      .toThrowError(ErpOwnershipError);
    // Not sending the unowned field is fine: nothing is asserted about it.
    expect(planErpFieldWrites({ owners: partial, conflictPolicy: "owner_wins", incoming: current, current }).action).toBe("apply");
  });

  it("compares a bigint column that Postgres returns as text with the ERP's number", () => {
    const plan = planErpFieldWrites({ owners: { ...allErp, basicSalaryMinor: "nucleus" }, conflictPolicy: "hold_for_review", incoming: { basicSalaryMinor: 1800000 }, current });
    expect(plan.action).toBe("apply");
    expect(plan.conflicts).toEqual([]);
  });
});

describe("erpMatchTarget (match_key)", () => {
  it("matches on the external code for employee_code and external_id", () => {
    expect(erpMatchTarget("employee_code", { externalCode: " ERP-001 " })).toEqual({ key: "employee_code", value: "ERP-001" });
    expect(erpMatchTarget("external_id", { externalCode: "ERP-001" })).toEqual({ key: "external_id", value: "ERP-001" });
  });

  it("matches on a lower-cased email, and reports a record that has none", () => {
    expect(erpMatchTarget("work_email", { externalCode: "ERP-001", workEmail: "Anil@Example.test" })).toEqual({ key: "work_email", value: "anil@example.test" });
    const missing = erpMatchTarget("work_email", { externalCode: "ERP-001" });
    expect(missing.value).toBeNull();
    if (missing.value === null) expect(missing.issue).toContain("work email");
  });
});
