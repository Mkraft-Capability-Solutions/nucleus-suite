import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

const mocks = vi.hoisted(() => ({ enforce: vi.fn(), tenantTx: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }) }));
vi.mock("@/server/platform/access", () => ({ enforce: mocks.enforce, tenantTx: mocks.tenantTx }));

const { HttpError } = await import("@/server/platform/http");
const { loadWorkforceInsights, insightsQuerySchema } = await import("@/server/analytics/workforce-insights");
const calc = await import("@/server/analytics/workforce-insights-calc");

const access = { tenantId: "t-1", context: { actorUserId: "u-1", membershipId: "m-1", tenantId: "t-1", permissions: [], roles: [] } } as unknown as Access;
const NOW = new Date("2026-11-23T10:00:00.000Z");

type Stmt = { text: string; values: unknown[] };

/** Routes each tenantTx batch to canned rows by the first table its first statement reads. */
function respond(tables: Record<string, unknown[][]>) {
  mocks.tenantTx.mockImplementation(async (_access: Access, statements: Stmt[]) => {
    const first = statements[0]?.text ?? "";
    const key = Object.keys(tables).find((name) => first.includes(`from ${name}`));
    return key ? tables[key] : statements.map(() => []);
  });
}

const baseBatch = [
  [{ name: "Finance" }, { name: "Plant" }],
  [{ gender: "Female", total: 4 }, { gender: "m", total: 5 }, { gender: null, total: 1 }],
  [{ total: 10 }],
  [{ total: 2 }],
  [{ total: 3 }],
  [],
  [],
  [],
];

describe("workforce insights calc", () => {
  it("builds inclusive period windows from an injected clock", () => {
    expect(calc.periodWindow("current_month", NOW)).toMatchObject({ from: "2026-11-01", to: "2026-11-23", days: 23 });
    expect(calc.periodWindow("current_quarter", NOW)).toMatchObject({ from: "2026-10-01" });
    expect(calc.periodWindow("ytd", NOW)).toMatchObject({ from: "2026-01-01" });
    expect(calc.periodWindow("last_12_months", NOW)).toMatchObject({ from: "2025-11-24", days: 365 });
  });

  it("returns null instead of zero when there is nothing to divide by", () => {
    expect(calc.percent(1, 0)).toBeNull();
    expect(calc.diversityIndex({ female: 0, male: 0, other: 0, unrecorded: 9 })).toBeNull();
    expect(calc.basicWageCompliance([])).toBeNull();
    expect(calc.workforceFromSites([]).utilization).toBeNull();
  });

  it("closes the wage bridge exactly on the current gross", () => {
    const prior = [{ run_id: "p", employee_id: "a", gross: 100, basic_da: 50 }, { run_id: "p", employee_id: "b", gross: 80, basic_da: 40 }];
    const current = [{ run_id: "c", employee_id: "a", gross: 110, basic_da: 55 }, { run_id: "c", employee_id: "c", gross: 70, basic_da: 20 }];
    const bridge = calc.wageBridge(current, prior);
    expect(bridge).toEqual({ priorGrossMinor: 180, joinersMinor: 70, continuingChangeMinor: 10, leaversMinor: 80 });
    expect(bridge.priorGrossMinor + bridge.joinersMinor + bridge.continuingChangeMinor - bridge.leaversMinor).toBe(180);
    expect(calc.basicWageCompliance(current)).toBe(50);
  });

  it("counts the funnel cumulatively and measures time to hire from stage history", () => {
    const talent = calc.talentFromApplications([
      { stage: "applied", source: "referral", days_to_join: null, referred: true },
      { stage: "interview", source: "career site", days_to_join: null, referred: false },
      { stage: "converted", source: "referral", days_to_join: 20, referred: true },
      { stage: "declined", source: "career site", days_to_join: null, referred: false },
    ], 2);
    expect(talent.funnel.map((step) => step.value)).toEqual([4, 2, 2, 1, 1]);
    expect(talent.avgTimeToHireDays).toBe(20);
    expect(talent.offerAcceptance).toBe(50);
    expect(talent.referralShare).toBe(50);
    expect(talent.channels[0]).toMatchObject({ channel: "referral", applications: 2, joined: 1, conversion: 50 });
  });
});

describe("loadWorkforceInsights", () => {
  beforeEach(() => {
    mocks.enforce.mockReset();
    mocks.tenantTx.mockReset();
  });

  it("validates the query filters", () => {
    expect(insightsQuerySchema.safeParse({ period: "forever" }).success).toBe(false);
    expect(insightsQuerySchema.parse({}).period).toBe("current_quarter");
  });

  it("scopes every statement to the caller's tenant and reports unmeasurable sections honestly", async () => {
    respond({ departments: baseBatch, attendance_days: [[]], payroll_runs: [[]], applications: [[], [{ total: 0 }]] });
    const result = await loadWorkforceInsights(access, { period: "current_month" }, NOW);
    for (const [, statements] of mocks.tenantTx.mock.calls as Array<[Access, Stmt[]]>) {
      for (const statement of statements) expect(statement.values).toContain("t-1");
    }
    expect(mocks.enforce).toHaveBeenCalledWith(access.context, "employee.read", { tenantId: "t-1" });
    expect(result.departments).toEqual(["Finance", "Plant"]);
    expect(result.people).toEqual({ available: true, value: { activeHeadcount: 10, gender: { female: 4, male: 5, other: 0, unrecorded: 1 }, diversityIndex: 88.9 } });
    expect(result.attrition).toMatchObject({ available: true, value: { exits: 2 } });
    expect(result.risk).toEqual({ available: false, reason: "no_attrition_scores" });
    expect(result.workforce).toEqual({ available: false, reason: "no_attendance" });
    expect(result.payroll).toEqual({ available: false, reason: "no_payroll_run" });
    expect(result.talent).toEqual({ available: false, reason: "no_applications" });
    expect(result.capability).toEqual({ available: false, reason: "no_capability_runs" });
    expect(result.metrics).toEqual({ available: false, reason: "no_metric_definitions" });
    expect(result.leave).toEqual({ available: false, reason: "no_leave_data" });
  });

  it("marks a section forbidden when the role lacks its permission, without hiding the rest", async () => {
    respond({ departments: baseBatch, applications: [[], [{ total: 1 }]] });
    mocks.enforce.mockImplementation((_ctx: unknown, action: string) => {
      if (action === "payroll.read" || action === "attendance.read" || action === "leave.read") {
        throw new HttpError({ status: 403, code: "FORBIDDEN", message: "no" });
      }
    });
    const result = await loadWorkforceInsights(access, { period: "ytd", department: "Finance" }, NOW);
    expect(result.payroll).toEqual({ available: false, reason: "forbidden" });
    expect(result.workforce).toEqual({ available: false, reason: "forbidden" });
    expect(result.leave).toEqual({ available: false, reason: "forbidden" });
    expect(result.people.available).toBe(true);
    expect(result.window).toMatchObject({ department: "Finance", from: "2026-01-01" });
  });

  it("propagates database failures instead of returning empty figures", async () => {
    mocks.tenantTx.mockRejectedValue(new Error("connection lost"));
    await expect(loadWorkforceInsights(access, { period: "ytd" }, NOW)).rejects.toThrow("connection lost");
  });

  it("derives payroll figures from the run's own lines", async () => {
    let payrollCall = 0;
    mocks.tenantTx.mockImplementation(async (_access: Access, statements: Stmt[]) => {
      const first = statements[0]?.text ?? "";
      if (first.includes("from departments")) return baseBatch;
      if (first.includes("from attendance_days")) return [[{ location: "Pune", shift: "G", employees: 2, scheduled: 10, present: 8, half_day: 2, absent: 1, ot_minutes: 120 }]];
      if (first.includes("from applications")) return [[], [{ total: 0 }]];
      if (first.includes("from leave_balances")) return [[{ leave_type: "EL", balance: 12.5, approved: 2, employees: 1 }]];
      payrollCall += 1;
      if (payrollCall === 1) return [[{ id: "r2", period: "2026-11", scope: "regular", currency: "INR" }]];
      if (payrollCall === 2) return [[{ id: "r1", period: "2026-10" }]];
      return [
        [
          { run_id: "r2", employee_id: "a", gross: "100000", basic_da: "50000" },
          { run_id: "r1", employee_id: "a", gross: "90000", basic_da: "45000" },
        ],
        [{ total: "12000" }],
        [{ total: "5000" }],
      ];
    });
    const result = await loadWorkforceInsights(access, { period: "current_month" }, NOW);
    expect(result.workforce).toMatchObject({ available: true, value: { utilization: 90, absenteeism: 10, avgOvertimeHoursPerEmployee: 1 } });
    expect(result.leave).toMatchObject({ available: true, value: { balanceDays: 12.5, approvedDays: 2, employees: 1 } });
    expect(result.payroll).toMatchObject({
      available: true,
      value: { grossMinor: 100000, statutoryMinor: 12000, advanceDrawdown: 5, basicWageCompliance: 100, bridge: { available: true, value: { priorPeriod: "2026-10", continuingChangeMinor: 10000 } } },
    });
  });
});
