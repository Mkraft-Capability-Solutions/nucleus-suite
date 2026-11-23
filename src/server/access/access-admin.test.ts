import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx, uuidOrNull: (value: string) => value }));
vi.mock("@/server/admin/service", () => ({ isValidTimezone: () => true }));

const { updateRolePermissions, updateRolePermissionsSchema, setRoleUiAccess, roleUiAccessSchema, previewRole } = await import("@/server/access/role-admin");
const { csvCell } = await import("@/server/access/audit-log");
const { expiryTimestamp, setMemberOverrides, setOverridesSchema } = await import("@/server/access/member-access");
const { deriveUiAccess } = await import("@/lib/access/ui-access-catalog");

const ROLE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", employeeId: null, permissions: [], roles: ["hr_partner"] } } as unknown as Access;
const roleRow = (code: string, keys: string[] = ["employee.read"]) => ({ id: ROLE_ID, code, name: "Role", status: "active", system_managed: false, permission_keys: keys, member_count: 2 });

function sqlText(call: unknown[]): string {
  return (call[0] as Array<{ strings: TemplateStringsArray }>).map((statement) => statement.strings.join("?")).join("\n");
}

describe("role administration", () => {
  beforeEach(() => {
    mocks.enforce.mockReset();
    mocks.tenantTx.mockReset();
  });

  it("grants and revokes known permissions with an audit row, checking role.manage", async () => {
    mocks.tenantTx.mockImplementation(async (_access: Access, statements: unknown[]) => {
      const text = sqlText([statements]);
      if (text.includes("from roles r")) return [[roleRow("hr_partner")]];
      if (text.includes("roleUiAccess")) return [[{ ui: null }]];
      if (text.includes("select permission_key from permissions")) return [[{ permission_key: "leave.read" }, { permission_key: "employee.read" }]];
      return statements.map(() => []);
    });
    const input = updateRolePermissionsSchema.parse({ grant: ["leave.read"], revoke: ["employee.read"] });
    await updateRolePermissions(access, ROLE_ID, input, "req-1");
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "role.manage", { tenantId: "t-1" });
    const write = mocks.tenantTx.mock.calls.map((call) => sqlText([call[1]])).find((text) => text.includes("delete from role_permissions"));
    expect(write).toContain("insert into role_permissions");
    expect(write).toContain("access.role_permissions");
  });

  it("rejects unknown permission keys instead of creating them", async () => {
    mocks.tenantTx.mockImplementation(async (_access: Access, statements: unknown[]) => {
      const text = sqlText([statements]);
      if (text.includes("from roles r")) return [[roleRow("hr_partner")]];
      if (text.includes("roleUiAccess")) return [[{ ui: null }]];
      return [[]];
    });
    const input = updateRolePermissionsSchema.parse({ grant: ["console:S1"] });
    await expect(updateRolePermissions(access, ROLE_ID, input, "req-1")).rejects.toMatchObject({ status: 422, code: "UNKNOWN_PERMISSION" });
  });

  it("refuses to edit actions of a role that receives every permission", async () => {
    mocks.tenantTx.mockImplementation(async (_access: Access, statements: unknown[]) => {
      const text = sqlText([statements]);
      if (text.includes("from roles r")) return [[roleRow("owner")]];
      return [[{ ui: null }]];
    });
    await expect(updateRolePermissions(access, ROLE_ID, updateRolePermissionsSchema.parse({ grant: ["leave.read"] }), "r")).rejects.toMatchObject({ status: 422 });
  });

  it("returns 404 for a role outside the tenant", async () => {
    mocks.tenantTx.mockResolvedValue([[]]);
    await expect(setRoleUiAccess(access, ROLE_ID, roleUiAccessSchema.parse({ pages: ["payroll"], cards: [] }), "r")).rejects.toMatchObject({ status: 404 });
  });

  it("validates page and card keys", () => {
    expect(roleUiAccessSchema.safeParse({ pages: ["not_a_page"], cards: [] }).success).toBe(false);
    expect(roleUiAccessSchema.safeParse({ pages: ["payroll"], cards: ["S5"] }).success).toBe(true);
  });

  it("previews a configured role and flags pages whose data it cannot read", async () => {
    mocks.tenantTx.mockImplementation(async (_access: Access, statements: unknown[]) => {
      const text = sqlText([statements]);
      if (text.includes("from roles r")) return [[roleRow("hr_partner", ["employee.read"])]];
      return [[{ ui: { [ROLE_ID]: { pages: ["payroll", "people_core"], cards: [] } } }]];
    });
    const preview = await previewRole(access, ROLE_ID);
    const payroll = preview.access.pages.find((entry) => entry.key === "payroll");
    expect(payroll).toMatchObject({ visible: true, source: "role", missingPermissions: ["payroll.read"] });
    expect(preview.access.pages.find((entry) => entry.key === "attendance")?.visible).toBe(false);
  });
});

describe("member overrides", () => {
  beforeEach(() => { mocks.enforce.mockReset(); mocks.tenantTx.mockReset(); });

  it("forbids changing your own access", async () => {
    const input = setOverridesSchema.parse({ items: [{ type: "page", key: "payroll", effect: "allow" }], reason: "temporary cover", expiresOn: "2099-01-01" });
    const self = { ...access, context: { ...access.context, membershipId: MEMBER_ID } } as Access;
    await expect(setMemberOverrides(self, MEMBER_ID, input, "r")).rejects.toMatchObject({ code: "SELF_GRANT_FORBIDDEN" });
  });

  it("bounds the expiry to the next year", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(() => expiryTimestamp("2026-05-01", now)).toThrow();
    expect(() => expiryTimestamp("2028-01-01", now)).toThrow();
    expect(expiryTimestamp("2026-07-01", now)).toBe("2026-07-01T23:59:59.000Z");
  });
});

describe("ui access derivation and csv", () => {
  it("applies overrides over role defaults and lets super admins see all", () => {
    const result = deriveUiAccess({ superAdmin: false, permissions: ["employee.read"], roleConfigs: [null], overrides: [{ type: "page", key: "people_core", effect: "deny" }] });
    expect(result.pages.find((entry) => entry.key === "people_core")).toMatchObject({ visible: false, source: "override_deny" });
    expect(result.pages.find((entry) => entry.key === "team")).toMatchObject({ visible: true, source: "role_default" });
    expect(deriveUiAccess({ superAdmin: true, permissions: [], roleConfigs: [] }).cards.every((entry) => entry.visible)).toBe(true);
  });

  it("neutralises formula injection in CSV cells", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('a"b')).toBe(`"a""b"`);
  });
});
