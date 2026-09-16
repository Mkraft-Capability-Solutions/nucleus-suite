import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/platform/http";

import {
  CHECK_KEYS,
  EXPLANATION_MIN_LENGTH,
  allowedDispositions,
  assertItemTransition,
  checkDimensionSums,
  checkInternalIdentity,
  checkJournalGrossVsPayslipEarnings,
  checkJournalNetVsBankFile,
  checkLoanRecoveryVsMovement,
  checkOvertimeVsAttendance,
  checkStatutoryVsRemittance,
  dimensionLabel,
  drillKindsFor,
  evaluateReconciliation,
  explainVarianceSchema,
  groupExportLines,
  initialStateFor,
  isDimensioned,
  journalLineKey,
  nextItemState,
  reconciliationFingerprint,
  reconciliationTimeline,
  resolveResultAction,
  runReconciliationSchema,
  runStateFrom,
  type ExportLineRow,
  type JournalDimensions,
  type JournalFactLine,
  type PayslipFact,
  type ReconciliationFacts,
} from "./reconciliation";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN = "11111111-1111-4111-8111-111111111111";

function dimensions(overrides: Partial<JournalDimensions> = {}): JournalDimensions {
  return {
    costCenterId: "cc-1",
    departmentId: "dep-1",
    department: "Operations",
    locationId: "loc-1",
    location: "Pune",
    projectId: null,
    runType: "regular",
    ...overrides,
  };
}

function journalLine(overrides: Partial<JournalFactLine> & Pick<JournalFactLine, "accountCode">): JournalFactLine {
  const base: JournalFactLine = {
    key: `key-${overrides.accountCode}-${overrides.componentCode ?? "net"}`,
    primaryExportLineId: `el-${overrides.accountCode}`,
    glAccountId: `acc-${overrides.accountCode}`,
    accountCode: overrides.accountCode,
    accountName: `${overrides.accountCode} account`,
    componentCode: "basic",
    kind: "earning",
    debitMinor: 0,
    creditMinor: 0,
    dimensions: dimensions(),
    contributions: [],
  };
  return { ...base, ...overrides };
}

function payslip(overrides: Partial<PayslipFact> & Pick<PayslipFact, "employeeId">): PayslipFact {
  return {
    payrollRunEmployeeId: `pre-${overrides.employeeId}`,
    employeeCode: `E-${overrides.employeeId}`,
    employeeName: "Asha Rao",
    grossMinor: 100_000,
    deductionsMinor: 20_000,
    netMinor: 80_000,
    ...overrides,
  };
}

/**
 * A run whose journal is posted, whose batch is released and whose seven
 * assertions all balance. Individual tests bend exactly one fact at a time.
 */
function facts(overrides: Partial<ReconciliationFacts> = {}): ReconciliationFacts {
  const payslips = overrides.payslips ?? [payslip({ employeeId: "e1" }), payslip({ employeeId: "e2" })];
  const gross = payslips.reduce((total, row) => total + row.grossMinor, 0);
  const deductions = payslips.reduce((total, row) => total + row.deductionsMinor, 0);
  const net = payslips.reduce((total, row) => total + row.netMinor, 0);
  return {
    runId: RUN,
    period: "2026-03",
    runType: "regular",
    runStatus: "finalized",
    currency: "INR",
    journalPosted: true,
    journalLines: [
      journalLine({ accountCode: "5001", componentCode: "basic", kind: "earning", debitMinor: gross }),
      journalLine({ accountCode: "2001", componentCode: "pf", kind: "deduction", creditMinor: deductions }),
      journalLine({
        accountCode: "1001",
        componentCode: null,
        kind: null,
        creditMinor: net,
        contributions: payslips.map((row) => ({
          exportLineId: `el-net-${row.employeeId}`,
          payrollLineId: `pl-${row.employeeId}`,
          employeeId: row.employeeId,
          employeeCode: row.employeeCode,
          amountMinor: row.netMinor,
        })),
      }),
    ],
    payslips,
    bank: {
      batchId: "batch-1",
      state: "released",
      totalAmountMinor: net,
      items: payslips.map((row) => ({
        disbursementItemId: `di-${row.employeeId}`,
        payrollRunEmployeeId: row.payrollRunEmployeeId,
        employeeId: row.employeeId,
        employeeCode: row.employeeCode,
        amountMinor: row.netMinor,
        state: "released",
      })),
    },
    remittance: null,
    ot: { employees: [], traceRowCount: 0 },
    loans: { employees: [], transactionCount: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("journal line reassembly (SCR-103)", () => {
  const row = (overrides: Partial<ExportLineRow> & Pick<ExportLineRow, "exportLineId">): ExportLineRow => ({
    payrollLineId: `pl-${overrides.exportLineId}`,
    glAccountId: "acc-5001",
    accountCode: "5001",
    accountName: "Salary expense",
    componentCode: "basic",
    side: "debit",
    lineDebitMinor: 500_000,
    lineCreditMinor: 0,
    contributionMinor: 250_000,
    employeeId: "e1",
    employeeCode: "E-1",
    dimensions: dimensions(),
    ...overrides,
  });

  it("takes the line total once however many contributions carry it", () => {
    // GL posting writes one row per contributing payroll line and repeats the
    // line totals on each; adding them would multiply the journal.
    const lines = groupExportLines([row({ exportLineId: "a" }), row({ exportLineId: "b", employeeId: "e2" })], { basic: "earning" });
    expect(lines).toHaveLength(1);
    expect(lines[0].debitMinor).toBe(500_000);
    expect(lines[0].contributions.map((entry) => entry.amountMinor)).toEqual([250_000, 250_000]);
    expect(lines[0].kind).toBe("earning");
  });

  it("keeps lines apart when they differ by dimension", () => {
    const lines = groupExportLines(
      [row({ exportLineId: "a" }), row({ exportLineId: "b", dimensions: dimensions({ costCenterId: "cc-2" }) })],
      { basic: "earning" },
    );
    expect(lines).toHaveLength(2);
  });

  it("leaves the net-pay leg without a component kind", () => {
    const lines = groupExportLines([row({ exportLineId: "n", componentCode: null, side: "credit", lineDebitMinor: 0, lineCreditMinor: 400_000 })], {});
    expect(lines[0].componentCode).toBeNull();
    expect(lines[0].kind).toBeNull();
  });

  it("separates the two legs of the same account by side", () => {
    const key = (side: string) => journalLineKey({ glAccountId: "acc-1", componentCode: "pf", side, dimensions: dimensions() });
    expect(key("debit")).not.toBe(key("credit"));
  });
});

describe("check (a) journal gross versus payslip earnings (SCR-103)", () => {
  it("passes when the posted earnings debits equal the payslip gross", () => {
    const check = checkJournalGrossVsPayslipEarnings(facts());
    expect(check.status).toBe("pass");
    expect(check.expectedMinor).toBe(200_000);
    expect(check.actualMinor).toBe(200_000);
    expect(check.varianceMinor).toBe(0);
  });

  it("signs the variance positive when the journal overstates earnings", () => {
    const base = facts();
    const check = checkJournalGrossVsPayslipEarnings({
      ...base,
      journalLines: base.journalLines.map((line) => (line.componentCode === "basic" ? { ...line, debitMinor: 205_000 } : line)),
    });
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(5_000);
  });

  it("signs the variance negative when the journal understates earnings", () => {
    const base = facts();
    const check = checkJournalGrossVsPayslipEarnings({
      ...base,
      journalLines: base.journalLines.map((line) => (line.componentCode === "basic" ? { ...line, debitMinor: 190_000 } : line)),
    });
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(-10_000);
  });

  it("is indeterminate, naming the journal, when nothing has been posted", () => {
    const check = checkJournalGrossVsPayslipEarnings(facts({ journalPosted: false, journalLines: [] }));
    expect(check.status).toBe("indeterminate");
    expect(check.actualMinor).toBeNull();
    expect(check.varianceMinor).toBeNull();
    expect(check.reason).toMatch(/No journal has been posted/);
  });
});

describe("check (b) journal net versus the bank file (SCR-103)", () => {
  it("passes when the released batch total equals the net-pay legs", () => {
    const check = checkJournalNetVsBankFile(facts());
    expect(check.status).toBe("pass");
    expect(check.expectedMinor).toBe(160_000);
    expect(check.actualMinor).toBe(160_000);
  });

  it("reports a signed variance when the bank paid less than the journal recorded", () => {
    const base = facts();
    const check = checkJournalNetVsBankFile({ ...base, bank: { ...base.bank!, totalAmountMinor: 150_000 } });
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(10_000);
  });

  it("is indeterminate, naming the release, when no batch has been released", () => {
    const check = checkJournalNetVsBankFile(facts({ bank: null }));
    expect(check.status).toBe("indeterminate");
    expect(check.expectedMinor).toBeNull();
    expect(check.varianceMinor).toBeNull();
    expect(check.reason).toMatch(/released state/);
  });

  it("pairs one bank item to one journal line only when each side is unambiguous", () => {
    const single = payslip({ employeeId: "solo" });
    const one = facts({ payslips: [single] });
    expect(checkJournalNetVsBankFile(one).disbursementItemId).toBe("di-solo");
    expect(checkJournalNetVsBankFile(facts()).disbursementItemId).toBeNull();
  });
});

describe("check (c) statutory heads versus remittance (SCR-103)", () => {
  it("is indeterminate because no challan or remittance source exists in this system", () => {
    const check = checkStatutoryVsRemittance(facts());
    expect(check.status).toBe("indeterminate");
    expect(check.expectedMinor).toBeNull();
    expect(check.varianceMinor).toBeNull();
  });

  it("names both missing sources rather than comparing the withheld figure to itself", () => {
    const check = checkStatutoryVsRemittance(facts());
    expect(check.reason).toMatch(/No remitted amount has been recorded/);
    expect(check.reason).toMatch(/no flag marking a head as statutory/);
    expect(check.expectedSource).toMatch(/Statutory filing register/);
    expect(check.expectedMinor).toBeNull();
    // The withheld side is still reported, but only on `actual`.
    expect(check.actualMinor).toBe(40_000);
    expect(check.actualMinor).not.toBe(check.expectedMinor);
  });

  it("would compare both sides the day a remittance source appears", () => {
    const check = checkStatutoryVsRemittance(facts({ remittance: { totalMinor: 39_000, heads: [] } }));
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(1_000);
  });
});

describe("check (d) dimension sums versus the journal total (SCR-103)", () => {
  it("passes when every posted debit carries an analysis dimension", () => {
    const check = checkDimensionSums(facts());
    expect(check.status).toBe("pass");
    expect(check.varianceMinor).toBe(0);
  });

  it("detects residue and names it instead of absorbing it", () => {
    const base = facts();
    const check = checkDimensionSums({
      ...base,
      journalLines: [
        ...base.journalLines,
        journalLine({
          accountCode: "5999",
          componentCode: "special",
          debitMinor: 7_500,
          dimensions: dimensions({ costCenterId: null, departmentId: null, department: null, locationId: null, location: null }),
        }),
      ],
    });
    expect(check.status).toBe("variance");
    expect(check.expectedMinor).toBe(207_500);
    expect(check.actualMinor).toBe(200_000);
    expect(check.varianceMinor).toBe(-7_500);
    expect(check.reason).toMatch(/carry no cost centre/);
  });

  it("treats run type alone as no dimension", () => {
    expect(isDimensioned(dimensions({ costCenterId: null, departmentId: null, locationId: null, projectId: null }))).toBe(false);
    expect(isDimensioned(dimensions({ costCenterId: null, departmentId: null, locationId: null, projectId: "prj-1" }))).toBe(true);
    expect(dimensionLabel(dimensions({ costCenterId: null, departmentId: null, department: null, locationId: null, location: null }))).toBe("No dimension");
  });

  it("is indeterminate when nothing has been posted", () => {
    expect(checkDimensionSums(facts({ journalPosted: false, journalLines: [] })).status).toBe("indeterminate");
  });
});

describe("check (e) overtime paid versus approved attendance (SCR-103)", () => {
  const otEmployee = (approvedMinutes: number, paidAmountMinor: number, paidMinutes = approvedMinutes) => ({
    payrollRunEmployeeId: "pre-e1",
    employeeId: "e1",
    employeeCode: "E-1",
    employeeName: "Asha Rao",
    approvedMinutes,
    hourlyRateMinor: 100,
    multiplier: 2,
    paidMinutes,
    paidAmountMinor,
  });

  it("passes when the run paid exactly the approved minutes at the recorded rate", () => {
    const check = checkOvertimeVsAttendance(facts({ runType: "ot", ot: { employees: [otEmployee(600, 120_000)], traceRowCount: 1 } }));
    expect(check.status).toBe("pass");
    expect(check.expectedMinor).toBe(120_000);
    expect(check.varianceMinor).toBe(0);
  });

  it("signs the variance positive when the run paid more minutes than attendance approved", () => {
    const check = checkOvertimeVsAttendance(facts({ runType: "ot", ot: { employees: [otEmployee(600, 140_000, 700)], traceRowCount: 1 } }));
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(20_000);
    expect(check.reason).toMatch(/700 overtime minutes against 600 approved/);
  });

  it("is indeterminate on a regular run, because the assertion is scoped to off-cycle overtime", () => {
    const check = checkOvertimeVsAttendance(facts({ ot: { employees: [otEmployee(600, 120_000)], traceRowCount: 1 } }));
    expect(check.status).toBe("indeterminate");
    expect(check.reason).toMatch(/off-cycle overtime run/);
  });

  it("is indeterminate, naming the trace, when approved minutes carry no recorded rate", () => {
    const check = checkOvertimeVsAttendance(
      facts({ runType: "ot", ot: { employees: [{ ...otEmployee(600, 0), hourlyRateMinor: null, multiplier: null, paidMinutes: null }], traceRowCount: 0 } }),
    );
    expect(check.status).toBe("indeterminate");
    expect(check.expectedMinor).toBeNull();
    expect(check.reason).toMatch(/payroll_calculations/);
  });
});

describe("check (f) loan recovery versus loan outstanding movement (SCR-103)", () => {
  const loan = (recoveredMinor: number, movementMinor: number) => ({
    employeeId: "e1",
    employeeCode: "E-1",
    employeeName: "Asha Rao",
    recoveredMinor,
    movementMinor,
    transactionCount: 1,
  });

  it("passes when the deduction equals the movement written against the loan", () => {
    const check = checkLoanRecoveryVsMovement(facts({ loans: { employees: [loan(5_000, 5_000)], transactionCount: 1 } }));
    expect(check.status).toBe("pass");
    expect(check.varianceMinor).toBe(0);
  });

  it("signs the variance when payroll withheld more than the loan moved", () => {
    const check = checkLoanRecoveryVsMovement(facts({ loans: { employees: [loan(5_000, 3_000)], transactionCount: 1 } }));
    expect(check.status).toBe("variance");
    expect(check.expectedMinor).toBe(3_000);
    expect(check.actualMinor).toBe(5_000);
    expect(check.varianceMinor).toBe(2_000);
  });

  it("signs the variance negative when a loan moved without a payroll deduction", () => {
    const check = checkLoanRecoveryVsMovement(facts({ loans: { employees: [loan(0, 4_000)], transactionCount: 1 } }));
    expect(check.varianceMinor).toBe(-4_000);
  });

  it("passes trivially only when neither side has anything to say", () => {
    const check = checkLoanRecoveryVsMovement(facts());
    expect(check.status).toBe("pass");
    expect(check.expectedMinor).toBe(0);
    expect(check.actualMinor).toBe(0);
  });
});

describe("check (g) the internal identity (SCR-103)", () => {
  it("passes when every employee's net equals their gross less deductions", () => {
    const check = checkInternalIdentity(facts());
    expect(check.status).toBe("pass");
    expect(check.expectedMinor).toBe(160_000);
    expect(check.actualMinor).toBe(160_000);
  });

  it("reports a signed variance and counts the employees that break it", () => {
    const check = checkInternalIdentity(facts({ payslips: [payslip({ employeeId: "e1", netMinor: 81_500 }), payslip({ employeeId: "e2" })] }));
    expect(check.status).toBe("variance");
    expect(check.varianceMinor).toBe(1_500);
    expect(check.reason).toMatch(/^1 employee carry|^1 employee /);
    expect(check.detail).toContainEqual({ label: "Employees breaking the identity", value: "1" });
  });

  it("still names the per-employee breaks when two offsetting errors cancel in the total", () => {
    const check = checkInternalIdentity({
      ...facts({ payslips: [payslip({ employeeId: "e1", netMinor: 82_000 }), payslip({ employeeId: "e2", netMinor: 78_000 })] }),
    });
    expect(check.varianceMinor).toBe(0);
    expect(check.status).toBe("pass");
    expect(check.reason).toMatch(/2 employees carry a stored net/);
  });

  it("is indeterminate when the run has no calculated employees", () => {
    const check = checkInternalIdentity(facts({ payslips: [] }));
    expect(check.status).toBe("indeterminate");
    expect(check.expectedMinor).toBeNull();
  });
});

describe("all seven assertions (RL-530, SCR-103)", () => {
  it("evaluates every check independently and always in the workbook's order", () => {
    const checks = evaluateReconciliation(facts());
    expect(checks.map((check) => check.key)).toEqual([...CHECK_KEYS]);
    expect(checks).toHaveLength(7);
  });

  it("does not let one indeterminate check suppress the other six", () => {
    const checks = evaluateReconciliation(facts({ bank: null }));
    expect(checks.filter((check) => check.status === "pass")).toHaveLength(4);
    expect(checks.filter((check) => check.status === "indeterminate").map((check) => check.key)).toEqual([
      "journal_net_vs_bank_file",
      "statutory_vs_remittance",
      "ot_paid_vs_attendance_approved",
    ]);
  });

  it("gives every check both sides of its own assertion, never one figure twice", () => {
    for (const check of evaluateReconciliation(facts())) {
      expect(check.expectedSource).not.toBe(check.actualSource);
      expect(check.label).toBeTruthy();
    }
  });
});

describe("idempotent re-run (SCR-103)", () => {
  const checks = evaluateReconciliation(facts());
  const fingerprint = reconciliationFingerprint(RUN, checks);

  it("creates the first result", () => {
    expect(resolveResultAction(null, fingerprint)).toEqual({ action: "create" });
  });

  it("treats an unchanged re-run as a no-op rather than a duplicate", () => {
    expect(resolveResultAction({ resultId: "r1", lifecycle: "live", fingerprint }, fingerprint)).toEqual({ action: "unchanged", resultId: "r1" });
  });

  it("supersedes — never duplicates — when the figures have moved", () => {
    const moved = reconciliationFingerprint(RUN, evaluateReconciliation(facts({ payslips: [payslip({ employeeId: "e1" })] })));
    expect(moved).not.toBe(fingerprint);
    expect(resolveResultAction({ resultId: "r1", lifecycle: "live", fingerprint }, moved)).toEqual({ action: "supersede", resultId: "r1" });
  });

  it("starts a fresh result once the previous one is superseded, keeping the old rows", () => {
    expect(resolveResultAction({ resultId: "r1", lifecycle: "superseded", fingerprint }, fingerprint)).toEqual({ action: "create" });
  });

  it("ignores presentation-only differences in the fingerprint", () => {
    const relabelled = checks.map((check) => ({ ...check, detail: [{ label: "noise", value: "1" }] }));
    expect(reconciliationFingerprint(RUN, relabelled)).toBe(fingerprint);
  });
});

describe("state machine (SCR-103)", () => {
  it("reconciles a passing control without an explanation", () => {
    expect(initialStateFor("pass")).toBe("reconciled");
    expect(initialStateFor("variance")).toBe("open");
    expect(initialStateFor("indeterminate")).toBe("open");
  });

  it("requires an explanation before a control can be closed as reconciled", () => {
    expect(nextItemState("open", "reconcile")).toBeNull();
    expect(() => assertItemTransition("open", "reconcile")).toThrowError(HttpError);
    try {
      assertItemTransition("open", "reconcile");
    } catch (error) {
      expect((error as HttpError).status).toBe(409);
      expect((error as HttpError).message).toMatch(/must be explained before/);
    }
  });

  it("walks open -> explained -> reconciled", () => {
    expect(assertItemTransition("open", "timing")).toBe("explained");
    expect(assertItemTransition("explained", "reconcile")).toBe("reconciled");
  });

  it("escalates a variance from open or explained, and lets an escalation be re-explained", () => {
    expect(assertItemTransition("open", "escalate")).toBe("escalated");
    expect(assertItemTransition("explained", "escalate")).toBe("escalated");
    expect(assertItemTransition("escalated", "data_correction")).toBe("explained");
    expect(nextItemState("escalated", "reconcile")).toBeNull();
  });

  it("treats reconciled as terminal", () => {
    expect(allowedDispositions("reconciled")).toEqual([]);
    expect(() => assertItemTransition("reconciled", "escalate")).toThrowError(HttpError);
  });

  it("offers only the dispositions the current state accepts", () => {
    expect(allowedDispositions("open")).toEqual(["timing", "data_correction", "accepted", "escalate"]);
    expect(allowedDispositions("explained")).toEqual(["timing", "data_correction", "accepted", "reconcile", "escalate"]);
  });

  it("rolls the run up to its weakest control", () => {
    expect(runStateFrom(["reconciled", "reconciled"])).toBe("reconciled");
    expect(runStateFrom(["reconciled", "explained"])).toBe("explained");
    expect(runStateFrom(["reconciled", "explained", "open"])).toBe("open");
    expect(runStateFrom(["reconciled", "open", "escalated"])).toBe("escalated");
    expect(runStateFrom([])).toBe("open");
  });

  it("marks the timeline at the state the run has reached", () => {
    expect(reconciliationTimeline("explained").map((step) => step.state)).toEqual(["done", "current", "todo", "todo"]);
    expect(reconciliationTimeline("escalated").map((step) => step.state)).toEqual(["done", "done", "todo", "current"]);
  });
});

describe("explanation input (SCR-103)", () => {
  const valid = { itemId: RUN, disposition: "timing" as const, note: "Bank value date falls in the next period." };

  it("accepts a reason a reviewer can act on", () => {
    expect(explainVarianceSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an empty or token reason", () => {
    expect(explainVarianceSchema.safeParse({ ...valid, note: "" }).success).toBe(false);
    expect(explainVarianceSchema.safeParse({ ...valid, note: "ok" }).success).toBe(false);
    expect(explainVarianceSchema.safeParse({ ...valid, note: "x".repeat(EXPLANATION_MIN_LENGTH - 1) }).success).toBe(false);
    expect(explainVarianceSchema.safeParse({ ...valid, note: "x".repeat(EXPLANATION_MIN_LENGTH) }).success).toBe(true);
  });

  it("refuses an unknown disposition and an unknown field", () => {
    expect(explainVarianceSchema.safeParse({ ...valid, disposition: "ignore" }).success).toBe(false);
    expect(explainVarianceSchema.safeParse({ ...valid, force: true }).success).toBe(false);
  });

  it("requires a payroll run to reconcile", () => {
    expect(runReconciliationSchema.safeParse({}).success).toBe(false);
    expect(runReconciliationSchema.safeParse({ payrollRunId: RUN }).success).toBe(true);
  });
});

describe("drill-back scope (RL-531, SCR-103)", () => {
  it("drills the gross assertion through earning and reimbursement heads", () => {
    expect(drillKindsFor("journal_gross_vs_payslip_earnings")).toEqual(["earning", "reimbursement"]);
  });

  it("drills the net assertion through the net-pay legs", () => {
    expect(drillKindsFor("journal_net_vs_bank_file")).toBe("net_pay");
  });

  it("drills the statutory assertion through deduction and employer-contribution heads", () => {
    expect(drillKindsFor("statutory_vs_remittance")).toEqual(["deduction", "employer_contribution"]);
  });
});
