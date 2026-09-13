import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { createDelegation, revokeDelegation } from "@/server/delegation/service";
import { decideLeave, requestLeave } from "@/server/leave/service";
import { approveRun, calculateRun, correctRun, createRun, finalizeRun } from "@/server/payroll/service";

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

describe.skipIf(!LIVE)("live corrections and delegation verification (opt-in)", () => {
  it("corrects finalized runs without touching the source and blocks proxy self-approval", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const maker = await accessFor("opencode-smoke@example.test", tenantId);
    const checker = await accessFor("admin@mkraft.local", tenantId);
    const proxy = await accessFor("approver-one@example.test", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-GV-${suffix}`}, 'Gov', 'Ern', 'Operator', 'Weaving', 'Plant North', '2021-01-15', 5000000)`;
    const smokeUsers = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
    await db`update memberships set employee_id = ${employeeId} where tenant_id = ${tenantId} and user_id = ${smokeUsers[0]?.id ?? ""}`;
    let runId = "";
    let correctionId = "";
    const trackedRuns: string[] = [];
    try {
      // Correction needs a finalized source.
      const run = await createRun(maker, { period: "2026-09", scope: "regular" }, crypto.randomUUID());
      runId = run.id;
      trackedRuns.push(runId);
      await calculateRun(maker, runId, [employeeId], crypto.randomUUID());
      await expect(correctRun(maker, runId, { reason: "Too early", adjustments: [{ employeeId, component: "basic", amountMinor: 100 }] }, crypto.randomUUID())).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
      await approveRun(maker, runId, crypto.randomUUID());
      await finalizeRun(checker, runId, crypto.randomUUID());
      const sourceLines = (await db`
        select l.id from payroll_lines l join payroll_run_employees e on e.id = l.payroll_run_employee_id
        where e.payroll_run_id = ${runId} and l.attributes->>'code' = 'basic' limit 1
      `) as Array<{ id: string }>;
      const corrected = await correctRun(maker, runId, {
        reason: "Bank rejection top-up",
        adjustments: [{ employeeId, component: "bonus", amountMinor: 50_000, reversesLineId: sourceLines[0]?.id ?? crypto.randomUUID() }],
      }, crypto.randomUUID());
      correctionId = corrected.correctionId;
      trackedRuns.push(correctionId);
      expect(corrected.net).toBe(50_000);
      const linked = (await db`select reverses_line_id from payroll_lines where payroll_run_employee_id in (select id from payroll_run_employees where payroll_run_id = ${correctionId})`) as Array<{ reverses_line_id: string | null }>;
      expect(linked[0]?.reverses_line_id).toBe(sourceLines[0]?.id);
      const source = (await db`select status from payroll_runs where id = ${runId}`) as Array<{ status: string }>;
      expect(source[0]?.status).toBe("finalized");
      // Delegation: requester grants leave.approve to a proxy; proxy approval is forbidden until revoked.
      const leave = await requestLeave(maker, { employeeId, leaveType: "CL", startsOn: "2026-12-01", endsOn: "2026-12-01", days: 1 }, crypto.randomUUID());
      const delegation = await createDelegation(maker, {
        delegateMembershipId: proxy.context.membershipId,
        scopes: ["leave.approve"],
        validFrom: "2026-01-01T00:00:00+05:30",
        validTo: "2027-01-01T00:00:00+05:30",
        reason: "HOD on leave",
      }, crypto.randomUUID());
      await expect(decideLeave(proxy, leave.id, true, undefined, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      await revokeDelegation(maker, delegation.id, crypto.randomUUID());
      const decided = await decideLeave(proxy, leave.id, true, "ok", crypto.randomUUID());
      expect(decided.status).toBe("pending_hod");
      // Cleanup in FK-safe order.
      await db`delete from delegation_windows where tenant_id = ${tenantId} and id = ${delegation.id}`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id = ${leave.id}`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where id = ${leave.id}`;
      for (const rid of [correctionId, runId]) {
        const members = (await db`select id from payroll_run_employees where payroll_run_id = ${rid}`) as Array<{ id: string }>;
        for (const member of members) {
          const docs = (await db`select document_id from payslips where payroll_run_employee_id = ${member.id}`) as Array<{ document_id: string }>;
          await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
          for (const doc of docs) {
            await db`delete from document_versions where tenant_id = ${tenantId} and document_id = ${doc.document_id}`;
            await db`delete from documents where id = ${doc.document_id}`;
          }
          await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
        }
        await db`delete from payroll_run_employees where payroll_run_id = ${rid}`;
        await db`delete from payroll_anomalies where payroll_run_id = ${rid}`;
        await db`delete from payroll_approvals where payroll_run_id = ${rid}`;
        await db`delete from payroll_runs where id = ${rid}`;
      }
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`delete from delegation_windows where tenant_id = ${tenantId}`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id in (select id from leave_requests where employee_id = ${employeeId})`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      for (const runIdValue of trackedRuns) {
        const members = (await db`select id from payroll_run_employees where payroll_run_id = ${runIdValue}`) as Array<{ id: string }>;
        for (const member of members) {
          const docs = (await db`select document_id from payslips where payroll_run_employee_id = ${member.id}`) as Array<{ document_id: string }>;
          await db`delete from payslips where payroll_run_employee_id = ${member.id}`;
          for (const doc of docs) {
            await db`delete from document_versions where tenant_id = ${tenantId} and document_id = ${doc.document_id}`;
            await db`delete from documents where id = ${doc.document_id}`;
          }
          await db`delete from payroll_lines where payroll_run_employee_id = ${member.id}`;
        }
        await db`delete from payroll_run_employees where payroll_run_id = ${runIdValue}`;
        await db`delete from payroll_anomalies where payroll_run_id = ${runIdValue}`;
        await db`delete from payroll_approvals where payroll_run_id = ${runIdValue}`;
        await db`delete from payroll_runs where id = ${runIdValue}`;
      }
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employee_salary_assignments where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
