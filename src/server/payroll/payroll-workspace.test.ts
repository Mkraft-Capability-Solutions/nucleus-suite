import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (v: string) => v }));
vi.mock("@/server/identity/authorization", () => ({ authorize: () => ({ allowed: true }) }));

const { buildLoanRegister } = await import("@/server/payroll/loan-register");
const { advanceAllowanceFor } = await import("@/server/payroll/overview");
const { toWageRow } = await import("@/server/payroll/wage-register");

type LoanArg = Parameters<typeof buildLoanRegister>[0][number];
type GuarantorArg = Parameters<typeof buildLoanRegister>[1][number];
type WageArg = Parameters<typeof toWageRow>[0];

const loan = (over: Partial<LoanArg> = {}): LoanArg => ({
  id: "L1", employee_id: "E1", attributes: { status: "active", principal_minor: "1000000", outstanding_minor: 600000, instalment_minor: 50000, tenure_months: 20, purpose: "medical" },
  employee_code: "EMP001", first_name: "Asha", last_name: "Rao", department: "Ops", designation: "Lead", currency: "INR", recoveries: "8", ...over,
});
const guarantor = (over: Partial<GuarantorArg> = {}): GuarantorArg => ({
  employee_loan_id: "L1", guarantor_employee_id: "G1", sequence: 2, status: "approved", employee_code: "EMP002", first_name: "Ravi", last_name: null, ...over,
});

describe("buildLoanRegister", () => {
  it("maps attributes to minor-unit numbers and orders guarantors by sequence", () => {
    const { items } = buildLoanRegister([loan()], [guarantor(), guarantor({ guarantor_employee_id: "G0", sequence: 1, status: "pending" })]);
    expect(items[0]).toMatchObject({ borrowerName: "Asha Rao", principalMinor: 1000000, outstandingMinor: 600000, instalmentMinor: 50000, recoveredInstalments: 8, purpose: "medical" });
    expect(items[0].guarantors.map((g) => g.employeeId)).toEqual(["G0", "G1"]);
  });

  it("locks only approved guarantors on non-terminal loans", () => {
    const { locks } = buildLoanRegister(
      [loan(), loan({ id: "L2", attributes: { status: "repaid" } })],
      [guarantor(), guarantor({ guarantor_employee_id: "G3", status: "pending" }), guarantor({ employee_loan_id: "L2", guarantor_employee_id: "G4" })],
    );
    expect(locks).toEqual([expect.objectContaining({ guarantorEmployeeId: "G1", loanId: "L1", outstandingMinor: 600000, guarantorName: "Ravi" })]);
  });

  it("falls back for missing attributes, names and currency", () => {
    const { items } = buildLoanRegister([loan({ attributes: null, first_name: null, last_name: null, currency: null, recoveries: null })], []);
    expect(items[0]).toMatchObject({ status: "submitted", borrowerName: "EMP001", currency: "INR", principalMinor: 0, instalmentMinor: null, recoveredInstalments: 0, purpose: null });
  });

  it("uses the indicative instalment when none is fixed", () => {
    const { items } = buildLoanRegister([loan({ attributes: { status: "submitted", indicative_instalment_minor: 1234 } })], []);
    expect(items[0].instalmentMinor).toBe(1234);
  });
});

describe("advanceAllowanceFor", () => {
  const base = { basicMinor: 3000000, currency: "INR", hasOpenLoan: false, hasOpenAdvance: false };
  it("allows up to one month's basic", () => {
    expect(advanceAllowanceFor(base)).toEqual({ available: true, limitMinor: 3000000, currency: "INR" });
  });
  it("refuses without basic, with an open loan or an open advance, in that order", () => {
    expect(advanceAllowanceFor({ ...base, basicMinor: 0, hasOpenLoan: true })).toEqual({ available: false, reason: "no_basic_salary" });
    expect(advanceAllowanceFor({ ...base, hasOpenLoan: true, hasOpenAdvance: true })).toEqual({ available: false, reason: "open_loan" });
    expect(advanceAllowanceFor({ ...base, hasOpenAdvance: true })).toEqual({ available: false, reason: "open_advance" });
  });
});

describe("toWageRow", () => {
  const row: WageArg = {
    id: "E1", employee_code: "EMP001", first_name: "Asha", last_name: "Rao", designation: null, department: "Ops", location: "Pune", category: "skilled",
    currency: null, basic_salary_minor: "2500000", shift: "A", ot_minutes: "95.7", attended_days: "22", day_rows: "22", gross_minor: "3000000", net_minor: null,
  };
  it("returns pay fields when compensation is visible", () => {
    expect(toWageRow(row, true)).toMatchObject({ name: "Asha Rao", basicMinor: 2500000, grossMinor: 3000000, netMinor: null, payableOtMinutes: 95, attendedDays: 22, attendanceRecorded: true, currency: "INR", masked: false });
  });
  it("masks pay fields server-side when compensation is not visible", () => {
    expect(toWageRow(row, false)).toMatchObject({ basicMinor: null, grossMinor: null, netMinor: null, masked: true, shift: "A" });
  });
  it("flags missing attendance and falls back to the code for the name", () => {
    expect(toWageRow({ ...row, first_name: " ", last_name: null, day_rows: null, ot_minutes: null }, true)).toMatchObject({ name: "EMP001", attendanceRecorded: false, payableOtMinutes: 0 });
  });
});
