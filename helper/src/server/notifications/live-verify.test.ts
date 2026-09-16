import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";
import { requestLeave } from "@/server/leave/service";
import { runTick } from "@/server/jobs/worker";
import { listNotifications, markNotificationRead, upsertPreferences } from "@/server/notifications/service";

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

describe.skipIf(!LIVE)("live notifications verification (opt-in)", () => {
  it("fans out event notifications with mute and read semantics", { timeout: 240_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const admin = await accessFor("admin@mkraft.local", tenantId);
    const suffix = Date.now().toString(36).toUpperCase();
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date) values (${employeeId}, ${tenantId}, ${personId}, ${`HO-TDD-NT-${suffix}`}, 'Notify', 'Mee', 'Operator', 'Weaving', 'Plant North', '2022-01-15')`;
    // Link admin login to the employee so requester resolution reaches the inbox.
    const adminUsers = (await db`select id from "user" where email = 'admin@mkraft.local' limit 1`) as Array<{ id: string }>;
    await db`update memberships set employee_id = ${employeeId} where tenant_id = ${tenantId} and user_id = ${adminUsers[0]?.id ?? ""}`;
    // Baseline: other suites' undispatched outbox rows may fan out during runTick.
    // Scope every assertion to notifications created by this run only.
    const baseline = new Set((await listNotifications(admin, false)).items.map((item) => item.id));
    const freshLeaveNotes = (items: Array<{ id: string; attributes: Record<string, unknown> }>) =>
      items.filter(
        (item) =>
          !baseline.has(item.id) &&
          String((item.attributes as { event_type?: string }).event_type) === "leave.requested",
      );
    try {
      const leave = await requestLeave(admin, { employeeId, leaveType: "CL", startsOn: "2026-11-03", endsOn: "2026-11-03", days: 1 }, crypto.randomUUID());
      await runTick("live-test");
      const inbox = await listNotifications(admin, false);
      expect(inbox.unread).toBeGreaterThanOrEqual(1);
      const leaveNote = freshLeaveNotes(inbox.items)[0];
      expect(leaveNote).toBeTruthy();
      const marked = await markNotificationRead(admin, String(leaveNote?.id ?? ""));
      expect(marked.read).toBe(true);
      // Muting the event suppresses future fan-out for this member.
      await upsertPreferences(admin, { channels: { inapp: true, email: false, sms: false }, mutedEvents: ["leave.requested"] });
      const leave2 = await requestLeave(admin, { employeeId, leaveType: "SL", startsOn: "2026-11-04", endsOn: "2026-11-04", days: 1 }, crypto.randomUUID());
      await runTick("live-test");
      const inbox2 = await listNotifications(admin, false);
      const second = freshLeaveNotes(inbox2.items).find((item) => item.id !== leaveNote?.id);
      expect(second).toBeUndefined();
      // Cleanup in FK-safe order.
      await db`delete from notifications where tenant_id = ${tenantId} and membership_id = ${admin.context.membershipId}`;
      await db`delete from notification_preferences where tenant_id = ${tenantId} and membership_id = ${admin.context.membershipId}`;
      await db`delete from transactional_outbox where tenant_id = ${tenantId} and aggregate_id in (${leave.id}, ${leave2.id})`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id in (${leave.id}, ${leave2.id})`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where id in (${leave.id}, ${leave2.id})`;
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`delete from notifications where tenant_id = ${tenantId} and membership_id = ${admin.context.membershipId}`;
      await db`delete from notification_preferences where tenant_id = ${tenantId} and membership_id = ${admin.context.membershipId}`;
      await db`delete from transactional_outbox where tenant_id = ${tenantId} and payload->>'employeeId' = ${employeeId}`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id in (select id from leave_requests where employee_id = ${employeeId})`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_requests where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
