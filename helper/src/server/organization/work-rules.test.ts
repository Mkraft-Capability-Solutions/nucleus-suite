import { describe, expect, it } from "vitest";
import {
  hasRestDaysFromPattern,
  policyFromAssignmentOverrides,
  policyFromCategoryConfig,
  resolveWorkRules,
  restDayWorkedTreatment,
} from "./work-rules";

/** A third-party category and its two sub-categories, exactly as a tenant would configure them. */
const THIRD_PARTY = { code: "third-party", restDayPattern: "fixed_sunday", wageType: "monthly", otEligibility: "all" };
const TP_EMPLOYEE = { code: "third-party-employee", restDayPattern: "fixed_sunday" };
const TP_HELPER = { code: "third-party-helper", restDayPattern: "none" };
const CONTRACTUAL = { code: "contract", restDayPattern: "none", wageType: "daily", otEligibility: "none" };

describe("policyFromCategoryConfig", () => {
  it("derives rest-day applicability from the configured pattern", () => {
    expect(policyFromCategoryConfig(TP_EMPLOYEE)).toMatchObject({ hasRestDays: true, restDayPattern: "fixed_sunday" });
    expect(policyFromCategoryConfig(TP_HELPER)).toMatchObject({ hasRestDays: false, restDayPattern: "none" });
  });

  it("states nothing where the configuration states nothing", () => {
    expect(policyFromCategoryConfig({ code: "unset" })).toMatchObject({
      hasRestDays: null,
      restDayPattern: null,
      wageType: null,
      otEligibility: null,
    });
    expect(policyFromCategoryConfig(null)).toEqual({});
  });
});

describe("policyFromAssignmentOverrides", () => {
  it("lets an explicit rest-day override win over the pattern beside it", () => {
    const policy = policyFromAssignmentOverrides({ overrideHasRestDays: false, overrideRestDayPattern: "fixed_weekly_day" });
    expect(policy.hasRestDays).toBe(false);
    expect(policy.restDayPattern).toBe("fixed_weekly_day");
  });

  it("falls back to the pattern when no explicit flag is set", () => {
    expect(policyFromAssignmentOverrides({ overrideRestDayPattern: "none" }).hasRestDays).toBe(false);
    expect(policyFromAssignmentOverrides({}).hasRestDays).toBeNull();
  });
});

describe("resolveWorkRules (RL-05)", () => {
  it("resolves employee, then sub-category, then category, first non-empty per field", () => {
    const resolved = resolveWorkRules({
      employee: policyFromAssignmentOverrides({ overrideOtEligibility: "none" }),
      subCategory: policyFromCategoryConfig(TP_HELPER),
      category: policyFromCategoryConfig(THIRD_PARTY),
      categoryCode: "third-party",
      subCategoryCode: "third-party-helper",
    });
    expect(resolved.otEligibility).toBe("none");
    expect(resolved.source.otEligibility).toBe("employee");
    expect(resolved.hasRestDays).toBe(false);
    expect(resolved.source.hasRestDays).toBe("sub_category");
    // The sub-category states no wage type, so the category's still applies.
    expect(resolved.wageType).toBe("monthly");
    expect(resolved.source.wageType).toBe("category");
  });

  it("tells a third-party Employee apart from a Helper under one category (T-07)", () => {
    const shared = { category: policyFromCategoryConfig(THIRD_PARTY), categoryCode: "third-party" };
    const employee = resolveWorkRules({ ...shared, subCategory: policyFromCategoryConfig(TP_EMPLOYEE) });
    const helper = resolveWorkRules({ ...shared, subCategory: policyFromCategoryConfig(TP_HELPER) });
    expect(employee.hasRestDays).toBe(true);
    expect(helper.hasRestDays).toBe(false);
    // Both come from configuration rows, so adding a third worker class needs no code change.
    expect(employee.source.hasRestDays).toBe("sub_category");
    expect(helper.source.hasRestDays).toBe("sub_category");
  });

  it("marks a daily wage basis as paid on days present and no rest day (RL-26, T-06)", () => {
    const resolved = resolveWorkRules({ category: policyFromCategoryConfig(CONTRACTUAL), categoryCode: "contract" });
    expect(resolved.wageType).toBe("daily");
    expect(resolved.paysOnDaysPresent).toBe(true);
    expect(resolved.hasRestDays).toBe(false);
  });

  it("reports an unresolved field rather than defaulting it", () => {
    const resolved = resolveWorkRules({ category: policyFromCategoryConfig({ code: "unconfigured" }) });
    expect(resolved.wageType).toBeNull();
    expect(resolved.paysOnDaysPresent).toBeNull();
    expect(resolved.unresolved).toEqual(["hasRestDays", "restDayPattern", "wageType", "otEligibility"]);
    expect(resolved.source.wageType).toBe("unresolved");
  });
});

describe("restDayWorkedTreatment (Q-14)", () => {
  it("refuses rather than choosing between overtime and a normal day's wage", () => {
    const resolved = resolveWorkRules({ category: policyFromCategoryConfig(CONTRACTUAL) });
    expect(() => restDayWorkedTreatment(resolved)).toThrowError(/Q-14/);
  });
});

describe("rest-day applicability from the configured pattern (RL-05)", () => {
  // "none" is the only value PL_REST_DAY_PATTERN and the worker-categories list share,
  // so it is the only comparison made. This replaced a four-literal category table in
  // `hr-rules.ts`, which was a second answer to the same question.
  it.each(["fixed_sunday", "fixed_weekly_day", "two_fixed_days", "rotating", "rotational_weekly_off"])(
    "treats %s as entitled to a rest day",
    (pattern) => expect(hasRestDaysFromPattern(pattern)).toBe(true),
  );

  it("treats none as no rest day", () => expect(hasRestDaysFromPattern("none")).toBe(false));

  it.each([null, undefined, "", "   "])("says nothing at all when no level states a pattern (%s)", (pattern) => {
    expect(hasRestDaysFromPattern(pattern)).toBeNull();
  });
});
