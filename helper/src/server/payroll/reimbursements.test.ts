import { describe, expect, it } from "vitest";

import {
  assertBillNumberUnique,
  CLAIM_ACTIONS,
  CLAIM_CATEGORIES,
  checkVendorGstin,
  claimActionAvailability,
  claimActions,
  claimedToDate,
  entitlementPosition,
  financialYearLabelOf,
  isTravelLinked,
  parseEntitlementScheme,
  passedAmountEditable,
  payrollTagState,
  reimbursementRegister,
  resolvePassedAmount,
  stateTimeline,
  type ClaimRecord,
  type EntitlementScheme,
} from "./reimbursements";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ASHA = "11111111-1111-4111-8111-111111111111";
const BIMAL = "22222222-2222-4222-8222-222222222222";

let sequence = 0;

function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  sequence += 1;
  const expenseDate = overrides.expenseDate ?? "2026-06-10";
  return {
    id: `claim-${sequence}`,
    status: "draft",
    version: 1,
    employeeId: ASHA,
    employeeCode: "E-001",
    employeeName: "Asha Rao",
    travelId: null,
    expenseDate,
    financialYear: financialYearLabelOf(expenseDate),
    category: "fuel_conveyance",
    amountMinor: 100_00,
    currency: "INR",
    approvedAmountMinor: null,
    entitlementMinor: null,
    payrollRunId: null,
    billNumber: null,
    vendor: null,
    vendorGstin: null,
    receiptDocumentId: "doc-1",
    description: "Cab to plant",
    paymentReference: null,
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-10T09:00:00.000Z",
    ...overrides,
    // A caller that overrides the date should not have to restate the year.
    ...(overrides.financialYear === undefined && overrides.expenseDate !== undefined
      ? { financialYear: financialYearLabelOf(overrides.expenseDate) }
      : {}),
  };
}

const noPermissions = { permissions: [] as string[] };
const clerk = { permissions: ["workforce.travel.write", "workforce.travel.read"] };
const approver = { permissions: ["workforce.travel.approve", "workforce.travel.write"] };
const payrollApprover = { permissions: ["workforce.travel.approve", "payroll.accounting.write"] };

// ---------------------------------------------------------------------------

describe("Financial year placement (SCR-058)", () => {
  it("places April through March in the same Indian financial year", () => {
    expect(financialYearLabelOf("2026-04-01")).toBe("2026-27");
    expect(financialYearLabelOf("2026-12-31")).toBe("2026-27");
    expect(financialYearLabelOf("2027-03-31")).toBe("2026-27");
    expect(financialYearLabelOf("2026-03-31")).toBe("2025-26");
  });

  it("returns null rather than guessing a year for an unusable date", () => {
    expect(financialYearLabelOf("")).toBeNull();
    expect(financialYearLabelOf(null)).toBeNull();
    expect(financialYearLabelOf("June 2026")).toBeNull();
    expect(financialYearLabelOf("2026-13-01")).toBeNull();
  });
});

describe("Reimbursement register excludes travel-linked claims (SCR-058)", () => {
  const standalone = claim({ id: "standalone" });
  const linked = claim({ id: "linked", travelId: "33333333-3333-4333-8333-333333333333" });
  const blankLink = claim({ id: "blank-link", travelId: "   " });

  it("treats a claim with a travel reference as travel-linked", () => {
    expect(isTravelLinked(standalone)).toBe(false);
    expect(isTravelLinked(linked)).toBe(true);
  });

  it("does not treat whitespace as a travel link", () => {
    expect(isTravelLinked(blankLink)).toBe(false);
  });

  it("keeps only standalone claims in the register", () => {
    expect(reimbursementRegister([standalone, linked, blankLink]).map((row) => row.id)).toEqual(["standalone", "blank-link"]);
  });

  it("returns an empty register when every claim belongs to a trip", () => {
    expect(reimbursementRegister([linked])).toEqual([]);
  });
});

describe("Claimed to date (SCR-058)", () => {
  const population: ClaimRecord[] = [
    claim({ id: "a1", amountMinor: 100_00, category: "fuel_conveyance", expenseDate: "2026-06-10" }),
    claim({ id: "a2", amountMinor: 250_00, category: "fuel_conveyance", expenseDate: "2026-11-02" }),
    // Same employee and year, a different claim type.
    claim({ id: "a3", amountMinor: 900_00, category: "telephone_internet", expenseDate: "2026-07-01" }),
    // Same employee and claim type, the previous financial year.
    claim({ id: "a4", amountMinor: 700_00, category: "fuel_conveyance", expenseDate: "2026-03-15" }),
    // A different employee.
    claim({ id: "b1", employeeId: BIMAL, amountMinor: 400_00, category: "fuel_conveyance", expenseDate: "2026-06-11" }),
    // Travel-linked, but the same employee, type and year: it still consumes.
    claim({
      id: "a5",
      amountMinor: 60_00,
      category: "fuel_conveyance",
      expenseDate: "2026-08-01",
      travelId: "33333333-3333-4333-8333-333333333333",
    }),
    // Consumes nothing.
    claim({ id: "a6", amountMinor: 5_000_00, category: "fuel_conveyance", expenseDate: "2026-09-01", status: "rejected" }),
    claim({ id: "a7", amountMinor: 5_000_00, category: "fuel_conveyance", expenseDate: "2026-09-02", status: "cancelled" }),
  ];

  const totals = claimedToDate(population, { employeeId: ASHA, category: "fuel_conveyance", financialYear: "2026-27" });

  it("sums only the requested employee, claim type and financial year", () => {
    expect(totals.claimedMinor).toBe(100_00 + 250_00 + 60_00);
    expect(totals.claimCount).toBe(3);
  });

  it("excludes rejected and cancelled claims, which consume no entitlement", () => {
    const withoutTerminal = population.filter((row) => row.id !== "a6" && row.id !== "a7");
    expect(claimedToDate(withoutTerminal, { employeeId: ASHA, category: "fuel_conveyance", financialYear: "2026-27" }).claimedMinor).toBe(
      totals.claimedMinor,
    );
  });

  it("reports the travel-linked part separately instead of hiding it in the total", () => {
    expect(totals.travelLinkedMinor).toBe(60_00);
  });

  it("counts nothing passed while no claim has been decided", () => {
    expect(totals.passedMinor).toBe(0);
  });

  it("sums the passed amounts once claims are decided", () => {
    const decided = [
      claim({ id: "d1", amountMinor: 100_00, approvedAmountMinor: 80_00, status: "approved" }),
      claim({ id: "d2", amountMinor: 200_00, status: "reimbursed" }),
      claim({ id: "d3", amountMinor: 300_00, status: "submitted" }),
    ];
    const result = claimedToDate(decided, { employeeId: ASHA, category: "fuel_conveyance", financialYear: "2026-27" });
    expect(result.claimedMinor).toBe(600_00);
    expect(result.passedMinor).toBe(80_00 + 200_00);
  });

  it("can exclude the claim being inspected so a balance is not double counted", () => {
    const result = claimedToDate(population, {
      employeeId: ASHA,
      category: "fuel_conveyance",
      financialYear: "2026-27",
      excludeClaimId: "a2",
    });
    expect(result.claimedMinor).toBe(100_00 + 60_00);
  });

  it("returns zero for an employee with no claims, without inventing rows", () => {
    const result = claimedToDate([], { employeeId: ASHA, category: "fuel_conveyance", financialYear: "2026-27" });
    expect(result).toMatchObject({ claimedMinor: 0, passedMinor: 0, claimCount: 0 });
  });
});

describe("Entitlement is reported, never invented (SCR-058)", () => {
  it("reports no configured scheme as not configured, with the missing source named", () => {
    const position = entitlementPosition({ scheme: null, category: "fuel_conveyance", claimedToDateMinor: 410_00 });
    expect(position.configured).toBe(false);
    expect(position.annualEntitlementMinor).toBeNull();
    expect(position.balanceMinor).toBeNull();
    expect(position.missing).toHaveLength(1);
    expect(position.missing[0]).toContain("reimbursement_entitlement_scheme");
  });

  it("never reports an absent entitlement as zero or as unlimited", () => {
    const position = entitlementPosition({ scheme: null, category: "fuel_conveyance", claimedToDateMinor: 0 });
    expect(position.annualEntitlementMinor).not.toBe(0);
    expect(position.annualEntitlementMinor).toBeNull();
    expect(position.balanceMinor).not.toBe(Number.POSITIVE_INFINITY);
    expect(position.balanceMinor).toBeNull();
  });

  it("still reports claimed-to-date when the entitlement is unknown", () => {
    const position = entitlementPosition({ scheme: null, category: "fuel_conveyance", claimedToDateMinor: 410_00 });
    expect(position.claimedToDateMinor).toBe(410_00);
  });

  it("never marks an unconfigured entitlement as exceeded, whatever was claimed", () => {
    const position = entitlementPosition({ scheme: null, category: "fuel_conveyance", claimedToDateMinor: 99_999_00 });
    expect(position.exceeded).toBe(false);
  });

  const scheme: EntitlementScheme = {
    code: "STD-2026",
    currency: "INR",
    annualEntitlementMinorByCategory: { fuel_conveyance: 1_200_00 },
  };

  it("names the claim type when the scheme exists but says nothing about it", () => {
    const position = entitlementPosition({ scheme, category: "telephone_internet", claimedToDateMinor: 300_00 });
    expect(position.configured).toBe(false);
    expect(position.annualEntitlementMinor).toBeNull();
    expect(position.balanceMinor).toBeNull();
    expect(position.missing[0]).toContain("telephone_internet");
  });

  it("computes the balance when the claim type is configured", () => {
    const position = entitlementPosition({ scheme, category: "fuel_conveyance", claimedToDateMinor: 410_00 });
    expect(position).toMatchObject({ configured: true, annualEntitlementMinor: 1_200_00, balanceMinor: 790_00, exceeded: false });
  });

  it("reports an overrun as a negative balance rather than clamping it to zero", () => {
    const position = entitlementPosition({ scheme, category: "fuel_conveyance", claimedToDateMinor: 1_500_00 });
    expect(position.balanceMinor).toBe(-300_00);
    expect(position.exceeded).toBe(true);
  });

  it("treats a zero configured entitlement as configured, not as missing", () => {
    const zeroed: EntitlementScheme = { ...scheme, annualEntitlementMinorByCategory: { fuel_conveyance: 0 } };
    const position = entitlementPosition({ scheme: zeroed, category: "fuel_conveyance", claimedToDateMinor: 0 });
    expect(position.configured).toBe(true);
    expect(position.annualEntitlementMinor).toBe(0);
    expect(position.balanceMinor).toBe(0);
  });
});

describe("Entitlement scheme parsing (SCR-058)", () => {
  it("returns null when nothing is configured", () => {
    expect(parseEntitlementScheme(undefined)).toBeNull();
    expect(parseEntitlementScheme(null)).toBeNull();
  });

  it("returns null rather than a partial scheme when the shape is wrong", () => {
    expect(parseEntitlementScheme({ code: "STD", currency: "rupees", annualEntitlementMinorByCategory: {} })).toBeNull();
    expect(parseEntitlementScheme({ code: "STD", currency: "INR", annualEntitlementMinorByCategory: { fuel_conveyance: 12.5 } })).toBeNull();
    expect(parseEntitlementScheme({ code: "STD", currency: "INR", annualEntitlementMinorByCategory: { fuel_conveyance: -1 } })).toBeNull();
  });

  it("accepts a well-formed scheme", () => {
    expect(parseEntitlementScheme({ code: "STD", currency: "INR", annualEntitlementMinorByCategory: { meal: 500_00 } })).toEqual({
      code: "STD",
      currency: "INR",
      annualEntitlementMinorByCategory: { meal: 500_00 },
    });
  });
});

describe("Amount claimed versus amount passed (SCR-058)", () => {
  it("passes nothing while the claim is undecided", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, status: "submitted" }));
    expect(result.passedMinor).toBeNull();
    expect(result.decided).toBe(false);
  });

  it("does not present a proposed figure as passed before approval", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: 60_00, status: "submitted" }));
    expect(result.recordedMinor).toBe(60_00);
    expect(result.passedMinor).toBeNull();
  });

  it("defaults an approved claim with no recorded reduction to the full claim", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: null, status: "approved" }));
    expect(result.passedMinor).toBe(100_00);
    expect(result.defaulted).toBe(true);
  });

  it("honours a reduction the approver recorded", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: 65_00, status: "approved" }));
    expect(result.passedMinor).toBe(65_00);
    expect(result.defaulted).toBe(false);
    expect(result.exceedsClaim).toBe(false);
  });

  it("never lets the passed amount exceed the amount claimed", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: 150_00, status: "approved" }));
    expect(result.passedMinor).toBe(100_00);
    expect(result.exceedsClaim).toBe(true);
    expect(result.recordedMinor).toBe(150_00);
  });

  it("still refuses to pass an inflated figure on a reimbursed claim", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: 150_00, status: "reimbursed" }));
    expect(result.passedMinor).toBe(100_00);
    expect(result.exceedsClaim).toBe(true);
  });

  it("carries a zero pass through instead of falling back to the claim", () => {
    const result = resolvePassedAmount(claim({ amountMinor: 100_00, approvedAmountMinor: 0, status: "approved" }));
    expect(result.passedMinor).toBe(0);
    expect(result.defaulted).toBe(false);
  });

  it("allows the passed amount to be recorded only while the claim is editable", () => {
    expect(passedAmountEditable({ status: "draft" }).editable).toBe(true);
    expect(passedAmountEditable({ status: "returned" }).editable).toBe(true);
    expect(passedAmountEditable({ status: "submitted" }).editable).toBe(false);
    expect(passedAmountEditable({ status: "approved" }).editable).toBe(false);
    expect(passedAmountEditable({ status: "approved" }).reason).toContain("only editable");
  });
});

describe("Claim state machine (SCR-058)", () => {
  it("allows a draft claim to be submitted", () => {
    const result = claimActionAvailability("submit", { status: "draft" }, clerk);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("allows a returned claim to be submitted again", () => {
    expect(claimActionAvailability("submit", { status: "returned" }, clerk).allowed).toBe(true);
  });

  it("refuses to submit an already submitted claim, and says why", () => {
    const result = claimActionAvailability("submit", { status: "submitted" }, clerk);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("draft or returned");
    expect(result.reason).toContain("submitted");
  });

  it("refuses to approve a draft claim", () => {
    const result = claimActionAvailability("approve", { status: "draft" }, approver);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("submitted");
  });

  it("allows approve, return and reject only from submitted", () => {
    for (const action of ["approve", "return", "reject"] as const) {
      expect(claimActionAvailability(action, { status: "submitted" }, approver).allowed).toBe(true);
      expect(claimActionAvailability(action, { status: "approved" }, approver).allowed).toBe(false);
      expect(claimActionAvailability(action, { status: "draft" }, approver).allowed).toBe(false);
    }
  });

  it("allows cancel from draft, returned and submitted but not after a decision", () => {
    expect(claimActionAvailability("cancel", { status: "draft" }, clerk).allowed).toBe(true);
    expect(claimActionAvailability("cancel", { status: "returned" }, clerk).allowed).toBe(true);
    expect(claimActionAvailability("cancel", { status: "submitted" }, clerk).allowed).toBe(true);
    expect(claimActionAvailability("cancel", { status: "approved" }, clerk).allowed).toBe(false);
    expect(claimActionAvailability("cancel", { status: "reimbursed" }, clerk).allowed).toBe(false);
  });

  it("allows reimburse only from approved", () => {
    expect(claimActionAvailability("reimburse", { status: "approved" }, payrollApprover).allowed).toBe(true);
    expect(claimActionAvailability("reimburse", { status: "submitted" }, payrollApprover).allowed).toBe(false);
    expect(claimActionAvailability("reimburse", { status: "reimbursed" }, payrollApprover).allowed).toBe(false);
  });

  it("leaves every action illegal once the claim is rejected or reimbursed", () => {
    for (const status of ["rejected", "reimbursed"]) {
      const available = claimActions({ status }, payrollApprover).filter((entry) => entry.allowed);
      expect(available).toEqual([]);
    }
  });

  it("requires payroll.accounting.write on top of the approval permission to reimburse", () => {
    const withoutPayroll = claimActionAvailability("reimburse", { status: "approved" }, approver);
    expect(withoutPayroll.allowed).toBe(false);
    expect(withoutPayroll.reason).toContain("payroll.accounting.write");
    expect(withoutPayroll.permissions).toContain("payroll.accounting.write");
  });

  it("disables every action with a reason when the role carries no permission", () => {
    for (const entry of claimActions({ status: "submitted" }, noPermissions)) {
      expect(entry.allowed).toBe(false);
      expect(entry.reason).toBeTruthy();
    }
  });

  it("tells the user a reason is always required, and a payment reference for reimburse", () => {
    expect(claimActionAvailability("submit", { status: "draft" }, clerk).requires).toEqual(["A reason of at least 3 characters"]);
    expect(claimActionAvailability("reimburse", { status: "approved" }, payrollApprover).requires).toContain(
      "A completed payment reference",
    );
  });

  it("offers exactly the six actions the resource defines", () => {
    expect([...CLAIM_ACTIONS].sort()).toEqual(["approve", "cancel", "reimburse", "reject", "return", "submit"]);
  });
});

describe("State timeline (SCR-058)", () => {
  it("marks the current status and leaves later steps to do", () => {
    expect(stateTimeline({ status: "submitted" })).toEqual([
      { status: "draft", label: "Raised", state: "done" },
      { status: "submitted", label: "Submitted", state: "current" },
      { status: "approved", label: "Approved", state: "todo" },
      { status: "reimbursed", label: "Reimbursed", state: "todo" },
    ]);
  });

  it("marks nothing beyond what history proves for a status off the happy path", () => {
    const steps = stateTimeline({ status: "returned" }, ["draft", "submitted"]);
    expect(steps.map((step) => step.state)).toEqual(["done", "done", "todo", "todo"]);
  });

  it("claims no progress for a returned claim with no recorded history", () => {
    expect(stateTimeline({ status: "rejected" }).every((step) => step.state === "todo")).toBe(true);
  });
});

describe("Payroll tagging (SCR-058)", () => {
  const runs = new Map([["run-1", { period: "2026-07", status: "draft" }]]);

  it("reports an untagged claim as untagged", () => {
    const state = payrollTagState({ payrollRunId: null, status: "approved" }, runs);
    expect(state.tagged).toBe(false);
    expect(state.payrollInputRaised).toBe(false);
  });

  it("resolves the tagged run and still reports that no payroll input is raised", () => {
    const state = payrollTagState({ payrollRunId: "run-1", status: "reimbursed" }, runs);
    expect(state).toMatchObject({ tagged: true, runPeriod: "2026-07", runStatus: "draft", payrollInputRaised: false });
  });

  it("does not pretend a tag reached payroll when the run cannot be seen", () => {
    const state = payrollTagState({ payrollRunId: "run-missing", status: "reimbursed" }, runs);
    expect(state).toMatchObject({ tagged: true, runPeriod: null, payrollInputRaised: false });
  });
});

describe("Vendor GSTIN (SCR-058)", () => {
  it("reports an absent GSTIN as absent, not as invalid", () => {
    expect(checkVendorGstin(null).state).toBe("absent");
    expect(checkVendorGstin("   ").state).toBe("absent");
  });

  it("accepts a well-formed GSTIN", () => {
    expect(checkVendorGstin("27AAPFU0939F1ZV").state).toBe("valid");
    expect(checkVendorGstin("27aapfu0939f1zv").state).toBe("valid");
  });

  it("flags a malformed GSTIN, and says a pre-existing claim may still carry one", () => {
    const result = checkVendorGstin("NOT-A-GSTIN");
    expect(result.state).toBe("malformed");
    expect(result.message).toContain("before the format was enforced");
  });

  it("does not claim the GSTIN was verified, only that its shape was checked", () => {
    expect(checkVendorGstin("27AAPFU0939F1ZV").message).toContain("not confirmed");
  });
});

describe("Claim vocabulary (SCR-058)", () => {
  it("takes the claim types from the resource rather than restating them", () => {
    expect(CLAIM_CATEGORIES).toContain("fuel_conveyance");
    expect(CLAIM_CATEGORIES).toContain("telephone_internet");
    expect(CLAIM_CATEGORIES.length).toBeGreaterThan(5);
  });
});

describe("duplicate bill numbers (FRM-PAY-06)", () => {
  const existing = [
    { id: "c1", billNumber: "INV-1001", category: "fuel_conveyance", expenseDate: "2026-05-04", status: "approved" },
    { id: "c2", billNumber: "INV-2002", category: "medical", expenseDate: "2026-05-04", status: "rejected" },
  ];
  const claim = (over: Partial<{ billNumber: string | null; category: string; expenseDate: string; id: string }> = {}) => ({
    billNumber: "INV-1001",
    category: "fuel_conveyance",
    expenseDate: "2026-06-01",
    ...over,
  });

  it("blocks the same bill under the same claim type in the same financial year", () => {
    expect(() => assertBillNumberUnique(claim(), existing)).toThrow();
    // Case and surrounding space are not what makes a bill number different.
    expect(() => assertBillNumberUnique(claim({ billNumber: " inv-1001 " }), existing)).toThrow();
  });

  it("allows the same bill number under a different claim type or a different year", () => {
    expect(() => assertBillNumberUnique(claim({ category: "medical" }), existing)).not.toThrow();
    // April starts the financial year, so 2026-03-31 and 2026-05-04 are different years.
    expect(() => assertBillNumberUnique(claim({ expenseDate: "2026-03-31" }), existing)).not.toThrow();
  });

  it("does not let a rejected or cancelled claim reserve a bill number", () => {
    expect(() => assertBillNumberUnique(claim({ billNumber: "INV-2002", category: "medical" }), existing)).not.toThrow();
  });

  it("ignores a blank bill number, and does not clash a claim with itself on edit", () => {
    expect(() => assertBillNumberUnique(claim({ billNumber: null }), existing)).not.toThrow();
    expect(() => assertBillNumberUnique(claim({ id: "c1" }), existing)).not.toThrow();
  });
});
