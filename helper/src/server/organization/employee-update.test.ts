import { describe, expect, it, vi } from "vitest";
const { tenantTx, enforce } = vi.hoisted(() => ({ tenantTx: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/db", () => ({ sqlClient: (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({ tenantTx, enforce, uuidOrNull: (value: string) => value }));
import { updateEmployee, updateEmployeeSchema } from "./employee-update";
import type { Access } from "@/server/platform/access";
const access = { tenantId: "tenant-a", context: { actorUserId: "user-a", membershipId: "membership-a" } } as Access;

describe("employee editing", () => {
  it("requires an actual change and a reason", () => {
    expect(updateEmployeeSchema.safeParse({ reason: "Correction" }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ firstName: "A" }).success).toBe(false);
    expect(updateEmployeeSchema.safeParse({ firstName: "A", reason: "Correction" }).success).toBe(true);
  });
  it("updates under a tenant and version predicate with audit in the same statement", async () => {
    tenantTx.mockResolvedValueOnce([[{ id: "employee-a", version: 3 }]]);
    const result = await updateEmployee(access, "employee-a", 2, { firstName: "Changed", reason: "Correction" }, "request");
    expect(result.version).toBe(3);
    expect(enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "tenant-a" });
    const statement = tenantTx.mock.calls.at(-1)![1][0];
    expect(statement.sql).toContain("and version = ?");
    expect(statement.sql).toContain("insert into audit_events");
    expect(statement.values).toContain("tenant-a");
  });
  it("rejects stale edits without reporting success", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(updateEmployee(access, "employee-a", 1, { lastName: "Changed", reason: "Correction" }, "request")).rejects.toMatchObject({ status: 409 });
  });
});
