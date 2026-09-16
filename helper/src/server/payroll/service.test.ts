import { describe, expect, it } from "vitest";
import { applyLoanSchema, approveLoanSchema, repayLoanSchema } from "@/server/loans/service";
import { periodEndDate } from "@/server/payroll/gl";
import {
  correctRunSchema,
  createRunSchema,
  deriveTimeline,
  displayRunCode,
  displayRunStatus,
  findingDisplayStatus,
  findingTimeline,
  formatPeriodLabel,
  logFindingSchema,
  payDateAllowed,
  reproducibilityStamp,
  resolveAnomalySchema,
  runTypeForScope,
  scopeForRunType,
  toScopeFinding,
  scopeLabel,
  STANDARD_STRUCTURE,
} from "@/server/payroll/service";

const EMPLOYEE = "123e4567-e89b-12d3-a456-426614174000";
const OTHER = "123e4567-e89b-12d3-a456-426614174001";

describe("payroll schemas (OC-P4-01/02)", () => {
  it("pins the standard structure to the golden fixture lines", () => {
    expect(STANDARD_STRUCTURE).toEqual({ basic: 5_000_000, hra: 2_000_000, da: 500_000, conveyance: 160_000, special: 840_000 });
  });

  it("validates run creation periods and run types (FRM-PAY-03)", () => {
    const base = { period: "2026-09", payDate: "2026-09-30" };
    expect(createRunSchema.safeParse({ ...base, runType: "regular" }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, runType: "off_cycle_overtime" }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, runType: "full_and_final" }).success).toBe(true);
    // The workbook lists arrears, bonus and reimbursement as run types; all three are now accepted.
    expect(createRunSchema.safeParse({ ...base, runType: "arrears" }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, runType: "bonus" }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, runType: "reimbursement" }).success).toBe(true);
    expect(createRunSchema.safeParse({ ...base, runType: "correction" }).success).toBe(false);
    expect(createRunSchema.safeParse({ period: "Sept 2026", payDate: "2026-09-30" }).success).toBe(false);
    // The pay date is mandatory and must be a date, not a period.
    expect(createRunSchema.safeParse({ period: "2026-09" }).success).toBe(false);
    expect(createRunSchema.safeParse({ period: "2026-09", payDate: "2026-09" }).success).toBe(false);
  });

  it("keeps a regular pay date on or after period end, and lets an off-cycle run pay early (FRM-PAY-03)", () => {
    expect(periodEndDate("2026-02")).toBe("2026-02-28");
    expect(periodEndDate("2028-02")).toBe("2028-02-29");
    expect(payDateAllowed("regular", "2026-09", "2026-09-30")).toBe(true);
    expect(payDateAllowed("regular", "2026-09", "2026-10-05")).toBe(true);
    expect(payDateAllowed("regular", "2026-09", "2026-09-20")).toBe(false);
    expect(payDateAllowed("arrears", "2026-09", "2026-09-20")).toBe(false);
    expect(payDateAllowed("off_cycle_overtime", "2026-09", "2026-09-20")).toBe(true);
    expect(payDateAllowed("full_and_final", "2026-09", "2026-09-12")).toBe(true);
    expect(createRunSchema.safeParse({ period: "2026-09", runType: "regular", payDate: "2026-09-20" }).success).toBe(false);
    expect(createRunSchema.safeParse({ period: "2026-09", runType: "off_cycle_overtime", payDate: "2026-09-20" }).success).toBe(true);
  });

  it("defaults the run header the way the workbook does (FRM-PAY-03)", () => {
    const parsed = createRunSchema.parse({ period: "2026-09", payDate: "2026-09-30" });
    expect(parsed.runType).toBe("regular");
    expect(parsed.includeArrears).toBe(true);
  });

  it("translates only the two run types whose slug differs from the stored scope (FRM-PAY-03)", () => {
    expect(scopeForRunType("off_cycle_overtime")).toBe("ot");
    expect(scopeForRunType("full_and_final")).toBe("full_final");
    expect(scopeForRunType("arrears")).toBe("arrears");
    expect(runTypeForScope("ot")).toBe("off_cycle_overtime");
    expect(runTypeForScope("full_final")).toBe("full_and_final");
    expect(runTypeForScope("bonus")).toBe("bonus");
    // `correction` is Nucleus-only and has no workbook run type; it is passed through unchanged.
    expect(runTypeForScope("correction")).toBe("correction");
  });

  it("hashes a run's inputs so the same inputs reproduce and a changed one does not (FRM-PAY-03)", () => {
    const base = {
      runId: "123e4567-e89b-12d3-a456-426614174000",
      period: "2026-09",
      scope: "regular",
      rulePackVersionId: "123e4567-e89b-12d3-a456-426614174001",
      payGroupId: "123e4567-e89b-12d3-a456-426614174002",
      employeeIds: [EMPLOYEE, OTHER],
      inputs: [{ employee_id: EMPLOYEE, component: "bonus", amount_minor: "500000" }],
    };
    const first = reproducibilityStamp(base);
    // Employee order is not an input change; the hash sorts before it hashes.
    expect(reproducibilityStamp({ ...base, employeeIds: [OTHER, EMPLOYEE] }).inputHash).toBe(first.inputHash);
    expect(reproducibilityStamp({ ...base, inputs: [{ employee_id: EMPLOYEE, component: "bonus", amount_minor: "500001" }] }).inputHash).not.toBe(first.inputHash);
    expect(first.snapshotId.startsWith(`${base.runId}:`)).toBe(true);
  });

  it("holds a correction reason to the workbook's 15-character minimum (FRM-PAY-03)", () => {
    const adjustment = { employeeId: EMPLOYEE, component: "bonus", amountMinor: 5_000 };
    expect(correctRunSchema.safeParse({ reason: "Bonus omitted", adjustments: [adjustment] }).success).toBe(false);
    expect(correctRunSchema.safeParse({ reason: "Bonus omitted from the September run", adjustments: [adjustment] }).success).toBe(true);
  });

  it("bounds anomaly dispositions with mandatory reasons (FRM-PAY-04)", () => {
    expect(resolveAnomalySchema.safeParse({ disposition: "resolve", resolution: "Verified bank change" }).success).toBe(true);
    expect(resolveAnomalySchema.safeParse({ disposition: "assign", resolution: "Assigned to payroll reviewer" }).success).toBe(true);
    expect(resolveAnomalySchema.safeParse({ disposition: "escalate", resolution: "Escalated to the payroll manager" }).success).toBe(true);
    expect(resolveAnomalySchema.safeParse({ disposition: "ignore", resolution: "x" }).success).toBe(false);
    expect(resolveAnomalySchema.safeParse({ disposition: "resolve", resolution: "" }).success).toBe(false);
  });

  it("holds a waiver to the workbook's 20-character reason (FRM-PAY-04)", () => {
    // "Verified bank change" is exactly 20 characters: the boundary the workbook states.
    expect(resolveAnomalySchema.safeParse({ disposition: "waive", resolution: "Verified bank change" }).success).toBe(true);
    expect(resolveAnomalySchema.safeParse({ disposition: "waive", resolution: "Known issue" }).success).toBe(false);
    // The same short reason is fine on a resolution; only a waiver carries the longer minimum.
    expect(resolveAnomalySchema.safeParse({ disposition: "resolve", resolution: "Known issue" }).success).toBe(true);
  });
});

describe("payroll run cockpit presentation (SCR-030)", () => {
  it("labels scopes, periods and display statuses", () => {
    expect(scopeLabel("regular")).toBe("Regular");
    expect(scopeLabel("ot")).toBe("Off-cycle overtime");
    expect(scopeLabel("full_final")).toBe("Full and final");
    expect(formatPeriodLabel("2026-08")).toBe("Aug 2026");
    expect(formatPeriodLabel("not-a-period")).toBe("not-a-period");
    expect(displayRunStatus("draft")).toBe("DRAFT");
    expect(displayRunStatus("calculated")).toBe("PRE_AUDIT");
    expect(displayRunStatus("approved")).toBe("PRE_AUDIT");
    expect(displayRunStatus("finalized")).toBe("CLOSED");
    expect(displayRunStatus("paid")).toBe("CLOSED");
  });

  it("builds stable display-only run codes", () => {
    expect(displayRunCode("2026-08", "123e4567-e89b-12d3-a456-426614174000")).toBe("PR-2026-08-123E");
  });

  it("derives the 8-step timeline from persisted state", () => {
    const fresh = deriveTimeline({ status: "draft", inputsExist: false, anomaliesOpen: 0, anomaliesTotal: 0, approvalsExist: false, payslipsExist: false });
    expect(fresh.map((step) => step.key)).toEqual(["draft", "inputs_locked", "pre_audit", "calculated", "review", "approved", "disbursed", "closed"]);
    expect(fresh[0]!.state).toBe("done");
    expect(fresh[1]!.state).toBe("current");
    const closed = deriveTimeline({ status: "finalized", inputsExist: true, anomaliesOpen: 0, anomaliesTotal: 2, approvalsExist: true, payslipsExist: true });
    expect(closed.every((step) => step.state === "done")).toBe(true);
    const calculated = deriveTimeline({ status: "calculated", inputsExist: true, anomaliesOpen: 1, anomaliesTotal: 2, approvalsExist: false, payslipsExist: false });
    expect(calculated.find((step) => step.key === "calculated")!.state).toBe("done");
    expect(calculated.find((step) => step.key === "review")!.state).toBe("current");
  });
});

describe("pre-payroll audit findings (SCR-031)", () => {
  it("maps finding statuses to the audit vocabulary", () => {
    expect(findingDisplayStatus("open")).toBe("OPEN");
    expect(findingDisplayStatus("acknowledged")).toBe("ASSIGNED");
    expect(findingDisplayStatus("resolved")).toBe("RESOLVED");
    expect(findingDisplayStatus("overridden")).toBe("WAIVED");
    expect(findingDisplayStatus("escalated")).toBe("ESCALATED");
  });

  it("derives the open → assigned → resolved/waived timeline", () => {
    const open = findingTimeline("open");
    expect(open.map((step) => step.label)).toEqual(["Open", "Assigned", "Resolved"]);
    expect(open[0]!.state).toBe("done");
    expect(open[1]!.state).toBe("current");
    expect(open[2]!.state).toBe("todo");
    const assigned = findingTimeline("acknowledged");
    expect(assigned[1]!.state).toBe("done");
    expect(assigned[2]!.state).toBe("current");
    const resolved = findingTimeline("resolved");
    expect(resolved.every((step) => step.state === "done")).toBe(true);
    const waived = findingTimeline("overridden");
    expect(waived[2]!.label).toBe("Waived");
    expect(waived.every((step) => step.state === "done")).toBe(true);
  });

  it("maps snake_case join rows to the camelCase finding contract", () => {
    const mapped = toScopeFinding({
      id: "a1",
      payroll_run_id: "r1",
      employee_id: "e1",
      rule_code: "missing-salary",
      severity: "critical",
      status: "open",
      resolution: null,
      facts: { note: "Bank account change unverified", impact_amount_minor: 125_000, suggested_resolution: "Re-verify against the cancelled cheque" },
      created_at: "2026-09-01T00:00:00.000Z",
      period: "2026-09",
      scope: "regular",
      run_status: "draft",
      employee_count: 412,
      first_name: "Asha",
      last_name: "K",
      employee_code: "E-001",
      entity_code: "LE-01",
    });
    expect(mapped.payrollRunId).toBe("r1");
    expect(mapped.ruleCode).toBe("missing-salary");
    expect(mapped.runStatus).toBe("draft");
    expect(mapped.firstName).toBe("Asha");
    expect(mapped.entityCode).toBe("LE-01");
    expect(mapped.employeeCount).toBe(412);
    expect(mapped.description).toBe("Bank account change unverified");
    expect(mapped.impactAmountMinor).toBe(125_000);
    expect(mapped.suggestedResolution).toBe("Re-verify against the cancelled cheque");
  });

  it("falls back to the raising rule's reason when a finding carries no note (FRM-PAY-04)", () => {
    const mapped = toScopeFinding({
      id: "a2",
      payroll_run_id: "r1",
      employee_id: "e1",
      rule_code: "missing-salary",
      severity: "critical",
      status: "open",
      resolution: null,
      created_at: null,
      period: "2026-09",
      scope: "regular",
      run_status: "draft",
      employee_count: null,
      first_name: null,
      last_name: null,
      employee_code: null,
      entity_code: null,
      facts: { reason: "No basic salary available for calculation." },
    });
    expect(mapped.description).toBe("No basic salary available for calculation.");
    expect(mapped.impactAmountMinor).toBeNull();
    expect(mapped.suggestedResolution).toBeNull();
  });

  it("validates manual log-finding payloads", () => {
    const base = { payrollRunId: "123e4567-e89b-12d3-a456-426614174000", employeeId: "123e4567-e89b-12d3-a456-426614174001", ruleCode: "missing-salary" };
    expect(logFindingSchema.safeParse(base).success).toBe(true);
    // Severity now speaks PL_SEVERITY; the queue's old high/medium/low spelling is rejected.
    expect(logFindingSchema.safeParse({ ...base, severity: "critical" }).success).toBe(true);
    expect(logFindingSchema.safeParse({ ...base, severity: "high" }).success).toBe(false);
    expect(logFindingSchema.parse(base).severity).toBe("warning");
    expect(logFindingSchema.safeParse({ ...base, ruleCode: "" }).success).toBe(false);
    expect(logFindingSchema.safeParse({ ...base, payrollRunId: "not-a-uuid" }).success).toBe(false);
    expect(logFindingSchema.safeParse({ ...base, impactAmountMinor: 125_000, suggestedResolution: "Re-verify" }).success).toBe(true);
    expect(logFindingSchema.safeParse({ ...base, impactAmountMinor: 1250.5 }).success).toBe(false);
  });
});

describe("loan schemas (OC-P4-01/02)", () => {
  it("requires two to three distinct guarantors", () => {
    const base = { employeeId: EMPLOYEE, principalMinor: 20_000_000, tenureMonths: 24, annualRatePct: 10, purpose: "personal" };
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER, EMPLOYEE] }).success).toBe(true);
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER] }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, guarantorEmployeeIds: [OTHER, OTHER] }).success).toBe(true);
  });

  it("bounds principal, tenure and rate", () => {
    const base = { employeeId: EMPLOYEE, tenureMonths: 24, annualRatePct: 10, purpose: "personal", guarantorEmployeeIds: [OTHER, EMPLOYEE] };
    expect(applyLoanSchema.safeParse({ ...base, principalMinor: 0 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, tenureMonths: 0 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, tenureMonths: 85 }).success).toBe(false);
    expect(applyLoanSchema.safeParse({ ...base, annualRatePct: 37 }).success).toBe(false);
  });

  it("defaults director override off and validates repayments", () => {
    expect(approveLoanSchema.safeParse({}).data).toMatchObject({ directorOverride: false });
    expect(repayLoanSchema.safeParse({ amountMinor: 100_00 }).success).toBe(true);
    expect(repayLoanSchema.safeParse({ amountMinor: 0 }).success).toBe(false);
  });
});
