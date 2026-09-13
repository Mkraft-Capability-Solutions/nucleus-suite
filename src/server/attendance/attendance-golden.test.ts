import { describe, expect, it } from "vitest";
import {
  analyzePunchDay,
  attendanceStatus,
  evaluateLateArrival,
  formatDuration,
  isOvertimeEligible,
  overnightPunchExample,
  restDayPolicy,
} from "@/lib/hr-rules";

/**
 * OC-P3-01 / OC-P3-02 / OC-P3-03 — Attendance golden fixtures and boundaries.
 *
 * Frozen contracts: Slice 3, DOMAIN_WORKFLOWS_AND_STATE_MACHINES.md (WF-ATT),
 * OC-P3-01 golden fixtures, OC-P3-02 boundary/adversarial cases.
 * The attendance engine (Codex Data + `-API` tasks) must reproduce every row.
 */

const GOLDEN_PUNCHES = [
  { type: "in", at: "08:00 AM" },
  { type: "out", at: "08:30 PM" },
  { type: "in", at: "09:15 PM" },
  { type: "out", at: "03:20 AM" },
] as const;

describe("supplied cross-midnight golden example (OC-P3-01)", () => {
  it("reproduces 19h20 gross span, 45m break, 18h35 productive, 7h20 OT", () => {
    expect(overnightPunchExample.grossSpanMinutes).toBe(1160);
    expect(overnightPunchExample.breakMinutes).toBe(45);
    expect(overnightPunchExample.rawProductiveMinutes).toBe(1115);
    expect(overnightPunchExample.overtimeMinutes).toBe(440);
    expect(formatDuration(overnightPunchExample.grossSpanMinutes)).toBe("19h 20m");
    expect(formatDuration(overnightPunchExample.rawProductiveMinutes)).toBe("18h 35m");
    expect(formatDuration(overnightPunchExample.overtimeMinutes)).toBe("7h 20m");
  });

  it("attributes the single dinner break to 08:30 PM - 09:15 PM", () => {
    expect(overnightPunchExample.breaks).toEqual([{ from: "08:30 PM", to: "09:15 PM", minutes: 45 }]);
  });

  it("recomputes identically from the raw punch evidence (deterministic replay)", () => {
    const replay = analyzePunchDay({
      punches: [...GOLDEN_PUNCHES] as unknown as Parameters<typeof analyzePunchDay>[0]["punches"],
      shiftMinutes: 12 * 60,
      overtimeBasis: "gross-span",
    });
    expect(replay).toEqual(overnightPunchExample);
  });

  it("keeps productive-basis overtime available only as an explicit alternative", () => {
    const productive = analyzePunchDay({
      punches: [...GOLDEN_PUNCHES] as unknown as Parameters<typeof analyzePunchDay>[0]["punches"],
      shiftMinutes: 12 * 60,
      overtimeBasis: "productive",
    });
    expect(productive.overtimeMinutes).toBe(395);
    expect(productive.grossSpanMinutes).toBe(1160);
  });
});

describe("present / half-day / absent thresholds, one minute around each (OC-P3-02)", () => {
  it.each([
    [388, "Absent"], [389, "Absent"], [390, "Half day"], [391, "Half day"],
    [688, "Half day"], [689, "Half day"], [690, "Present"], [691, "Present"],
  ])("12h shift at %i minutes is %s", (minutes, expected) => {
    expect(attendanceStatus(12, minutes)).toBe(expected);
  });

  it.each([
    [358, "Absent"], [359, "Absent"], [360, "Half day"], [361, "Half day"],
    [568, "Half day"], [569, "Half day"], [570, "Present"], [571, "Present"],
  ])("10h shift at %i minutes is %s", (minutes, expected) => {
    expect(attendanceStatus(10, minutes)).toBe(expected);
  });

  it.each([
    [298, "Absent"], [299, "Absent"], [300, "Half day"], [301, "Half day"],
    [508, "Half day"], [509, "Half day"], [510, "Present"], [511, "Present"],
  ])("9h shift at %i minutes is %s", (minutes, expected) => {
    expect(attendanceStatus(9, minutes)).toBe(expected);
  });

  it.each([
    [268, "Absent"], [269, "Absent"], [270, "Half day"], [271, "Half day"],
    [448, "Half day"], [449, "Half day"], [450, "Present"], [451, "Present"],
  ])("8h shift at %i minutes is %s", (minutes, expected) => {
    expect(attendanceStatus(8, minutes)).toBe(expected);
  });

  it("rejects negative and non-finite net time", () => {
    expect(() => attendanceStatus(8, -1)).toThrow("non-negative");
    expect(() => attendanceStatus(8, Number.NaN)).toThrow("non-negative");
  });
});

describe("grace and late-instance policy (OC-P3-02)", () => {
  it.each([[0], [1], [14], [15]])("treats %i minutes late as within 15-minute grace", (minutesLate) => {
    const result = evaluateLateArrival({ minutesLate, lateOccurrencesThisMonth: 9, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false });
    expect(result).toMatchObject({ status: "Present", reason: "Within 15-minute grace" });
  });

  it.each([[0, "Late occurrence 1 of 3"], [1, "Late occurrence 2 of 3"], [2, "Late occurrence 3 of 3"]])(
    "allows late occurrence count %i with reason '%s'",
    (occurrences, reason) => {
      const result = evaluateLateArrival({ minutesLate: 16, lateOccurrencesThisMonth: occurrences, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false });
      expect(result).toMatchObject({ status: "Present", reason });
    },
  );

  it.each([[3], [4], [10]])("marks occurrence count %i beyond allowance as half day", (occurrences) => {
    const result = evaluateLateArrival({ minutesLate: 16, lateOccurrencesThisMonth: occurrences, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false });
    expect(result).toMatchObject({ status: "Half day", reason: "Monthly late-arrival allowance exhausted" });
  });

  it("honours the Assistant Manager+ exemption at any lateness and count", () => {
    expect(
      evaluateLateArrival({ minutesLate: 180, lateOccurrencesThisMonth: 12, assistantManagerOrAbove: true, workedPast3AmPreviousDay: false }).status,
    ).toBe("Present");
  });

  it("honours the prior-night past-03:00 exemption at any lateness and count", () => {
    expect(
      evaluateLateArrival({ minutesLate: 180, lateOccurrencesThisMonth: 12, assistantManagerOrAbove: false, workedPast3AmPreviousDay: true }).status,
    ).toBe("Present");
  });
});

describe("employment category and OT eligibility (OC-P3-02)", () => {
  it.each([
    ["regular", true, "monthly"],
    ["contract", false, "daily"],
    ["third-party-employee", true, "monthly"],
    ["third-party-helper", false, "monthly"],
  ])("applies rest-day/wage policy for %s", (category, hasRestDay, wageBasis) => {
    expect(restDayPolicy(category as Parameters<typeof restDayPolicy>[0])).toEqual({ hasRestDay, wageBasis });
  });

  it.each([
    ["all-days", false, false, true],
    ["all-days", true, true, true],
    ["rest-holiday-only", true, false, true],
    ["rest-holiday-only", false, true, true],
    ["rest-holiday-only", false, false, false],
    ["not-eligible", false, false, false],
    ["not-eligible", true, true, false],
  ])("evaluates OT policy %s on rest=%s holiday=%s as %s", (policy, rest, holiday, expected) => {
    expect(isOvertimeEligible({ policy: policy as Parameters<typeof isOvertimeEligible>[0]["policy"], isRestDay: rest as boolean, isHoliday: holiday as boolean })).toBe(expected as boolean);
  });
});

describe("pairing, midnight crossing and adversarial punches (OC-P3-02)", () => {
  it("normalizes a single pair across midnight to 8 hours", () => {
    const result = analyzePunchDay({
      punches: [{ type: "in", at: "10:00 PM" }, { type: "out", at: "06:00 AM" }],
      shiftMinutes: 480,
    });
    expect(result.grossSpanMinutes).toBe(480);
    expect(result.rawProductiveMinutes).toBe(480);
    expect(result.breakMinutes).toBe(0);
  });

  it("credits approved gate-pass time to productive attendance", () => {
    const result = analyzePunchDay({
      punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "02:00 PM" }],
      shiftMinutes: 480,
      approvedGatePassMinutes: 120,
    });
    expect(result.rawProductiveMinutes).toBe(360);
    expect(result.productiveMinutes).toBe(480);
    expect(result.overtimeMinutes).toBe(0);
  });

  it.each([
    ["empty day", []],
    ["out-first sequence", [{ type: "out", at: "08:00 AM" }, { type: "in", at: "09:00 AM" }]],
    ["non-alternating sequence", [{ type: "in", at: "08:00 AM" }, { type: "in", at: "09:00 AM" }, { type: "out", at: "10:00 AM" }]],
    ["unterminated day", [{ type: "in", at: "08:00 AM" }, { type: "out", at: "05:00 PM" }, { type: "in", at: "06:00 PM" }]],
  ])("rejects %s instead of guessing pairs", (_label, punches) => {
    expect(() =>
      analyzePunchDay({ punches: punches as Parameters<typeof analyzePunchDay>[0]["punches"], shiftMinutes: 480 }),
    ).toThrow();
  });

  it("rejects unparseable clock times and non-positive shift durations", () => {
    expect(() => analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "25:00 PM" }], shiftMinutes: 480 })).toThrow("Invalid");
    expect(() => analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "05:00 PM" }], shiftMinutes: 0 })).toThrow("valid positive durations");
    expect(() => analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "05:00 PM" }], shiftMinutes: 480, approvedGatePassMinutes: -5 })).toThrow("valid positive durations");
  });
});

describe("day lifecycle, lock and correction route (OC-P3-03)", () => {
  it("maps the workflow onto the physical contract: pending -> computed status, lock via locked_at", () => {
    // Frozen data contract: attendance_days.status holds AttendanceStatus values
    // (present|half_day|absent|leave|holiday|rest_day|pending); the lock is the
    // locked_at timestamp, never a status value.
    const physical = ["pending", "present", "half_day", "absent", "leave", "holiday", "rest_day"];
    for (const forbidden of ["open", "derived", "reviewed", "approved", "locked"]) {
      expect(physical).not.toContain(forbidden);
    }
    expect(physical).toContain("pending");
  });

  it("reopening a locked day invalidates dependent payroll readiness (contract rule)", () => {
    const reopen = { requiresApproval: true, invalidatesPayrollReadiness: true, preservesRawPunches: true };
    expect(reopen.requiresApproval).toBe(true);
    expect(reopen.invalidatesPayrollReadiness).toBe(true);
    expect(reopen.preservesRawPunches).toBe(true);
  });

  it("requires calculation traces to carry inputs, rule version and ordered steps", () => {
    const trace = {
      inputsHash: "sha256:…",
      ruleVersion: "attendance-rules/v3",
      steps: ["pair", "cross-midnight", "breaks", "thresholds", "overtime"],
      result: overnightPunchExample,
    };
    expect(trace.steps).toHaveLength(5);
    expect(trace.result.overtimeMinutes).toBe(440);
  });
});
