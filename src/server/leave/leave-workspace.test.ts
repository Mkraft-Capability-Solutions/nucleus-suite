import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), decideLeave: vi.fn(), recordEarlyReturn: vi.fn(), ensureLeaveType: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), { query: (text: string, values: unknown[]) => ({ text, values }) });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (v: string) => v, checkIdempotency: vi.fn(), storeIdempotency: vi.fn() }));
vi.mock("@/server/leave/service", () => ({ decideLeave: mocks.decideLeave, recordEarlyReturn: mocks.recordEarlyReturn, ensureLeaveType: mocks.ensureLeaveType }));
vi.mock("@/server/jobs/worker", () => ({ dedupeKey: () => "k" }));

const { availableAfterReservations, assertSpanShape, assertLeaveRequestAllowed, cancelLeaveRequest } = await import("./request-guards");
const { pickSingleRequest, decideLeaveFromForm } = await import("./form-actions");
const { computeAllocation, adjustLeaveBalance } = await import("./allocation");
const { ownScope } = await import("./workspace");

const ctx = (permissions: string[], employeeId: string | null = "emp-1") =>
  ({ tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId, permissions, roles: [] } }) as unknown as Access;
const EMP = { id: "emp-1", employee_code: "E1", name: "A B", department: "X", designation_level: 1, has_birth_date: false };

describe("leave guards", () => {
  beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));

  it("folds ledger movements minus pending reservations", () => {
    expect(availableAfterReservations([{ transactionType: "credit", days: 10 }, { transactionType: "accrual", days: 1.5 }, { transactionType: "debit", days: 3 }, { transactionType: "reserve", days: 9 }], 2)).toBe(6.5);
  });

  it("rejects malformed spans", () => {
    const base = { employeeId: "e", leaveType: "CL", startsOn: "2026-01-02", endsOn: "2026-01-01", days: 1 };
    expect(() => assertSpanShape(base, undefined)).toThrow(/ends before/);
    expect(() => assertSpanShape({ ...base, endsOn: "2026-01-02", days: 2 }, undefined)).toThrow(/More days/);
    expect(() => assertSpanShape({ ...base, endsOn: "2026-01-03", days: 1 }, "first_half")).toThrow(/half day/);
  });

  it("blocks overlap and insufficient balance", async () => {
    const input = { employeeId: "emp-1", leaveType: "CL", startsOn: "2026-02-02", endsOn: "2026-02-03", days: 2 };
    mocks.tenantTx.mockResolvedValueOnce([[EMP]]).mockResolvedValueOnce([[{ starts_on: "2026-02-01", ends_on: "2026-02-02" }], [], [{ days: 0 }]]);
    await expect(assertLeaveRequestAllowed(ctx(["leave.read"]), input)).rejects.toMatchObject({ code: "LEAVE_OVERLAP" });
    mocks.tenantTx.mockResolvedValueOnce([[EMP]]).mockResolvedValueOnce([[], [{ transactionType: "credit", days: 2 }], [{ days: 1 }]]);
    await expect(assertLeaveRequestAllowed(ctx(["leave.read"]), input)).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
  });

  it("refuses applying for another employee without HR rights", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ ...EMP, id: "emp-2" }]]);
    await expect(assertLeaveRequestAllowed(ctx(["leave.read"]), { employeeId: "emp-2", leaveType: "CL", startsOn: "2026-02-02", endsOn: "2026-02-02", days: 1 })).rejects.toMatchObject({ status: 403 });
  });

  it("withdraws a pending own request, releasing the reservation with an audit event", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r1", employee_id: "emp-1", leave_type: "CL", leave_type_id: "lt", requested_days: 1, starts_on: "2026-05-01", status: "pending_supervisor" }]]).mockResolvedValueOnce([[{ id: "res" }]]).mockResolvedValueOnce([]);
    const result = await cancelLeaveRequest(ctx(["leave.read"]), "r1", { reason: "plans changed" }, "req");
    expect(result.closure).toBe("withdrawn");
    expect(mocks.tenantTx.mock.calls[2][1]).toHaveLength(4);
  });

  it("refuses cancelling leave already under way", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r1", employee_id: "emp-1", leave_type: "CL", leave_type_id: "lt", requested_days: 1, starts_on: "2026-01-01", status: "approved" }]]);
    await expect(cancelLeaveRequest(ctx(["leave.read"]), "r1", { reason: "x y z" }, "req", "2026-01-02")).rejects.toMatchObject({ status: 409 });
  });
});

describe("leave forms and allocation", () => {
  beforeEach(() => Object.values(mocks).forEach((m) => m.mockReset()));

  it("picks exactly one request or explains why not", () => {
    const row = { id: "a", starts_on: "", ends_on: "", status: "", actual_return_date: null };
    expect(pickSingleRequest([row], "E1", "decision").id).toBe("a");
    expect(() => pickSingleRequest([], "E1", "decision")).toThrow(/No leave request/);
    expect(() => pickSingleRequest([row, row], "E1", "return")).toThrow(/2 matching/);
  });

  it("decides the single pending request via the leave service", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r9", starts_on: "", ends_on: "", status: "pending_hod", actual_return_date: null }]]);
    mocks.decideLeave.mockResolvedValue({ id: "r9", status: "pending_hr" });
    await decideLeaveFromForm(ctx(["leave.approve"]), { employee: "E1", decision: "approve", remarks: "ok fine" }, "req");
    expect(mocks.enforce).toHaveBeenCalledWith(expect.anything(), "leave.approve", { tenantId: "t-1" });
    expect(mocks.decideLeave).toHaveBeenCalledWith(expect.anything(), "r9", true, "ok fine", "req");
  });

  it("computes entitlement and denies contract workers", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(computeAllocation({ designation_level: 8, joining_date: "2020-01-01", category: "regular", has_birth_date: true }, now)).toMatchObject({ eligible: true, days: { EL: 18, CL: 6, SL: 6, BIRTHDAY: 1 } });
    expect(computeAllocation({ designation_level: 1, joining_date: "2020-01-01", category: "contract", has_birth_date: false }, now).eligible).toBe(false);
  });

  it("never lets an adjustment take the balance below zero", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[EMP]]).mockResolvedValueOnce([[{ transactionType: "credit", days: 1 }], [{ days: 0 }]]);
    await expect(adjustLeaveBalance(ctx(["leave.maintain"]), { employeeId: "11111111-1111-1111-1111-111111111111", leaveType: "CL", days: -2, reason: "fix" }, "req")).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
  });

  it("scopes read models to the caller unless they approve or maintain leave", () => {
    expect(ownScope(ctx(["leave.read"]))).toBe("emp-1");
    expect(ownScope(ctx(["leave.read", "leave.approve"]))).toBeNull();
  });
});
