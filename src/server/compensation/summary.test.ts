import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray) => strings.join("?") }));
const tenantTx = vi.fn();
const enforce = vi.fn();
vi.mock("@/server/platform/access", () => ({ enforce, tenantTx, uuidOrNull: (v: string) => v }));

const { bandMetrics, lockBenefitSelection, lockBenefitSelectionSchema } = await import("@/server/compensation/summary");

const OPT_A = "123e4567-e89b-12d3-a456-426614174001";
const OPT_B = "123e4567-e89b-12d3-a456-426614174002";
const access = (employeeId: string | null) => ({ tenantId: "t1", context: { employeeId, actorUserId: "u1", membershipId: "m1" } }) as unknown as Parameters<typeof lockBenefitSelection>[0];

describe("bandMetrics", () => {
  it("computes compa-ratio and position against the midpoint", () => {
    expect(bandMetrics(4500000, { minMinor: 3000000, maxMinor: 5000000 })).toEqual({ midMinor: 4000000, compaRatio: 1.13, positionPct: 75 });
  });
  it("returns nulls for a missing or degenerate band", () => {
    expect(bandMetrics(100, null)).toEqual({ midMinor: null, compaRatio: null, positionPct: null });
    expect(bandMetrics(100, { minMinor: 5, maxMinor: 5 })).toEqual({ midMinor: null, compaRatio: null, positionPct: null });
  });
  it("keeps the midpoint but no ratio when basic is unknown", () => {
    expect(bandMetrics(null, { minMinor: 0, maxMinor: 10 })).toEqual({ midMinor: 5, compaRatio: null, positionPct: null });
  });
});

describe("lockBenefitSelection", () => {
  beforeEach(() => { tenantTx.mockReset(); enforce.mockReset(); });

  it("validates the selection list", () => {
    expect(lockBenefitSelectionSchema.safeParse({ optionIds: [] }).success).toBe(false);
    expect(lockBenefitSelectionSchema.safeParse({ optionIds: ["nope"] }).success).toBe(false);
  });

  it("requires an employee link", async () => {
    await expect(lockBenefitSelection(access(null), { optionIds: [OPT_A] }, "r1")).rejects.toMatchObject({ status: 403 });
    expect(tenantTx).not.toHaveBeenCalled();
  });

  it("rejects unknown options with 404", async () => {
    tenantTx.mockResolvedValueOnce([[], []]);
    await expect(lockBenefitSelection(access("E1"), { optionIds: [OPT_A] }, "r1")).rejects.toMatchObject({ status: 404 });
  });

  it("enrolls only new options, with one audit event each, and skips existing enrollments", async () => {
    tenantTx.mockResolvedValueOnce([[{ id: OPT_A, benefit_plan_id: "P1" }, { id: OPT_B, benefit_plan_id: "P1" }], [{ benefit_option_id: OPT_A }]]).mockResolvedValueOnce([]);
    const result = await lockBenefitSelection(access("E1"), { optionIds: [OPT_A, OPT_B, OPT_B] }, "r1");
    expect(enforce).toHaveBeenCalledWith(expect.anything(), "employee.write", { tenantId: "t1" });
    expect(result.alreadyEnrolled).toEqual([OPT_A]);
    expect(result.enrollmentIds).toHaveLength(1);
    expect(tenantTx).toHaveBeenCalledTimes(2);
    expect(tenantTx.mock.calls[1][1]).toHaveLength(2);
  });

  it("writes nothing when every option is already enrolled", async () => {
    tenantTx.mockResolvedValueOnce([[{ id: OPT_A, benefit_plan_id: "P1" }], [{ benefit_option_id: OPT_A }]]);
    const result = await lockBenefitSelection(access("E1"), { optionIds: [OPT_A] }, "r1");
    expect(result.enrollmentIds).toEqual([]);
    expect(tenantTx).toHaveBeenCalledTimes(1);
  });
});
