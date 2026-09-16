import { config } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { neon } from "@neondatabase/serverless";
import type { Access } from "@/server/platform/access";

config({ path: [".env.local", ".env"], quiet: true });

// Opt-in live verification of the Leave Operations registers against the
// migrated dev database.
// Run: MKRAFT_LIVE_VERIFY=1 npx vitest run src/server/leave/leave-registers-live-verify.test.ts
const LIVE = process.env.MKRAFT_LIVE_VERIFY === "1" && Boolean(process.env.DATABASE_URL);

// The db client reads DATABASE_URL when its module is first evaluated, and the
// dotenv call above only runs after static imports resolve, so the services are
// loaded lazily to let them see the real connection string.
type Registers = {
  listLeaveRequestQueue: typeof import("@/server/leave/request-register")["listLeaveRequestQueue"];
  getLeaveRequestRecord: typeof import("@/server/leave/request-register")["getLeaveRequestRecord"];
  listLeaveLedger: typeof import("@/server/leave/ledger-register")["listLeaveLedger"];
  getLeaveLedgerRecord: typeof import("@/server/leave/ledger-register")["getLeaveLedgerRecord"];
  listLeavePolicies: typeof import("@/server/leave/policy-register")["listLeavePolicies"];
  getLeavePolicyRecord: typeof import("@/server/leave/policy-register")["getLeavePolicyRecord"];
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

describe.skipIf(!LIVE)("Leave Operations registers — live verification (opt-in)", () => {
  beforeAll(async () => {
    const [request, ledger, policy] = await Promise.all([
      import("@/server/leave/request-register"),
      import("@/server/leave/ledger-register"),
      import("@/server/leave/policy-register"),
    ]);
    api = {
      listLeaveRequestQueue: request.listLeaveRequestQueue,
      getLeaveRequestRecord: request.getLeaveRequestRecord,
      listLeaveLedger: ledger.listLeaveLedger,
      getLeaveLedgerRecord: ledger.getLeaveLedgerRecord,
      listLeavePolicies: policy.listLeavePolicies,
      getLeavePolicyRecord: policy.getLeavePolicyRecord,
    };
    access = await adminAccess();
  });

  it("SCR-030 resolves every request to a named applicant", async () => {
    const rows = await api.listLeaveRequestQueue(access, { search: "", status: null });
    expect(rows.length).toBeGreaterThan(0);
    // The old list rendered a bare uuid; every row must now name its applicant.
    expect(rows.every((row) => Boolean(row.employee_code))).toBe(true);
    for (const row of rows) {
      expect(row.leave_type).not.toBe("");
      expect(["draft", "validated", "pending_approval", "approved", "availed", "closed"]).toContain(row.status);
    }
    const detail = await api.getLeaveRequestRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(Array.isArray(detail.ledger)).toBe(true);
    expect(Array.isArray(detail.auditTrail)).toBe(true);
  });

  it("SCR-030 filters by approval step", async () => {
    const pending = await api.listLeaveRequestQueue(access, { search: "", status: "pending_hod" });
    for (const row of pending) {
      expect(row.raw_status).toBe("pending_hod");
      expect(row.status).toBe("pending_approval");
    }
  });

  it("SCR-031 carries a running balance that matches its own credits and debits", async () => {
    const rows = await api.listLeaveLedger(access, { search: "", employeeId: null });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.ledger_reference).not.toBe("");
      expect(["projected", "expired", "encashed", "reversed"]).toContain(row.status);
    }
    // Re-derive each account's closing balance independently of the projection.
    const closing = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.employee_id}:${row.leave_type}`;
      closing.set(key, Math.round(((closing.get(key) ?? 0) + row.credit - row.debit) * 100) / 100);
      expect(row.balance).toBe(closing.get(key));
    }
    const detail = await api.getLeaveLedgerRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(detail.account.some((entry) => entry.id === rows[0].id)).toBe(true);
  });

  it("SCR-032 returns the accrual rules with their band and leave type", async () => {
    const rows = await api.listLeavePolicies(access, "");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.policy_code).not.toBe("");
      expect(row.leave_type).not.toBe("");
      expect(["draft", "simulated", "effective", "superseded"]).toContain(row.status);
    }
    const detail = await api.getLeavePolicyRecord(access, rows[0].id);
    expect(detail.record.id).toBe(rows[0].id);
    expect(Array.isArray(detail.auditTrail)).toBe(true);
  });
});
