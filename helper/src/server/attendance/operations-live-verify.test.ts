import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live verification of the eight Attendance Operations registers
// (SCR-020..SCR-027) against the migrated dev database.
// Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/attendance/operations-live-verify.test.ts
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

// The db client reads DATABASE_URL when its module is first evaluated and the
// dotenv call above only runs after static imports resolve, so the services are
// loaded lazily to let them see the real connection string.
type Registers = {
  punch: typeof import("@/server/attendance/punch-register");
  day: typeof import("@/server/attendance/day-register");
  gatePass: typeof import("@/server/attendance/gate-pass-register");
  overtime: typeof import("@/server/attendance/overtime-register");
  exception: typeof import("@/server/attendance/exception-register");
  recompute: typeof import("@/server/attendance/recompute-monitor");
  teamHistory: typeof import("@/server/attendance/team-history-register");
};

let api: Registers;
let access: Access;

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

describe.skipIf(!LIVE)("Attendance Operations registers — live verification (opt-in)", () => {
  beforeAll(async () => {
    const [punch, day, gatePass, overtime, exception, recompute, teamHistory] = await Promise.all([
      import("@/server/attendance/punch-register"),
      import("@/server/attendance/day-register"),
      import("@/server/attendance/gate-pass-register"),
      import("@/server/attendance/overtime-register"),
      import("@/server/attendance/exception-register"),
      import("@/server/attendance/recompute-monitor"),
      import("@/server/attendance/team-history-register"),
    ]);
    api = { punch, day, gatePass, overtime, exception, recompute, teamHistory };
    access = await adminAccess();
  });

  it("SCR-020 returns punches with reference, device and source as distinct values", async () => {
    const rows = await api.punch.listPunchRegister(access, { search: "", date: null });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.employee_code).not.toBe("");
      expect(row.event_reference).not.toBe("");
      expect(["in", "out", "unknown"]).toContain(row.direction);
      expect(["queued_offline", "ingested", "computed", "rejected"]).toContain(row.status);
    }
    // The reference screen shows the punch id in both the Punch and Source
    // columns; that is a bug and must not be reproduced.
    expect(rows.some((row) => row.source !== row.event_reference)).toBe(true);
    const detail = await api.punch.getPunchRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
  });

  it("SCR-021/022 return attendance days with hours rendered as H:MM", async () => {
    const rows = await api.day.listAttendanceDayRegister(access, { employeeId: null, from: null, to: null, search: "" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.employee_code).not.toBe("");
      expect(["computed", "exception", "locked"]).toContain(row.status);
      if (row.net_minutes > 0) expect(row.net_hours).toMatch(/^\d+:[0-5]\d$/);
    }
    const detail = await api.day.getAttendanceDayRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(Array.isArray(detail.punches)).toBe(true);
  });

  it("SCR-023 returns gate passes with the ceiling read from a stored policy", async () => {
    const rows = await api.gatePass.listGatePassRegister(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(["draft", "pending_approval", "approved", "rejected", "credited"]).toContain(row.status);
    }
    // One seeded pass is rejected and carries its reason in the stored status.
    const rejected = rows.find((row) => row.status === "rejected");
    expect(rejected?.rejection_note).toBeTruthy();
    const detail = await api.gatePass.getGatePassRecord(access, rows[0].id);
    expect(detail.quota.period).toMatch(/^\d{4}-\d{2}$/);
    expect(detail.quota.usedMinutes).toBeGreaterThanOrEqual(0);
  });

  it("SCR-024 derives overtime state from approval, pay run and paid run", async () => {
    const rows = await api.overtime.listOvertimeRegister(access, { search: "", location: null, orgUnit: null, period: null });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(["pending_approval", "approved", "tagged_to_run", "paid"]).toContain(row.status);
      if ((row.overtime_minutes ?? 0) > 0) expect(row.overtime_label).toMatch(/^\d+:[0-5]\d$/);
      // A tagged entry must actually carry a pay run.
      if (row.status === "tagged_to_run") expect(row.pay_run).toBeTruthy();
    }
    const detail = await api.overtime.getOvertimeRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
  });

  it("SCR-025 keeps the exception reference and age as separate values", async () => {
    const rows = await api.exception.listExceptionRegister(access, "");
    for (const row of rows) {
      expect(["open", "proposed", "resolved", "rejected"]).toContain(row.status);
      expect(row.exception_reference).not.toBe("");
      // The reference screen repeats the same id in the Exception and Age
      // columns; age is a day count and must differ.
      expect(String(row.age_days)).not.toBe(row.exception_reference);
    }
    if (rows.length > 0) {
      const detail = await api.exception.getExceptionRecord(access, rows[0].id);
      expect(detail.record.id).toBe(rows[0].id);
    }
  });

  it("SCR-026 reports only real recompute activity", async () => {
    const rows = await api.recompute.listRecomputeMonitor(access, "");
    for (const row of rows) {
      expect(["queued", "running", "completed", "blocked"]).toContain(row.status);
      expect(row.job_reference).not.toBe("");
      expect(typeof row.delta_label).toBe("string");
    }
    // An empty monitor is the honest render when nothing has been recomputed.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("SCR-027 aggregates team history from real attendance, leave and overtime", async () => {
    const rows = await api.teamHistory.listTeamHistory(access, { from: "2026-09-01", to: "2026-09-15", search: "" });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.employee_code).not.toBe("");
      expect(["ready", "scheduled", "expired"]).toContain(row.status);
      expect(row.present_days).toBeGreaterThanOrEqual(0);
      expect(row.leave_days).toBeGreaterThanOrEqual(0);
    }
    // At least one employee has real attendance in this window.
    expect(rows.some((row) => row.present_days > 0)).toBe(true);
    // And at least one has real overtime.
    expect(rows.some((row) => (row.overtime_minutes ?? 0) > 0)).toBe(true);
  });
});
