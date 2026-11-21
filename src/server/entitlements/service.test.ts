import { describe, expect, it } from "vitest";
import { resolveEntitlements } from "@/lib/entitlements/resolve";
import type { EntitlementState } from "@/lib/entitlements/types";
import { HttpError } from "@/server/platform/http";
import { planEntitlementChanges, validateInitialModules, type EntitlementChange } from "./service";

function plan(states: EntitlementState[], changes: EntitlementChange[], authority: "platform" | "tenant" = "platform") {
  return planEntitlementChanges(resolveEntitlements(states), new Map(states.map((state) => [state.key, state.config])), changes, authority);
}

function problems(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof HttpError) return error.details.map((detail) => detail.issue).join(" | ");
    throw error;
  }
  throw new Error("expected the changes to be rejected");
}

describe("planEntitlementChanges", () => {
  it("lets the platform switch modules and sub-modules", () => {
    const result = plan([], [{ key: "recruitment", enabled: true }, { key: "leave.policies", enabled: false }]);
    expect(result.map((change) => [change.entry.key, change.enabled])).toEqual([["recruitment", true], ["leave.policies", false]]);
  });

  it("keeps organisation administrators to features and settings", () => {
    expect(problems(() => plan([], [{ key: "leave.policies", enabled: false }], "tenant"))).toMatch(/part of your plan/);
    expect(problems(() => plan([], [{ key: "recruitment", enabled: true }], "tenant"))).toMatch(/part of your plan/);
    expect(plan([], [{ key: "leave.requests.early_return", enabled: false }], "tenant")[0]!.enabled).toBe(false);
    expect(plan([], [{ key: "leave.requests", config: { maxDaysPerRequest: 5 } }], "tenant")[0]!.config).toEqual({ maxDaysPerRequest: 5 });
  });

  it("refuses settings for sub-modules outside the organisation's plan", () => {
    expect(problems(() => plan([{ key: "leave", enabled: false, config: {} }], [{ key: "leave.requests", config: { maxDaysPerRequest: 5 } }], "tenant"))).toMatch(
      /not part of your plan/,
    );
  });

  it("refuses to switch off locked entries", () => {
    expect(problems(() => plan([], [{ key: "people.records", enabled: false }]))).toMatch(/always on/);
  });

  it("checks dependencies on the resulting state", () => {
    expect(problems(() => plan([], [{ key: "leave.encashment", enabled: true }, { key: "payroll", enabled: false }]))).toMatch(/Turn on Payroll first/);
    // Switching off what others need is allowed; they become inactive until it is back.
    const [change] = plan([{ key: "leave.encashment", enabled: true, config: {} }], [{ key: "payroll", enabled: false }]);
    expect(change!.enabled).toBe(false);
    // Switching on a requirement and its dependant in one batch is fine.
    expect(plan([], [{ key: "payroll", enabled: true }, { key: "leave.encashment", enabled: true }])).toHaveLength(2);
    expect(plan([{ key: "leave.encashment", enabled: true, config: {} }], [{ key: "leave.encashment", enabled: false }, { key: "payroll", enabled: false }])).toHaveLength(2);
  });

  it("validates settings against the field definitions", () => {
    const message = problems(() => plan([], [{ key: "leave.requests", config: { maxDaysPerRequest: 0, allowedLeaveTypes: [] } }]));
    expect(message).toMatch(/whole number from 1 to 60/);
    expect(message).toMatch(/at least 1/);
    expect(problems(() => plan([], [{ key: "leave.requests", config: { colour: "red" } }]))).toMatch(/does not exist/);
    expect(problems(() => plan([], [{ key: "leave.balances", config: { x: 1 } }]))).toMatch(/has no settings/);
    expect(problems(() => plan([], [{ key: "nope", enabled: true }]))).toMatch(/Unknown/);
  });

  it("merges a partial settings change into what is stored", () => {
    const stored: EntitlementState[] = [{ key: "leave.requests", enabled: true, config: { maxDaysPerRequest: 9 } }];
    const [change] = plan(stored, [{ key: "leave.requests", config: { allowedLeaveTypes: ["EL", "EL", "CL"] } }]);
    expect(change!.config).toEqual({ maxDaysPerRequest: 9, allowedLeaveTypes: ["EL", "CL"] });
  });
});

describe("validateInitialModules", () => {
  it("adds core modules and checks module dependencies", () => {
    expect(validateInitialModules(["leave"])).toEqual(expect.arrayContaining(["leave", "people", "dashboards", "administration"]));
    expect(problems(() => validateInitialModules(["compensation"]))).toMatch(/needs Payroll/);
    expect(problems(() => validateInitialModules(["made_up"]))).toMatch(/Unknown module/);
  });
});
