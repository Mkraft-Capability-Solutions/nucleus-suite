import { describe, expect, it } from "vitest";
import {
  canSeeCompensation,
  createDepartmentSchema,
  createDocumentSchema,
  createPersonSchema,
  createPositionSchema,
  freezePositionSchema,
  importPreviewSchema,
  MAX_DOCUMENT_BYTES,
  projectEmployee,
  type EmployeeRow,
} from "@/server/organization/service";

const ROW: EmployeeRow = {
  id: "e1",
  employee_code: "HO-0001",
  first_name: "Aditi",
  last_name: "Sharma",
  work_email: "aditi@example.test",
  designation: "HR Admin",
  department: "People",
  location: "Head Office",
  category: "regular",
  status: "active",
  joining_date: "2024-01-15",
  basic_salary_minor: 5_000_000,
  currency: "INR",
  version: 3,
};

describe("employee field projection (OC-P2-03)", () => {
  it("reveals salary with the independent permission", () => {
    expect(projectEmployee(ROW, true)).toMatchObject({ basic_salary_minor: 5_000_000, salaryMasked: false });
  });

  it("masks salary without the permission while keeping identity fields", () => {
    const view = projectEmployee(ROW, false);
    expect(view.basic_salary_minor).toBeNull();
    expect(view.salaryMasked).toBe(true);
    expect(view.employee_code).toBe("HO-0001");
    expect(view.designation).toBe("HR Admin");
  });

  it("never mutates the source row when masking", () => {
    const source = { ...ROW };
    projectEmployee(source, false);
    expect(source.basic_salary_minor).toBe(5_000_000);
  });

  it("denies Plant time-office the compensation projection", () => {
    const plant = { context: { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: ["employee.read", "attendance.manage"], roles: ["plant_time_office"] }, tenantId: "t" };
    expect(canSeeCompensation(plant)).toBe(false);
  });

  it("grants HR Admin with the rate permission the compensation projection", () => {
    const admin = { context: { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: ["employee.read", "payroll.rate.read"], roles: ["hr_admin"] }, tenantId: "t" };
    expect(canSeeCompensation(admin)).toBe(true);
  });
});

describe("document and import schemas (OC-P2-01/02)", () => {
  it("bounds uploads at 10 MiB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10_485_760);
  });

  it("validates document payloads strictly", () => {
    const valid = { documentTypeId: "123e4567-e89b-12d3-a456-426614174000", documentClass: "pan", title: "PAN card", mimeType: "application/pdf", contentBase64: "aGk=" };
    expect(createDocumentSchema.safeParse(valid).success).toBe(true);
    expect(createDocumentSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(createDocumentSchema.safeParse({ ...valid, documentTypeId: "nope" }).success).toBe(false);
    // The workbook makes the document class mandatory and takes it from PL_DOCUMENT_CLASS.
    expect(createDocumentSchema.safeParse({ ...valid, documentClass: undefined }).success).toBe(false);
    expect(createDocumentSchema.safeParse({ ...valid, documentClass: "tax_return" }).success).toBe(false);
    expect(createDocumentSchema.safeParse({ ...valid, documentNumber: "ABCDE1234F", issuedOn: "2020-06-01" }).success).toBe(true);
    expect(createDocumentSchema.safeParse({ ...valid, issuedOn: "not-a-date" }).success).toBe(false);
  });

  it("validates import previews row by row within 1..500 rows", () => {
    const row = { employeeCode: "HO-0002", firstName: "Rohan", lastName: "Verma", department: "Finance" };
    expect(importPreviewSchema.safeParse({ rows: [row] }).success).toBe(true);
    expect(importPreviewSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(importPreviewSchema.safeParse({ rows: [{ ...row, workEmail: "bad" }] }).success).toBe(false);
  });
});

describe("creation schemas (command-centre forms)", () => {
  it("validates single-person creation with defaults", () => {
    const parsed = createPersonSchema.safeParse({ firstName: "Asha", lastName: "Nair" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.designation).toBe("Associate");
      expect(parsed.data.department).toBe("General");
    }
    expect(createPersonSchema.safeParse({ firstName: "", lastName: "Nair" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ firstName: "Asha", lastName: "Nair", joiningDate: "10-09-2026" }).success).toBe(false);
  });

  it("rejects negative basic salary while accepting zero and positive minor units", () => {
    const person = { firstName: "Asha", lastName: "Nair" };
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: -1 }).success).toBe(false);
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: 0 }).success).toBe(true);
    expect(createPersonSchema.safeParse({ ...person, basicSalaryMinor: 4_500_000 }).success).toBe(true);
  });

  it("validates department creation", () => {
    expect(createDepartmentSchema.safeParse({ name: "Weaving" }).success).toBe(true);
    expect(createDepartmentSchema.safeParse({ name: "", businessUnitId: "nope" }).success).toBe(false);
  });

  it("validates position creation against the position master field set", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const valid = {
      name: "Weaving Operator",
      departmentId: uuid,
      locationId: uuid,
      costCenterId: uuid,
      workerClass: "workman_permanent",
      fte: 1,
      availableFrom: "2026-04-01",
      effectiveFrom: "2026-04-01",
    };
    expect(createPositionSchema.safeParse(valid).success).toBe(true);
    expect(createPositionSchema.safeParse({ name: "X" }).success).toBe(false);
    // Location, cost centre and worker class are mandatory in the workbook.
    expect(createPositionSchema.safeParse({ ...valid, locationId: undefined }).success).toBe(false);
    expect(createPositionSchema.safeParse({ ...valid, costCenterId: undefined }).success).toBe(false);
    expect(createPositionSchema.safeParse({ ...valid, workerClass: "not_a_class" }).success).toBe(false);
    // A part-time post prorates the sanction, but never below a quarter of a head.
    expect(createPositionSchema.safeParse({ ...valid, fte: 0.25 }).success).toBe(true);
    expect(createPositionSchema.safeParse({ ...valid, fte: 0.2 }).success).toBe(false);
    expect(createPositionSchema.safeParse({ ...valid, fte: 1.5 }).success).toBe(false);
    expect(createPositionSchema.safeParse({ ...valid, budgetCostMinor: -1 }).success).toBe(false);
    expect(createPositionSchema.safeParse({ ...valid, budgetCostMinor: 125_000_000 }).success).toBe(true);
  });

  it("holds a freeze reason to the workbook minimum of ten characters", () => {
    expect(freezePositionSchema.safeParse({ reason: "Budget" }).success).toBe(false);
    expect(freezePositionSchema.safeParse({ reason: "Budget cut for FY27" }).success).toBe(true);
  });
});
