import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx }));

const { loadEmployeeFormReference, mergeDepartments } = await import("@/server/onboarding/form-reference");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;

describe("employee form reference", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("merges the department master with names already in use, without duplicates", () => {
    const merged = mergeDepartments([{ name: "Finance", code: "FIN" }, { name: " ", code: null }], [{ name: "finance" }, { name: "Quality" }, { name: null }]);
    expect(merged).toEqual([{ name: "Finance", code: "FIN" }, { name: "Quality", code: null }]);
  });

  it("enforces employee.read, scopes each list to the tenant and maps shift masters", async () => {
    mocks.tenantTx.mockResolvedValue([
      [{ name: "Production", code: "PRD" }],
      [{ name: "Production" }],
      [{ code: "PUN-01", name: "Pune Plant", city: "Pune", state: "maharashtra" }, { code: null, name: "No code", city: null, state: null }],
      [{ code: "A", name: "Shift A", starts_at: "08:00", ends_at: "20:00", duration_minutes: "720" }, { code: "G", name: null, starts_at: null, ends_at: null, duration_minutes: null }],
    ]);
    const result = await loadEmployeeFormReference(access);
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    (mocks.tenantTx.mock.calls[0][1] as Array<{ values: unknown[] }>).forEach((statement) => expect(statement.values).toContain("t-1"));
    expect(result.departments).toEqual([{ name: "Production", code: "PRD" }]);
    expect(result.locations).toEqual([{ code: "PUN-01", name: "Pune Plant", city: "Pune", state: "maharashtra" }]);
    expect(result.shifts).toEqual([
      { code: "A", name: "Shift A", startsAt: "08:00", endsAt: "20:00", durationMinutes: 720 },
      { code: "G", name: "G", startsAt: null, endsAt: null, durationMinutes: null },
    ]);
  });

  it("returns empty lists for an empty tenant rather than defaults", async () => {
    mocks.tenantTx.mockResolvedValue([[], [], [], []]);
    expect(await loadEmployeeFormReference(access)).toEqual({ departments: [], locations: [], shifts: [] });
  });
});
