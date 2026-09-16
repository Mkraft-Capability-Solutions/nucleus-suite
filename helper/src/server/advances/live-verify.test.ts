import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { decideAdvance, payAdvance, requestAdvance } from "@/server/advances/service";
import { approveRun, calculateRun, createRun, finalizeRun, listPayrollInputs, upsertPayrollInput } from "@/server/payroll/service";

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

describe.skipIf(!LIVE)("live advances and inputs verification (opt-in)", () => {
  it("flows advance request -> approve -> pay -> payroll recovery -> finalize marks recovered", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const maker = await accessFor("opencode-smoke@example.test", tenantId);
    const checker = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-AD-${suffix}`}, 'Adv', 'Ance', 'Operator', 'Weaving', 'Plant North', '2021-01-15', 5000000)`;
    let runId = "";
    try {
      // Over-cap and exposure rules enforced at request time.
      await expect(requestAdvance(maker, { employeeId, amountMinor: 6_000_000, period: "2026-09", reason: "Too much requested", instalments: 1 }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      const advance = await requestAdvance(maker, { employeeId, amountMinor: 2_000_000, period: "2026-09", reason: "Medical emergency at home", instalments: 1 }, crypto.randomUUID());
      expect(advance.status).toBe("requested");
      await expect(requestAdvance(maker, { employeeId, amountMinor: 1_000_000, period: "2026-09", reason: "Second request in the period", instalments: 1 }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      await decideAdvance(maker, advance.id, { decision: "approve" }, crypto.randomUUID());
      const paid = await payAdvance(maker, advance.id, {}, crypto.randomUUID());
      expect(paid.status).toBe("paid");
      // TDS input + advance legs flow into the deterministic calculation.
      await upsertPayrollInput(maker, { employeeId, period: "2026-09", component: "tds", amountMinor: 500_000, note: "Declaration shortfall" }, crypto.randomUUID());
      const updated = await upsertPayrollInput(maker, { employeeId, period: "2026-09", component: "tds", amountMinor: 600_000 }, crypto.randomUUID());
      expect(updated.updated).toBe(true);
      const inputs = await listPayrollInputs(checker, { employeeId, period: "2026-09" });
      expect((inputs as Array<{ component: string }>).some((row) => row.component === "tds")).toBe(true);
      const run = await createRun(maker, { period: "2026-09", runType: "regular", payDate: "2026-09-30", includeArrears: true }, crypto.randomUUID());
      runId = run.id;
      const calc = await calculateRun(maker, runId, [employeeId], crypto.randomUUID());
      expect(calc.calculated).toBe(1);
      // Gross 85,000 + advance paid 20,000; deductions PF 1,800 + PT 200 + TDS 6,000 + advance recovery 20,000.
      expect(calc.gross).toBe(8_500_000 + 2_000_000);
      expect(calc.deductions).toBe(180_000 + 20_000 + 600_000 + 2_000_000);
      expect(calc.net).toBe(10_500_000 - 2_800_000);
      await approveRun(maker, runId, crypto.randomUUID());
      await finalizeRun(checker, runId, crypto.randomUUID());
      const advances = (await db`select attributes->>'status' as status from salary_advances where id = ${advance.id}`) as Array<{ status: string }>;
      expect(advances[0]?.status).toBe("recovered");
    } finally {
      if (runId) {
        const members = (await db`select id from payroll_run_employees where payroll_run_id = ${runId}`) as Array<{ id: string }>;
        for (const member of members) {
          const docs = (await db`select document_id from payslips where payroll_run_employee_id = ${member.id}`) as Array<{ document_id: string }>;
          await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
          for (const doc of docs) {
            await db`delete from document_versions where tenant_id = ${tenantId} and document_id = ${doc.document_id}`;
            await db`delete from documents where id = ${doc.document_id}`;
          }
          await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
        }
        await db`delete from payroll_run_employees where payroll_run_id = ${runId}`;
        await db`delete from payroll_anomalies where payroll_run_id = ${runId}`;
        await db`delete from payroll_approvals where payroll_run_id = ${runId}`;
        await db`delete from payroll_runs where id = ${runId}`;
      }
      await db`delete from salary_advances where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from payroll_inputs where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
