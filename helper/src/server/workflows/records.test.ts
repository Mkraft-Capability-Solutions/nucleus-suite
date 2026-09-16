import { beforeEach, describe, expect, it, vi } from "vitest";
const { enforce, tenantTx, query } = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn(), query: vi.fn((sql, params) => ({ sql, params })) }));
vi.mock("@/lib/db", () => ({ sqlClient: { query } }));
vi.mock("@/server/platform/access", () => ({ enforce, tenantTx }));
import { workflowRecords } from "./records";
import type { Access } from "@/server/platform/access";
const access = { tenantId: "tenant-a", context: {} } as Access;
beforeEach(() => { vi.clearAllMocks(); tenantTx.mockResolvedValue([[{ id: "r1", attributes: { name: "Agency" }, created_at: "2026-01-01" }]]); });

describe("workflow record lists", () => {
  it("authorizes access and binds tenant and pagination parameters", async () => {
    const response = await workflowRecords(access, "contractors/agencies", new Request("https://hrms.test/api/v1/contractors/agencies?page=2&pageSize=10"), "request");
    expect(enforce).toHaveBeenCalledWith(access.context, "employee.write", { tenantId: "tenant-a" });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('from "contractor_organizations" where tenant_id = $1'), ["tenant-a", 11, 10]);
    expect(await response.json()).toMatchObject({ data: [{ id: "r1", attributes: { name: "Agency" } }] });
  });
  it("rejects unknown and inherited resource names before storage access", async () => {
    for (const resource of ["employees; drop table employees", "__proto__", "constructor"]) await expect(workflowRecords(access, resource, new Request("https://hrms.test"), "request")).rejects.toMatchObject({ status: 404 });
    expect(query).not.toHaveBeenCalled();
  });
  it("does not query storage on permission denial", async () => {
    enforce.mockImplementationOnce(() => { throw new Error("Forbidden"); });
    await expect(workflowRecords(access, "contractors/agencies", new Request("https://hrms.test"), "request")).rejects.toThrow("Forbidden");
    expect(query).not.toHaveBeenCalled();
  });
  it("filters clearance work by a bound case reference", async () => {
    const parentId = "a0000000-0000-4000-8000-000000000001";
    await workflowRecords(access, "offboarding/items", new Request("https://hrms.test/api/v1/offboarding/items?parentId=" + parentId), "request");
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"offboarding_case_id" = $4::uuid'), ["tenant-a", 26, 0, parentId]);
    expect(query.mock.calls[0][0]).toContain("jsonb_build_object('parentReference'");
  });
  it("rejects malformed case references before querying", async () => {
    await expect(workflowRecords(access, "offboarding/items", new Request("https://hrms.test/api/v1/offboarding/items?parentId=invalid"), "request")).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});
