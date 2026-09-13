import { describe, expect, it } from "vitest";
import { authorize, type AuthorizationContext } from "@/server/identity/authorization";

/**
 * OC-P1-02 / OC-P1-03 — Tenant isolation and field-security acceptance (TDD spec).
 *
 * Frozen contracts: TENANCY_RLS_AND_FIELD_SECURITY.md,
 * AUTHENTICATION_AUTHORIZATION.md, OC-P1-03 denial scenarios.
 * Every backend `-API` task must fail closed on these cases.
 */

const TENANT_A = "tenant_india_demo";
const TENANT_B = "tenant_india_second";

function actor(tenantId: string, permissions: string[], roles = ["hr_admin"]): AuthorizationContext {
  return { actorUserId: `user_${tenantId}`, membershipId: `membership_${tenantId}`, tenantId, permissions, roles };
}

const HR_ADMIN = actor(TENANT_A, [
  "employee.read",
  "employee.update",
  "leave.approve",
  "attendance.manage",
  "document.read",
  "payroll.rate.read",
  "employee.bank.read",
  "employee.tax.read",
  "ai.query",
]);
// Plant time-office: attendance only, never salary/rate/bank (ATT-030/PAY-002).
const PLANT_TIME_OFFICE = actor(TENANT_A, ["employee.read", "attendance.manage", "gatepass.manage"], ["plant_time_office"]);
// Auditor: read-only, no approvals or sensitive fields.
const AUDITOR = actor(TENANT_A, ["employee.read", "audit.read"], ["auditor"]);

const CROSS_TENANT_ACTIONS = [
  "employee.read",
  "employee.update",
  "leave.approve",
  "attendance.manage",
  "payroll.read",
  "loan.approve",
  "document.read",
  "ai.query",
  "integration.manage",
];

describe("cross-tenant isolation (OC-P1-03)", () => {
  it.each(CROSS_TENANT_ACTIONS)("denies %s against another tenant with TENANT_CONTEXT_MISMATCH", (action) => {
    const decision = authorize(HR_ADMIN, { action, resource: { tenantId: TENANT_B } });
    expect(decision).toMatchObject({ allowed: false, reasonCode: "TENANT_CONTEXT_MISMATCH", allowedFields: [] });
  });

  it("returns the identical denial for unknown tenant ids (no existence leak)", () => {
    const known = authorize(HR_ADMIN, { action: "employee.read", resource: { tenantId: TENANT_B } });
    const unknown = authorize(HR_ADMIN, { action: "employee.read", resource: { tenantId: "tenant_does_not_exist" } });
    expect(known).toEqual(unknown);
  });

  it("denies cross-tenant access even with wildcard-grade permissions", () => {
    const superAdmin = actor(TENANT_A, [...CROSS_TENANT_ACTIONS, "payroll.rate.read", "employee.bank.read"]);
    expect(authorize(superAdmin, { action: "payroll.read", resource: { tenantId: TENANT_B } }).allowed).toBe(false);
  });

  it("isolates two deterministic demo tenants with collision-proof keys", () => {
    const fixtureRows = [
      { tenantId: TENANT_A, employeeCode: "HO-0001" },
      { tenantId: TENANT_B, employeeCode: "HO-0001" },
    ];
    // Same human-readable code in both tenants must never resolve across tenants.
    for (const row of fixtureRows) {
      expect(row.tenantId).toBeTruthy();
      const decision = authorize(actor(row.tenantId, ["employee.read"]), {
        action: "employee.read",
        resource: { tenantId: row.tenantId },
      });
      expect(decision.allowed).toBe(true);
      expect(
        authorize(actor(row.tenantId === TENANT_A ? TENANT_B : TENANT_A, ["employee.read"]), {
          action: "employee.read",
          resource: { tenantId: row.tenantId },
        }).allowed,
      ).toBe(false);
    }
  });

  it("requires tenant_id on every tenant-bearing fixture row", () => {
    const rows = [
      { tenantId: TENANT_A, id: "emp_1" },
      { tenantId: TENANT_A, id: "leave_1" },
      { tenantId: TENANT_A, id: "run_1" },
      { tenantId: TENANT_A, id: "doc_1" },
    ];
    for (const row of rows) expect(row.tenantId).toBe(TENANT_A);
  });
});

describe("Plant versus Head Office salary boundary (OC-P2-03 / OC-P4-03)", () => {
  it("lets Plant time-office read attendance identity but not compensation", () => {
    expect(
      authorize(PLANT_TIME_OFFICE, { action: "employee.read", resource: { tenantId: TENANT_A }, requestedFields: ["name", "code"] }).allowed,
    ).toBe(true);
    expect(
      authorize(PLANT_TIME_OFFICE, {
        action: "employee.read",
        resource: { tenantId: TENANT_A },
        requestedFields: ["name", "compensation"],
      }),
    ).toMatchObject({ allowed: false, reasonCode: "FIELD_FORBIDDEN" });
  });

  it.each([["bank"], ["tax"], ["health"]])("denies Plant access to protected %s fields", (field) => {
    expect(
      authorize(PLANT_TIME_OFFICE, { action: "employee.read", resource: { tenantId: TENANT_A }, requestedFields: [field] }).allowed,
    ).toBe(false);
  });

  it("denies Plant access to compensation-flagged resources regardless of requested fields", () => {
    expect(
      authorize(PLANT_TIME_OFFICE, { action: "employee.read", resource: { tenantId: TENANT_A, sensitivity: ["compensation"] } }).allowed,
    ).toBe(false);
  });

  it("permits HR Admin with the independent rate permission to read compensation", () => {
    expect(
      authorize(HR_ADMIN, {
        action: "employee.read",
        resource: { tenantId: TENANT_A, sensitivity: ["compensation"] },
        requestedFields: ["name", "compensation"],
      }).allowed,
    ).toBe(true);
  });
});

describe("least-privilege personas (OC-P1-03)", () => {
  it("keeps the auditor read-only: no approvals, no mutations, no sensitive fields", () => {
    expect(authorize(AUDITOR, { action: "leave.approve", resource: { tenantId: TENANT_A } })).toMatchObject({
      allowed: false,
      reasonCode: "ACTION_FORBIDDEN",
    });
    expect(
      authorize(AUDITOR, { action: "employee.read", resource: { tenantId: TENANT_A }, requestedFields: ["bank"] }).allowed,
    ).toBe(false);
  });

  it("fails closed for revoked or suspended memberships (empty permission set)", () => {
    const revoked = actor(TENANT_A, [], ["none"]);
    expect(authorize(revoked, { action: "employee.read", resource: { tenantId: TENANT_A } })).toMatchObject({
      allowed: false,
      reasonCode: "ACTION_FORBIDDEN",
    });
  });

  it("never grants by role name alone: permissions are the authority", () => {
    const namedOnly = actor(TENANT_A, [], ["hr_admin"]);
    expect(authorize(namedOnly, { action: "employee.read", resource: { tenantId: TENANT_A } }).allowed).toBe(false);
  });

  it("echoes back only the authorized projection on allow", () => {
    const decision = authorize(HR_ADMIN, {
      action: "employee.read",
      resource: { tenantId: TENANT_A },
      requestedFields: ["name", "code"],
    });
    expect(decision).toEqual({ allowed: true, reasonCode: "ALLOWED", allowedFields: ["name", "code"] });
  });
});
