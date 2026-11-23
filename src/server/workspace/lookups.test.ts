import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx }));

const { isLookupList, listLookup } = await import("@/server/workspace/lookups");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;

describe("workspace lookups", () => {
  beforeEach(() => {
    mocks.enforce.mockReset();
    mocks.tenantTx.mockReset();
    mocks.tenantTx.mockResolvedValue([[{ id: "r-1", code: "employee", name: "Employee" }]]);
  });

  it("knows only the declared lists", () => {
    expect(isLookupList("roles")).toBe(true);
    expect(isLookupList("employees")).toBe(false);
  });

  it("lists roles behind membership.manage, scoped to the tenant", async () => {
    const items = await listLookup(access, "roles", "emp");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "membership.manage", { tenantId: "t-1" });
    const statement = (mocks.tenantTx.mock.calls[0]?.[1] as Array<{ values: unknown[] }>)[0];
    expect(statement?.values).toEqual(["t-1", "%emp%", "%emp%"]);
    expect(items).toEqual([{ id: "r-1", code: "employee", name: "Employee" }]);
  });

  it("lists document types behind employee.write and stops when denied", async () => {
    await listLookup(access, "document-types", "");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    mocks.enforce.mockImplementation(() => { throw new Error("denied"); });
    mocks.tenantTx.mockClear();
    await expect(listLookup(access, "document-types", "")).rejects.toThrow("denied");
    expect(mocks.tenantTx).not.toHaveBeenCalled();
  });
});
