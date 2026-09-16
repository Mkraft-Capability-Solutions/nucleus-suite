import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenantTx, enforce } = vi.hoisted(() => ({ tenantTx: vi.fn(), enforce: vi.fn() }));
vi.mock("@/lib/db", () => ({
  sqlClient: Object.assign(
    (parts: TemplateStringsArray, ...values: unknown[]) => ({ sql: parts.join("?"), values }),
    { query: (sql: string, values: unknown[]) => ({ sql, values }) },
  ),
}));
vi.mock("@/server/platform/access", () => ({ tenantTx, enforce, uuidOrNull: (value: string) => value }));

import {
  canReadWholePolicyRoll,
  derivePolicyAckState,
  getPolicyAcknowledgementRecord,
  listPolicyAcknowledgements,
} from "./policy-acknowledgements";
import type { Access } from "@/server/platform/access";

const SELF = "11111111-1111-4111-8111-111111111111";

/** The standard employee role: `employee.read`, never `employee.write`. */
const EMPLOYEE = ["tenant.read", "employee.read", "attendance.read", "leave.read"];
const PUBLISHER = [...EMPLOYEE, "employee.write"];

function access(permissions: string[], roles: string[]): Access {
  return {
    tenantId: "tenant-a",
    context: {
      actorUserId: "user-a",
      membershipId: "membership-a",
      tenantId: "tenant-a",
      employeeId: SELF,
      permissions,
      roles,
    },
  } as Access;
}

type Statement = { sql: string; values: unknown[] };

function statements(call: number): Statement[] {
  return tenantTx.mock.calls[call]![1] as Statement[];
}

/** One policy row as the self-scoped query actually returns it. */
function policyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "policy-1",
    policy: "Code of conduct",
    policy_code: "POL-1",
    version: "2026",
    audience: "All employees",
    published_from: "2026-01-01",
    due_on: null,
    audience_count: null,
    acknowledged_count: null,
    acknowledged_on: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("who may read the whole acknowledgement roll", () => {
  it("admits an administrative principal and whoever publishes the policies", () => {
    expect(canReadWholePolicyRoll(["tenant.manage"], [])).toBe(true);
    expect(canReadWholePolicyRoll([], ["hr_admin"])).toBe(true);
    expect(canReadWholePolicyRoll(PUBLISHER, [])).toBe(true);
  });

  it("does NOT admit employee.read, which every employee holds", () => {
    expect(canReadWholePolicyRoll(EMPLOYEE, ["employee"])).toBe(false);
  });
});

describe("derivePolicyAckState", () => {
  it("never reads a withheld count as nobody having to acknowledge", () => {
    expect(
      derivePolicyAckState({ acknowledgedByViewer: false, dueOn: null, audienceCount: null, acknowledgedCount: null }, "2026-09-14"),
    ).toBe("pending_acknowledgement");
    expect(
      derivePolicyAckState({ acknowledgedByViewer: true, dueOn: null, audienceCount: null, acknowledgedCount: null }, "2026-09-14"),
    ).toBe("acknowledged");
  });
});

describe("listPolicyAcknowledgements", () => {
  it("withholds tenant coverage from a self-scoped reader rather than counting it", async () => {
    tenantTx.mockResolvedValueOnce([[{ employee_id: SELF }]]);
    tenantTx.mockResolvedValueOnce([[policyRow()]]);

    const rows = await listPolicyAcknowledgements(access(EMPLOYEE, ["employee"]), "");

    const [statement] = statements(1);
    expect(statement.sql).toContain("null::int as audience_count");
    expect(statement.sql).toContain("null::int as acknowledged_count");
    // The tenant's headcount and consent rows are not counted at all.
    expect(statement.sql).not.toContain("from employees emp");
    expect(statement.sql).not.toContain("count(*)::int from consent_records");
    // Withheld, never a fabricated zero.
    expect(rows[0]!.audience_count).toBeNull();
    expect(rows[0]!.acknowledged_count).toBeNull();
    expect(rows[0]!.status).toBe("pending_acknowledgement");
    expect(enforce).toHaveBeenCalledWith(expect.anything(), "employee.read", { tenantId: "tenant-a" });
  });

  it("keeps live coverage for the principal who publishes the policies", async () => {
    tenantTx.mockResolvedValueOnce([[{ employee_id: SELF }]]);
    tenantTx.mockResolvedValueOnce([[policyRow({ audience_count: 412, acknowledged_count: 37 })]]);

    const rows = await listPolicyAcknowledgements(access(PUBLISHER, ["hr-manager"]), "");

    const [statement] = statements(1);
    expect(statement.sql).toContain("from employees emp");
    expect(statement.sql).not.toContain("null::int as audience_count");
    expect(rows[0]!.audience_count).toBe(412);
    expect(rows[0]!.acknowledged_count).toBe(37);
  });

  it("refuses an account with no linked employee profile", async () => {
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(listPolicyAcknowledgements(access(EMPLOYEE, ["employee"]), "")).rejects.toMatchObject({
      status: 403,
      code: "EMPLOYEE_LINK_REQUIRED",
    });
    // Only the membership lookup ran; no policy row was read.
    expect(tenantTx).toHaveBeenCalledTimes(1);
  });
});

describe("getPolicyAcknowledgementRecord", () => {
  it("serves a self-scoped reader only their own line of the roll", async () => {
    tenantTx.mockResolvedValueOnce([[{ employee_id: SELF }]]);
    tenantTx.mockResolvedValueOnce([[policyRow()]]);
    tenantTx.mockResolvedValueOnce([[]]);
    tenantTx.mockResolvedValueOnce([[]]);

    await getPolicyAcknowledgementRecord(access(EMPLOYEE, ["employee"]), "policy-1");

    const [roll] = statements(2);
    expect(roll.sql).toContain("$3::text is null or cr.attributes->>'subject_id' = $3::text");
    expect(roll.values[2]).toBe(SELF);
  });

  it("serves the whole roll to the principal who publishes the policies", async () => {
    tenantTx.mockResolvedValueOnce([[{ employee_id: SELF }]]);
    tenantTx.mockResolvedValueOnce([[policyRow({ audience_count: 412, acknowledged_count: 37 })]]);
    tenantTx.mockResolvedValueOnce([[]]);
    tenantTx.mockResolvedValueOnce([[]]);

    await getPolicyAcknowledgementRecord(access(PUBLISHER, ["hr-manager"]), "policy-1");
    expect(statements(2)[0]!.values[2]).toBeNull();
  });

  it("does not find a policy version that the scoped lookup did not return", async () => {
    tenantTx.mockResolvedValueOnce([[{ employee_id: SELF }]]);
    tenantTx.mockResolvedValueOnce([[]]);
    await expect(getPolicyAcknowledgementRecord(access(EMPLOYEE, ["employee"]), "policy-1")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
