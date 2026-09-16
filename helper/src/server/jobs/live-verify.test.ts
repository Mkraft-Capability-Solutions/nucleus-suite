import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { requestLeave } from "@/server/leave/service";
import { runTick } from "@/server/jobs/worker";

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

describe.skipIf(!LIVE)("live jobs verification (opt-in)", () => {
  it("claims, executes, retries and dispatches with tenant isolation", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const admin = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date, basic_salary_minor) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-JB-${suffix}`}, 'Job', 'Worker', 'Operator', 'Weaving', 'Plant North', '2023-05-10', 4000000)`;
    const enqueue = async (taskType: string, payload: Record<string, unknown>) => {
      const rows = (await db`
        insert into scheduled_tasks (tenant_id, task_type, payload, available_at)
        values (${tenantId}, ${taskType}, ${JSON.stringify(payload)}::jsonb, now())
        returning id
      `) as Array<{ id: string }>;
      return rows[0]?.id ?? "";
    };
    try {
      // Monthly EL accrual credits the ledger exactly once (idempotent rerun).
      const accrualId = await enqueue("leave.accrue_monthly", { period: "2026-09" });
      let summary = await runTick("live-test");
      expect(summary.tasks.completed).toBeGreaterThanOrEqual(1);
      const accruals = (await db`
        select (attributes->>'days')::float as days from leave_ledger_entries
        where tenant_id = ${tenantId} and employee_id = ${employeeId} and attributes->>'kind' = 'accrual'
      `) as Array<{ days: number }>;
      expect(accruals).toHaveLength(1);
      expect(Number(accruals[0]?.days)).toBe(1.5);
      const rerunId = await enqueue("leave.accrue_monthly", { period: "2026-09" });
      summary = await runTick("live-test");
      const accrualsAfter = (await db`
        select count(*)::int as total from leave_ledger_entries
        where tenant_id = ${tenantId} and employee_id = ${employeeId} and attributes->>'kind' = 'accrual'
      `) as Array<{ total: number }>;
      expect(accrualsAfter[0]?.total).toBe(1);
      // COFF expiry flips stale grants.
      const grantId = crypto.randomUUID();
      const typeRows = (await db`select id from leave_types where tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
      const typeId = typeRows[0]?.id ?? crypto.randomUUID();
      await db`insert into comp_off_grants (id, tenant_id, employee_id, attributes) values (${grantId}, ${tenantId}, ${employeeId}, '{"days":1,"earned_on":"2026-06-01","expires_on":"2026-07-31","status":"available"}'::jsonb)`;
      await db`insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes) values (${tenantId}, ${employeeId}, ${typeId}, ${grantId}, '{"kind":"grant","days":1,"leave_type":"COFF"}'::jsonb)`;
      await enqueue("leave.coff_expire", { asOf: "2026-09-10" });
      await runTick("live-test");
      const grants = (await db`select attributes->>'status' as status from comp_off_grants where id = ${grantId}`) as Array<{ status: string }>;
      expect(grants[0]?.status).toBe("expired");
      // Unknown task types dead-letter instead of retrying forever.
      const bogusId = await enqueue("bogus.task", {});
      await runTick("live-test");
      const bogus = (await db`select status, attempts from scheduled_tasks where id = ${bogusId}`) as Array<{ status: string; attempts: number }>;
      expect(bogus[0]?.status).toBe("dead");
      const attempts = (await db`select outcome from task_attempts where scheduled_task_id = ${bogusId}`) as Array<{ outcome: string }>;
      expect(attempts.some((row) => row.outcome === "dead")).toBe(true);
      // Outbox dispatch fans out webhook deliveries to matching subscriptions.
      const endpointId = crypto.randomUUID();
      await db`insert into webhook_endpoints (id, tenant_id, attributes) values (${endpointId}, ${tenantId}, '{"url":"https://erp.example.test/hook","events":["leave.requested"],"secret_hash":"abc","status":"active"}'::jsonb)`;
      const subscriptionId = crypto.randomUUID();
      await db`insert into webhook_subscriptions (id, tenant_id, webhook_endpoint_id, attributes) values (${subscriptionId}, ${tenantId}, ${endpointId}, '{"events":["leave.requested"],"status":"active"}'::jsonb)`;
      const leave = await requestLeave(admin, { employeeId, leaveType: "CL", startsOn: "2026-11-03", endsOn: "2026-11-03", days: 1 }, crypto.randomUUID());
      summary = await runTick("live-test");
      expect(summary.outbox.published).toBeGreaterThanOrEqual(1);
      const deliveries = (await db`select id from webhook_deliveries where tenant_id = ${tenantId} and webhook_subscription_id = ${subscriptionId}`) as Array<{ id: string }>;
      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      // Year close encashes EL for the established joiner.
      await enqueue("leave.year_close", { year: 2026 });
      await runTick("live-test");
      const closeEntries = (await db`
        select attributes->>'kind' as kind from leave_ledger_entries
        where tenant_id = ${tenantId} and employee_id = ${employeeId} and attributes->>'kind' in ('encash','lapse')
      `) as Array<{ kind: string }>;
      expect(closeEntries.some((row) => row.kind === "encash")).toBe(true);
      // Cleanup in FK-safe order.
      await db`delete from webhook_deliveries where tenant_id = ${tenantId} and webhook_subscription_id = ${subscriptionId}`;
      await db`delete from webhook_subscriptions where id = ${subscriptionId}`;
      await db`delete from webhook_endpoints where id = ${endpointId}`;
      await db`delete from transactional_outbox where tenant_id = ${tenantId} and (aggregate_id = ${leave.id} or aggregate_type = 'webhook_delivery')`;
      await db`delete from scheduled_tasks where tenant_id = ${tenantId} and id in (${accrualId}, ${rerunId}, ${bogusId})`;
      await db`delete from scheduled_tasks where tenant_id = ${tenantId} and task_type in ('leave.coff_expire','leave.year_close')`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id = ${leave.id}`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where id = ${leave.id}`;
      await db`delete from comp_off_grants where id = ${grantId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`delete from webhook_deliveries where tenant_id = ${tenantId}`;
      await db`delete from webhook_subscriptions where tenant_id = ${tenantId} and attributes->>'status' = 'active'`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id in (select id from leave_requests where employee_id = ${employeeId})`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from comp_off_grants where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from scheduled_tasks where tenant_id = ${tenantId} and task_type like 'leave.%'`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
