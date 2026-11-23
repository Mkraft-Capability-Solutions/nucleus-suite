import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), assertVisible: vi.fn(), scope: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }), { query: (text: string, values: unknown[]) => ({ text, values }) });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (v: string) => v }));
vi.mock("@/server/attendance/service", () => ({ assertAttendanceEmployeeVisible: mocks.assertVisible, resolveAttendanceScope: mocks.scope }));

const ledger = await import("@/server/attendance/time-office-ledger");
const reg = await import("@/server/attendance/regularization-workflow");
const allowance = await import("@/server/attendance/gate-pass-allowance");
const anomaly = await import("@/server/attendance/anomaly-resolution");
const shift = await import("@/server/attendance/shift-assignment");
const timesheet = await import("@/server/attendance/timesheet-submission");

const EMP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: EMP, permissions: [], roles: [] } } as unknown as Access;

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.scope.mockResolvedValue({ kind: "tenant", rootEmployeeId: EMP, employeeIds: [EMP, OTHER] });
});

describe("pure helpers", () => {
  it("parses stored minutes and shift inference without inventing values", () => {
    expect(ledger.storedMinutes("90")).toBe(90);
    expect(ledger.storedMinutes("note")).toBeNull();
    expect(ledger.storedMinutes(null)).toBeNull();
    expect(ledger.isShiftInferred("A", "B")).toBe(true);
    expect(ledger.isShiftInferred("A", null)).toBe(false);
  });
  it("runs the two-tier regularization machine", () => {
    expect(reg.pendingStage("submitted")).toBe("supervisor");
    expect(reg.nextRegularizationStatus("submitted", "supervisor", true)).toBe("supervisor_approved");
    expect(reg.nextRegularizationStatus("supervisor_approved", "time_office", true)).toBe("approved");
    expect(reg.nextRegularizationStatus("submitted", "supervisor", false)).toBe("rejected");
    expect(() => reg.nextRegularizationStatus("submitted", "time_office", true)).toThrow();
    expect(() => reg.nextRegularizationStatus("approved", "supervisor", true)).toThrow();
  });
  it("reports unknown limits as null", () => {
    expect(allowance.remaining(null, 3)).toBeNull();
    expect(allowance.remaining(240, 300)).toBe(0);
    expect(allowance.allowedMinutesFrom([240, "120", -1, "x"])).toEqual([120, 240]);
  });
  it("maps anomaly actions and open state", () => {
    expect(anomaly.anomalyStatusFor("WAIVE")).toBe("waived");
    expect(anomaly.isAnomalyOpen("open")).toBe(true);
    expect(anomaly.isAnomalyOpen("Resolved")).toBe(false);
  });
  it("detects cross-midnight shifts and week windows", () => {
    expect(shift.crossesMidnight("22:00", "06:30")).toBe(true);
    expect(shift.crossesMidnight("09:00", "18:00")).toBe(false);
    expect(timesheet.weekWindow("2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(timesheet.sumStoredMinutes(["480", null, "x", "60"])).toEqual({ minutes: 540, recordedDays: 2 });
  });
});

describe("writes", () => {
  it("refuses self-approval of a regularization", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r-1", employee_id: EMP, status: "submitted" }]]);
    await expect(reg.decideRegularizationStage(access, "r-1", { approve: true }, "req")).rejects.toMatchObject({ status: 403 });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "attendance.write", { tenantId: "t-1" });
  });
  it("advances a regularization only when the guarded update moved a row", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r-1", employee_id: OTHER, status: "submitted" }]]).mockResolvedValueOnce([[]]);
    await expect(reg.decideRegularizationStage(access, "r-1", { approve: true }, "req")).rejects.toMatchObject({ status: 409 });
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "r-1", employee_id: OTHER, status: "submitted" }]]).mockResolvedValueOnce([[{ entity_id: "r-1" }]]);
    await expect(reg.decideRegularizationStage(access, "r-1", { approve: true }, "req")).resolves.toMatchObject({ status: "supervisor_approved", stage: "supervisor" });
  });
  it("rejects regularizing a payroll-locked day", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "e-1", record_status: "locked", locked_at: "" }], [{ id: "p-1" }]]);
    await expect(reg.createRegularization(access, { employeeId: OTHER, date: "2026-01-05", kind: "missing-punch", reason: "Forgot to punch" }, "req")).rejects.toMatchObject({ code: "PERIOD_LOCKED" });
  });
  it("returns 404 for an unknown anomaly instead of a silent success", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(anomaly.resolveAnomaly(access, "x", { action: "RESOLVE", reason: "checked" }, "req")).rejects.toMatchObject({ status: 404 });
  });
  it("refuses a shift that is not in the shift master", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[]]);
    await expect(shift.createShiftAssignment(access, { employeeId: OTHER, shiftCode: "ZZ", effectiveDate: "2026-01-05", reason: "Roster change" }, "req")).rejects.toMatchObject({ status: 422 });
  });
  it("sums timesheet hours on the server and never defaults them", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ minutes: "480" }, { minutes: "450" }], [], [{ id: "p-1" }]]).mockResolvedValueOnce([]);
    const result = await timesheet.submitWeeklyTimesheet(access, { weekStart: "2026-01-05" }, "req");
    expect(result).toMatchObject({ total_minutes: 930, recorded_days: 2, employeeId: EMP });
    mocks.tenantTx.mockResolvedValueOnce([[], [], [{ id: "p-1" }]]);
    await expect(timesheet.submitWeeklyTimesheet(access, { weekStart: "2026-01-12" }, "req")).rejects.toMatchObject({ status: 422 });
  });
});
