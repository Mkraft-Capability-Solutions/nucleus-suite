import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  tenantTx: vi.fn(),
  checkIdempotency: vi.fn(),
  storeIdempotency: vi.fn(),
  createModuleRecord: vi.fn(),
  getModuleRecord: vi.fn(),
  updateModuleRecord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({
  enforce: mocks.enforce,
  tenantTx: mocks.tenantTx,
  checkIdempotency: mocks.checkIdempotency,
  storeIdempotency: mocks.storeIdempotency,
  uuidOrNull: (value: string) => (/^[0-9a-f-]{36}$/i.test(value) ? value : null),
}));
vi.mock("@/server/ops/modules-service", () => ({
  OPERATIONAL_MODULES: {
    shift_master: { screenId: "SCR-1", table: "shifts", permission: "attendance.read", auditAction: "a" },
    ats_pipeline: { screenId: "SCR-2", table: "candidates", permission: "employee.read", auditAction: "b" },
  },
  createModuleRecord: mocks.createModuleRecord,
  getModuleRecord: mocks.getModuleRecord,
  updateModuleRecord: mocks.updateModuleRecord,
}));
vi.mock("@/config/ui/lib.operational-module-registry.json", () => ({
  default: { modules: [{ id: "statutory_register", states: ["Draft", "Filed"] }, { id: "ats_pipeline", states: ["Applied", "Hired"] }] },
}));

const { createRecord, deleteRecord, getRecord, listRecords, statement, transitionRecord, updateRecord } = await import("@/server/ops-modules/records");
const { resolveModuleStore } = await import("@/server/ops-modules/module-store");
const { idempotent } = await import("@/server/ops-modules/payload");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;
const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const row = { id: ID, employee_id: null, status: "active", attributes: { formCode: "F18" }, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-02T00:00:00.000Z" };
const undefinedTable = Object.assign(new Error("relation does not exist"), { code: "42P01" });

describe("module store resolution", () => {
  it("maps permissions and rejects modules without storage instead of fabricating records", () => {
    expect(resolveModuleStore("shift_master")).toMatchObject({ kind: "table", table: "shift_master", read: "attendance.read", write: "attendance.write" });
    expect(resolveModuleStore("ats_pipeline")).toMatchObject({ kind: "service", read: "employee.read", write: "employee.write" });
    expect(resolveModuleStore("bank_disbursement")).toMatchObject({ kind: "table", read: "payroll.read", write: "payroll.run" });
    expect(() => resolveModuleStore("payroll_runs")).toThrow(/No record store/);
    expect(() => resolveModuleStore("__proto__")).toThrow(/No record store/);
  });

  it("numbers placeholders in order so tenantTx can re-bind them", () => {
    expect(statement("a = ? and b = ?", [1, 2])).toEqual({ text: "a = $1 and b = $2", values: [1, 2] });
  });
});

describe("operational module records", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("lists table records scoped to the tenant with the read permission and a real total", async () => {
    mocks.tenantTx.mockResolvedValue([[{ total: 1 }], [row]]);
    const result = await listRecords(access, "statutory_register", { page: 2, pageSize: 10, search: "F18" });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    const [, listStatement] = mocks.tenantTx.mock.calls[0][1];
    expect(listStatement.text).toContain('from "statutory_register" where tenant_id = $1');
    expect(listStatement.values).toEqual(["t-1", "%F18%", "%F18%", 10, 10]);
    expect(result).toEqual({ total: 1, items: [{ id: ID, status: "active", employeeId: null, attributes: { formCode: "F18" }, createdAt: row.created_at, updatedAt: row.updated_at }] });
  });

  it("propagates database errors instead of returning an empty list", async () => {
    mocks.tenantTx.mockRejectedValue(new Error("connection reset"));
    await expect(listRecords(access, "statutory_register", { page: 1, pageSize: 10 })).rejects.toThrow("connection reset");
  });

  it("reports missing storage as 503 when the table is not provisioned and no fallback exists", async () => {
    mocks.tenantTx.mockRejectedValue(undefinedTable);
    await expect(listRecords(access, "statutory_register", { page: 1, pageSize: 10 })).rejects.toMatchObject({ status: 503, code: "STORAGE_UNAVAILABLE" });
  });

  it("falls back to the audit-event store only for an undefined table with a service config", async () => {
    mocks.tenantTx.mockRejectedValueOnce(undefinedTable).mockResolvedValueOnce([[{ total: 1 }], [{ entity_id: "e-1", after: { status: "Open" }, created_at: "2026-01-01", updated_at: "2026-01-03" }]]);
    const result = await listRecords(access, "shift_master", { page: 1, pageSize: 5 });
    expect(result.items[0]).toMatchObject({ id: "e-1", status: "Open" });
  });

  it("returns 404 for a missing record rather than the raw result array", async () => {
    mocks.tenantTx.mockResolvedValue([[]]);
    await expect(getRecord(access, "statutory_register", ID)).rejects.toMatchObject({ status: 404 });
    await expect(getRecord(access, "statutory_register", "not-a-uuid")).rejects.toMatchObject({ status: 404 });
    mocks.tenantTx.mockResolvedValue([[row]]);
    await expect(getRecord(access, "statutory_register", ID)).resolves.toMatchObject({ id: ID, attributes: { formCode: "F18" } });
  });

  it("creates with the write permission and audits in the same transaction", async () => {
    mocks.tenantTx.mockResolvedValue([[row], []]);
    await createRecord(access, "statutory_register", { formCode: "F18" }, "req-1");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    const statements = mocks.tenantTx.mock.calls[0][1];
    expect(statements).toHaveLength(2);
    expect(statements[0].text).toContain('insert into "statutory_register"');
    expect(statements[1].values).toContain("ops.statutory_register.create");
  });

  it("merges a patch into attributes and 404s when nothing matched", async () => {
    mocks.tenantTx.mockResolvedValue([[row]]);
    await updateRecord(access, "statutory_register", ID, { period: "2026-01" }, "req-2");
    const [merge] = mocks.tenantTx.mock.calls[0][1];
    expect(merge.text).toContain("attributes = t.attributes || $3::jsonb");
    expect(merge.text).toContain("insert into audit_events");
    mocks.tenantTx.mockResolvedValue([[]]);
    await expect(updateRecord(access, "statutory_register", ID, { period: "x" }, "req-3")).rejects.toMatchObject({ status: 404 });
  });

  it("updates service records only after confirming they exist", async () => {
    mocks.getModuleRecord.mockRejectedValue(Object.assign(new Error("nf"), { status: 404 }));
    await expect(updateRecord(access, "ats_pipeline", "x", { a: 1 }, "r")).rejects.toMatchObject({ status: 404 });
    expect(mocks.updateModuleRecord).not.toHaveBeenCalled();
  });

  it("only allows registry states and stores their canonical casing", async () => {
    await expect(transitionRecord(access, "statutory_register", ID, "Shredded", "r")).rejects.toMatchObject({ status: 422, code: "INVALID_STATE" });
    mocks.tenantTx.mockResolvedValue([[{ ...row, status: "Filed" }]]);
    const record = await transitionRecord(access, "statutory_register", ID, "filed", "r");
    expect(record.status).toBe("Filed");
    expect(mocks.tenantTx.mock.calls[0][1][0].values).toContain("Filed");
  });

  it("deletes table records with audit, 404s when absent, and refuses deleting event-sourced records", async () => {
    mocks.tenantTx.mockResolvedValue([[]]);
    await expect(deleteRecord(access, "statutory_register", ID, "r")).rejects.toMatchObject({ status: 404 });
    mocks.tenantTx.mockResolvedValue([[{ id: ID }]]);
    await expect(deleteRecord(access, "statutory_register", ID, "r")).resolves.toEqual({ id: ID, deleted: true });
    await expect(deleteRecord(access, "ats_pipeline", "x", "r")).rejects.toMatchObject({ status: 405 });
  });

  it("replays an idempotent write and rejects a reused key with another body", async () => {
    const run = vi.fn().mockResolvedValue({ id: "new" });
    const replay = vi.fn().mockResolvedValue({ id: "old" });
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "replay", responseLocator: "old" });
    await expect(idempotent(access, "op", "k", { a: 1 }, run, replay)).resolves.toEqual({ result: { id: "old" }, replayed: true });
    expect(run).not.toHaveBeenCalled();
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "conflict" });
    await expect(idempotent(access, "op", "k", { a: 2 }, run, replay)).rejects.toMatchObject({ status: 409 });
    mocks.checkIdempotency.mockResolvedValueOnce({ outcome: "accept" });
    await idempotent(access, "op", "k2", { a: 3 }, run, replay);
    expect(mocks.storeIdempotency).toHaveBeenCalledWith(access, "op", "k2", expect.any(String), 200, "new");
  });
});
