import { describe, expect, it } from "vitest";
import {
  GRACE_LATE_POLICY_CODE,
  GRACE_LATE_RESOURCE,
  NIGHT_EXTENSION_POLICY_CODE,
  NIGHT_EXTENSION_RESOURCE,
  declaredAttendancePolicy,
  lateCounterWindow,
  nightExtensionForShift,
  requireExemptGradeRank,
  requireNightExtensionRule,
  resolveAttendancePolicy,
  type PublishedPolicyRow,
  type RuleSetRow,
} from "@/server/attendance/attendance-policy";

/**
 * Resolution order for RL-17 (F-ATT-06) and RL-18 (F-SHF-03): a published
 * configuration record beats the approved rule set, which beats the declared pack,
 * and a value nobody supplied is refused rather than guessed.
 */

const AS_OF = "2026-09-15";

const publishedGrace = (data: Record<string, unknown>, updated_at = "2026-09-01T00:00:00Z"): PublishedPolicyRow => ({
  resource: GRACE_LATE_RESOURCE,
  data: { policyCode: "GL-STD", graceInMinutes: 10, graceOutMinutes: 5, latesAllowedPerMonth: 2, consequenceBeyondAllowance: "half_day", counterResetBasis: "calendar_month", effectiveFrom: "2026-01-01", ...data },
  updated_at,
});

const publishedNight = (data: Record<string, unknown>, updated_at = "2026-09-01T00:00:00Z"): PublishedPolicyRow => ({
  resource: NIGHT_EXTENSION_RESOURCE,
  data: { appliesToShiftCode: "A", triggerAfterTime: "03:00", permittedArrivalUntil: "09:30", minimumDepartureTime: "20:00", resultingDayStatus: "present", effectiveFrom: "2026-01-01", ...data },
  updated_at,
});

const ruleSetGrace: RuleSetRow = {
  code: GRACE_LATE_POLICY_CODE,
  config: { graceMinutesIn: 20, graceMinutesOut: 20, latesAllowedPerMonth: 5, lateConsequence: "Warning only", lateCounterReset: "calendar_month", exemptFromGradeRank: 7 },
};

const ruleSetNight: RuleSetRow = {
  code: NIGHT_EXTENSION_POLICY_CODE,
  config: { appliesToShiftCode: "B", triggerAfterTime: "04:00", permittedArrivalUntil: "09:00", minimumDepartureTime: "19:00", maxUsesPerMonth: 2 },
};

describe("grace & late policy resolution (F-ATT-06, RL-17)", () => {
  it("reads the published record ahead of the rule set", () => {
    const pack = resolveAttendancePolicy({ ruleSets: [ruleSetGrace], published: [publishedGrace({ exemptFromGradeRank: 4 })], asOf: AS_OF });
    expect(pack.graceLate).toMatchObject({ source: "published", graceMinutesIn: 10, graceMinutesOut: 5, latesAllowedPerMonth: 2, consequence: "Half day", counterReset: "calendar_month", exemptFromGradeRank: 4 });
    expect(requireExemptGradeRank(pack.graceLate)).toBe(4);
  });

  it("falls back to the rule set when nothing is published, and to the declared pack when neither exists", () => {
    const fromRuleSet = resolveAttendancePolicy({ ruleSets: [ruleSetGrace], published: [], asOf: AS_OF });
    expect(fromRuleSet.graceLate).toMatchObject({ source: "rule-set", graceMinutesIn: 20, latesAllowedPerMonth: 5, consequence: "Warning only", exemptFromGradeRank: 7 });

    const declared = resolveAttendancePolicy({ ruleSets: [], published: [], asOf: AS_OF });
    expect(declared.graceLate).toEqual(declaredAttendancePolicy.graceLate);
    expect(declared.graceLate).toMatchObject({ source: "declared", graceMinutesIn: 15, latesAllowedPerMonth: 3, consequence: "Half day" });
    expect(() => requireExemptGradeRank(declared.graceLate)).toThrow("graceLate.exemptFromGradeRank");
  });

  it("keeps a blank exempt grade rank unsupplied on a published record rather than borrowing the rule set's", () => {
    const pack = resolveAttendancePolicy({ ruleSets: [ruleSetGrace], published: [publishedGrace({})], asOf: AS_OF });
    expect(pack.graceLate.source).toBe("published");
    expect(pack.graceLate.exemptFromGradeRank).toBeNull();
    expect(() => requireExemptGradeRank(pack.graceLate)).toThrow("Grace & Late Policy Setup (F-ATT-06)");
  });

  it("ignores a draft, an approved-but-unpublished, and a future-dated record", () => {
    // Only published rows reach the resolver; the query filters status. A published
    // row effective after the day still must not apply.
    const pack = resolveAttendancePolicy({
      ruleSets: [ruleSetGrace],
      published: [publishedGrace({ graceInMinutes: 1, effectiveFrom: "2026-10-01" })],
      asOf: AS_OF,
    });
    expect(pack.graceLate).toMatchObject({ source: "rule-set", graceMinutesIn: 20 });
  });

  it("uses the latest effective published record, then the most recently updated one", () => {
    const pack = resolveAttendancePolicy({
      ruleSets: [],
      published: [
        publishedGrace({ policyCode: "OLD", graceInMinutes: 5, effectiveFrom: "2025-01-01" }, "2026-09-10T00:00:00Z"),
        publishedGrace({ policyCode: "NEW", graceInMinutes: 12, effectiveFrom: "2026-06-01" }, "2026-06-01T00:00:00Z"),
        publishedGrace({ policyCode: "NEW-2", graceInMinutes: 13, effectiveFrom: "2026-06-01" }, "2026-08-01T00:00:00Z"),
      ],
      asOf: AS_OF,
    });
    expect(pack.graceLate.graceMinutesIn).toBe(13);
  });

  it("maps the picklist consequence and refuses one the engine cannot apply", () => {
    expect(resolveAttendancePolicy({ ruleSets: [], published: [publishedGrace({ consequenceBeyondAllowance: "present" })], asOf: AS_OF }).graceLate.consequence).toBe("No action");
    expect(resolveAttendancePolicy({ ruleSets: [], published: [publishedGrace({ consequenceBeyondAllowance: "on_leave" })], asOf: AS_OF }).graceLate.consequence).toBe("Leave deduction");
    expect(() => resolveAttendancePolicy({ ruleSets: [], published: [publishedGrace({ consequenceBeyondAllowance: "weekly_off" })], asOf: AS_OF }))
      .toThrow("graceLate.consequenceBeyondAllowance");
  });

  it("carries a published payroll-month basis through to the counter, which still refuses an undefined cycle", () => {
    const pack = resolveAttendancePolicy({ ruleSets: [], published: [publishedGrace({ counterResetBasis: "payroll_month" })], asOf: AS_OF });
    expect(pack.graceLate.counterReset).toBe("payroll_month");
    expect(() => lateCounterWindow(pack.graceLate, AS_OF)).toThrow("payroll_month");
  });
});

describe("night extension resolution (F-SHF-03, RL-18)", () => {
  it("reads the published record for the shift ahead of the rule set", () => {
    const pack = resolveAttendancePolicy({ ruleSets: [ruleSetNight], published: [publishedNight({ maxUsesPerMonth: 3 })], asOf: AS_OF });
    const rule = nightExtensionForShift(pack, "A");
    expect(rule).toMatchObject({ source: "published", appliesToShiftCode: "A", triggerAfterMinute: 180, permittedArrivalUntilMinute: 570, minimumDepartureMinute: 1200, resultingDayStatus: "Present", maxUsesPerMonth: 3 });
    expect(requireNightExtensionRule(rule!)).toEqual({ triggerAfterMinute: 180, permittedArrivalUntilMinute: 570, minimumDepartureMinute: 1200 });
  });

  it("honours which shift the published rule names", () => {
    const pack = resolveAttendancePolicy({
      ruleSets: [ruleSetNight],
      published: [publishedNight({ appliesToShiftCode: "A" }), publishedNight({ appliesToShiftCode: "C", triggerAfterTime: "02:00" })],
      asOf: AS_OF,
    });
    expect(nightExtensionForShift(pack, "a")?.triggerAfterMinute).toBe(180);
    expect(nightExtensionForShift(pack, "C")?.triggerAfterMinute).toBe(120);
    // Published rules are the whole source: the rule set's B rule does not fill the gap.
    expect(nightExtensionForShift(pack, "B")).toBeNull();
  });

  it("falls back to the rule set, keeping its shift match, and then to the declared pack", () => {
    const fromRuleSet = resolveAttendancePolicy({ ruleSets: [ruleSetNight], published: [], asOf: AS_OF });
    expect(nightExtensionForShift(fromRuleSet, "B")).toMatchObject({ source: "rule-set", triggerAfterMinute: 240, maxUsesPerMonth: 2, resultingDayStatus: "Present" });
    expect(nightExtensionForShift(fromRuleSet, "A")).toBeNull();

    const declared = resolveAttendancePolicy({ ruleSets: [], published: [], asOf: AS_OF });
    const rule = nightExtensionForShift(declared, "A");
    expect(rule).toMatchObject({ source: "declared", appliesToShiftCode: null, triggerAfterMinute: null, maxUsesPerMonth: null });
    expect(() => requireNightExtensionRule(rule!)).toThrow("Night Extension Rule Setup (F-SHF-03)");
  });

  it("keeps a blank monthly cap unsupplied on a published record", () => {
    const pack = resolveAttendancePolicy({ ruleSets: [ruleSetNight], published: [publishedNight({ maxUsesPerMonth: "" })], asOf: AS_OF });
    expect(nightExtensionForShift(pack, "A")?.maxUsesPerMonth).toBeNull();
  });

  it("takes the latest effective published rule per shift and skips a future-dated one", () => {
    const pack = resolveAttendancePolicy({
      ruleSets: [],
      published: [
        publishedNight({ triggerAfterTime: "03:00", effectiveFrom: "2026-01-01" }),
        publishedNight({ triggerAfterTime: "03:30", effectiveFrom: "2026-08-01" }),
        publishedNight({ triggerAfterTime: "04:00", effectiveFrom: "2026-12-01" }),
      ],
      asOf: AS_OF,
    });
    expect(pack.nightExtensionRules).toHaveLength(1);
    expect(nightExtensionForShift(pack, "A")?.triggerAfterMinute).toBe(210);
  });

  it("maps the resulting day status and refuses one the engine cannot apply", () => {
    expect(nightExtensionForShift(resolveAttendancePolicy({ ruleSets: [], published: [publishedNight({ resultingDayStatus: "half_day" })], asOf: AS_OF }), "A")?.resultingDayStatus).toBe("Half day");
    expect(() => resolveAttendancePolicy({ ruleSets: [], published: [publishedNight({ resultingDayStatus: "on_duty" })], asOf: AS_OF }))
      .toThrow("nightExtension.resultingDayStatus");
  });
});
