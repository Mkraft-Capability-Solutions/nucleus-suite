import { describe, expect, it } from "vitest";
import { assertOtRunAllowed, computeVpAttendance, inferShift, manpowerAvailability, payloadHashSource, renderMergeTemplate, VP_FEATURES, workerCategoryDefaults } from "./policy";

const windows = [
  { code: "A", earliestMinute: 7 * 60, latestMinute: 9 * 60 + 30, durationMinutes: 8 * 60 },
  { code: "B", earliestMinute: 19 * 60, latestMinute: 22 * 60, durationMinutes: 12 * 60 },
];

describe("VP readiness coverage", () => {
  it("tracks every requirement exactly once", () => {
    expect(VP_FEATURES).toHaveLength(26);
    expect(new Set(VP_FEATURES).size).toBe(26);
  });
});

describe("time-office completion", () => {
  it("infers B shift from the first punch and records a reason", () => {
    expect(inferShift("A", "2026-09-12T20:10:00+05:30", windows)).toMatchObject({ inferred: "B", effective: "B" });
    expect(inferShift("A", "2026-09-12T20:10:00+05:30", windows).reason).toContain("matched B");
  });

  it("uses net productive hours for OT and respects rest-day eligibility", () => {
    const result = computeVpAttendance({
      punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "08:00 PM" }, { type: "in", at: "09:00 PM" }, { type: "out", at: "03:00 AM" }],
      assignedShift: "A", windows, shiftHours: 8, approvedGatePassMinutes: 0,
      otPolicy: "rest-holiday-only", dayType: "working", minutesLate: 0,
      lateOccurrencesThisMonth: 0, assistantManagerOrAbove: false,
      workedPast3AmPreviousDay: false, firstPunchIso: "2026-09-12T08:00:00+05:30",
    });
    expect(result.grossSpanMinutes).toBe(1140);
    expect(result.breakMinutes).toBe(60);
    expect(result.productiveMinutes).toBe(1080);
    expect(result.overtimeMinutes).toBe(600);
    expect(result.payableOtMinutes).toBe(0);
  });

  it("applies worker category defaults", () => {
    expect(workerCategoryDefaults("contract")).toMatchObject({ hasRestDay: false, wageBasis: "daily" });
    expect(workerCategoryDefaults("third-party-employee").hasRestDay).toBe(true);
    expect(workerCategoryDefaults("third-party-helper")).toMatchObject({ hasRestDay: false, otPolicy: "not-eligible" });
  });
});

describe("payroll, manpower and documents", () => {
  it("allows OT only after regular payroll finalization", () => {
    expect(() => assertOtRunAllowed("ot", "approved")).toThrow("finalized first");
    expect(assertOtRunAllowed("ot", "finalized")).toBe(true);
    expect(assertOtRunAllowed("regular", null)).toBe(true);
  });

  it("does not consume sanction for a replacement", () => {
    expect(manpowerAvailability({ sanctioned: 2, filled: 2, openAdditions: 0, requisitionType: "replacement" }).allowed).toBe(true);
    expect(manpowerAvailability({ sanctioned: 2, filled: 2, openAdditions: 0, requisitionType: "addition" }).allowed).toBe(false);
  });

  it("renders versioned HR/statutory templates strictly", () => {
    expect(renderMergeTemplate("Hello {{ employee.name }}", { "employee.name": "Maya" })).toBe("Hello Maya");
    expect(() => renderMergeTemplate("Hello {{missing}}", {})).toThrow("Missing merge field");
  });

  it("normalizes payload key order for ERP idempotency", () => {
    expect(payloadHashSource({ z: 1, a: { y: 2, b: 3 } })).toEqual({ a: { b: 3, y: 2 }, z: 1 });
  });
});
