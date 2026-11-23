import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";
import { createMovementSchema, movementIssues, rootCompanyOf, tenureLabel, withTenure } from "@/lib/employment-movements";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), authorize: vi.fn(() => ({ allowed: true })) }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (value: string) => value }));
vi.mock("@/server/identity/authorization", () => ({ authorize: mocks.authorize }));

const { createMovement, applyScheduledMovement, listMovements } = await import("@/server/organization/employment-movements");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const EMP = "33333333-3333-4333-8333-333333333333";
const employeeRow = { id: EMP, name: "Asha Rao", legal_entity_id: A, designation: "Analyst", department: "Finance", currency: "INR", status: "active", joining_date: "2023-01-01", today: "2026-11-23", timezone: "Asia/Kolkata" };
const companies = [
  { id: A, legal_name: "Alpha", code: "A", industry: "Steel", parent_legal_entity_id: null, status: "active", currency_code: "INR" },
  { id: B, legal_name: "Beta", code: "B", industry: "Retail", parent_legal_entity_id: A, status: "active", currency_code: "USD" },
];
const idem = { operation: "people.movement_create", key: "k-1", fingerprint: "f" };
type Stmt = { sql: string; values: unknown[] };

function primeReads() {
  mocks.tenantTx.mockResolvedValueOnce([[employeeRow]]).mockResolvedValueOnce([companies]).mockResolvedValueOnce([[{ n: 1 }]]).mockResolvedValue([[]]);
}

describe("employment movement rules", () => {
  it("rejects a transfer to the same company and a promotion without a new designation", () => {
    const current = { companyId: A, designation: "Analyst", department: "Finance", currency: "INR" };
    const ctx = { hasHire: true, today: "2026-11-23", joiningDate: "2023-01-01" };
    const base = { toCompanyId: A, effectiveDate: "2026-01-01" };
    expect(movementIssues({ ...base, movementType: "INTER_COMPANY_TRANSFER" }, current, ctx)[0]?.field).toBe("toCompanyId");
    expect(movementIssues({ ...base, movementType: "PROMOTION" }, current, ctx)[0]?.field).toBe("toDesignation");
    expect(movementIssues({ ...base, movementType: "HIRE" }, current, ctx)[0]?.field).toBe("movementType");
    expect(movementIssues({ ...base, movementType: "PROMOTION", toDesignation: "Lead", effectiveDate: "2022-01-01" }, current, ctx)[0]?.field).toBe("effectiveDate");
    expect(movementIssues({ ...base, movementType: "PROMOTION", toDesignation: "Lead" }, current, ctx)).toEqual([]);
  });

  it("validates the request contract strictly", () => {
    expect(createMovementSchema.safeParse({ movementType: "PROMOTION", toCompanyId: A, effectiveDate: "2026-01-01", tenantId: "x" }).success).toBe(false);
    expect(createMovementSchema.safeParse({ movementType: "PROMOTION", toCompanyId: A, effectiveDate: "01/01/2026" }).success).toBe(false);
    expect(createMovementSchema.safeParse({ movementType: "PROMOTION", toCompanyId: A, effectiveDate: "2026-01-01", toCurrency: "usd" }).success).toBe(false);
  });

  it("computes tenure, scheduled status, root company and labels", () => {
    const company = { id: A, name: "Alpha", code: null, industry: "Steel" };
    const row = (id: string, date: string) => ({ id, movementType: "PROMOTION" as const, effectiveDate: date, fromCompany: company, toCompany: { ...company, industry: "Retail" }, fromDesignation: "a", toDesignation: "b", fromDepartment: null, toDepartment: null, fromCurrency: null, toCurrency: null, remarks: null, approvedBy: null, createdBy: null, createdAt: `${date} 00:00`, rootGroupId: A });
    const out = withTenure([row("1", "2026-01-01"), row("2", "2026-03-02"), row("3", "2027-01-01")], "2026-04-01");
    expect(out.map((item) => [item.status, item.tenureDays])).toEqual([["applied", 60], ["applied", 30], ["scheduled", null]]);
    expect(out[0]?.industryChanged).toBe(true);
    expect(rootCompanyOf(B, new Map([[A, null], [B, A]]))).toBe(A);
    expect(tenureLabel(400)).toBe("1 y 1 m");
  });
});

describe("createMovement", () => {
  beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); mocks.authorize.mockReturnValue({ allowed: true }); });

  it("applies a movement effective today in one transaction with log, employee update, history, audit and idempotency key", async () => {
    primeReads();
    const result = await createMovement(access, EMP, { movementType: "INTER_COMPANY_TRANSFER", toCompanyId: B, effectiveDate: "2026-11-23" }, "req-1", idem);
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(result.status).toBe("applied");
    const statements = mocks.tenantTx.mock.calls.at(-1)?.[1] as Stmt[];
    const sql = statements.map((statement) => statement.sql).join("\n");
    expect(sql).toMatch(/insert into employment_movement_logs/);
    expect(sql).toMatch(/update employees set legal_entity_id/);
    expect(sql).toMatch(/insert into employee_job_history/);
    expect(sql).toMatch(/insert into audit_events/);
    expect(sql).toMatch(/insert into idempotency_keys/);
    expect(sql).not.toMatch(/scheduled_tasks/);
    // Currency follows the new company; root group is the parent company.
    expect(statements[0]?.values).toContain("USD");
    expect(statements[0]?.values[2]).toBe(A);
  });

  it("schedules a future-dated movement instead of touching the employee", async () => {
    primeReads();
    const result = await createMovement(access, EMP, { movementType: "PROMOTION", toCompanyId: A, toDesignation: "Lead", effectiveDate: "2027-01-01" }, "req-1", idem);
    expect(result.status).toBe("scheduled");
    const sql = (mocks.tenantTx.mock.calls.at(-1)?.[1] as Stmt[]).map((statement) => statement.sql).join("\n");
    expect(sql).toMatch(/insert into scheduled_tasks/);
    expect(sql).not.toMatch(/update employees/);
  });

  it("rejects a company outside the tenant", async () => {
    primeReads();
    await expect(createMovement(access, EMP, { movementType: "INTER_COMPANY_TRANSFER", toCompanyId: "44444444-4444-4444-8444-444444444444", effectiveDate: "2026-11-23" }, "req-1", idem))
      .rejects.toMatchObject({ status: 422 });
  });

  it("refuses employees who have left", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ ...employeeRow, status: "separated" }]]);
    await expect(createMovement(access, EMP, { movementType: "PROMOTION", toCompanyId: A, toDesignation: "Lead", effectiveDate: "2026-11-23" }, "req-1", idem)).rejects.toMatchObject({ status: 422 });
  });
});

describe("applyScheduledMovement and listMovements", () => {
  beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); mocks.authorize.mockReturnValue({ allowed: false }); });

  it("does nothing when the movement was already applied", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "mv", already_applied: true }]]);
    expect(await applyScheduledMovement(access, { movementId: "55555555-5555-4555-8555-555555555555" })).toEqual({ applied: false });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(1);
  });

  it("paginates and reports permissions", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[employeeRow]]).mockResolvedValueOnce([[]]);
    const list = await listMovements(access, EMP, { page: 1, pageSize: 10, order: "asc" });
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    expect(list).toMatchObject({ total: 0, canRecord: false, hasHire: false, employee: { companyId: A } });
  });
});
