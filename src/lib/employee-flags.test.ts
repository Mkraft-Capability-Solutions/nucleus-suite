import { describe, expect, it } from "vitest";
import { addMonths, daysBetween, evaluateEmployee, parseDay, resolveRules, sortFlags, type FlaggableEmployee } from "./employee-flags";

const TODAY = "2026-11-21";
const rules = resolveRules([]);
const person = (overrides: Partial<FlaggableEmployee> = {}): FlaggableEmployee => ({
  id: "e1", code: "E-1", name: "Asha Rao", dateOfBirth: "1990-01-01", passportExpiry: null, workPermitExpiry: null,
  isInternationalWorker: false, medicalExamDate: null, fitnessStatus: null, ...overrides,
});
const only = (employee: FlaggableEmployee, rule: string) => evaluateEmployee(employee, rules, TODAY).filter((flag) => flag.rule === rule);

describe("employee flags: dates", () => {
  it("reads calendar dates and ignores empty or invalid values", () => {
    expect(parseDay("2026-12-01")).toBe("2026-12-01");
    expect(parseDay("2026-12-01T10:00:00Z")).toBe("2026-12-01");
    expect(parseDay("")).toBeNull();
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("soon")).toBeNull();
  });

  it("adds months without overflowing the month", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("1966-05-12", 720)).toBe("2026-05-12");
    expect(daysBetween("2026-11-21", "2026-12-01")).toBe(10);
  });
});

describe("employee flags: rules", () => {
  it("uses the defaults when the organisation has not set a rule, and stored values over them", () => {
    expect(rules.map((rule) => [rule.key, rule.warningDays, rule.alertDays])).toEqual([
      ["passport_expiry", 90, 30], ["visa_expiry", 90, 30], ["medical_exam_due", 30, 0], ["retirement_due", 180, 60],
    ]);
    const custom = resolveRules([{ key: "retirement_due", warningDays: 365, alertDays: 90, settings: { retirementAge: 58 } }]);
    expect(custom.find((rule) => rule.key === "retirement_due")).toMatchObject({ enabled: true, warningDays: 365, alertDays: 90, settings: { retirementAge: 58 } });
  });

  it("passport: nothing far out, a warning inside 90 days, an alert inside 30 days and once expired", () => {
    expect(only(person({ passportExpiry: "2027-06-01" }), "passport_expiry")).toEqual([]);
    expect(only(person({ passportExpiry: "2027-01-15" }), "passport_expiry")[0]).toMatchObject({ severity: "warning", daysLeft: 55, detail: "Passport expires in 55 days (15 Jan 2027)." });
    expect(only(person({ passportExpiry: "2026-12-01" }), "passport_expiry")[0]).toMatchObject({ severity: "alert", daysLeft: 10 });
    expect(only(person({ passportExpiry: "2026-11-19" }), "passport_expiry")[0]).toMatchObject({ severity: "alert", daysLeft: -2, detail: "Passport expired 2 days ago (19 Nov 2026)." });
    expect(only(person({ passportExpiry: "" }), "passport_expiry")).toEqual([]);
  });

  it("visa: reads the work permit / visa expiry", () => {
    expect(only(person({ isInternationalWorker: true, workPermitExpiry: "2026-12-25" }), "visa_expiry")[0]).toMatchObject({ severity: "warning", daysLeft: 34 });
  });

  it("medical examination: due one interval after the last one; unfit is an alert, pending a warning", () => {
    expect(only(person({ medicalExamDate: "2026-03-01" }), "medical_exam_due")).toEqual([]);
    expect(only(person({ medicalExamDate: "2025-12-10" }), "medical_exam_due")[0]).toMatchObject({ severity: "warning", dueDate: "2026-12-10" });
    expect(only(person({ medicalExamDate: "2025-10-01" }), "medical_exam_due")[0]).toMatchObject({ severity: "alert", dueDate: "2026-10-01" });
    expect(only(person({ fitnessStatus: "Unfit" }), "medical_exam_due")[0]).toMatchObject({ severity: "alert", detail: "Recorded as unfit at the last medical examination." });
    expect(only(person({ fitnessStatus: "Pending" }), "medical_exam_due")[0]).toMatchObject({ severity: "warning" });
    // An overdue examination stays an alert even while fitness is pending.
    expect(only(person({ medicalExamDate: "2025-10-01", fitnessStatus: "Pending" }), "medical_exam_due")[0]).toMatchObject({ severity: "alert" });
  });

  it("retirement: from the date of birth and the retirement age", () => {
    expect(only(person({ dateOfBirth: "1966-12-15" }), "retirement_due")[0]).toMatchObject({ severity: "alert", dueDate: "2026-12-15", daysLeft: 24 });
    expect(only(person({ dateOfBirth: "1967-03-01" }), "retirement_due")[0]).toMatchObject({ severity: "warning", dueDate: "2027-03-01" });
    expect(only(person({ dateOfBirth: "1990-01-01" }), "retirement_due")).toEqual([]);
    // A birth date in the future is a data error, not a retirement.
    expect(only(person({ dateOfBirth: "2026-11-30" }), "retirement_due")).toEqual([]);
  });

  it("a rule that is off raises nothing; flag ids change when a warning becomes an alert", () => {
    const off = resolveRules([{ key: "passport_expiry", enabled: false }]);
    expect(evaluateEmployee(person({ passportExpiry: "2026-12-01" }), off, TODAY).filter((flag) => flag.rule === "passport_expiry")).toEqual([]);
    const warning = only(person({ passportExpiry: "2027-01-15" }), "passport_expiry")[0]!;
    const alert = only(person({ passportExpiry: "2026-12-01" }), "passport_expiry")[0]!;
    expect(warning.id).not.toBe(alert.id);
  });

  it("sorts alerts first, then the soonest", () => {
    const sorted = sortFlags([
      { severity: "warning", daysLeft: 10 }, { severity: "alert", daysLeft: 20 }, { severity: "alert", daysLeft: -3 }, { severity: "warning", daysLeft: 5 },
    ] as const as Array<{ severity: "warning" | "alert"; daysLeft: number }>);
    expect(sorted.map((flag) => `${flag.severity}:${flag.daysLeft}`)).toEqual(["alert:-3", "alert:20", "warning:5", "warning:10"]);
  });
});
