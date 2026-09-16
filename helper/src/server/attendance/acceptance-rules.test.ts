import { describe, expect, it } from "vitest";
import {
  analyzePunchDay,
  attendanceStatus,
  detectionIntervals,
  detectionWindowContains,
  detectionWindowOverlaps,
  evaluateLateArrival,
  evaluateNightExtension,
  formatDuration,
  punchClockToMinutes,
  seededShiftThresholds,
  shiftRules,
} from "@/lib/hr-rules";
import {
  clockToMinuteOfDay,
  declaredAttendancePolicy,
  lateCounterWindow,
  requireAttendanceSetting,
  requireExemptGradeRank,
  requireNightExtensionRule,
} from "@/server/attendance/attendance-policy";
import { assertDetectionWindowsDoNotOverlap, detectShift, type ShiftMasterRecord } from "@/server/attendance/shift-master";

/**
 * Client acceptance rules RL-04, RL-16, RL-17, RL-18 and RL-19, each reproducing the
 * worked example the workbook states. The golden fixtures in
 * `attendance-golden.test.ts` stay the numeric contract; this file proves the same
 * numbers now come from the shift record and the policy pack rather than literals.
 */

const GOLDEN_SESSION = [
  { type: "in", at: "08:00 AM" },
  { type: "out", at: "08:30 PM" },
  { type: "in", at: "09:15 PM" },
  { type: "out", at: "03:20 AM" },
] as const;

function shift(overrides: Partial<ShiftMasterRecord> = {}): ShiftMasterRecord {
  return {
    code: "A",
    name: "General / A shift",
    startMinute: 8 * 60,
    endMinute: 20 * 60,
    durationMinutes: 720,
    graceInMinutes: null,
    graceOutMinutes: null,
    thresholds: { halfDayBelowMinutes: 11 * 60 + 30, absentBelowMinutes: 6 * 60 + 30 },
    detection: [],
    detectionLabel: null,
    overtimeBasis: "gross-span",
    overtimeAfterMinutes: 720,
    otEligible: true,
    source: "seed",
    ...overrides,
  };
}

describe("RL-04 overtime is measured on the base the shift record names (T-03)", () => {
  it("reproduces 19:20 less 12:00 = 7:20 from the shift's own OT threshold", () => {
    const record = shift();
    const trace = analyzePunchDay({
      punches: [...GOLDEN_SESSION] as unknown as Parameters<typeof analyzePunchDay>[0]["punches"],
      shiftMinutes: record.durationMinutes,
      overtimeBasis: record.overtimeBasis,
      overtimeAfterMinutes: record.overtimeAfterMinutes,
    });
    expect(formatDuration(trace.grossSpanMinutes)).toBe("19h 20m");
    expect(formatDuration(trace.overtimeMinutes)).toBe("7h 20m");
    expect(trace.overtimeAfterMinutes).toBe(720);
  });

  it("honours a shift that starts overtime earlier than its own duration", () => {
    const trace = analyzePunchDay({
      punches: [...GOLDEN_SESSION] as unknown as Parameters<typeof analyzePunchDay>[0]["punches"],
      shiftMinutes: 720,
      overtimeBasis: "gross-span",
      overtimeAfterMinutes: 600,
    });
    expect(formatDuration(trace.overtimeMinutes)).toBe("9h 20m");
  });

  it("honours a net-minutes shift without changing the gross figure", () => {
    const trace = analyzePunchDay({
      punches: [...GOLDEN_SESSION] as unknown as Parameters<typeof analyzePunchDay>[0]["punches"],
      shiftMinutes: 720,
      overtimeBasis: "productive",
      overtimeAfterMinutes: 720,
    });
    expect(trace.grossSpanMinutes).toBe(1160);
    expect(trace.overtimeMinutes).toBe(395);
    expect(trace.overtimeBasis).toBe("productive");
  });
});

describe("RL-16 thresholds come from the shift record, not a coded shift length (T-24)", () => {
  it.each([
    [11 * 60 + 45, "Present"],
    [11 * 60, "Half day"],
    [6 * 60, "Absent"],
  ])("a 12-hour shift at %i net minutes is %s", (minutes, expected) => {
    expect(attendanceStatus(shift().thresholds, minutes)).toBe(expected);
  });

  it("runs a shift length nobody seeded, straight from its configured thresholds", () => {
    const eleven = shift({ code: "D", durationMinutes: 660, thresholds: { halfDayBelowMinutes: 10 * 60 + 30, absentBelowMinutes: 5 * 60 + 30 } });
    expect(attendanceStatus(eleven.thresholds, 10 * 60 + 45)).toBe("Present");
    expect(attendanceStatus(eleven.thresholds, 10 * 60)).toBe("Half day");
    expect(attendanceStatus(eleven.thresholds, 5 * 60)).toBe("Absent");
  });

  it("refuses an unseeded shift length rather than falling back to eight hours", () => {
    expect(() => seededShiftThresholds(11)).toThrow("No seeded thresholds for a 11-hour shift");
    expect(Object.keys(shiftRules).sort()).toEqual(["10", "12", "8", "9"]);
  });

  it("refuses a shift whose thresholds were never configured", () => {
    expect(() => attendanceStatus({ halfDayBelowMinutes: Number.NaN, absentBelowMinutes: 0 }, 100)).toThrow("must be configured");
  });
});

describe("RL-17 grace, late counting and the grade exemption (T-25)", () => {
  const policy = { graceMinutes: 15, latesAllowedPerMonth: 3, consequence: "Half day" as const };

  it("treats 08:10 on an 08:00 shift as within grace and marks no late", () => {
    const result = evaluateLateArrival({ minutesLate: 10, lateOccurrencesThisMonth: 0, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy });
    expect(result).toMatchObject({ status: "Present", late: false });
  });

  it("counts 08:20 as late and half-days the fourth occurrence", () => {
    for (const occurrences of [0, 1, 2]) {
      const allowed = evaluateLateArrival({ minutesLate: 20, lateOccurrencesThisMonth: occurrences, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy });
      expect(allowed).toMatchObject({ status: "Present", late: true });
    }
    expect(evaluateLateArrival({ minutesLate: 20, lateOccurrencesThisMonth: 3, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy }))
      .toMatchObject({ status: "Half day", late: true });
  });

  it("leaves the exempt grade unaffected at the same lateness and count", () => {
    expect(evaluateLateArrival({ minutesLate: 20, lateOccurrencesThisMonth: 9, assistantManagerOrAbove: true, workedPast3AmPreviousDay: false, policy }).status).toBe("Present");
  });

  it("honours a tenant that configures a different grace and allowance", () => {
    const strict = { graceMinutes: 5, latesAllowedPerMonth: 1, consequence: "Half day" as const };
    expect(evaluateLateArrival({ minutesLate: 10, lateOccurrencesThisMonth: 0, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy: strict }).late).toBe(true);
    expect(evaluateLateArrival({ minutesLate: 10, lateOccurrencesThisMonth: 1, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy: strict }).status).toBe("Half day");
  });

  it("applies a warning-only consequence without downgrading the day", () => {
    const warn = { graceMinutes: 15, latesAllowedPerMonth: 0, consequence: "Warning only" as const };
    expect(evaluateLateArrival({ minutesLate: 30, lateOccurrencesThisMonth: 4, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false, policy: warn }))
      .toMatchObject({ status: "Present", late: true });
  });

  it("refuses to guess the exempt grade rank (Q-06) and counts on the calendar month (Q-12)", () => {
    expect(declaredAttendancePolicy.graceLate.exemptFromGradeRank).toBeNull();
    expect(() => requireExemptGradeRank(declaredAttendancePolicy.graceLate)).toThrow("graceLate.exemptFromGradeRank");
    expect(lateCounterWindow(declaredAttendancePolicy.graceLate, "2026-02-17")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(lateCounterWindow(declaredAttendancePolicy.graceLate, "2026-01-31")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(() => lateCounterWindow({ ...declaredAttendancePolicy.graceLate, counterReset: "payroll_month" }, "2026-02-17"))
      .toThrow("needs its cycle defined");
  });
});

describe("RL-18 night extension gives a full day (T-26)", () => {
  const rule = { triggerAfterMinute: 3 * 60, permittedArrivalUntilMinute: 9 * 60 + 30, minimumDepartureMinute: 20 * 60 };

  it("out at 03:20, in at 09:15, out at 20:00 qualifies", () => {
    expect(evaluateNightExtension({ previousSessionEndMinute: 200, arrivalMinute: 555, departureMinute: 1200, rule }).applies).toBe(true);
  });

  it("does not apply when the previous session ended before the trigger hour", () => {
    expect(evaluateNightExtension({ previousSessionEndMinute: 150, arrivalMinute: 555, departureMinute: 1200, rule }))
      .toMatchObject({ applies: false, reason: "The previous session did not run past the trigger hour." });
    expect(evaluateNightExtension({ previousSessionEndMinute: null, arrivalMinute: 555, departureMinute: 1200, rule }).applies).toBe(false);
  });

  it("does not apply when arrival is later than permitted or work stops early", () => {
    expect(evaluateNightExtension({ previousSessionEndMinute: 200, arrivalMinute: 600, departureMinute: 1200, rule }).reason).toContain("permitted");
    expect(evaluateNightExtension({ previousSessionEndMinute: 200, arrivalMinute: 555, departureMinute: 1080, rule }).reason).toContain("minimum departure");
  });

  it("raises the day rather than only preventing a downgrade", () => {
    // 09:15 to 20:00 is 10h45 on a 12-hour shift: below the 11:30 half-day
    // threshold, so the threshold alone would give a half day.
    const thresholdOnly = attendanceStatus(shift().thresholds, 10 * 60 + 45);
    expect(thresholdOnly).toBe("Half day");
    const extension = evaluateNightExtension({ previousSessionEndMinute: 200, arrivalMinute: 555, departureMinute: 1200, rule });
    expect(extension.applies ? "Present" : thresholdOnly).toBe("Present");
  });

  it("refuses to invent the trigger, permitted arrival and minimum departure times", () => {
    const [declared] = declaredAttendancePolicy.nightExtensionRules;
    expect(declared.triggerAfterMinute).toBeNull();
    expect(() => requireNightExtensionRule(declared)).toThrow("nightExtension.triggerAfterTime");
    expect(declared.maxUsesPerMonth).toBeNull();
  });
});

describe("RL-19 shift detection from the in-punch (T-27)", () => {
  const records = [
    shift({ code: "A", detection: detectionIntervals(6 * 60, 9 * 60 + 59), detectionLabel: "06:00–09:59" }),
    shift({ code: "B", detection: detectionIntervals(19 * 60, 22 * 60), detectionLabel: "19:00–22:00", startMinute: 20 * 60 }),
  ];

  it("processes an A-rostered employee punching in at 20:05 on B shift", () => {
    const detection = detectShift(records, "A", 20 * 60 + 5);
    expect(detection).toMatchObject({ rostered: "A", detected: "B", effective: "B" });
    expect(detection.reason).toContain("B detection window");
  });

  it("records nothing when the punch matches the rostered shift", () => {
    expect(detectShift(records, "A", 8 * 60)).toMatchObject({ rostered: "A", detected: null, effective: "A" });
  });

  it("leaves the rostered shift alone when no window is configured", () => {
    expect(detectShift([shift({ code: "A" })], "A", 20 * 60 + 5)).toMatchObject({ detected: null, effective: "A" });
  });

  it("expresses a window that crosses midnight instead of matching nothing", () => {
    const night = detectionIntervals(20 * 60, 4 * 60);
    expect(night).toEqual([[1200, 1439], [0, 240]]);
    expect(detectionWindowContains(night, 23 * 60)).toBe(true);
    expect(detectionWindowContains(night, 2 * 60)).toBe(true);
    expect(detectionWindowContains(night, 12 * 60)).toBe(false);
  });

  it("refuses overlapping detection windows on save, midnight crossings included", () => {
    expect(() => assertDetectionWindowsDoNotOverlap([
      { code: "A", earliestIn: "06:00", latestIn: "09:59" },
      { code: "B", earliestIn: "19:00", latestIn: "22:00" },
    ])).not.toThrow();
    expect(() => assertDetectionWindowsDoNotOverlap([
      { code: "A", earliestIn: "06:00", latestIn: "10:00" },
      { code: "C", earliestIn: "09:30", latestIn: "12:00" },
    ])).toThrow("must not overlap");
    expect(() => assertDetectionWindowsDoNotOverlap([
      { code: "B", earliestIn: "20:00", latestIn: "04:00" },
      { code: "C", earliestIn: "02:00", latestIn: "05:00" },
    ])).toThrow("must not overlap");
    // A window nobody has configured cannot clash with anything.
    expect(() => assertDetectionWindowsDoNotOverlap([
      { code: "A", earliestIn: null, latestIn: null },
      { code: "B", earliestIn: "20:00", latestIn: "04:00" },
    ])).not.toThrow();
  });

  it("reports every clashing pair rather than only the first", () => {
    const clashes = detectionWindowOverlaps([
      { code: "A", intervals: detectionIntervals(360, 600) },
      { code: "B", intervals: detectionIntervals(540, 700) },
      { code: "C", intervals: detectionIntervals(580, 800) },
    ]);
    expect(clashes.map((pair) => `${pair.left.code}${pair.right.code}`)).toEqual(["AB", "AC", "BC"]);
  });
});

describe("policy pack plumbing", () => {
  it("reads clock settings and refuses an unreadable or absent one", () => {
    expect(clockToMinuteOfDay("09:30")).toBe(570);
    expect(clockToMinuteOfDay("24:00")).toBeNull();
    expect(clockToMinuteOfDay(undefined)).toBeNull();
    expect(requireAttendanceSetting(15, "graceLate.graceMinutesIn", "F-ATT-06")).toBe(15);
    expect(() => requireAttendanceSetting(null, "graceLate.graceMinutesIn", "F-ATT-06")).toThrow("has no approved value");
  });

  it("keeps the stated defaults the workbook does supply", () => {
    expect(declaredAttendancePolicy.graceLate).toMatchObject({ graceMinutesIn: 15, latesAllowedPerMonth: 3, consequence: "Half day", counterReset: "calendar_month" });
    expect(declaredAttendancePolicy.breakTypes).toContain("Unclassified");
  });

  it("parses a punch clock label back to minutes for the night-extension inputs", () => {
    expect(punchClockToMinutes("09:15 PM")).toBe(1275);
    expect(punchClockToMinutes("12:05 AM")).toBe(5);
    expect(() => punchClockToMinutes("25:00 PM")).toThrow("Invalid punch time");
  });
});
