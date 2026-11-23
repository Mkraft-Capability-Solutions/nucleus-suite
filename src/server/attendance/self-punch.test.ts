import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), ensureAttendanceSource: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values });
  sqlClient.query = (text: string, values: unknown[]) => ({ text, values });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (value: string) => value }));
vi.mock("@/server/attendance/service", () => ({ ensureAttendanceSource: mocks.ensureAttendanceSource }));

const { assertAlternation, getMyPunchDay, recordMyPunch, workedMinutes } = await import("@/server/attendance/self-punch");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: "e-1", permissions: [], roles: [] } } as unknown as Access;
const context = [{ timezone: "Asia/Kolkata", work_date: "2026-11-23", server_time: "2026-11-23T08:00:00.000Z" }];

function snapshot(punches: Array<{ id: string; at: string; type: "in" | "out"; source: string }>, day: unknown = { id: "d-1", status: "pending", locked: false }) {
  mocks.tenantTx.mockResolvedValueOnce([context]).mockResolvedValueOnce([day ? [day] : [], punches, []]);
}

describe("self punch", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.ensureAttendanceSource.mockResolvedValue("src-1");
  });

  it("pairs punches and counts an open IN up to the server time", () => {
    expect(workedMinutes([{ at: "2026-11-23T03:30:00Z", type: "in" }, { at: "2026-11-23T05:30:00Z", type: "out" }], "2026-11-23T08:00:00Z")).toBe(120);
    expect(workedMinutes([{ at: "2026-11-23T07:00:00Z", type: "in" }], "2026-11-23T08:00:00Z")).toBe(60);
  });

  it("enforces IN before OUT and no double IN", () => {
    expect(() => assertAlternation(null, "out")).toThrow(/Punch in first/);
    expect(() => assertAlternation("in", "in")).toThrow(/Punch out first/);
    expect(() => assertAlternation("out", "in")).not.toThrow();
  });

  it("refuses an account without a linked employee", async () => {
    const unlinked = { ...access, context: { ...access.context, employeeId: null } } as unknown as Access;
    await expect(getMyPunchDay(unlinked)).rejects.toMatchObject({ status: 403 });
    expect(mocks.tenantTx).not.toHaveBeenCalled();
  });

  it("falls back to the full attendance permission when the self key is missing", async () => {
    mocks.enforce.mockImplementationOnce(() => { throw new Error("denied"); });
    snapshot([]);
    const view = await getMyPunchDay(access);
    expect(mocks.enforce.mock.calls.map((call) => call[1])).toEqual(["attendance.self.read", "attendance.read"]);
    expect(view).toMatchObject({ state: "not_started", nextDirection: "in", workedMinutes: 0, workDate: "2026-11-23" });
  });

  it("records one punch for the caller only, audited and emitted to the outbox", async () => {
    snapshot([]);
    mocks.tenantTx.mockResolvedValueOnce([[], [], [], [], []]);
    snapshot([{ id: "p-1", at: "2026-11-23T08:00:00.000Z", type: "in", source: "web" }]);
    const view = await recordMyPunch(access, { direction: "in" }, "req-1");
    const write = mocks.tenantTx.mock.calls[2]?.[1] as Array<{ text: string; values: unknown[] }>;
    expect(write.map((statement) => statement.text).join(" ")).toMatch(/attendance_punches[\s\S]*attendance_events[\s\S]*audit_events[\s\S]*transactional_outbox/);
    expect(write[0]?.values).toContain("t-1");
    expect(write[1]?.values).toContain("e-1");
    expect(view).toMatchObject({ state: "in", nextDirection: "out", firstIn: "2026-11-23T08:00:00.000Z" });
  });

  it("rejects a punch on a locked day without writing", async () => {
    snapshot([], { id: "d-1", status: "present", locked: true });
    await expect(recordMyPunch(access, { direction: "in" }, "req-1")).rejects.toMatchObject({ code: "PERIOD_LOCKED" });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(2);
  });
});
