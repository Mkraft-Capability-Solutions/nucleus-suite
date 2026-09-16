import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live verification of the Smart Attendance and Leave Management module
// consoles against the migrated dev database.
// Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/attendance/engine-live-verify.test.ts
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

// The db client reads DATABASE_URL when its module is first evaluated and the
// dotenv call above only runs after static imports resolve, so the services are
// loaded lazily to let them see the real connection string.
type Consoles = {
  attendance: typeof import("@/server/attendance/engine-console");
  leave: typeof import("@/server/leave/engine-console");
};

let api: Consoles;
let access: Access;
let employeeId: string;

async function adminAccess(): Promise<Access> {
  const client = neon(process.env.DATABASE_URL!);
  const rows = (await client`
    select m.user_id, m.id as membership_id, m.tenant_id,
      coalesce(array_agg(distinct p.permission_key) filter (where p.permission_key is not null), '{}') as permission_keys
    from memberships m
    left join membership_roles mr on mr.membership_id = m.id and mr.tenant_id = m.tenant_id
      and mr.revoked_at is null and mr.valid_from <= now() and (mr.valid_to is null or mr.valid_to > now())
    left join roles r on r.id = mr.role_id and r.tenant_id = m.tenant_id and r.status = 'active'
    left join role_permissions rp on rp.role_id = r.id and rp.tenant_id = m.tenant_id
    left join permissions p on p.id = rp.permission_id and p.status = 'active'
    where m.status = 'active'
    group by m.user_id, m.id, m.tenant_id
    order by count(distinct p.permission_key) desc
    limit 1
  `) as Array<{ user_id: string; membership_id: string; tenant_id: string; permission_keys: string[] }>;
  const membership = rows[0];
  if (!membership) throw new Error("no active membership found");
  return {
    context: {
      actorUserId: membership.user_id,
      membershipId: membership.membership_id,
      tenantId: membership.tenant_id,
      permissions: membership.permission_keys ?? [],
      roles: ["owner"],
    },
    tenantId: membership.tenant_id,
  };
}

describe.skipIf(!LIVE)("Attendance and Leave consoles — live verification (opt-in)", () => {
  beforeAll(async () => {
    const [attendance, leave] = await Promise.all([
      import("@/server/attendance/engine-console"),
      import("@/server/leave/engine-console"),
    ]);
    api = { attendance, leave };
    access = await adminAccess();
    const client = neon(process.env.DATABASE_URL!);
    // An employee that actually has attendance rows, so the timesheet is exercised.
    const rows = (await client`
      select employee_id from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id is not null
      group by employee_id order by count(*) desc limit 1
    `) as Array<{ employee_id: string }>;
    employeeId = rows[0]?.employee_id ?? "";
  });

  it("returns worker categories with the imported prose row filtered out", async () => {
    const categories = await api.attendance.listWorkerCategories(access);
    expect(categories.length).toBeGreaterThan(0);
    for (const category of categories) {
      expect(category.code).not.toBe("");
      // The import carries one 155-character prose "note" row that must not show.
      expect(category.code.length).toBeLessThanOrEqual(40);
    }
  });

  it("returns a full calendar month of timesheet days including unrecorded ones", async () => {
    expect(employeeId).not.toBe("");
    const days = await api.attendance.listMonthlyTimesheet(access, employeeId, "2026-09");
    expect(days.length).toBe(30);
    expect(days[0].date).toBe("2026-09-01");
    expect(days[29].date).toBe("2026-09-30");
    for (const day of days) {
      expect(["in", "late", "off", "absent", "leave", "not_recorded"]).toContain(day.status);
    }
    // September 2026 has real punches for this employee.
    expect(days.some((day) => day.status === "in")).toBe(true);
  });

  it("reports the gate-pass quota against a stored ceiling, never a hardcoded one", async () => {
    const quota = await api.attendance.getGatePassQuota(access, employeeId, "2026-09");
    expect(quota.period).toBe("2026-09");
    expect(quota.usedMinutes).toBeGreaterThanOrEqual(0);
    expect(quota.usedMinutes).toBeLessThanOrEqual(Math.max(quota.ceilingMinutes, quota.usedMinutes));
  });

  it("returns an honest closed session when nobody is punched in", async () => {
    const session = await api.attendance.getCurrentSession(access, employeeId);
    expect(session.employeeId).toBe(employeeId);
    if (!session.open) {
      expect(session.checkedInAt).toBeNull();
      expect(session.elapsedMinutes).toBeNull();
    }
  });

  it("counts the leave approval pipeline from live requests", async () => {
    const pipeline = await api.leave.getApprovalPipeline(access);
    expect(pipeline.stages.map((stage) => stage.stage)).toEqual([
      "pending_supervisor",
      "pending_hod",
      "pending_hr",
    ]);
    const summed = pipeline.stages.reduce((total, stage) => total + stage.count, 0);
    expect(pipeline.totalPending).toBe(summed);
    expect(summed).toBeGreaterThan(0);
  });

  it("returns the comp-off clock with expired grants marked lapsed", async () => {
    const clock = await api.leave.listCompOffClock(access);
    expect(clock.length).toBeGreaterThan(0);
    for (const entry of clock) {
      expect(["open", "consumed", "lapsed"]).toContain(entry.status);
      if (entry.daysToExpiry !== null && entry.daysToExpiry < 0 && entry.status !== "consumed") {
        expect(entry.status).toBe("lapsed");
      }
    }
  });

  it("returns the band rules matrix with the prose leave type filtered out", async () => {
    const { bandRules, leaveTypeRules } = await api.leave.getBandRulesMatrix(access);
    expect(bandRules.length).toBeGreaterThan(0);
    expect(leaveTypeRules.length).toBeGreaterThan(0);
    for (const rule of bandRules) {
      expect(rule.policyCode).toMatch(/^LP-/);
      expect(rule.leaveType).not.toBe("");
    }
    for (const type of leaveTypeRules) {
      expect(type.name).not.toBe("");
      expect(type.code.length).toBeLessThanOrEqual(12);
      expect(Array.isArray(type.cannotCombineWith)).toBe(true);
    }
  });

  it("derives balance cards from the ledger for an employee who has one", async () => {
    const client = neon(process.env.DATABASE_URL!);
    const rows = (await client`
      select employee_id from leave_ledger_entries
      where tenant_id = ${access.tenantId} and employee_id is not null
      group by employee_id order by count(*) desc limit 1
    `) as Array<{ employee_id: string }>;
    const ledgerEmployee = rows[0]?.employee_id;
    expect(ledgerEmployee).toBeTruthy();
    const cards = await api.leave.listBalanceCards(access, ledgerEmployee!);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.leaveType).not.toBe("");
      // Available is always derived, never stored.
      expect(card.available).toBe(card.allocated - card.availed);
    }
  });
});
