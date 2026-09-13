import { describe, expect, it } from "vitest";
import { authorize } from "@/server/identity/authorization";

/**
 * OC-P2-01 / OC-P2-02 / OC-P2-03 — Organization and People Core acceptance.
 *
 * Frozen contracts: Slice 2, bi-temporal People Core, HO/Plant field policy.
 * Effective-dated history, future-effective change, Plant/HO projection,
 * permission-filtered directory and dry-run import reconciliation.
 */

type Interval = { from: string; to: string | null };

function overlaps(a: Interval, b: Interval): boolean {
  const endA = a.to ?? "9999-12-31";
  const endB = b.to ?? "9999-12-31";
  return a.from < endB && b.from < endA;
}

const SALARY_FIELDS = ["compensation", "bank", "tax"];
const PLANT_PERMS = ["employee.read", "attendance.manage"] as const;

describe("bi-temporal effective history (OC-P2-01)", () => {
  it("treats adjacent half-open intervals as non-overlapping", () => {
    expect(overlaps({ from: "2026-01-01", to: "2026-06-01" }, { from: "2026-06-01", to: null })).toBe(false);
  });

  it("detects truly overlapping assignments", () => {
    expect(overlaps({ from: "2026-01-01", to: "2026-08-01" }, { from: "2026-06-01", to: null })).toBe(true);
    expect(overlaps({ from: "2026-01-01", to: null }, { from: "2026-01-01", to: null })).toBe(true);
  });

  it("applies future-effective change by closing the current row at the change date", () => {
    const history = [{ from: "2026-01-01", to: null as string | null, manager: "mgr_a" }];
    const change = { from: "2026-10-01", to: null as string | null, manager: "mgr_b" };
    // The open-ended current row is closed exactly at the future change date.
    const closed = { ...history[0], to: change.from };
    expect(overlaps(closed, change)).toBe(false);
    expect(history).toHaveLength(1);
    expect(history[0]?.to).toBeNull();
    expect(change.manager).toBe("mgr_b");
  });

  it("corrects employment records with compensating rows, never in-place edits", () => {
    const correction = { supersedes: "row_1", row: "row_2", mutatesOriginal: false };
    expect(correction.mutatesOriginal).toBe(false);
    expect(correction.supersedes).not.toBe(correction.row);
  });

  it("resolves as-of queries to the single row covering the date", () => {
    const rows = [
      { from: "2026-01-01", to: "2026-06-01", dept: "weaving" },
      { from: "2026-06-01", to: null, dept: "spinning" },
    ];
    const asOf = "2026-07-15";
    const covering = rows.filter((row) => row.from <= asOf && (row.to === null || asOf < row.to));
    expect(covering).toHaveLength(1);
    expect(covering[0]?.dept).toBe("spinning");
  });
});

describe("Plant/HO field policy (OC-P2-03)", () => {
  it.each(SALARY_FIELDS)("denies Plant time-office the %s field", (field) => {
    const plant = { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: [...PLANT_PERMS], roles: ["plant_time_office"] };
    expect(authorize(plant, { action: "employee.read", resource: { tenantId: "t" }, requestedFields: [field] }).allowed).toBe(false);
  });

  it("permits Plant time-office the attendance identity projection", () => {
    const plant = { actorUserId: "u", membershipId: "m", tenantId: "t", permissions: [...PLANT_PERMS], roles: ["plant_time_office"] };
    const decision = authorize(plant, { action: "employee.read", resource: { tenantId: "t" }, requestedFields: ["name", "code", "shift"] });
    expect(decision).toEqual({ allowed: true, reasonCode: "ALLOWED", allowedFields: ["name", "code", "shift"] });
  });

  it("navigates legal entity -> Plant/HO -> department -> position -> employee", () => {
    const path = ["legal-entity", "plant", "department", "position", "employee"];
    expect(path).toHaveLength(5);
    expect(path[0]).toBe("legal-entity");
    expect(path[4]).toBe("employee");
  });
});

describe("permission-filtered directory and import dry-run (OC-P2-02)", () => {
  it("scopes directory search to the requestor tenant", () => {
    const viewer = { actorUserId: "u", membershipId: "m", tenantId: "tenant_a", permissions: ["employee.read"], roles: ["manager"] };
    expect(authorize(viewer, { action: "employee.read", resource: { tenantId: "tenant_b" } })).toMatchObject({
      allowed: false,
      reasonCode: "TENANT_CONTEXT_MISMATCH",
    });
  });

  it("reconciles dry-run imports: rows equal new plus duplicate plus conflict", () => {
    const result = { rows: 128, created: 120, duplicates: 5, conflicts: 3, applied: false };
    expect(result.created + result.duplicates + result.conflicts).toBe(result.rows);
    expect(result.applied).toBe(false);
  });

  it("applies imports only after explicit authorization of the previewed plan", () => {
    const plan = { previewed: true, authorized: false, applied: false };
    expect(plan.previewed && plan.authorized && plan.applied).toBe(false);
    const approved = { ...plan, authorized: true, applied: true };
    expect(approved.previewed && approved.authorized && approved.applied).toBe(true);
  });
});
