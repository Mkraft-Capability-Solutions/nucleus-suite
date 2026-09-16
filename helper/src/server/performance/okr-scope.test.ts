import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantTx, enforce } = vi.hoisted(() => ({ tenantTx: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/db", () => ({
  sqlClient: (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join("?"), values }),
}));
vi.mock("@/server/platform/access", () => ({ tenantTx, enforce, uuidOrNull: (value: string) => value }));
vi.mock("@/server/performance/service", () => ({ createObjective: vi.fn(), createKeyResult: vi.fn() }));

import { canReadWholeCascade, loadObjectiveTree, okrCascadeScopeFor } from "./okr";
import type { Access } from "@/server/platform/access";

const SELF = "11111111-1111-4111-8111-111111111111";
const COLLEAGUE = "22222222-2222-4222-8222-222222222222";

function access(permissions: string[], roles: string[], employeeId: string | null): Access {
  return {
    tenantId: "tenant-a",
    context: {
      actorUserId: "user-a",
      membershipId: "membership-a",
      tenantId: "tenant-a",
      employeeId,
      permissions,
      roles,
    },
  } as Access;
}

/** Rows as the narrowed query would actually return them. */
function ownObjectiveRows() {
  return [
    {
      id: "objective-self",
      parent_objective_id: "objective-ceo",
      owner_employee_id: SELF,
      goal_cycle_id: null,
      attributes: { title: "Ship the payroll migration", weight_pct: 100 },
      created_at: "2026-01-01",
    },
  ];
}

function statementsOfLastCall(): Array<{ sql: string; values: unknown[] }> {
  return tenantTx.mock.calls.at(-1)![1] as Array<{ sql: string; values: unknown[] }>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("who may read the whole cascade", () => {
  it("admits an administrative principal and anyone who may author objectives", () => {
    expect(canReadWholeCascade(["tenant.manage"], [])).toBe(true);
    expect(canReadWholeCascade([], ["hr_admin"])).toBe(true);
    expect(canReadWholeCascade(["employee.write"], [])).toBe(true);
  });

  it("does NOT admit employee.read, which every employee holds", () => {
    expect(canReadWholeCascade(["employee.read", "attendance.read", "leave.read"], ["employee"])).toBe(false);
  });

  it("resolves the slice before a row is read", () => {
    expect(okrCascadeScopeFor(["tenant.manage"], [], SELF)).toBe("tenant");
    expect(okrCascadeScopeFor(["employee.read"], ["employee"], SELF)).toBe("self-and-reports");
    expect(okrCascadeScopeFor(["employee.read"], ["employee"], null)).toBe("none");
  });
});

describe("loadObjectiveTree for a non-administrative caller", () => {
  beforeEach(() => {
    tenantTx.mockResolvedValueOnce([ownObjectiveRows(), [], []]);
    tenantTx.mockResolvedValueOnce([[{ settings: {} }]]);
  });

  it("narrows to the caller and their reports in SQL, not after the fact", async () => {
    const tree = await loadObjectiveTree(access(["employee.read"], ["employee"], SELF));

    expect(tree.scope).toBe("self-and-reports");
    const [objectiveStatement, keyResultStatement, linkStatement] = tenantTx.mock.calls[0]![1] as Array<{ sql: string; values: unknown[] }>;
    for (const statement of [objectiveStatement, keyResultStatement, linkStatement]) {
      expect(statement.sql).toContain("visible_owner");
      expect(statement.sql).toContain("manager_employee_id = ?");
      expect(statement.values).toContain(SELF);
      expect(statement.values).not.toContain(COLLEAGUE);
    }
    expect(enforce).toHaveBeenCalledWith(expect.anything(), "employee.read", { tenantId: "tenant-a" });
  });

  it("says plainly that the rest of the cascade was not served", async () => {
    const tree = await loadObjectiveTree(access(["employee.read"], ["employee"], SELF));
    expect(tree.scopeNote).toMatch(/not served to this account/i);
  });

  it("renders an objective whose parent is outside the slice as a root rather than dropping it", async () => {
    const tree = await loadObjectiveTree(access(["employee.read"], ["employee"], SELF));
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0]!.ownerEmployeeId).toBe(SELF);
    expect(tree.nodes[0]!.parentId).toBeNull();
  });
});

describe("loadObjectiveTree for an account with no employee record", () => {
  it("serves an empty cascade, never the tenant's", async () => {
    tenantTx.mockResolvedValueOnce([[{ settings: {} }]]);
    const tree = await loadObjectiveTree(access(["employee.read"], ["employee"], null));

    expect(tree.scope).toBe("none");
    expect(tree.nodes).toEqual([]);
    expect(tree.keyResults).toEqual([]);
    // The only statement that ran was the health-threshold read.
    expect(tenantTx).toHaveBeenCalledTimes(1);
    expect(statementsOfLastCall()[0]!.sql).toContain("tenant_settings");
  });
});

describe("loadObjectiveTree for an administrative caller", () => {
  it("keeps the whole-tenant cascade", async () => {
    tenantTx.mockResolvedValueOnce([ownObjectiveRows(), [], []]);
    tenantTx.mockResolvedValueOnce([[{ settings: {} }]]);
    const tree = await loadObjectiveTree(access(["employee.read", "tenant.manage"], ["hr_admin"], SELF));

    expect(tree.scope).toBe("tenant");
    for (const statement of tenantTx.mock.calls[0]![1] as Array<{ sql: string }>) {
      expect(statement.sql).not.toContain("visible_owner");
    }
  });
});
