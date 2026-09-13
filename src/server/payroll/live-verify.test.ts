import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import {
  approveLoan,
  applyForLoan,
  consentGuarantee,
  disburseLoan,
  getLoan,
  repayLoan,
} from "@/server/loans/service";
import {
  approveRun,
  calculateRun,
  createRun,
  finalizeRun,
  getJournal,
  getPayslip,
  simulateWageBase,
} from "@/server/payroll/service";

config({ path: [".env.local", ".env"], quiet: true });

const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);
const client = () => neon(process.env.DATABASE_URL!);

async function accessFor(email: string, tenantId: string): Promise<Access> {
  const db = client();
  const users = (await db`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
  const rows = (await db`
    select m.id as membership_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.user_id = ${users[0]?.id ?? ""} and m.tenant_id = ${tenantId} and m.status = 'active'
    group by m.id
  `) as Array<{ membership_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error(`membership for ${email} not found`);
  return {
    context: { actorUserId: users[0]?.id ?? "", membershipId: membership.membership_id, tenantId, permissions: membership.permission_keys ?? [], roles: ["test"] },
    tenantId,
  };
}

describe.skipIf(!LIVE)("live P4 verification (opt-in)", () => {
  it("runs create -> calculate -> approve -> finalize with payslip and balanced journal", { timeout: 180_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const maker = await accessFor("opencode-smoke@example.test", tenantId);
    const checker = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-P4-${suffix}`}, 'Pay', 'Roll', 'Operator', 'Weaving', 'Plant North', '2020-01-15', 5000000)`;
    try {
      const run = await createRun(maker, { period: "2026-09", scope: "regular" }, crypto.randomUUID());
      expect(run.status).toBe("draft");
      const calc = await calculateRun(maker, run.id, [employeeId], crypto.randomUUID());
      expect(calc.calculated).toBe(1);
      // Golden: gross 85,000.00, PF capped 1,800.00, no ESI, PT 200.00, TDS 0.
      expect(calc.gross).toBe(8_500_000);
      expect(calc.deductions).toBe(180_000 + 20_000);
      expect(calc.net).toBe(8_500_000 - 200_000);
      const approved = await approveRun(maker, run.id, crypto.randomUUID());
      expect(approved.status).toBe("approved");
      // Maker cannot finalize their own run.
      await expect(finalizeRun(maker, run.id, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const finalized = await finalizeRun(checker, run.id, crypto.randomUUID());
      expect(finalized.status).toBe("finalized");
      expect(finalized.payslips).toBe(1);
      // Finalized runs are immutable.
      await expect(calculateRun(maker, run.id, [employeeId], crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      const journal = await getJournal(checker, run.id);
      expect(journal.balanced).toBe(true);
      const slips = (await db`select id from payslips where tenant_id = ${tenantId} and payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${run.id})`) as Array<{ id: string }>;
      expect(slips).toHaveLength(1);
      const slip = await getPayslip(checker, slips[0]?.id ?? "");
      expect((slip.lines as Array<{ code: string }>).map((line) => line.code)).toContain("basic");
      const sim = await simulateWageBase(checker, { basicMinor: 5_000_000, dearnessMinor: 500_000, scenario: "da-hike" }, crypto.randomUUID());
      expect(sim.resultMinor).toBe(5_500_000);
      expect(sim.posted).toBe(false);
      // Cleanup financial rows in FK-safe order.
      const members = (await db`select id from payroll_run_employees where payroll_run_id = ${run.id}`) as Array<{ id: string }>;
      for (const member of members) {
        await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
        await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
      }
      await db`delete from payroll_run_employees where payroll_run_id = ${run.id}`;
      await db`delete from payroll_anomalies where payroll_run_id = ${run.id}`;
      await db`delete from payroll_approvals where payroll_run_id = ${run.id}`;
      await db`delete from payroll_runs where id = ${run.id}`;
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from documents where tenant_id = ${tenantId} and employee_id = ${employeeId} and attributes->>'title' like 'Payslip%'`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      const members = (await db`select id from payroll_run_employees where payroll_run_id in (select id from payroll_runs where tenant_id = ${tenantId}) and employee_id = ${employeeId}`) as Array<{ id: string }>;
      for (const member of members) {
        await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
        await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
      }
      await db`delete from payroll_run_employees where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from payroll_anomalies where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from payroll_approvals where tenant_id = ${tenantId} and payroll_run_id in (select id from payroll_runs where tenant_id = ${tenantId})`;
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from documents where tenant_id = ${tenantId} and employee_id = ${employeeId} and attributes->>'title' like 'Payslip%'`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });

  it("runs apply -> guarantor consents -> approve -> disburse -> repay to closure", { timeout: 180_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const maker = await accessFor("opencode-smoke@example.test", tenantId);
    const g1 = await accessFor("approver-one@example.test", tenantId);
    const g2 = await accessFor("approver-two@example.test", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const mkEmployee = async (code: string, name: string) => {
      const personId = crypto.randomUUID();
      const employeeId = crypto.randomUUID();
      await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
      await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${code}, ${name}, 'Tdd', 'Operator', 'Weaving', 'Plant North', '2019-06-01', 5000000)`;
      return { personId, employeeId };
    };
    const borrower = await mkEmployee(`HO-TDD-LN-${suffix}`, "Borrower");
    const guar1 = await mkEmployee(`HO-TDD-G1-${suffix}`, "GuarantorOne");
    const guar2 = await mkEmployee(`HO-TDD-G2-${suffix}`, "GuarantorTwo");
    // Link guarantor logins for consent; borrower stays link-free.
    const link = async (email: string, employeeId: string) => {
      const users = (await db`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
      await db`update memberships set employee_id = ${employeeId} where tenant_id = ${tenantId} and user_id = ${users[0]?.id ?? ""}`;
    };
    await link("approver-one@example.test", guar1.employeeId);
    await link("approver-two@example.test", guar2.employeeId);
    try {
      const applied = await applyForLoan(maker, {
        employeeId: borrower.employeeId, principalMinor: 15_000_000, tenureMonths: 24,
        annualRatePct: 10, purpose: "Medical emergency", guarantorEmployeeIds: [guar1.employeeId, guar2.employeeId],
      }, crypto.randomUUID());
      expect(applied.status).toBe("submitted");
      expect(applied.ceiling).toBe(300000);
      // Approval before consents is blocked.
      await expect(approveLoan(maker, applied.id, { directorOverride: false }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await consentGuarantee(g1, applied.id, true, crypto.randomUUID());
      await consentGuarantee(g2, applied.id, true, crypto.randomUUID());
      const approved = await approveLoan(maker, applied.id, { directorOverride: false }, crypto.randomUUID());
      expect(approved.status).toBe("approved");
      expect(approved.emiMinor).toBeGreaterThan(0);
      const disbursed = await disburseLoan(maker, applied.id, crypto.randomUUID());
      expect(disbursed.status).toBe("disbursed");
      // Borrower cannot take a second loan while exposed.
      await expect(applyForLoan(maker, {
        employeeId: borrower.employeeId, principalMinor: 5_000_000, tenureMonths: 12,
        annualRatePct: 10, purpose: "Second", guarantorEmployeeIds: [guar1.employeeId, guar2.employeeId],
      }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const partial = await repayLoan(maker, applied.id, { amountMinor: 5_000_000 }, crypto.randomUUID());
      expect(partial.outstandingMinor).toBe(10_000_000);
      const closed = await repayLoan(maker, applied.id, { amountMinor: 10_000_000 }, crypto.randomUUID());
      expect(closed.status).toBe("repaid");
      const detail = await getLoan(maker, applied.id);
      expect(detail.guarantors).toHaveLength(2);
      expect(detail.schedule).not.toBeNull();
      // Cleanup in FK-safe order (unlink memberships first: the composite
      // FK would otherwise null tenant_id, which is NOT NULL).
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id in (${guar1.employeeId}, ${guar2.employeeId})`;
      await db`delete from loan_transactions where tenant_id = ${tenantId} and employee_loan_id = ${applied.id}`;
      await db`delete from loan_schedules where tenant_id = ${tenantId} and employee_loan_id = ${applied.id}`;
      await db`delete from loan_guarantors where tenant_id = ${tenantId} and employee_loan_id = ${applied.id}`;
      await db`delete from employee_loans where id = ${applied.id}`;
      await db`delete from loans where id = ${applied.id}`;
      for (const person of [borrower, guar1, guar2]) {
        await db`delete from employees where id = ${person.employeeId}`;
        await db`delete from people where id = ${person.personId}`;
      }
    } finally {
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id in (${guar1.employeeId}, ${guar2.employeeId})`;
      const loanIds = (await db`select id from employee_loans where tenant_id = ${tenantId} and employee_id = ${borrower.employeeId}`) as Array<{ id: string }>;
      for (const loan of loanIds) {
        await db`delete from loan_transactions where tenant_id = ${tenantId} and employee_loan_id = ${loan.id}`;
        await db`delete from loan_schedules where tenant_id = ${tenantId} and employee_loan_id = ${loan.id}`;
        await db`delete from loan_guarantors where tenant_id = ${tenantId} and employee_loan_id = ${loan.id}`;
      }
      await db`delete from employee_loans where tenant_id = ${tenantId} and employee_id = ${borrower.employeeId}`;
      await db`delete from loans where tenant_id = ${tenantId} and employee_id = ${borrower.employeeId}`;
      for (const person of [borrower, guar1, guar2]) {
        await db`delete from loan_guarantors where tenant_id = ${tenantId} and guarantor_employee_id = ${person.employeeId}`;
        await db`delete from employees where id = ${person.employeeId}`;
        await db`delete from people where id = ${person.personId}`;
      }
    }
  });
});
