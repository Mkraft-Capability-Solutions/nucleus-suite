import { afterAll, describe, expect, it } from "vitest";

import type { Access } from "@/server/platform/access";
import {
  ACCEPTANCE_DEPARTMENT,
  ACTORS,
  type ActorKey,
  HEAD_OFFICE_LOCATION,
  LIVE,
  PLANT_LOCATION,
  SHIFTS,
  accessFor,
  addDays,
  at,
  createScenarioEmployee,
  db,
  removeScenarioRows,
  tenantId,
} from "@/server/acceptance/fixture";
import { decideAdvance, requestAdvance } from "@/server/advances/service";
import { decideGatePass, ingestPunches, requestGatePass, traceDay, transitionDay } from "@/server/attendance/service";
import {
  allocateFormSerial,
  deriveStatutoryFormValues,
  describeStatutoryTemplates,
  loadFormSerialRegister,
  voidFormSerial,
} from "@/server/compliance/statutory-forms";
import { listErpQueue, retryErpRecord, syncErpEmployee } from "@/server/integrations/erp-sync";
import { saveErpSettings } from "@/server/integrations/erp-settings";
import { connectIntegration } from "@/server/integrations/service";
import { waiveClearanceItem } from "@/server/lifecycle/clearance-board";
import { clearClearanceItem, ensureEmployment, startOffboarding } from "@/server/lifecycle/service";
import { applyForLoan, approveLoan, disburseLoan, getLoan, loanConfigurationGaps, repayLoan } from "@/server/loans/service";
import { getJournal, listGlAccounts, postJournal, unmappedComponents, upsertGlAccount } from "@/server/payroll/gl";
import { approveRun, calculateRun, createRun, finalizeRun, upsertPayrollInput } from "@/server/payroll/service";
import { executeVpCommand } from "@/server/vp/service";
import { mutateOperationalRecord } from "@/server/workflows/operational-service";

/**
 * Client acceptance scenarios T-19 … T-32 for loans, advances, payroll runs, gate
 * passes, ERP sync, GL posting, settlement and statutory forms. Every scenario
 * creates its own employees under its `T-nn` prefix; `afterAll` removes them and
 * every payroll, ledger and statutory row the scenarios wrote.
 *
 * Opt in with MKRAFT_LIVE_VERIFY=1 and DATABASE_URL, after
 * scripts/seed-acceptance-demo.ts has run.
 */

const TIMEOUT = 120_000;
const TESTS = ["T-19", "T-20", "T-21", "T-22", "T-23", "T-28", "T-29", "T-30", "T-31", "T-32"] as const;
const rid = () => crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const currentPeriod = () => today().slice(0, 7);

/** ISO date `years` before today, on the elapsed-time basis `completedServiceYears` uses. */
function yearsAgo(years: number): string {
  return new Date(Date.now() - years * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function periodEnd(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Rows the scenarios write outside the employee envelope, for afterAll.
// ---------------------------------------------------------------------------
const created = {
  payrollRunIds: [] as string[],
  glAccountIds: [] as string[],
  ledgerRecordIds: [] as string[],
  ruleSetIds: [] as string[],
  statutoryInstanceIds: [] as string[],
  serialIds: [] as string[],
  erpExternalKeys: [] as string[],
  connectionIds: [] as string[],
};
const claimedPeriods = new Set<string>();

/** A payroll period with no run of any scope on the tenant, so scenario runs never collide. */
async function freePeriod(): Promise<string> {
  const tenant = await tenantId();
  const rows = (await db()`select distinct period from payroll_runs where tenant_id = ${tenant}`) as Array<{ period: string }>;
  const used = new Set(rows.map((row) => row.period));
  for (let year = 2027; year <= 2032; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const period = `${year}-${String(month).padStart(2, "0")}`;
      if (used.has(period) || claimedPeriods.has(period)) continue;
      claimedPeriods.add(period);
      return period;
    }
  }
  throw new Error("No free payroll period between 2027 and 2032.");
}

/**
 * The first of the workbook's named actors whose live permission set holds every key the
 * step enforces, falling back to the owner. The fallback is printed, so a seed that leaves
 * the named role short of a permission shows up in the run log rather than as a bare
 * FORBIDDEN; the owner's separation-of-duties limits then still apply.
 */
async function actorHolding(step: string, permissions: string[], preferred: ActorKey[]): Promise<{ key: ActorKey; access: Access }> {
  for (const key of [...preferred, "owner" as const]) {
    const access = await accessFor(key);
    const held = access.context.permissions;
    if (permissions.every((permission) => held.includes(permission))) {
      if (!preferred.includes(key)) console.warn(`[acceptance] ${step}: none of ${preferred.map((actor) => ACTORS[actor]).join(", ")} holds ${permissions.join(" + ")}; using ${ACTORS[key]}.`);
      return { key, access };
    }
  }
  throw new Error(`${step}: no seeded actor (${[...preferred, "owner" as const].map((actor) => ACTORS[actor]).join(", ")}) holds ${permissions.join(" + ")}.`);
}

/** Draft → calculate → approve (payroll admin) → finalize (owner) for one employee. */
async function finalizedRegularRun(employeeId: string, period: string) {
  const payroll = await accessFor("payrollAdmin");
  const owner = await accessFor("owner");
  const run = await createRun(payroll, { period, runType: "regular", payDate: addDays(periodEnd(period), 5), includeArrears: true }, rid());
  created.payrollRunIds.push(run.id);
  const calc = await calculateRun(payroll, run.id, [employeeId], rid());
  expect(calc.calculated).toBe(1);
  await approveRun(payroll, run.id, rid());
  const finalized = await finalizeRun(owner, run.id, rid());
  expect(finalized.status).toBe("finalized");
  return { runId: run.id, calc };
}

async function loanAttributes(loanId: string): Promise<Record<string, unknown>> {
  const rows = (await db()`select attributes from employee_loans where id = ${loanId}`) as Array<{ attributes: Record<string, unknown> }>;
  return rows[0]?.attributes ?? {};
}

async function locationByName(name: string): Promise<{ id: string; code: string | null; state: string | null } | null> {
  const tenant = await tenantId();
  const rows = (await db()`
    select id, attributes->>'code' as code, attributes->>'state' as state from locations
    where tenant_id = ${tenant} and (attributes->>'name' = ${name} or attributes->>'code' = ${name})
    order by created_at limit 1
  `) as Array<{ id: string; code: string | null; state: string | null }>;
  return rows[0] ?? null;
}

/** Saves a minimal approved template for a state/form only when none is approved, so the seed's own is never retired. */
async function ensureTemplate(owner: Access, hr: Access, stateCode: string, formCode: string, template: string): Promise<void> {
  const described = await describeStatutoryTemplates(hr, { stateCode, formCode });
  if (described.items.some((item) => item.approved)) return;
  const saved = (await executeVpCommand(owner, {
    action: "save_rule_set",
    domain: "statutory",
    code: `${stateCode}:${formCode}`,
    effectiveFrom: "2020-01-01",
    config: { template },
  }, rid())) as { id: string };
  created.ruleSetIds.push(saved.id);
}

// ---------------------------------------------------------------------------

describe.skipIf(!LIVE)("acceptance: payroll, loans, gate pass, ERP, GL, settlement, statutory (T-19 … T-32)", () => {
  afterAll(async () => {
    const tenant = await tenantId();
    const client = db();
    const patterns = TESTS.map((test) => `${test}-%`);
    const employees = (await client`select id from employees where tenant_id = ${tenant} and employee_code like any(${patterns}::text[])`) as Array<{ id: string }>;
    const ids = employees.map((row) => row.id);

    // Statutory: instances and serials the scenarios generated.
    if (created.serialIds.length > 0) await client`delete from statutory_form_serials where tenant_id = ${tenant} and id = any(${created.serialIds}::uuid[])`;
    if (created.statutoryInstanceIds.length > 0) {
      await client`delete from statutory_form_serials where tenant_id = ${tenant} and statutory_instance_id = any(${created.statutoryInstanceIds}::uuid[])`;
      await client`delete from vp_statutory_instances where tenant_id = ${tenant} and id = any(${created.statutoryInstanceIds}::uuid[])`;
    }
    if (ids.length > 0) {
      await client`delete from statutory_form_serials where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
      await client`delete from vp_statutory_instances where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
    }
    if (created.ruleSetIds.length > 0) await client`delete from vp_rule_sets where tenant_id = ${tenant} and id = any(${created.ruleSetIds}::uuid[])`;

    // Settlement envelope: full and final, clearance, offboarding (none carry employee_id).
    if (ids.length > 0) {
      await client`delete from full_final_settlements where tenant_id = ${tenant} and employment_id in (select id from employments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))`;
      await client`delete from clearance_items where tenant_id = ${tenant} and offboarding_case_id in (select id from offboarding_cases where tenant_id = ${tenant} and employment_id in (select id from employments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])))`;
      await client`delete from offboarding_cases where tenant_id = ${tenant} and employment_id in (select id from employments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))`;
      await client`delete from hrms_operation_events where tenant_id = ${tenant} and record_id in (select id from hrms_operation_records where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[]))`;
    }

    // Payroll runs the scenarios drafted, in FK-safe order.
    for (const runId of created.payrollRunIds) {
      await client`delete from full_final_settlements where tenant_id = ${tenant} and payroll_run_id = ${runId}`;
      await client`delete from payroll_export_lines where tenant_id = ${tenant} and payroll_export_id in (select id from payroll_exports where tenant_id = ${tenant} and payroll_run_id = ${runId})`;
      await client`delete from payroll_exports where tenant_id = ${tenant} and payroll_run_id = ${runId}`;
      const members = (await client`select id from payroll_run_employees where payroll_run_id = ${runId}`) as Array<{ id: string }>;
      for (const member of members) {
        const docs = (await client`select document_id from payslips where payroll_run_employee_id = ${member.id}`) as Array<{ document_id: string }>;
        await client`delete from payslips where payroll_run_employee_id = ${member.id}`;
        for (const doc of docs) {
          await client`delete from document_versions where tenant_id = ${tenant} and document_id = ${doc.document_id}`;
          await client`delete from documents where id = ${doc.document_id}`;
        }
        await client`delete from payroll_calculations where tenant_id = ${tenant} and payroll_run_employee_id = ${member.id}`;
        await client`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
      }
      await client`delete from payroll_run_employees where payroll_run_id = ${runId}`;
      await client`delete from payroll_anomalies where payroll_run_id = ${runId}`;
      await client`delete from payroll_approvals where payroll_run_id = ${runId}`;
      await client`delete from payroll_runs where id = ${runId}`;
    }

    // GL rows the scenarios created (the seed's own mappings are left alone).
    if (created.glAccountIds.length > 0) {
      await client`delete from gl_mappings where tenant_id = ${tenant} and (debit_account_id = any(${created.glAccountIds}::uuid[]) or credit_account_id = any(${created.glAccountIds}::uuid[]))`;
      await client`delete from gl_accounts where tenant_id = ${tenant} and id = any(${created.glAccountIds}::uuid[])`;
    }
    if (created.ledgerRecordIds.length > 0) {
      await client`delete from gl_mappings where tenant_id = ${tenant} and attributes->>'workflow_record_id' = any(${created.ledgerRecordIds}::text[])`;
      await client`delete from hrms_operation_events where tenant_id = ${tenant} and record_id = any(${created.ledgerRecordIds}::uuid[])`;
      await client`delete from hrms_operation_records where tenant_id = ${tenant} and id = any(${created.ledgerRecordIds}::uuid[])`;
    }

    // Loans and their children, which RESTRICT the employee delete.
    if (ids.length > 0) {
      const loans = (await client`select id from employee_loans where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`) as Array<{ id: string }>;
      const loanIds = loans.map((row) => row.id);
      if (loanIds.length > 0) {
        await client`delete from loan_transactions where tenant_id = ${tenant} and employee_loan_id = any(${loanIds}::uuid[])`;
        await client`delete from loan_schedules where tenant_id = ${tenant} and employee_loan_id = any(${loanIds}::uuid[])`;
        await client`delete from loan_guarantors where tenant_id = ${tenant} and employee_loan_id = any(${loanIds}::uuid[])`;
      }
      await client`delete from loan_guarantors where tenant_id = ${tenant} and guarantor_employee_id = any(${ids}::uuid[])`;
      await client`delete from employee_loans where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
      await client`delete from loans where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
      await client`delete from vp_feature_records where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
      await client`delete from employee_salary_assignments where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
      await client`delete from documents where tenant_id = ${tenant} and employee_id = any(${ids}::uuid[])`;
    }
    if (created.erpExternalKeys.length > 0) {
      await client`delete from vp_erp_records where tenant_id = ${tenant} and direction = 'inbound_employee' and external_key = any(${created.erpExternalKeys}::text[])`;
    }
    if (created.connectionIds.length > 0) {
      await client`delete from vp_erp_records where tenant_id = ${tenant} and connection_id = any(${created.connectionIds}::uuid[])`;
      await client`delete from integration_connections where tenant_id = ${tenant} and id = any(${created.connectionIds}::uuid[])`;
    }
    for (const test of TESTS) await removeScenarioRows(test);
    // The demo tenant now carries the full v1.1 dataset (payroll_lines alone runs into
    // the thousands), so the per-payroll-run-employee sweep above and removeScenarioRows'
    // own table scans take longer than the shared TIMEOUT budget affords. Scoped to just
    // this hook rather than raising TIMEOUT itself, which also bounds every test body.
  }, TIMEOUT * 3);

  // -------------------------------------------------------------------------
  // T-19 — second loan and a salary advance are both blocked until repayment.
  // -------------------------------------------------------------------------
  it("T-19: a second loan and a salary advance are blocked while a loan is outstanding, and both clear when it closes", { timeout: TIMEOUT }, async () => {
    const payroll = await accessFor("payrollAdmin");
    // approveLoan enforces payroll.run before the Director's own permission, so the sanctioning
    // actor must hold both.
    const { access: director } = await actorHolding("T-19 sanction", ["payroll.run", "loan.director.approve"], ["director"]);
    const borrower = await createScenarioEmployee({ test: "T-19", firstName: "Borrower", joiningDate: "2019-01-15", basicSalaryMinor: 4_000_000 });
    const g1 = await createScenarioEmployee({ test: "T-19", firstName: "GuarantorOne" });
    const g2 = await createScenarioEmployee({ test: "T-19", firstName: "GuarantorTwo" });
    const application = {
      employeeId: borrower.id, principalMinor: 6_000_000, tenureMonths: 12, annualRatePct: 10, purpose: "personal",
      interestMethod: "reducing_balance" as const, guarantorEmployeeIds: [g1.id, g2.id], specialTermsRequested: false,
    };
    const loan = await applyForLoan(payroll, application, rid());
    expect(loan.status).toBe("submitted");
    // W-05/W-06: the Director's recorded sanction stands in for the two guarantor logins
    // this fixture does not hold; the rule under test is the exposure interlock, not consent.
    const sanctioned = await approveLoan(director, loan.id, {
      directorOverride: true, rulesWaived: ["guarantors"],
      overrideReason: "Acceptance T-19: guarantor consent taken on paper for the demo run",
    }, rid());
    expect(sanctioned.status).toBe("approved");
    expect((await disburseLoan(payroll, loan.id, rid())).status).toBe("disbursed");

    // RL-21: both a second loan and an advance are refused for the same reason - the open loan.
    const secondLoan = applyForLoan(payroll, { ...application, principalMinor: 2_000_000 }, rid());
    await expect(secondLoan).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(secondLoan).rejects.toThrow(/loan/i);
    const advance = requestAdvance(payroll, { employeeId: borrower.id, amountMinor: 1_000_000, period: currentPeriod(), reason: "Acceptance T-19 advance while a loan is open", instalments: 1 }, rid());
    await expect(advance).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(advance).rejects.toThrow(/loan/i);

    // Repayment in full closes the loan; the same two requests now go through.
    const closed = await repayLoan(payroll, loan.id, { amountMinor: 6_000_000 }, rid());
    expect(closed.status).toBe("repaid");
    expect(closed.outstandingMinor).toBe(0);
    const advanceAfter = await requestAdvance(payroll, { employeeId: borrower.id, amountMinor: 1_000_000, period: currentPeriod(), reason: "Acceptance T-19 advance after the loan closed", instalments: 1 }, rid());
    expect(advanceAfter.status).toBe("requested");
    // An open advance is itself an exposure, so it is closed before the loan is re-applied.
    await decideAdvance(payroll, advanceAfter.id, { decision: "reject", remarks: "Acceptance T-19: closing the advance to test the loan path" }, rid());
    const loanAfter = await applyForLoan(payroll, { ...application, principalMinor: 2_000_000 }, rid());
    expect(loanAfter.status).toBe("submitted");
  });

  // -------------------------------------------------------------------------
  // T-20 — the guarantor interlock works both ways.
  // -------------------------------------------------------------------------
  it("T-20: a named guarantor can neither borrow nor stand guarantor again until the guaranteed loan is repaid", { timeout: TIMEOUT }, async () => {
    const payroll = await accessFor("payrollAdmin");
    const { access: director } = await actorHolding("T-20 sanction", ["payroll.run", "loan.director.approve"], ["director"]);
    const borrower = await createScenarioEmployee({ test: "T-20", firstName: "Borrower", joiningDate: "2019-01-15" });
    const g1 = await createScenarioEmployee({ test: "T-20", firstName: "GuarantorOne", joiningDate: "2019-01-15" });
    const g2 = await createScenarioEmployee({ test: "T-20", firstName: "GuarantorTwo", joiningDate: "2019-01-15" });
    const other = await createScenarioEmployee({ test: "T-20", firstName: "OtherBorrower", joiningDate: "2019-01-15" });
    const x = await createScenarioEmployee({ test: "T-20", firstName: "FreshOne" });
    const y = await createScenarioEmployee({ test: "T-20", firstName: "FreshTwo" });
    const base = { principalMinor: 3_000_000, tenureMonths: 12, annualRatePct: 10, purpose: "personal", interestMethod: "reducing_balance" as const, specialTermsRequested: false };

    const loan = await applyForLoan(payroll, { ...base, employeeId: borrower.id, guarantorEmployeeIds: [g1.id, g2.id] }, rid());
    expect(loan.status).toBe("submitted");

    // The block attaches the moment the guarantor is named (a pending guarantee still binds).
    const g1Borrows = applyForLoan(payroll, { ...base, employeeId: g1.id, guarantorEmployeeIds: [x.id, y.id] }, rid());
    await expect(g1Borrows).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(g1Borrows).rejects.toThrow(/guarantor/i);
    const g2NamedAgain = applyForLoan(payroll, { ...base, employeeId: other.id, guarantorEmployeeIds: [g2.id, y.id] }, rid());
    await expect(g2NamedAgain).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    await expect(g2NamedAgain).rejects.toThrow(/guarantor/i);

    // Sanction (Director override standing in for the guarantor logins), disburse, repay in full.
    await approveLoan(director, loan.id, { directorOverride: true, rulesWaived: ["guarantors"], overrideReason: "Acceptance T-20: guarantor consent taken on paper for the demo run" }, rid());
    await disburseLoan(payroll, loan.id, rid());
    const repaid = await repayLoan(payroll, loan.id, { amountMinor: 3_000_000 }, rid());
    expect(repaid.status).toBe("repaid");

    // Both blocks clear: g1 may borrow, g2 may stand guarantor again.
    const g1After = await applyForLoan(payroll, { ...base, employeeId: g1.id, guarantorEmployeeIds: [x.id, y.id] }, rid());
    expect(g1After.status).toBe("submitted");
    const z = await createScenarioEmployee({ test: "T-20", firstName: "FreshThree" });
    const g2After = await applyForLoan(payroll, { ...base, employeeId: other.id, guarantorEmployeeIds: [g2.id, z.id] }, rid());
    expect(g2After.status).toBe("submitted");
  });

  // -------------------------------------------------------------------------
  // T-21 — loan ceiling by service, and the Director's recorded waiver above it.
  // -------------------------------------------------------------------------
  it("T-21: ceiling is 4x basic under five years and 6x at five years or more; exceeding it needs a recorded Director approval", { timeout: TIMEOUT }, async () => {
    const payroll = await accessFor("payrollAdmin");
    const { access: director } = await actorHolding("T-21 Director sanction", ["payroll.run", "loan.director.approve"], ["director"]);
    const basic = 4_000_000; // 40,000.00 basic, as the workbook's example states it
    const base = { tenureMonths: 24, annualRatePct: 10, purpose: "personal", interestMethod: "reducing_balance" as const, specialTermsRequested: false };
    const guarantors = async () => [
      (await createScenarioEmployee({ test: "T-21", firstName: "Guarantor" })).id,
      (await createScenarioEmployee({ test: "T-21", firstName: "Guarantor" })).id,
    ];

    // Four years of service: 4x -> 160,000.00 (16,000,000 minor).
    const fourYears = await createScenarioEmployee({ test: "T-21", firstName: "FourYears", joiningDate: yearsAgo(4), basicSalaryMinor: basic });
    const atFour = await applyForLoan(payroll, { ...base, employeeId: fourYears.id, principalMinor: 16_000_000, guarantorEmployeeIds: await guarantors() }, rid());
    expect(atFour.ceilingMinor).toBe(16_000_000);
    expect(atFour.ceiling).toBe(160_000);
    expect(atFour.ceilingMultiple).toBe(4);
    expect(atFour.requiresDirectorApproval).toBe(false);

    // Six years of service: 6x -> 240,000.00 (24,000,000 minor).
    const sixYears = await createScenarioEmployee({ test: "T-21", firstName: "SixYears", joiningDate: yearsAgo(6), basicSalaryMinor: basic });
    const atSix = await applyForLoan(payroll, { ...base, employeeId: sixYears.id, principalMinor: 24_000_000, guarantorEmployeeIds: await guarantors() }, rid());
    expect(atSix.ceilingMinor).toBe(24_000_000);
    expect(atSix.ceiling).toBe(240_000);
    expect(atSix.ceilingMultiple).toBe(6);

    // RL-22 reads "five years or more": exactly 5.00 years is already the higher band.
    const fiveYears = await createScenarioEmployee({ test: "T-21", firstName: "FiveYears", joiningDate: yearsAgo(5), basicSalaryMinor: basic });
    const atFive = await applyForLoan(payroll, { ...base, employeeId: fiveYears.id, principalMinor: 24_000_000, guarantorEmployeeIds: await guarantors() }, rid());
    expect(atFive.ceilingMultiple).toBe(6);
    expect(atFive.ceilingMinor).toBe(24_000_000);

    // Over the ceiling: refused outright, recorded when special terms are requested.
    const overApplicant = await createScenarioEmployee({ test: "T-21", firstName: "OverCeiling", joiningDate: yearsAgo(4), basicSalaryMinor: basic });
    const overGuarantors = await guarantors();
    await expect(applyForLoan(payroll, { ...base, employeeId: overApplicant.id, principalMinor: 17_000_000, guarantorEmployeeIds: overGuarantors }, rid()))
      .rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    const recorded = await applyForLoan(payroll, {
      ...base, employeeId: overApplicant.id, principalMinor: 17_000_000, guarantorEmployeeIds: overGuarantors,
      specialTermsRequested: true, specialTermsReason: "Medical contingency for a dependant; Director sanction sought",
    }, rid());
    expect(recorded.status).toBe("submitted");
    expect(recorded.requiresDirectorApproval).toBe(true);
    const recordedRow = await loanAttributes(recorded.id);
    expect(recordedRow.special_terms_requested).toBe(true);
    expect(recordedRow.rules_requiring_waiver).toEqual(["ceiling"]);
    expect(Number(recordedRow.ceiling_minor)).toBe(16_000_000);

    // W-06: waiving the ceiling is a Director's approval, not the payroll desk's.
    const waiver = { directorOverride: true, rulesWaived: ["ceiling" as const], overrideReason: "Acceptance T-21: Director sanctions the amount above the service ceiling" };
    await expect(approveLoan(payroll, recorded.id, waiver, rid())).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A Director who does not name the ceiling among the waived rules is refused too.
    await expect(approveLoan(director, recorded.id, { ...waiver, rulesWaived: ["guarantors" as const] }, rid())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    const sanctioned = await approveLoan(director, recorded.id, waiver, rid());
    expect(sanctioned.status).toBe("approved");
    expect(sanctioned.sanctionedAmountMinor).toBe(17_000_000);
    const sanctionedRow = await loanAttributes(recorded.id);
    expect(sanctionedRow.rules_waived).toEqual(["ceiling"]);
    expect(sanctionedRow.director_override).toBe(true);
    const tenant = await tenantId();
    const approvals = (await db()`select status, data from vp_feature_records where tenant_id = ${tenant} and kind = 'loan_special_terms' and reference_id = ${recorded.id}`) as Array<{ status: string; data: Record<string, unknown> }>;
    expect(approvals).toHaveLength(1);
    expect(approvals[0]?.status).toBe("approved");
    expect(approvals[0]?.data.rules_waived).toEqual(["ceiling"]);

    // Q-08: the third-guarantor threshold has no approved value and is reported as such.
    const gaps = loanConfigurationGaps();
    expect(gaps.map((gap) => gap.setting)).toContain("thirdGuarantorThresholdMinor");
    const detail = await getLoan(payroll, recorded.id);
    expect(detail.configurationGaps.map((gap) => gap.setting)).toContain("thirdGuarantorThresholdMinor");
    expect(detail.eligibility.ceiling?.higherFromServiceYears).toBe(5);
  });

  // -------------------------------------------------------------------------
  // T-22 — OT is paid in its own run, only after the regular run is closed.
  // -------------------------------------------------------------------------
  it("T-22: an OT run is refused until the regular run is finalized, then carries only OT lines", { timeout: TIMEOUT }, async () => {
    const payroll = await accessFor("payrollAdmin");
    const owner = await accessFor("owner");
    const hr = await accessFor("hrManager");
    const period = await freePeriod();
    const employee = await createScenarioEmployee({ test: "T-22", firstName: "Overtime", joiningDate: "2021-01-15", basicSalaryMinor: 5_000_000 });

    // Locked attendance with OT: the workbook's 08:00 -> 03:20 session on a 12-hour shift.
    const workDate = `${period}-10`;
    const ingested = await ingestPunches(hr, {
      employeeId: employee.id, workDate, shiftCode: SHIFTS.A,
      punches: [
        { at: at(workDate, "08:00"), type: "in", source: "biometric_device" },
        { at: at(workDate, "20:30"), type: "out", source: "biometric_device" },
        { at: at(workDate, "21:15"), type: "in", source: "biometric_device" },
        { at: at(addDays(workDate, 1), "03:20"), type: "out", source: "biometric_device" },
      ],
    }, rid());
    const traced = await traceDay(hr, ingested.dayId);
    expect(traced.trace?.overtimeMinutes).toBe(440);
    // Approve before locking: `traceDay` only computes, it does not persist, and the day's
    // figures are written while it is still unlocked. Payroll pays overtime off the locked
    // day's own `payable_ot_minutes`, so an unapproved day would lock in zero.
    await transitionDay(hr, ingested.dayId, "approve", rid());
    await transitionDay(hr, ingested.dayId, "lock", rid());

    const regular = await createRun(payroll, { period, runType: "regular", payDate: addDays(periodEnd(period), 5), includeArrears: true }, rid());
    created.payrollRunIds.push(regular.id);
    // RL-23: no OT run while the regular run is open.
    await expect(createRun(payroll, { period, runType: "off_cycle_overtime", payDate: addDays(periodEnd(period), 10), includeArrears: true }, rid()))
      .rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    const regularCalc = await calculateRun(payroll, regular.id, [employee.id], rid());
    expect(regularCalc.calculated).toBe(1);
    await approveRun(payroll, regular.id, rid());
    // Still refused after approval: only a finalized run releases OT.
    await expect(createRun(payroll, { period, runType: "off_cycle_overtime", payDate: addDays(periodEnd(period), 10), includeArrears: true }, rid()))
      .rejects.toMatchObject({ code: "POLICY_VIOLATION" });
    // Maker/checker: the approver may not finalize.
    await expect(finalizeRun(payroll, regular.id, rid())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await finalizeRun(owner, regular.id, rid())).status).toBe("finalized");

    const ot = await createRun(payroll, { period, runType: "off_cycle_overtime", payDate: addDays(periodEnd(period), 10), includeArrears: true }, rid());
    created.payrollRunIds.push(ot.id);
    expect(ot.scope).toBe("ot");
    const otCalc = await calculateRun(payroll, ot.id, [employee.id], rid());
    expect(otCalc.calculated).toBe(1);
    expect(otCalc.gross).toBeGreaterThan(0);
    const tenant = await tenantId();
    const lines = (await db()`
      select attributes->>'code' as code from payroll_lines
      where tenant_id = ${tenant} and payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${ot.id})
    `) as Array<{ code: string }>;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.code === "ot")).toBe(true);
    const regularLines = (await db()`
      select attributes->>'code' as code from payroll_lines
      where tenant_id = ${tenant} and payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${regular.id})
    `) as Array<{ code: string }>;
    expect(regularLines.some((line) => line.code === "ot")).toBe(false);
    await approveRun(payroll, ot.id, rid());
    expect((await finalizeRun(owner, ot.id, rid())).status).toBe("finalized");
  });

  // -------------------------------------------------------------------------
  // T-23 — gate pass entitlement and credit.
  // -------------------------------------------------------------------------
  it("T-23: a third personal gate pass in the month is refused; approved hours credit the day, a pending pass adds nothing", { timeout: TIMEOUT }, async () => {
    const hr = await accessFor("hrManager");
    const supervisor = await accessFor("supervisor");
    const employee = await createScenarioEmployee({ test: "T-23", firstName: "GatePass" });
    const period = currentPeriod();
    const day1 = `${period}-01`;
    const day2 = `${period}-02`;

    const first = await requestGatePass(hr, { employeeId: employee.id, date: day1, fromTime: "10:00", toTime: "12:00", passType: "personal", reason: "Bank visit for the acceptance run" }, rid());
    expect(first.minutes).toBe(120);
    const second = await requestGatePass(hr, { employeeId: employee.id, date: day2, fromTime: "10:00", toTime: "12:00", passType: "personal", reason: "School visit for the acceptance run" }, rid());
    expect(second.minutes).toBe(120);
    // RL-20: two passes of two hours exhaust the month; the third is blocked.
    await expect(requestGatePass(hr, { employeeId: employee.id, date: day2, fromTime: "14:00", toTime: "16:00", passType: "personal", reason: "Third pass in the same month" }, rid()))
      .rejects.toMatchObject({ code: "POLICY_VIOLATION" });

    // W-04: the reporting manager approves the first; the second stays pending.
    expect((await decideGatePass(supervisor, first.id, { approve: true }, rid())).status).toBe("approved");

    const punches = (date: string) => [
      { at: at(date, "08:00"), type: "in" as const, source: "biometric_device" as const },
      { at: at(date, "16:00"), type: "out" as const, source: "biometric_device" as const },
    ];
    const approvedDay = await ingestPunches(hr, { employeeId: employee.id, workDate: day1, shiftCode: SHIFTS.C, punches: punches(day1) }, rid());
    const pendingDay = await ingestPunches(hr, { employeeId: employee.id, workDate: day2, shiftCode: SHIFTS.C, punches: punches(day2) }, rid());
    const approvedTrace = await traceDay(hr, approvedDay.dayId);
    const pendingTrace = await traceDay(hr, pendingDay.dayId);
    expect(approvedTrace.trace?.gatePassMinutes).toBe(120);
    expect(approvedTrace.trace?.productiveMinutes).toBe(480 + 120);
    expect(approvedTrace.trace?.rawProductiveMinutes).toBe(480);
    expect(pendingTrace.trace?.gatePassMinutes).toBe(0);
    expect(pendingTrace.trace?.productiveMinutes).toBe(480);
  });

  // -------------------------------------------------------------------------
  // T-28 — ERP employee master sync and failure handling.
  // -------------------------------------------------------------------------
  it("T-28: an ERP change lands on the employee; a failed sync is queued with its reason and can be retried after correction", { timeout: TIMEOUT }, async () => {
    const owner = await accessFor("owner");
    const tenant = await tenantId();
    const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();

    // FRM-FIN-02: the scenario's own ERP connection, with the field-ownership map that
    // answers Q-15 for it. Records are matched on the ERP id held on the employee row, and
    // a record no employee carries the id for is refused, not silently created.
    const connection = await connectIntegration(owner, { catalogCode: "erp-acceptance", environment: "Simulated", config: {}, verifiedRoundTrip: false }, rid());
    created.connectionIds.push(connection.id);
    await saveErpSettings(owner, {
      connectionId: connection.id, masterMode: "erp_owns", erpSystem: "custom_file_based", syncFrequency: "on_demand",
      fieldOwners: { firstName: "erp", lastName: "erp", workEmail: "erp", department: "erp", location: "erp", designation: "erp", joiningDate: "erp", basicSalaryMinor: "erp" },
      conflictPolicy: "owner_wins", matchKey: "external_id", unmatchedAction: "reject",
    }, rid());

    const employee = await createScenarioEmployee({ test: "T-28", firstName: "Before", lastName: "Sync", joiningDate: "2024-01-15" });
    const externalCode = `ERP-T28-${suffix}-A`;
    created.erpExternalKeys.push(externalCode);
    await db()`update employees set metadata = metadata || ${JSON.stringify({ erp_external_id: externalCode })}::jsonb where id = ${employee.id}`;
    const payload = {
      firstName: "Erp", lastName: "Changed", department: ACCEPTANCE_DEPARTMENT, location: PLANT_LOCATION,
      designation: "Operator", joiningDate: "2024-02-01", basicSalaryMinor: 4_100_000,
    };

    // The change in the ERP lands in Nucleus.
    const applied = await syncErpEmployee(owner, { connectionId: connection.id, externalCode, employee: payload }, rid());
    expect(applied.status).toBe("applied");
    expect(applied.replay).toBe(false);
    expect(applied.employeeId).toBe(employee.id);
    const after = (await db()`select first_name, joining_date::text as joining_date, basic_salary_minor from employees where id = ${employee.id}`) as Array<{ first_name: string; joining_date: string; basic_salary_minor: number | string }>;
    expect(after[0]?.first_name).toBe("Erp");
    expect(after[0]?.joining_date).toBe("2024-02-01");
    expect(Number(after[0]?.basic_salary_minor)).toBe(4_100_000);
    // The same payload again is a replay, not a second write.
    expect((await syncErpEmployee(owner, { connectionId: connection.id, externalCode, employee: payload }, rid())).replay).toBe(true);

    // Forced failure: a record for an ERP id no employee carries, under "reject".
    const unmatchedCode = `ERP-T28-${suffix}-B`;
    created.erpExternalKeys.push(unmatchedCode);
    const joinerPayload = { ...payload, firstName: "Late", lastName: "Joiner", joiningDate: "2024-03-01" };
    await expect(syncErpEmployee(owner, { connectionId: connection.id, externalCode: unmatchedCode, employee: joinerPayload }, rid()))
      .rejects.toMatchObject({ code: "ERP_RECORD_UNMATCHED" });
    const failedRows = (await db()`
      select id, status, error_message, attempt_count from vp_erp_records
      where tenant_id = ${tenant} and direction = 'inbound_employee' and external_key = ${unmatchedCode}
    `) as Array<{ id: string; status: string; error_message: string | null; attempt_count: number | string }>;
    expect(failedRows).toHaveLength(1);
    const failed = failedRows[0]!;
    expect(failed.status).toBe("failed");
    expect(failed.error_message ?? "").toMatch(/no employee matches/i);
    expect(Number(failed.attempt_count)).toBe(1);
    const queue = await listErpQueue(owner, { direction: "inbound_employee", status: "failed" });
    expect(queue.items.some((item) => item.id === failed.id && item.retryable && item.errorMessage)).toBe(true);

    // Retrying the uncorrected record fails again and counts the attempt.
    await expect(retryErpRecord(owner, failed.id, rid())).rejects.toMatchObject({ code: "ERP_RECORD_UNMATCHED" });
    const retried = (await db()`select status, attempt_count from vp_erp_records where id = ${failed.id}`) as Array<{ status: string; attempt_count: number | string }>;
    expect(retried[0]?.status).toBe("failed");
    expect(Number(retried[0]?.attempt_count)).toBe(2);

    // Correction: HR links the ERP id to the joiner's record; the same queue record is retried.
    const joiner = await createScenarioEmployee({ test: "T-28", firstName: "Not", lastName: "Linked", joiningDate: "2024-03-01" });
    await db()`update employees set metadata = metadata || ${JSON.stringify({ erp_external_id: unmatchedCode })}::jsonb where id = ${joiner.id}`;
    const recovered = await retryErpRecord(owner, failed.id, rid());
    expect(recovered.id).toBe(failed.id);
    expect(recovered.status).toBe("applied");
    expect(recovered.employeeId).toBe(joiner.id);
    expect(recovered.attemptCount).toBe(3);
    const corrected = (await db()`select first_name, last_name from employees where id = ${joiner.id}`) as Array<{ first_name: string; last_name: string }>;
    expect(corrected[0]?.first_name).toBe("Late");
    expect(corrected[0]?.last_name).toBe("Joiner");
    const settled = (await db()`select status, error_message from vp_erp_records where id = ${failed.id}`) as Array<{ status: string; error_message: string | null }>;
    expect(settled[0]?.status).toBe("applied");
    expect(settled[0]?.error_message).toBeNull();
  });

  // -------------------------------------------------------------------------
  // T-29 — payroll posting is idempotent and a failure is logged.
  // -------------------------------------------------------------------------
  it("T-29: the GL journal balances, re-posting is a no-op, and a failed post leaves a record with its failure code", { timeout: TIMEOUT }, async () => {
    const payroll = await accessFor("payrollAdmin");
    // FRM-FIN-01: Finance keeps the chart and the mappings; approval and posting are the
    // separate approve permission, and the approver must not be the record's author.
    const { access: finance } = await actorHolding("T-29 GL mapping author", ["payroll.accounting.write", "payroll.accounting.read"], ["finance", "payrollAdmin"]);
    // Two actors, not one. Finance authors the mappings and posts the journal — posting
    // enforces payroll.accounting.approve, so Finance must hold it — but the product
    // refuses to let the raiser approve its own record, so the approval is somebody else's.
    const { access: poster } = await actorHolding("T-29 GL poster", ["payroll.accounting.approve", "payroll.accounting.read"], ["finance"]);
    const { access: mappingApprover } = await actorHolding("T-29 GL mapping approver", ["payroll.accounting.approve", "payroll.accounting.read"], ["owner"]);
    const tenant = await tenantId();
    const period = await freePeriod();
    const employee = await createScenarioEmployee({ test: "T-29", firstName: "Ledger", joiningDate: "2021-01-15", basicSalaryMinor: 5_000_000 });
    // The journal is keyed by the employment's legal entity, so the leaver-free employment is created here.
    await ensureEmployment(payroll, employee.id);
    // A bonus input gives the run a component the seed is unlikely to have mapped, so the
    // retire step below can act on a mapping this scenario owns.
    await upsertPayrollInput(payroll, { employeeId: employee.id, period, component: "bonus", amountMinor: 500_000 }, rid());
    const { runId } = await finalizedRegularRun(employee.id, period);

    // RL-521: map whatever the seed left unmapped, through the ledger workflow.
    const entityRows = (await db()`
      select le.id, le.code from employments em join legal_entities le on le.tenant_id = em.tenant_id and le.id = em.legal_entity_id
      where em.tenant_id = ${tenant} and em.employee_id = ${employee.id} order by em.created_at desc limit 1
    `) as Array<{ id: string; code: string }>;
    const entity = entityRows[0];
    expect(entity, "the T-29 employment carries no legal entity").toBeTruthy();
    const unmapped = await unmappedComponents(finance, { runId });
    const ownedRecords: Array<{ id: string; version: number; componentCode: string }> = [];
    const account = async (code: string, name: string, type: "expense" | "liability" | "asset", purpose: "component" | "net_pay" = "component") => {
      // Finance, not payroll: `upsertGlAccount` enforces payroll.accounting.write, the same
      // permission the ledger mapping below is created under. Maintaining the chart of
      // accounts is an accounting job (W-08), so the two halves of this step use one actor.
      const row = await upsertGlAccount(finance, { legalEntityId: entity!.id, code, name, type, purpose, status: "active", effectiveFrom: "2020-01-01", effectiveTo: null }, rid());
      created.glAccountIds.push(row.id);
      return row;
    };
    for (const item of unmapped.items) {
      const debit = await account(`T29-${item.componentCode.toUpperCase()}-DR`, `${item.componentName} expense`, "expense");
      const credit = await account(`T29-${item.componentCode.toUpperCase()}-CR`, `${item.componentName} payable`, "liability");
      const record = (await mutateOperationalRecord(finance, "ledger", {
        action: "create", key: rid(),
        input: {
          entityCode: entity!.code, componentCode: item.componentCode, debitAccountCode: debit.code, creditAccountCode: credit.code,
          dimensionSource: ["cost_center"], postingSide: item.kind === "earning" ? "debit" : "credit",
          startDate: "2020-01-01", endDate: "2099-12-31",
        },
      })) as { id: string; version: number };
      created.ledgerRecordIds.push(record.id);
      const submitted = (await mutateOperationalRecord(finance, "ledger", { id: record.id, version: record.version, action: "submit", input: { reason: "Acceptance T-29 mapping" }, key: rid() })) as { version: number };
      const approved = (await mutateOperationalRecord(mappingApprover, "ledger", { id: record.id, version: submitted.version, action: "approve", input: { reason: "Acceptance T-29 mapping approved" }, key: rid() })) as { version: number; status: string };
      expect(approved.status).toBe("approved");
      ownedRecords.push({ id: record.id, version: approved.version, componentCode: item.componentCode });
    }
    const accounts = await listGlAccounts(finance, { legalEntityId: entity!.id });
    if (!accounts.some((row) => row.purpose === "net_pay" && row.status === "active")) {
      await account("T29-NET-PAY", "Salary payable", "liability", "net_pay");
    }
    expect((await unmappedComponents(finance, { runId })).items).toEqual([]);

    // First post creates the export; the second is unchanged; exactly one export row exists.
    const first = await postJournal(finance, runId, rid());
    expect(first.posted).toHaveLength(1);
    expect(first.posted[0]?.action).toBe("create");
    const second = await postJournal(finance, runId, rid());
    expect(second.posted[0]?.action).toBe("unchanged");
    expect(second.posted[0]?.exportId).toBe(first.posted[0]?.exportId);
    const exportsAfter = (await db()`select id, attributes->>'state' as state from payroll_exports where tenant_id = ${tenant} and payroll_run_id = ${runId}`) as Array<{ id: string; state: string }>;
    expect(exportsAfter).toHaveLength(1);
    expect(exportsAfter[0]?.state).toBe("posted");
    const journal = await getJournal(finance, runId);
    expect(journal.blocked).toBe(false);
    expect(journal.state).toBe("posted");
    expect(journal.totalDebitMinor).toBeGreaterThan(0);
    expect(journal.totalDebitMinor).toBe(journal.totalCreditMinor);
    expect(journal.balanced).toBe(true);

    // RP-15: retire a mapping and the next post fails visibly, with its failure code logged.
    const owned = ownedRecords[0];
    let restore: { data: Record<string, unknown> } | null = null;
    let retiredId: string;
    if (owned) {
      retiredId = owned.id;
      // `retire` is an approval transition like `approve`, so it is the approver's to make,
      // not the author's — Finance raised this mapping and cannot sign off its withdrawal.
      await mutateOperationalRecord(mappingApprover, "ledger", { id: owned.id, version: owned.version, action: "retire", input: { reason: "Acceptance T-29: mapping retired to force a posting failure" }, key: rid() });
    } else {
      // The seed mapped every component, bonus included: retire its bonus mapping and put an equivalent back afterwards.
      const seedRows = (await db()`select id, version, data from hrms_operation_records where tenant_id = ${tenant} and resource = 'ledger' and status = 'approved' and data->>'componentCode' = 'bonus' order by created_at desc limit 1`) as Array<{ id: string; version: number; data: Record<string, unknown> }>;
      expect(seedRows[0], "no approved ledger mapping for bonus to retire").toBeTruthy();
      retiredId = seedRows[0]!.id;
      restore = { data: seedRows[0]!.data };
      await mutateOperationalRecord(finance, "ledger", { id: retiredId, version: seedRows[0]!.version, action: "retire", input: { reason: "Acceptance T-29: mapping retired to force a posting failure" }, key: rid() });
    }
    await expect(postJournal(finance, runId, rid())).rejects.toMatchObject({ code: "GL_MAPPING_MISSING" });
    const exportsAfterFailure = (await db()`
      select attributes->>'state' as state, attributes->>'failure_code' as failure_code, attributes->>'failure_message' as failure_message
      from payroll_exports where tenant_id = ${tenant} and payroll_run_id = ${runId} order by created_at
    `) as Array<{ state: string; failure_code: string | null; failure_message: string | null }>;
    expect(exportsAfterFailure).toHaveLength(2);
    expect(exportsAfterFailure[0]?.state).toBe("posted");
    expect(exportsAfterFailure[1]?.state).toBe("failed");
    expect(exportsAfterFailure[1]?.failure_code).toBe("GL_MAPPING_MISSING");
    expect(exportsAfterFailure[1]?.failure_message ?? "").toMatch(/no effective GL mapping/i);
    if (restore) {
      const replacement = (await mutateOperationalRecord(payroll, "ledger", { action: "create", key: rid(), input: restore.data })) as { id: string; version: number };
      const resubmitted = (await mutateOperationalRecord(payroll, "ledger", { id: replacement.id, version: replacement.version, action: "submit", input: { reason: "Acceptance T-29: restoring the seed mapping" }, key: rid() })) as { version: number };
      await mutateOperationalRecord(finance, "ledger", { id: replacement.id, version: resubmitted.version, action: "approve", input: { reason: "Acceptance T-29: seed mapping restored" }, key: rid() });
    }
  });

  // -------------------------------------------------------------------------
  // T-30 — no dues gates the settlement; a waiver needs a reason.
  // -------------------------------------------------------------------------
  it("T-30: full and final cannot finalize while a clearance line is pending; a reasoned waiver releases it, an unreasoned one does not", { timeout: TIMEOUT }, async () => {
    const hr = await accessFor("hrManager");
    const hrHead = await accessFor("hrHead");
    const finance = await accessFor("finance");
    const tenant = await tenantId();
    const period = await freePeriod();
    const employee = await createScenarioEmployee({ test: "T-30", firstName: "Leaver", joiningDate: "2021-01-15", basicSalaryMinor: 4_000_000 });
    const lastWorkingDate = addDays(today(), 30);

    const offboarding = await startOffboarding(hr, {
      employeeId: employee.id, exitType: "resignation", exitReasonCategory: "better_opportunity",
      reason: "Leaving for a better opportunity elsewhere (acceptance T-30)", lastWorkingDate,
      noticeWaivedDays: 0, isGardenLeave: false, rehireEligible: "yes", managerAccepted: true, hrAccepted: true,
    }, rid());
    expect(offboarding.clearanceInitiated).toBe(true);
    const items = (await db()`select id, attributes->>'owner' as owner from clearance_items where tenant_id = ${tenant} and offboarding_case_id = ${offboarding.caseId} order by attributes->>'owner'`) as Array<{ id: string; owner: string }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    const [pending, ...cleared] = items;
    for (const item of cleared) {
      expect((await clearClearanceItem(hr, item.id, { recoveryAmountMinor: 0 }, rid())).status).toBe("cleared");
    }

    // The settlement itself: drafted by HR Head, approved by Finance (W-08), against a finalized run.
    const { runId } = await finalizedRegularRun(employee.id, period);
    const proposal = (await mutateOperationalRecord(hrHead, "settlements", {
      action: "create", key: rid(),
      input: {
        employeeId: employee.id, offboardingCaseId: offboarding.caseId, payrollRunId: runId, lastWorkingDate,
        salaryPayableMinor: 4_000_000, leaveEncashmentMinor: 0, gratuityMinor: 0, otherEarningsMinor: 0,
        loanRecoveryMinor: 0, noticeRecoveryMinor: 0, taxDeductionMinor: 0,
        calculationPolicyReference: "Acceptance T-30 settlement policy reference", notes: "Acceptance T-30 full and final proposal",
      },
    })) as { id: string; version: number; status: string; netPayableMinor: number };
    expect(proposal.status).toBe("draft");
    expect(proposal.netPayableMinor).toBe(4_000_000);
    const submitted = (await mutateOperationalRecord(hrHead, "settlements", { id: proposal.id, version: proposal.version, action: "submit", input: { reason: "Proposal ready for Finance" }, key: rid() })) as { version: number; status: string };
    expect(submitted.status).toBe("submitted");
    const approved = (await mutateOperationalRecord(finance, "settlements", { id: proposal.id, version: submitted.version, action: "approve", input: { reason: "Figures verified by Finance" }, key: rid() })) as { version: number; status: string };
    expect(approved.status).toBe("approved");
    const finalize = () => mutateOperationalRecord(finance, "settlements", { id: proposal.id, version: approved.version, action: "finalize", input: { reason: "Release the settlement", paymentReference: "T30-PAY-0001" }, key: rid() });

    // RL-25: one line pending blocks release.
    await expect(finalize()).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });
    // A waiver that carries no reason still blocks (the SQL gate, not just the form).
    await db()`update clearance_items set attributes = attributes || '{"status":"waived","waive_reason":""}'::jsonb where id = ${pending!.id}`;
    await expect(finalize()).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });
    await db()`update clearance_items set attributes = attributes - 'waive_reason' || '{"status":"pending"}'::jsonb where id = ${pending!.id}`;
    // The service refuses an unreasoned waiver outright.
    await expect(waiveClearanceItem(hr, pending!.id, "", rid())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(waiveClearanceItem(hr, pending!.id, "too short", rid())).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(finalize()).rejects.toMatchObject({ code: "WORKFLOW_CONFLICT" });

    // Waived with a reason of twenty or more characters: release is permitted and the record saves.
    const waived = await waiveClearanceItem(hr, pending!.id, "Access card written off; facilities confirmed nothing is due", rid());
    expect(waived.to).toBe("waived");
    const finalized = (await finalize()) as { status: string };
    expect(finalized.status).toBe("finalized");
    const settlements = (await db()`select attributes->>'status' as status, payroll_run_id from full_final_settlements where tenant_id = ${tenant} and offboarding_case_id = ${offboarding.caseId}`) as Array<{ status: string; payroll_run_id: string }>;
    expect(settlements).toHaveLength(1);
    expect(settlements[0]?.status).toBe("settled");
    expect(settlements[0]?.payroll_run_id).toBe(runId);
    const cases = (await db()`select attributes->>'status' as status from offboarding_cases where id = ${offboarding.caseId}`) as Array<{ status: string }>;
    expect(cases[0]?.status).toBe("settled");
  });

  // -------------------------------------------------------------------------
  // T-31 — Form F from the employee record, with a gapless serial register.
  // -------------------------------------------------------------------------
  it("T-31: Form F is populated from the employee record in the establishment's state variant, with a gapless serial", { timeout: TIMEOUT }, async () => {
    const owner = await accessFor("owner");
    const hr = await accessFor("hrManager");
    const tenant = await tenantId();
    const plant = await locationByName(PLANT_LOCATION);
    expect(plant, `location "${PLANT_LOCATION}" is not on the location master`).toBeTruthy();
    expect(plant!.state, `location "${PLANT_LOCATION}" has no state, so no state variant can be resolved`).toBeTruthy();
    const stateCode = plant!.state!.trim().toUpperCase();
    const period = currentPeriod();
    const joiner = await createScenarioEmployee({ test: "T-31", firstName: "Form", lastName: "Joiner", joiningDate: `${period}-01` });

    const derived = await deriveStatutoryFormValues(hr, { formCode: "FORM_F", locationId: plant!.id, employeeId: joiner.id, period });
    expect(derived.stateCode).toBe(stateCode);
    expect(derived.employeeId).toBe(joiner.id);
    // Every value on the form is traceable to a record; nothing is typed.
    for (const field of Object.keys(derived.values)) {
      expect(derived.sources.find((source) => source.field === field)?.source, `${field} has no source`).toBeTruthy();
    }
    expect(derived.values.employee_code).toBe(joiner.code);
    expect(derived.values.employee_name).toBe("Form Joiner");
    expect(derived.values.date_of_joining).toBe(`${period}-01`);
    expect(derived.values.designation).toBe("Operator");
    expect(derived.values.nature_of_work).toBe("Operator");
    expect(derived.values.department).toBe(ACCEPTANCE_DEPARTMENT);
    expect(derived.values.state_code).toBe(stateCode);
    expect(derived.missing.map((entry) => entry.field)).not.toContain("employee_code");

    await ensureTemplate(owner, hr, stateCode, "FORM_F",
      "<p>Form F ({{ form_code }}, {{ state_code }}) period {{ period }}: {{ employee_code }} {{ employee_name }} joined {{ date_of_joining }}. Serial {{ serial_number }}.</p>");

    const generate = async (employeeId: string) => {
      const result = (await executeVpCommand(owner, { action: "generate_statutory_form", formCode: "FORM_F", employeeId, locationId: plant!.id, period }, rid())) as
        { id: string; status: string; serialNumber: number | null; renderedHtml: string; sources: Array<{ field: string; source: string }> };
      created.statutoryInstanceIds.push(result.id);
      return result;
    };
    const first = await generate(joiner.id);
    expect(first.status).toBe("generated");
    expect(typeof first.serialNumber).toBe("number");
    expect(first.renderedHtml).toContain(joiner.code);
    expect(first.sources.length).toBeGreaterThan(0);
    const instance = (await db()`select state_code, employee_id from vp_statutory_instances where tenant_id = ${tenant} and id = ${first.id}`) as Array<{ state_code: string; employee_id: string }>;
    expect(instance[0]?.state_code).toBe(stateCode);
    expect(instance[0]?.employee_id).toBe(joiner.id);

    // A spoiled serial is voided with a reason, never deleted, so the register stays gapless.
    const spoiled = await allocateFormSerial(owner, { establishmentKey: derived.establishmentKey, formCode: "FORM_F" });
    created.serialIds.push(spoiled.id);
    expect(spoiled.serialNumber).toBe(first.serialNumber! + 1);
    const voided = await voidFormSerial(owner, spoiled.id, "Acceptance T-31: form spoiled at the printer", rid());
    expect(voided.voidedAt).toBeTruthy();

    const secondJoiner = await createScenarioEmployee({ test: "T-31", firstName: "Second", lastName: "Joiner", joiningDate: `${period}-02` });
    const second = await generate(secondJoiner.id);
    expect(second.serialNumber).toBe(first.serialNumber! + 2);

    const register = await loadFormSerialRegister(hr, { formCode: "FORM_F", establishmentKey: derived.establishmentKey });
    expect(register.gapless).toBe(true);
    const establishment = register.establishments.find((entry) => entry.establishmentKey === derived.establishmentKey);
    expect(establishment?.gaps).toEqual([]);
    const mine = establishment!.serials.filter((serial) => [first.serialNumber, spoiled.serialNumber, second.serialNumber].includes(serial.serialNumber));
    expect(mine).toHaveLength(3);
    expect(mine.find((serial) => serial.serialNumber === spoiled.serialNumber)?.voidReason).toContain("spoiled");
    expect(mine.find((serial) => serial.serialNumber === first.serialNumber)?.employeeCode).toBe(joiner.code);
  });

  // -------------------------------------------------------------------------
  // T-32 — establishment returns in the establishment's own state variant.
  // -------------------------------------------------------------------------
  it("T-32: Forms 28, 18 and 36 derive every figure from the finalized run in the establishment's state variant", { timeout: TIMEOUT }, async () => {
    const owner = await accessFor("owner");
    const hr = await accessFor("hrManager");
    const tenant = await tenantId();
    const plant = await locationByName(PLANT_LOCATION);
    expect(plant, `location "${PLANT_LOCATION}" is not on the location master`).toBeTruthy();
    expect(plant!.state, `location "${PLANT_LOCATION}" has no state`).toBeTruthy();
    const stateCode = plant!.state!.trim().toUpperCase();
    const period = await freePeriod();
    // Wage figures are restricted to employees posted at the establishment, matched on its code.
    const employee = await createScenarioEmployee({ test: "T-32", firstName: "Return", joiningDate: "2021-01-15", basicSalaryMinor: 5_000_000, location: plant!.code ?? PLANT_LOCATION });
    const { runId, calc } = await finalizedRegularRun(employee.id, period);

    for (const formCode of ["FORM_28", "FORM_18", "FORM_36"] as const) {
      const derived = await deriveStatutoryFormValues(hr, { formCode, locationId: plant!.id, period });
      expect(derived.formCode).toBe(formCode);
      expect(derived.stateCode).toBe(stateCode);
      expect(derived.employeeId).toBeNull();
      for (const field of Object.keys(derived.values)) {
        expect(derived.sources.find((source) => source.field === field)?.source, `${formCode}: ${field} has no source`).toBeTruthy();
      }
      expect(derived.values.payroll_run_id).toBe(runId);
      expect(derived.values.employees_paid).toBe(1);
      expect(derived.values.gross_wages_minor).toBe(calc.gross);
      expect(derived.values.deductions_minor).toBe(calc.deductions);
      expect(derived.values.net_wages_minor).toBe(calc.net);
      expect(derived.sources.find((source) => source.field === "gross_wages")?.source).toMatch(/payroll_runs/);
      expect(derived.missing.map((entry) => entry.field)).not.toContain("gross_wages");
    }

    await ensureTemplate(owner, hr, stateCode, "FORM_28",
      "<p>{{ form_code }} {{ state_code }} {{ period }}: {{ employees_paid }} paid, gross {{ gross_wages }}, deductions {{ deductions }}, net {{ net_wages }}.</p>");
    const generated = (await executeVpCommand(owner, { action: "generate_statutory_form", formCode: "FORM_28", locationId: plant!.id, period }, rid())) as
      { id: string; status: string; serialNumber: number | null; renderedHtml: string; sources: Array<{ field: string }> };
    created.statutoryInstanceIds.push(generated.id);
    expect(generated.status).toBe("generated");
    expect(generated.serialNumber).toBeNull();
    expect(generated.renderedHtml).toContain(`${Math.trunc(calc.gross / 100)}.${String(calc.gross % 100).padStart(2, "0")}`);
    const instance = (await db()`select state_code, location_id, period from vp_statutory_instances where tenant_id = ${tenant} and id = ${generated.id}`) as Array<{ state_code: string; location_id: string; period: string }>;
    expect(instance[0]?.state_code).toBe(stateCode);
    expect(instance[0]?.location_id).toBe(plant!.id);
    // A caller cannot type a state either: an override is accepted only when it names an approved variant.
    await expect(executeVpCommand(owner, { action: "generate_statutory_form", formCode: "FORM_28", stateCode: "ZZ", locationId: plant!.id, period }, rid()))
      .rejects.toMatchObject({ code: "RULE_PACK_NOT_APPROVED" });

    // The second establishment resolves its own state from its own master record.
    const headOffice = await locationByName(HEAD_OFFICE_LOCATION);
    expect(headOffice, `location "${HEAD_OFFICE_LOCATION}" is not on the location master`).toBeTruthy();
    expect(headOffice!.state, `location "${HEAD_OFFICE_LOCATION}" has no state`).toBeTruthy();
    const other = await deriveStatutoryFormValues(hr, { formCode: "FORM_28", locationId: headOffice!.id, period });
    expect(other.stateCode).toBe(headOffice!.state!.trim().toUpperCase());
    expect(other.values.establishment_state).toBe(other.stateCode);
    if (other.stateCode !== stateCode) {
      // Different state, different template key: the plant's approved layout must not serve head office.
      const described = await describeStatutoryTemplates(hr, { stateCode: other.stateCode, formCode: "FORM_28" });
      expect(described.items[0]?.templateKey).toBe(`${other.stateCode}:FORM_28`);
      expect(described.items[0]?.templateKey).not.toBe(`${stateCode}:FORM_28`);
    }
  });
});
