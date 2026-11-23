import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({
  enforce: vi.fn(),
  tenantTx: vi.fn(),
  createPerson: vi.fn(),
  ingestPunches: vi.fn(),
  createCandidate: vi.fn(),
  recordAccrualCredit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx }));
vi.mock("@/server/organization/service", async () => {
  const { z } = await import("zod");
  return { createPerson: mocks.createPerson, createPersonSchema: z.object({}).passthrough() };
});
vi.mock("@/server/attendance/service", async () => {
  const { z } = await import("zod");
  return {
    ingestPunches: mocks.ingestPunches,
    ingestPunchesSchema: z.object({ employeeId: z.string(), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), punches: z.array(z.object({ at: z.string().datetime({ offset: true }), type: z.string(), source: z.string() })) }),
  };
});
vi.mock("@/server/talent/service", async () => {
  const { z } = await import("zod");
  return { createCandidate: mocks.createCandidate, createCandidateSchema: z.object({ name: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(), source: z.string() }) };
});
vi.mock("@/server/leave/service", async () => {
  const { z } = await import("zod");
  return { recordAccrualCredit: mocks.recordAccrualCredit, accrualCreditSchema: z.object({ employeeId: z.string(), leaveType: z.string().optional(), days: z.number().positive(), note: z.string().optional() }) };
});

const { runBulkImport, bulkImportSchema } = await import("@/server/organization/bulk-import");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;
const employee = { employeeCode: "E-1", firstName: "Asha", lastName: "Rao", workEmail: "asha@example.test", designation: "Analyst", department: "Finance", location: "Pune" };

describe("bulk import", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.tenantTx.mockResolvedValue([[]]);
    mocks.createPerson.mockResolvedValue({ id: "emp-1" });
    mocks.createCandidate.mockResolvedValue({ id: "cand-1" });
  });

  it("creates valid employees through the person service and never invents missing fields", async () => {
    const input = bulkImportSchema.parse({ importType: "employee", records: [employee, { employeeCode: "E-2", firstName: "No", lastName: "Email", designation: "x", department: "y", location: "z" }] });
    const result = await runBulkImport(access, input, "req-1");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(mocks.createPerson).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ accepted: 1, rejected: 1 });
    expect(result.details[1]).toMatchObject({ row: 2, outcome: "rejected" });
  });

  it("rejects codes repeated in the file or already in the tenant", async () => {
    mocks.tenantTx.mockResolvedValue([[{ id: "existing", employee_code: "E-9" }]]);
    const input = bulkImportSchema.parse({ importType: "employee", records: [employee, employee, { ...employee, employeeCode: "E-9" }] });
    const result = await runBulkImport(access, input, "req-1");
    expect(result.details.map((d) => d.outcome)).toEqual(["created", "rejected", "rejected"]);
  });

  it("validates without writing on a dry run", async () => {
    const input = bulkImportSchema.parse({ importType: "employee", records: [employee], dryRun: true });
    const result = await runBulkImport(access, input, "req-1");
    expect(mocks.createPerson).not.toHaveBeenCalled();
    expect(result.details[0]?.outcome).toBe("valid");
  });

  it("checks the attendance permission and rejects unknown employee codes", async () => {
    const input = bulkImportSchema.parse({ importType: "biometric", records: [{ employeeCode: "NOPE", workDate: "2026-11-02", punchIn: "2026-11-02T09:00:00+05:30", punchOut: "2026-11-02T18:00:00+05:30" }] });
    const result = await runBulkImport(access, input, "req-1");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "attendance.write", { tenantId: "t-1" });
    expect(mocks.ingestPunches).not.toHaveBeenCalled();
    expect(result.details[0]).toMatchObject({ outcome: "rejected", reason: "Unknown employee code." });
  });

  it("caps the batch size", () => {
    expect(bulkImportSchema.safeParse({ importType: "employee", records: Array.from({ length: 501 }, () => employee) }).success).toBe(false);
  });
});
