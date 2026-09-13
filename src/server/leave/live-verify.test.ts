import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import { ingestPunches, requestGatePass, decideGatePass, traceDay, transitionDay } from "@/server/attendance/service";
import { decideLeave, getBalances, grantCoff, requestLeave } from "@/server/leave/service";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live P3 verification. Run with MKRAFT_LIVE_VERIFY=1 and DATABASE_URL
// pointed at the direct (non-pooled) endpoint.
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

function client() {
  return neon(process.env.DATABASE_URL!);
}

async function accessFor(email: string, tenantId: string): Promise<Access> {
  const db = client();
  const users = (await db`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
  const userId = users[0]?.id;
  if (!userId) throw new Error(`user ${email} not found`);
  const rows = (await db`
    select m.id as membership_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.user_id = ${userId} and m.tenant_id = ${tenantId} and m.status = 'active'
    group by m.id
  `) as Array<{ membership_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error(`membership for ${email} not found`);
  return {
    context: { actorUserId: userId, membershipId: membership.membership_id, tenantId, permissions: membership.permission_keys ?? [], roles: ["test"] },
    tenantId,
  };
}

describe.skipIf(!LIVE)("live P3 verification (opt-in)", () => {
  it("reproduces the golden cross-midnight trace from live punches", { timeout: 120_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    const ownerRoles = (await db`select id from roles where tenant_id = ${tenantId} and code = 'owner' limit 1`) as Array<{ id: string }>;
    const ownerRoleId = ownerRoles[0]?.id ?? "";
    const users = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
    const mems = (await db`select id from memberships where user_id = ${users[0]?.id ?? ""} and tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
    await db`insert into membership_roles (tenant_id, membership_id, role_id) values (${tenantId}, ${mems[0]?.id ?? ""}, ${ownerRoleId}) on conflict do nothing`;
    const access = await accessFor("opencode-smoke@example.test", tenantId);
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const code = `HO-TDD-01-${Date.now().toString(36).toUpperCase()}`;
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date) values (${employeeId}, ${tenantId}, ${personId}, ${code}, 'Golden', 'Trace', 'Operator', 'Weaving', 'Plant North', '2024-01-15')`;
    try {
      const ingested = await ingestPunches(access, {
        employeeId,
        workDate: "2026-09-10",
        shiftCode: "A",
        punches: [
          { at: "2026-09-10T08:00:00+05:30", type: "in", source: "biometric" },
          { at: "2026-09-10T20:30:00+05:30", type: "out", source: "biometric" },
          { at: "2026-09-10T21:15:00+05:30", type: "in", source: "biometric" },
          { at: "2026-09-11T03:20:00+05:30", type: "out", source: "biometric" },
        ],
      }, crypto.randomUUID());
      expect(ingested.status).toBe("pending");
      const traced = await traceDay(access, ingested.dayId);
      expect(traced.trace?.grossSpanMinutes).toBe(1160);
      expect(traced.trace?.breakMinutes).toBe(45);
      expect(traced.trace?.rawProductiveMinutes).toBe(1115);
      expect(traced.trace?.overtimeMinutes).toBe(440);
      const locked = await transitionDay(access, ingested.dayId, "lock", crypto.randomUUID());
      expect(locked.to).toBe("locked");
      await expect(ingestPunches(access, {
        employeeId, workDate: "2026-09-10", shiftCode: "A",
        punches: [
          { at: "2026-09-10T08:00:00+05:30", type: "in", source: "biometric" },
          { at: "2026-09-10T17:00:00+05:30", type: "out", source: "biometric" },
        ],
      }, crypto.randomUUID())).rejects.toMatchObject({ code: "PERIOD_LOCKED" });
      await transitionDay(access, ingested.dayId, "reopen", crypto.randomUUID());
    } finally {
      await db`delete from attendance_punches where tenant_id = ${tenantId} and attendance_day_id in (select id from attendance_days where employee_id = ${employeeId})`;
      await db`delete from attendance_days where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });

  it("runs the full three-stage leave chain with SoD and balances", { timeout: 180_000 }, async () => {
    const db = client();
    const tenants = (await db`select id from tenants limit 1`) as Array<{ id: string }>;
    const tenantId = tenants[0]?.id ?? "";
    // Grant the approval permissions to the synthetic approver memberships via the owner role.
    const ownerRoles = (await db`select id from roles where tenant_id = ${tenantId} and code = 'owner' limit 1`) as Array<{ id: string }>;
    const ownerRoleId = ownerRoles[0]?.id ?? "";
    for (const email of ["admin@mkraft.local", "approver-one@example.test", "approver-two@example.test"]) {
      const users = (await db`select id from "user" where email = ${email} limit 1`) as Array<{ id: string }>;
      const mems = (await db`select id from memberships where user_id = ${users[0]?.id ?? ""} and tenant_id = ${tenantId} limit 1`) as Array<{ id: string }>;
      await db`insert into membership_roles (tenant_id, membership_id, role_id) values (${tenantId}, ${mems[0]?.id ?? ""}, ${ownerRoleId}) on conflict do nothing`;
    }
    const requester = await accessFor("opencode-smoke@example.test", tenantId);
    const l1 = await accessFor("admin@mkraft.local", tenantId);
    const l2 = await accessFor("approver-one@example.test", tenantId);
    const l3 = await accessFor("approver-two@example.test", tenantId);
    const personId = crypto.randomUUID();
    const employeeId = crypto.randomUUID();
    const code = `HO-TDD-02-${Date.now().toString(36).toUpperCase()}`;
    await db`insert into people (id, tenant_id) values (${personId}, ${tenantId})`;
    await db`insert into employees (id, tenant_id, person_id, employee_code, first_name, last_name, designation, department, location, joining_date) values (${employeeId}, ${tenantId}, ${personId}, ${code}, 'Leave', 'Chain', 'Operator', 'Weaving', 'Plant North', '2024-01-15')`;
    // Link the requester's login to the employee so self-approval is detectable.
    const smokeUsers = (await db`select id from "user" where email = 'opencode-smoke@example.test' limit 1`) as Array<{ id: string }>;
    await db`update memberships set employee_id = ${employeeId} where user_id = ${smokeUsers[0]?.id ?? ""} and tenant_id = ${tenantId}`;
    try {
      const submitted = await requestLeave(requester, { employeeId, leaveType: "EL", startsOn: "2026-10-05", endsOn: "2026-10-06", days: 2 }, crypto.randomUUID());
      expect(submitted.status).toBe("pending_supervisor");
      // Self-approval is forbidden.
      await expect(decideLeave(requester, submitted.id, true, undefined, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const s1 = await decideLeave(l1, submitted.id, true, "ok", crypto.randomUUID());
      expect(s1.status).toBe("pending_hod");
      // Same actor twice is forbidden.
      await expect(decideLeave(l1, submitted.id, true, undefined, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
      const s2 = await decideLeave(l2, submitted.id, true, "ok", crypto.randomUUID());
      expect(s2.status).toBe("pending_hr");
      const s3 = await decideLeave(l3, submitted.id, true, "ok", crypto.randomUUID());
      expect(s3.status).toBe("approved");
      const balances = await getBalances(requester, employeeId);
      expect(balances.used.EL).toBe(2);
      const grant = await grantCoff(l1, { employeeId, earnedOn: "2026-09-01", days: 1 }, crypto.randomUUID());
      expect(grant.expiresOn).toBe("2026-10-31");
      const gate = await requestGatePass(l1, { employeeId, date: "2026-09-12", minutes: 120, reason: "Bank visit" }, crypto.randomUUID());
      const decided = await decideGatePass(l1, gate.id, true, crypto.randomUUID());
      expect(decided.status).toBe("approved");
      // Second 2h pass ok, third exceeds the monthly envelope.
      const gate2 = await requestGatePass(l1, { employeeId, date: "2026-09-13", minutes: 120, reason: "Clinic" }, crypto.randomUUID());
      await decideGatePass(l1, gate2.id, true, crypto.randomUUID());
      await expect(requestGatePass(l1, { employeeId, date: "2026-09-14", minutes: 120, reason: "Extra" }, crypto.randomUUID())).rejects.toMatchObject({ code: "POLICY_VIOLATION" });
      // Unlink first: memberships carries a composite (tenant_id, employee_id)
      // FK with SET NULL, and tenant_id is NOT NULL — deleting a linked
      // employee directly would violate it.
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from gate_passes where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from comp_off_grants where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id = ${submitted.id}`;
      await db`delete from leave_requests where id = ${submitted.id}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    } finally {
      await db`update memberships set employee_id = null where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from gate_passes where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_ledger_entries where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from comp_off_grants where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from leave_approvals where tenant_id = ${tenantId} and leave_request_id in (select id from leave_requests where employee_id = ${employeeId})`;
      await db`delete from leave_requests where tenant_id = ${tenantId} and employee_id = ${employeeId}`;
      await db`delete from employees where id = ${employeeId}`;
      await db`delete from people where id = ${personId}`;
    }
  });
});
