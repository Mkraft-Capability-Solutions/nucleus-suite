import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), recordAudit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, recordAudit: mocks.recordAudit }));

const { buildMusterRoll, executeFactoryRegisterCommand, factoryRegisterCommandSchema } = await import("@/server/compliance/factory-registers");
const { registerFormFSchema, shareTotalHundredths } = await import("@/server/compliance/form-f");
const { assembleBatch, transitionGlBatch, renderGlExport, syncBatchStatus } = await import("@/server/compliance/erp-ledger");
const { stateMatrix, readVersion } = await import("@/server/compliance/rule-packs");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;
const uuid = "11111111-1111-4111-8111-111111111111";

beforeEach(() => { Object.values(mocks).forEach((m) => m.mockReset()); mocks.tenantTx.mockResolvedValue([[]]); });

describe("factory registers", () => {
  it("derives the muster roll from attendance rows", () => {
    const base = { employee_id: "e1", employee_code: "T1", first_name: "A", last_name: "B", designation: "Fitter", gender: null };
    const roll = buildMusterRoll([
      { ...base, attendance_date: "2026-03-02", status: "present", assigned_shift: "G", productive_minutes: 480, payable_ot_minutes: 60, gross_span_minutes: 700 },
      { ...base, attendance_date: "2026-03-03", status: "rest_day", assigned_shift: "G", productive_minutes: 0, payable_ot_minutes: 0, gross_span_minutes: 0 },
    ], "2026-03");
    expect(roll.daysInMonth).toBe(31);
    expect(roll.workers[0]).toMatchObject({ daysPresent: 1, normalMinutes: 480, otMinutes: 60, spreadoverBreaches: 1, relay: "G" });
  });

  it("validates and records a Form 36 visit with permission, tenant scope and audit", async () => {
    const cmd = factoryRegisterCommandSchema.parse({ action: "inspector", inspector: "R Rao", authority: "DISH", visitDate: "2026-01-10", purpose: "Routine", context: {} });
    const result = await executeFactoryRegisterCommand(access, cmd, "req");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "compliance.filing.write", { tenantId: "t-1" });
    expect(result.status).toBe("open");
    expect(mocks.recordAudit).toHaveBeenCalled();
  });

  it("rejects a future accident date", () => {
    expect(factoryRegisterCommandSchema.safeParse({ action: "accident", injuredPersonName: "X Y", tokenNo: "T", occupation: "Op", exactPlace: "Line", dateOfOccurrence: "2999-01-01", natureOfInjury: "Cut", lostWorkdays: 1, remedialActions: "Gloves" }).success).toBe(false);
  });
});

describe("form F", () => {
  it("requires shares to total exactly 100%", () => {
    expect(shareTotalHundredths([33.33, 33.33, 33.34])).toBe(10000);
    const base = { employeeId: uuid, witnesses: [{ name: "W One" }, { name: "W Two" }], declarationDate: "2026-01-01" };
    expect(registerFormFSchema.safeParse({ ...base, nominees: [{ name: "Spouse", relationship: "Wife", age: 30, sharePercent: 90 }] }).success).toBe(false);
    expect(registerFormFSchema.safeParse({ ...base, nominees: [{ name: "Spouse", relationship: "Wife", age: 30, sharePercent: 100 }] }).success).toBe(true);
  });
});

describe("GL queue", () => {
  const row = { id: uuid, payroll_run_id: uuid, connection_id: null, status: "posted", debit_minor: 1000, credit_minor: 1000, acknowledgement_ref: null, posted_at: null, created_at: null, period: "2026-03", currency: "INR", connector: null };
  const lines = [
    { id: "l1", batch_id: uuid, account_code: "SAL", cost_centre: null, component_code: "gross", debit_minor: 1000, credit_minor: 0, narration: "n" },
    { id: "l2", batch_id: uuid, account_code: "=BANK", cost_centre: null, component_code: "net", debit_minor: 0, credit_minor: 1000, narration: "n" },
  ];
  it("computes balance from stored lines and neutralises CSV formulas", () => {
    const batch = assembleBatch(row, lines);
    expect(batch.balanced).toBe(true);
    expect(renderGlExport(batch, "netsuite_csv").body).toContain(`"'=BANK"`);
    expect(assembleBatch(row, lines.slice(0, 1)).balanced).toBe(false);
  });
  it("refuses to reconcile without an ERP acknowledgement", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[row], lines]);
    await expect(transitionGlBatch(access, { action: "reconcile", batchId: uuid }, "req")).rejects.toMatchObject({ status: 422 });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "payroll.accounting.approve", { tenantId: "t-1" });
  });
  it("reports sync status from real counts", () => {
    expect(syncBatchStatus(3, 3, 0)).toBe("applied");
    expect(syncBatchStatus(3, 1, 2)).toBe("partial");
  });
});

describe("rule packs", () => {
  it("builds the state matrix only from stored attributes", () => {
    const v = readVersion({ version_id: "v1", pack: { code: "IN-KA" }, version: { code: "v1", state_code: "KA", minimum_wage_monthly_minor: 1720000 }, assignment: null, assignment_id: null, created_at: null });
    expect(stateMatrix([v])[0]).toMatchObject({ stateCode: "KA", minimumWageMonthlyMinor: 1720000, overtimeRule: null });
  });
});
