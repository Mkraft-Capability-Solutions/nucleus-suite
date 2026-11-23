import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ tenantTx: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => {
  const sqlClient = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }), {
    query: (text: string, values: unknown[]) => ({ text, values }),
  });
  return { sqlClient };
});
vi.mock("@/server/platform/access", () => ({ tenantTx: mocks.tenantTx }));
vi.mock("@/server/dashboards/query", () => ({ organisationContext: async () => ({ timezone: "UTC", name: "x", currency: "INR" }) }));

const { recomputeEmployeeAlerts, candidateQuery } = await import("./engine");
const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;

describe("alert engine", () => {
  beforeEach(() => mocks.tenantTx.mockReset());

  it("uses metadata only when the 0037 columns are missing", () => {
    const before = candidateQuery("t-1", { visa: false, permit: false }, {}) as unknown as { text: string };
    expect(before.text).not.toContain("visa_expiry_date");
    const after = candidateQuery("t-1", { visa: true, permit: true }, {}) as unknown as { text: string };
    expect(after.text).toContain("e.visa_expiry_date");
    expect(after.text).toContain("e.work_permit_expiry_date");
  });

  it("upserts in-range alerts and resolves the rest for one employee in one transaction", async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    mocks.tenantTx
      .mockResolvedValueOnce([[{ column_name: "visa_expiry_date" }, { column_name: "work_permit_expiry_date" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[
        { employee_id: "e1", company_id: null, root_group_id: null, category: "VISA_EXPIRY", source_ref: "visa", title: "Visa expiry", trigger_date: soon },
        { employee_id: "e1", company_id: null, root_group_id: null, category: "WORK_PERMIT_EXPIRY", source_ref: "work_permit", title: "Work permit", trigger_date: "2099-01-01" },
      ]])
      .mockResolvedValueOnce([[], [{ id: "old" }]]);
    const summary = await recomputeEmployeeAlerts(access, "e1");
    expect(summary).toMatchObject({ candidates: 2, open: 1, resolved: 1 });
    const writes = mocks.tenantTx.mock.calls[3]![1] as Array<{ text: string; values: unknown[] }>;
    expect(writes).toHaveLength(2); // no scan-state row for a single-employee recompute
    const payload = JSON.parse(writes[0]!.values[1] as string) as Array<{ severity: string; unique_dedup_key: string }>;
    expect(payload).toEqual([expect.objectContaining({ severity: "CRITICAL", unique_dedup_key: "VISA_EXPIRY:e1:visa" })]);
    expect(writes[1]!.values).toEqual(["t-1", ["VISA_EXPIRY:e1:visa"], "e1"]);
  });
});
