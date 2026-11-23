import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ tenantTx: vi.fn(), getPreference: vi.fn(), setPreference: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ tenantTx: mocks.tenantTx, uuidOrNull: (v: string | null) => v }));
vi.mock("@/server/preferences/service", () => ({ getPreference: mocks.getPreference, setPreference: mocks.setPreference }));

const { activeCompanyScope, buildHierarchy, getHierarchy, setActiveEntity, withDescendants, ALL_GROUP_ENTITIES } = await import("@/server/organization/active-entity");

const H = "00000000-0000-4000-8000-000000000001";
const A = "00000000-0000-4000-8000-000000000002";
const A1 = "00000000-0000-4000-8000-000000000003";
const B = "00000000-0000-4000-8000-000000000004";
const entity = (id: string, parent: string | null, name: string) => ({
  id, parent_legal_entity_id: parent, root_group_id: H, legal_name: name, code: null, industry_vertical: null, currency_code: "INR", status: "active",
});
const entities = [entity(H, null, "Holding"), entity(A, H, "Alpha Hotels"), entity(A1, A, "Alpha Resorts"), entity(B, H, "Beta Steel")];

function accessFor(permissions: string[]): Access {
  return { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: "e-1", permissions, roles: [] } } as unknown as Access;
}
const admin = accessFor(["tenant.manage"]);
const member = accessFor(["employee.read"]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPreference.mockResolvedValue(null);
});

describe("company hierarchy", () => {
  it("expands a company to its descendants", () => {
    expect([...withDescendants(entities, [A])].sort()).toEqual([A, A1].sort());
  });

  it("shows ancestors of accessible companies as not selectable", () => {
    const tree = buildHierarchy(entities, new Set([A, A1]));
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: H, selectable: false });
    expect(tree[0]!.children.map((n) => n.id)).toEqual([A]);
    expect(tree[0]!.children[0]!.children[0]).toMatchObject({ id: A1, selectable: true });
  });

  it("gives group administrators the whole tree and the all-entities option", async () => {
    mocks.tenantTx.mockResolvedValue([entities, []]);
    const result = await getHierarchy(admin);
    expect(result.canSelectAll).toBe(true);
    expect(result.tree[0]!.children.map((n) => n.legalName)).toEqual(["Alpha Hotels", "Beta Steel"]);
  });
});

describe("active entity", () => {
  it("refuses all group entities for a non-admin", async () => {
    mocks.tenantTx.mockResolvedValue([entities, [{ id: A }]]);
    await expect(setActiveEntity(member, { companyId: ALL_GROUP_ENTITIES })).rejects.toMatchObject({ status: 403 });
    expect(mocks.setPreference).not.toHaveBeenCalled();
  });

  it("refuses a company outside the caller's scope with 404", async () => {
    mocks.tenantTx.mockResolvedValue([entities, [{ id: A }]]);
    await expect(setActiveEntity(member, { companyId: B })).rejects.toMatchObject({ status: 404 });
  });

  it("stores an accessible company and scopes to its subtree", async () => {
    mocks.tenantTx.mockResolvedValue([entities, [{ id: A }]]);
    const result = await setActiveEntity(member, { companyId: A });
    expect(mocks.setPreference).toHaveBeenCalledWith(member, "active_entity", { companyId: A });
    expect(result.scope.companyIds).toEqual(expect.arrayContaining([A, A1]));
  });

  it("lets an admin choose all group entities", async () => {
    mocks.tenantTx.mockResolvedValue([entities, []]);
    const result = await setActiveEntity(admin, { companyId: ALL_GROUP_ENTITIES });
    expect(result.scope).toEqual({ companyIds: "ALL" });
  });

  it("ignores a stored company the caller no longer has access to", async () => {
    mocks.tenantTx.mockResolvedValue([entities, [{ id: B }]]);
    mocks.getPreference.mockResolvedValue({ companyId: A });
    expect(await activeCompanyScope(member)).toEqual({ companyIds: [B] });
  });

  it("ignores a stored all-entities choice for a non-admin", async () => {
    mocks.tenantTx.mockResolvedValue([entities, []]);
    mocks.getPreference.mockResolvedValue(ALL_GROUP_ENTITIES);
    expect(await activeCompanyScope(member)).toEqual({ companyIds: [] });
  });
});
