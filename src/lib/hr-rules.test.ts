import { describe, expect, it } from "vitest";
import {
  analyzePunchDay,
  annualLeaveCredit,
  attendanceStatus,
  coffExpiryDate,
  evaluateLateArrival,
  formatDuration,
  gatePassEligibility,
  isOvertimeEligible,
  joiningPeriodCasualAndSickLeave,
  loanEligibility,
  overnightPunchExample,
  reconcileEarlyLeaveReturn,
  restDayPolicy,
  validateLeaveRequest,
} from "./hr-rules";

describe("attendance calculation", () => {
  it("reproduces the supplied overnight example exactly", () => {
    expect(overnightPunchExample).toMatchObject({ grossSpanMinutes: 1160, rawProductiveMinutes: 1115, breakMinutes: 45, overtimeMinutes: 440 });
    expect(overnightPunchExample.breaks).toEqual([{ from: "08:30 PM", to: "09:15 PM", minutes: 45 }]);
  });

  it("supports productive-time overtime as an explicit alternative", () => {
    const result = analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "08:30 PM" }, { type: "in", at: "09:15 PM" }, { type: "out", at: "03:20 AM" }], shiftMinutes: 720, overtimeBasis: "productive" });
    expect(result.overtimeMinutes).toBe(395);
  });

  it("credits approved gate-pass time to productive attendance", () => {
    const result = analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "02:00 PM" }], shiftMinutes: 480, approvedGatePassMinutes: 120 });
    expect(result.rawProductiveMinutes).toBe(360);
    expect(result.productiveMinutes).toBe(480);
  });

  it("normalizes a single pair across midnight", () => {
    const result = analyzePunchDay({ punches: [{ type: "in", at: "10:00 PM" }, { type: "out", at: "06:00 AM" }], shiftMinutes: 480 });
    expect(result.grossSpanMinutes).toBe(480);
  });

  it.each([
    [[], "start"],
    [[{ type: "out", at: "08:00 AM" }, { type: "in", at: "09:00 AM" }], "start"],
    [[{ type: "in", at: "08:00 AM" }, { type: "in", at: "09:00 AM" }, { type: "out", at: "10:00 AM" }], "alternate"],
    [[{ type: "in", at: "08:00 AM" }, { type: "out", at: "25:00 PM" }], "Invalid"],
  ])("rejects malformed punch sequences %#", (punches, message) => {
    expect(() => analyzePunchDay({ punches: punches as never, shiftMinutes: 480 })).toThrow(message);
  });

  it("rejects invalid duration inputs", () => {
    expect(() => analyzePunchDay({ punches: [{ type: "in", at: "08:00 AM" }, { type: "out", at: "05:00 PM" }], shiftMinutes: 0 })).toThrow("valid positive durations");
  });

  it("formats durations for the UI", () => expect(formatDuration(440)).toBe("7h 20m"));
});

describe("attendance status boundaries", () => {
  it.each([
    [12, 389, "Absent"], [12, 390, "Half day"], [12, 689, "Half day"], [12, 690, "Present"],
    [10, 359, "Absent"], [10, 360, "Half day"], [10, 570, "Present"],
    [9, 299, "Absent"], [9, 300, "Half day"], [9, 510, "Present"],
    [8, 269, "Absent"], [8, 270, "Half day"], [8, 450, "Present"],
  ])("classifies %sh shift at %s minutes as %s", (shift, minutes, expected) => {
    expect(attendanceStatus(shift as 8 | 9 | 10 | 12, minutes)).toBe(expected);
  });

  it("rejects negative net time", () => expect(() => attendanceStatus(8, -1)).toThrow("non-negative"));
});

describe("late arrival and employment category policy", () => {
  it("honours grace at exactly fifteen minutes", () => expect(evaluateLateArrival({ minutesLate: 15, lateOccurrencesThisMonth: 3, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false }).status).toBe("Present"));
  it("allows the first three late occurrences", () => expect(evaluateLateArrival({ minutesLate: 20, lateOccurrencesThisMonth: 2, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false }).reason).toContain("3 of 3"));
  it("marks a fourth non-exempt late arrival half day", () => expect(evaluateLateArrival({ minutesLate: 20, lateOccurrencesThisMonth: 3, assistantManagerOrAbove: false, workedPast3AmPreviousDay: false }).status).toBe("Half day"));
  it.each([[true, false], [false, true]])("honours manager and overnight exemptions", (manager, overnight) => expect(evaluateLateArrival({ minutesLate: 90, lateOccurrencesThisMonth: 8, assistantManagerOrAbove: manager, workedPast3AmPreviousDay: overnight }).status).toBe("Present"));
  it.each([["regular", true, "monthly"], ["contract", false, "daily"], ["third-party-employee", true, "monthly"], ["third-party-helper", false, "monthly"]])("applies category policy for %s", (category, rest, wage) => expect(restDayPolicy(category as never)).toEqual({ hasRestDay: rest, wageBasis: wage }));
  it.each([["all-days", false, false, true], ["not-eligible", true, true, false], ["rest-holiday-only", true, false, true], ["rest-holiday-only", false, true, true], ["rest-holiday-only", false, false, false]])("evaluates OT policy %s", (policy, rest, holiday, expected) => expect(isOvertimeEligible({ policy: policy as never, isRestDay: rest, isHoliday: holiday })).toBe(expected));
});

describe("leave policy", () => {
  it.each([[1, 20, 6], [2, 1, 5], [4, 1, 4], [6, 1, 3], [8, 1, 2], [10, 1, 1], [12, 4, 1], [12, 5, 0]])("credits CL/SL by joining date %s/%s", (month, day, expected) => expect(joiningPeriodCasualAndSickLeave(month, day)).toBe(expected));
  it("rejects invalid joining dates", () => expect(() => joiningPeriodCasualAndSickLeave(13, 1)).toThrow("valid calendar"));
  it("credits AGM+ annual entitlement on January first", () => expect(annualLeaveCredit({ designationLevel: "AGM+", completedSixMonths: true })).toEqual({ EL: 18, CL: 6, SL: 6, monthlyEL: 0 }));
  it("uses monthly EL accrual for established below-AGM employees", () => expect(annualLeaveCredit({ designationLevel: "below-AGM", completedSixMonths: true })).toEqual({ EL: 0, CL: 6, SL: 6, monthlyEL: 1.5 }));
  it("withholds EL from a new joiner before six months", () => expect(annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 4, completedSixMonths: false }).EL).toBe(0));
  it("releases nine EL after a new joiner completes six months", () => expect(annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 4, completedSixMonths: true }).EL).toBe(9));
  it.each([["DET", 5], ["GET", 5], ["other", 0]])("applies trainee CL eligibility for %s", (trainee, expected) => expect(annualLeaveCredit({ designationLevel: "below-AGM", joinMonth: 2, completedSixMonths: false, traineeType: trainee as never }).CL).toBe(expected));
  it("blocks combining CL with EL or SL", () => expect(validateLeaveRequest({ requestedTypes: ["CL", "EL"], clDaysThisMonth: 1, elDaysThisMonth: 1 }).valid).toBe(false));
  it("enforces monthly CL and EL caps", () => expect(validateLeaveRequest({ requestedTypes: ["EL"], clDaysThisMonth: 3, elDaysThisMonth: 11 }).errors).toHaveLength(2));
  it("accepts a policy-compliant request", () => expect(validateLeaveRequest({ requestedTypes: ["SL"], clDaysThisMonth: 0, elDaysThisMonth: 0 }).valid).toBe(true));
  it("expires COFF after sixty days", () => expect(coffExpiryDate(new Date("2026-01-01T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-03-02"));
  it("rejects an invalid COFF date", () => expect(() => coffExpiryDate(new Date("invalid"))).toThrow("valid"));
  it("credits unused leave on early return", () => expect(reconcileEarlyLeaveReturn({ approvedDays: 4, actualLeaveDays: 2 })).toEqual({ presentDaysRestored: 2, leaveDaysCreditedBack: 2 }));
  it("never creates a negative leave credit", () => expect(reconcileEarlyLeaveReturn({ approvedDays: 2, actualLeaveDays: 3 }).leaveDaysCreditedBack).toBe(0));
});

describe("gate pass and loan safeguards", () => {
  it("allows a single four-hour pass", () => expect(gatePassEligibility({ approvedMinutesThisMonth: 0, approvedCountThisMonth: 0, requestedMinutes: 240 }).eligible).toBe(true));
  it("allows two two-hour passes", () => expect(gatePassEligibility({ approvedMinutesThisMonth: 120, approvedCountThisMonth: 1, requestedMinutes: 120 }).eligible).toBe(true));
  it("blocks a third pass and excess hours", () => expect(gatePassEligibility({ approvedMinutesThisMonth: 240, approvedCountThisMonth: 2, requestedMinutes: 120 }).reasons).toHaveLength(2));
  it("blocks unsupported gate-pass increments", () => expect(gatePassEligibility({ approvedMinutesThisMonth: 0, approvedCountThisMonth: 0, requestedMinutes: 60 }).eligible).toBe(false));
  it("sets a four-times salary ceiling through five years", () => expect(loanEligibility({ basicSalary: 50000, serviceYears: 5, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(200000));
  it("sets a six-times ceiling beyond five years", () => expect(loanEligibility({ basicSalary: 50000, serviceYears: 5.01, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false }).maximumAmount).toBe(300000));
  it.each([[true, false, false], [false, true, false], [false, false, true]])("blocks conflicting exposure", (loan, advance, guarantee) => expect(loanEligibility({ basicSalary: 50000, serviceYears: 2, hasOpenLoan: loan, hasSalaryAdvance: advance, isActiveGuarantor: guarantee }).eligible).toBe(false));
  it("allows an audited director override", () => expect(loanEligibility({ basicSalary: 50000, serviceYears: 2, hasOpenLoan: true, hasSalaryAdvance: false, isActiveGuarantor: false, directorOverride: true }).eligible).toBe(true));
  it("requires two guarantors and permits a third", () => expect(loanEligibility({ basicSalary: 50000, serviceYears: 2, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false })).toMatchObject({ mandatoryGuarantors: 2, optionalThirdGuarantor: true }));
  it("rejects invalid loan inputs", () => expect(() => loanEligibility({ basicSalary: 0, serviceYears: 2, hasOpenLoan: false, hasSalaryAdvance: false, isActiveGuarantor: false })).toThrow("valid"));
});
