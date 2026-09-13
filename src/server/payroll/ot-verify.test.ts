import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { ingestPunches, traceDay, transitionDay } from "@/server/attendance/service";
import { approveRun, calculateRun, createRun, finalizeRun, getJournal } from "@/server/payroll/service";

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

describe.skipIf(!LIVE)("live OT payroll verification (opt-in)", () => {
  it("pays overtime in a separate later run from locked attendance", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const maker = await accessFor("opencode-smoke@example.test", tenantId);
    const checker = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-OT-${suffix}`}, 'Over', 'Time', 'Operator', 'Weaving', 'Plant North', '2021-01-15', 5000000)`;
    let regularId = "";
    let otId = "";
    try {
      // Golden overnight shift: 440 OT minutes under the gross-span policy.
      const ingested = await ingestPunches(maker, {
        employeeId, workDate: "2026-09-10", shiftCode: "A",
        punches: [
          { at: "2026-09-10T08:00:00+05:30", type: "in", source: "biometric" },
          { at: "2026-09-10T20:30:00+05:30", type: "out", source: "biometric" },
          { at: "2026-09-10T21:15:00+05:30", type: "in", source: "biometric" },
          { at: "2026-09-11T03:20:00+05:30", type: "out", source: "biometric" },
        ],
      }, crypto.randomUUID());
      const traced = await traceDay(maker, ingested.dayId);
      expect(traced.trace?.overtimeMinutes).toBe(440);
      await transitionDay(maker, ingested.dayId, "lock", crypto.randomUUID());
      // Regular run first: no OT inside.
      const regular = await createRun(maker, { period: "2026-09", scope: "regular" }, crypto.randomUUID());
      regularId = regular.id;
      const regularCalc = await calculateRun(maker, regularId, [employeeId], crypto.randomUUID());
      expect(regularCalc.calculated).toBe(1);
      const regularLines = (await db`
        select attributes->>'code' as code from payroll_lines
        where payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${regularId})
      `) as Array<{ code: string }>;
      expect(regularLines.some((line) => line.code === "ot")).toBe(false);
      // OT paid later in its own run: 440 min at 2x hourly off a 50,000 basic.
      // hourly = 5,000,000 / (30*8*60); amount = round(hourly * 440 * 2) = 305,556.
      const ot = await createRun(maker, { period: "2026-09", scope: "ot" }, crypto.randomUUID());
      otId = ot.id;
      const otCalc = await calculateRun(maker, otId, [employeeId], crypto.randomUUID());
      expect(otCalc.calculated).toBe(1);
      expect(otCalc.gross).toBe(305_556);
      const otLines = (await db`
        select attributes->>'code' as code, (attributes->>'amount_minor')::bigint as amount from payroll_lines
        where payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${otId})
      `) as Array<{ code: string; amount: number }>;
      expect(otLines).toHaveLength(1);
      expect(otLines[0]?.code).toBe("ot");
      expect(Number(otLines[0]?.amount)).toBe(305_556);
      await approveRun(maker, otId, crypto.randomUUID());
      await finalizeRun(checker, otId, crypto.randomUUID());
      const journal = await getJournal(checker, otId);
      expect(journal.balanced).toBe(true);
    } finally {
      for (const runId of [regularId, otId].filter(Boolean)) {
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
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from attendance_punches where tenant_id = ${tenantId} and attendance_day_id in (select id from attendance_days where employee_id = ${employeeId})`;
      await db`delete from attendance_days where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
