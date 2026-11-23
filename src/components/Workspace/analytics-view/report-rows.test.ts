import { describe, expect, it } from "vitest";
import type { WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { buildReportRows } from "./report-rows";

const t = (_key: string, fallback: string, params?: Record<string, string | number>) =>
  fallback.replace(/\{(\w+)\}/g, (_match, name: string) => String(params?.[name] ?? ""));
const f = {
  number: (value: number) => String(value),
  pct: (value: number) => `${value}%`,
  money: (minor: number, currency: string) => `${currency} ${minor / 100}`,
  reason: (reason: string) => `reason:${reason}`,
};

const base: WorkforceInsightsPayload = {
  window: { period: "current_month", from: "2026-11-01", to: "2026-11-23", department: null },
  departments: [],
  people: { available: true, value: { activeHeadcount: 12, gender: { female: 6, male: 6, other: 0, unrecorded: 0 }, diversityIndex: 100 } },
  attrition: { available: false, reason: "no_dated_exits" },
  risk: { available: false, reason: "no_attrition_scores" },
  workforce: { available: false, reason: "forbidden" },
  payroll: { available: false, reason: "no_payroll_run" },
  talent: { available: false, reason: "no_applications" },
  capability: { available: false, reason: "no_capability_runs" },
  leave: { available: false, reason: "no_leave_data" },
  metrics: { available: false, reason: "no_metric_definitions" },
  generatedAt: "2026-11-23T00:00:00.000Z",
};

describe("buildReportRows", () => {
  it("writes measured values and states the reason for unmeasured sections instead of a number", () => {
    const { headers, rows } = buildReportRows(base, "headcount", t, f);
    expect(headers).toHaveLength(5);
    expect(rows[0]).toEqual(["Active Global Headcount", "All Departments", "2026-11-01 – 2026-11-23", "12", "Employees not separated"]);
    expect(rows.at(-1)?.[3]).toBe("reason:no_dated_exits");
    expect(rows.flat()).not.toContain("98.4%");
  });

  it("uses only the server payroll figures for compensation", () => {
    const payload: WorkforceInsightsPayload = {
      ...base,
      payroll: { available: true, value: { runId: "r", period: "2026-11", currency: "INR", grossMinor: 500000, employees: 2, basicWageCompliance: null, statutoryMinor: 6000, advancesMinor: 0, advanceDrawdown: 0, bridge: { available: false, reason: "no_prior_run" } } },
    };
    const { rows } = buildReportRows(payload, "compensation", t, f);
    expect(rows.map((row) => row[3])).toEqual(["INR 5000", "—", "INR 60", "0%"]);
  });
});
