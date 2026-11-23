import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (value: string | null) => value }));

const { registerCatalogAsset, registerCatalogAssetSchema } = await import("@/server/assets/catalog-intake");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: [] } } as unknown as Access;
const input = registerCatalogAssetSchema.parse({ assetCode: "LT-0042", assetType: "laptop", brand: "Lenovo", model: "ThinkPad T14", serialNumber: "SN-9", replacementValueMinor: 8_500_000, currency: "INR" });

describe("asset catalogue intake", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("validates the asset type and condition against the picklists and pairs value with currency", () => {
    expect(registerCatalogAssetSchema.safeParse({ ...input, assetType: "spaceship" }).success).toBe(false);
    expect(registerCatalogAssetSchema.safeParse({ ...input, condition: "excellent" }).success).toBe(false);
    const noCurrency = registerCatalogAssetSchema.safeParse({ ...input, currency: undefined });
    expect(noCurrency.success).toBe(false);
    expect(input.condition).toBe("new");
  });

  it("enforces employee.write, inserts an Available asset and audits it in one tenant transaction", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[], []]).mockResolvedValueOnce([]);
    const result = await registerCatalogAsset(access, input, "req-1");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "t-1" });
    expect(result).toMatchObject({ assetCode: "LT-0042", status: "available" });
    const writes = mocks.tenantTx.mock.calls[1][1] as Array<{ strings: string[]; values: unknown[] }>;
    expect(writes).toHaveLength(2);
    expect(writes[0].strings.join("")).toContain("insert into asset_catalog");
    expect(writes[0].values).toContain("t-1");
    expect(String(writes[0].values[2])).toContain('"status":"Available"');
    expect(writes[1].strings.join("")).toContain("insert into audit_events");
    expect(writes[1].values).toContain("asset.register");
  });

  it("rejects a duplicate asset tag or serial number with 409", async () => {
    mocks.tenantTx.mockResolvedValueOnce([[{ id: "a-1" }], []]);
    await expect(registerCatalogAsset(access, input, "req-1")).rejects.toMatchObject({ status: 409 });
    mocks.tenantTx.mockResolvedValueOnce([[], [{ asset_code: "LT-0001" }]]);
    await expect(registerCatalogAsset(access, input, "req-1")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("LT-0001") });
    expect(mocks.tenantTx).toHaveBeenCalledTimes(2);
  });
});
