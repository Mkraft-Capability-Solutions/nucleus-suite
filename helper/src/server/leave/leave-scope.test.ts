import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantTx, enforce } = vi.hoisted(() => ({ tenantTx: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/db", () => ({
  sqlClient: Object.assign(
    (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join("?"), values }),
    { query: (sql: string, values: unknown[]) => ({ sql, values }) },
  ),
}));
vi.mock("@/server/platform/access", () => ({ tenantTx, enforce, uuidOrNull: (value: string) => value }));

import { canReadWholeLeaveRegister, leaveReadScopeFor } from "./leave-scope";
import { getLeaveLedgerRecord, listLeaveLedger } from "./ledger-register";
import { getLeaveRequestRecord, listLeaveRequestQueue } from "./request-register";
import { getBalances, listLeaveRequests } from "./service";
import type { Access } from "@/server/platform/access";

const SELF = "11111111-1111-4111-8111-111111111111";
const COLLEAGUE = "22222222-2222-4222-8222-222222222222";

/** The standard employee role: `leave.read` and `leave.write`, nothing wider. */
const EMPLOYEE = ["tenant.read", "employee.read", "attendance.read", "leave.read", "leave.write"];
/** The manager / HR roles: the same plus the approval permission. */
const APPROVER = [...EMPLOYEE, "leave.approve"];

function access(permissions: string[], roles: string[], employeeId: string | null): Access {
  return {
    tenantId: "tenant-a",
    context: {
      actorUserId: "user-a",
      membershipId: "membership-a",
      tenantId: "tenant-a",
      employeeId,
      permissions,
      roles,
    },
  } as Access;
}

type Statement = { sql: string; values: unknown[] };

function statements(call = 0): Statement[] {
  return tenantTx.mock.calls[call]![1] as Statement[];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("who may read the whole tenant's leave", () => {
  it("admits an administrative principal and anyone who may approve leave", () => {
    expect(canReadWholeLeaveRegister(["tenant.manage"], [])).toBe(true);
    expect(canReadWholeLeaveRegister([], ["hr_admin"])).toBe(true);
    expect(canReadWholeLeaveRegister(APPROVER, ["manager"])).toBe(true);
  });

  it("does NOT admit leave.read, which every employee holds", () => {
    expect(canReadWholeLeaveRegister(EMPLOYEE, ["employee"])).toBe(false);
    expect(leaveReadScopeFor(EMPLOYEE, ["employee"])).toBe("self");
    expect(leaveReadScopeFor(APPROVER, ["manager"])).toBe("tenant");
  });
});

describe("listLeaveRequests", () => {
  it("binds the caller's own employee id into the SQL and discards the one asked for", async () => {
    tenantTx.mockResolvedValueOnce([[{ total: 0 }], []]);
    await listLeaveRequests(access(EMPLOYEE, ["employee"], SELF), {
      // A self-scoped caller asking for a colleague's leave.
      employeeId: COLLEAGUE,
      status: null,
      page: 1,
      pageSize: 20,
    });

    const [countStatement, rowStatement] = statements();
    for (const statement of [countStatement, rowStatement]) {
      expect(statement.values).toContain(SELF);
      expect(statement.values).not.toContain(COLLEAGUE);
    }
    expect(enforce).toHaveBeenCalledWith(expect.anything(), "leave.read", { tenantId: "tenant-a" });
  });

  it("refuses an account with no linked employee profile instead of serving the tenant", async () => {
    await expect(
      listLeaveRequests(access(EMPLOYEE, ["employee"], null), { status: null, page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 403, code: "EMPLOYEE_LINK_REQUIRED" });
    // Nothing was read: the refusal happens before a statement is built.
    expect(tenantTx).not.toHaveBeenCalled();
  });

  it("leaves an approver's and an administrator's query un-narrowed", async () => {
    tenantTx.mockResolvedValueOnce([[{ total: 0 }], []]);
    await listLeaveRequests(access(APPROVER, ["manager"], SELF), { status: null, page: 1, pageSize: 20 });
    // Nothing narrows the approver's query: their own id is not bound into it.
    for (const statement of statements()) expect(statement.values).not.toContain(SELF);

    tenantTx.mockResolvedValueOnce([[{ total: 0 }], []]);
    await listLeaveRequests(access([...EMPLOYEE, "tenant.manage"], ["hr_admin"], SELF), {
      // An administrative caller still filters by whichever employee they ask for.
      employeeId: COLLEAGUE,
      status: null,
      page: 1,
      pageSize: 20,
    });
    for (const statement of statements(1)) expect(statement.values).toContain(COLLEAGUE);
  });
});

describe("listLeaveRequestQueue", () => {
  it("pins the queue to the caller's own applications", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await listLeaveRequestQueue(access(EMPLOYEE, ["employee"], SELF), { search: COLLEAGUE, status: null });

    const [statement] = statements();
    expect(statement.sql).toContain("$4::uuid is null or r.employee_id = $4::uuid");
    expect(statement.values[3]).toBe(SELF);
  });

  it("keeps the whole queue for an approver, who has to see what they approve", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await listLeaveRequestQueue(access(APPROVER, ["manager"], SELF), { search: "", status: "pending_supervisor" });
    expect(statements()[0]!.values[3]).toBeNull();
  });

  it("refuses an unlinked account", async () => {
    await expect(
      listLeaveRequestQueue(access(EMPLOYEE, ["employee"], null), { search: "", status: null }),
    ).rejects.toMatchObject({ status: 403, code: "EMPLOYEE_LINK_REQUIRED" });
  });
});

describe("getLeaveRequestRecord", () => {
  it("does not find another employee's request, so its existence cannot be probed", async () => {
    // The narrowed lookup returns nothing: the row exists, but not for this reader.
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(getLeaveRequestRecord(access(EMPLOYEE, ["employee"], SELF), "request-of-a-colleague")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    const [statement] = statements();
    expect(statement.sql).toContain("$3::uuid is null or r.employee_id = $3::uuid");
    expect(statement.values[2]).toBe(SELF);
  });

  it("leaves an approver's lookup unbound", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(getLeaveRequestRecord(access(APPROVER, ["manager"], SELF), "some-request")).rejects.toMatchObject({ status: 404 });
    expect(statements()[0]!.values[2]).toBeNull();
  });
});

describe("listLeaveLedger", () => {
  it("ignores a supplied employeeId and binds the caller's own", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await listLeaveLedger(access(EMPLOYEE, ["employee"], SELF), { search: "", employeeId: COLLEAGUE });

    const [statement] = statements();
    expect(statement.values).toContain(SELF);
    expect(statement.values).not.toContain(COLLEAGUE);
  });

  it("honours the employeeId filter for an administrative caller", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await listLeaveLedger(access([...EMPLOYEE, "tenant.manage"], ["hr_admin"], SELF), { search: "", employeeId: COLLEAGUE });
    expect(statements()[0]!.values).toContain(COLLEAGUE);
  });
});

describe("getLeaveLedgerRecord", () => {
  it("does not find a movement belonging to another employee", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(getLeaveLedgerRecord(access(EMPLOYEE, ["employee"], SELF), "entry-of-a-colleague")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    const [statement] = statements();
    expect(statement.sql).toContain("$3::uuid is null or l.employee_id = $3::uuid");
    expect(statement.values[2]).toBe(SELF);
  });
});

describe("getBalances", () => {
  it("answers 404 — not 403 — for another employee's balances, and reads nothing", async () => {
    await expect(getBalances(access(EMPLOYEE, ["employee"], SELF), COLLEAGUE)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(tenantTx).not.toHaveBeenCalled();
  });

  it("still serves an approver the balances of the employee they asked for", async () => {
    // Employee profile lookup, then the ledger read behind `leaveBalancesFromLedger`.
    tenantTx.mockResolvedValue([[{ id: COLLEAGUE, designation_level: 3, joining_date: "2024-01-01" }]]);
    await expect(getBalances(access(APPROVER, ["manager"], SELF), COLLEAGUE)).resolves.toMatchObject({
      employeeId: COLLEAGUE,
    });
  });
});
