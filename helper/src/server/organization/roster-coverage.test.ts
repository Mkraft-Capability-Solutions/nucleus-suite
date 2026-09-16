import { describe, expect, it } from "vitest";

import { rosterCoverage } from "./roster-coverage";

describe("roster coverage (FRM-TIM-02)", () => {
  it("counts the Sunday off and the six working days around it", () => {
    // Monday 2026-06-01 to Sunday 2026-06-07.
    const coverage = rosterCoverage({ startDate: "2026-06-01", endDate: "2026-06-07", restDayPattern: "fixed_sunday" });
    expect(coverage.spanDays).toBe(7);
    expect(coverage.restDaysInWeek).toBe(1);
    expect(coverage.consecutiveDays).toBe(6);
  });

  it("reports the worst week, not the average, over a longer span", () => {
    // Three weeks where the middle Sunday is itself rostered as working: an average
    // would read one rest day a week and hide the week that has none.
    const coverage = rosterCoverage({ startDate: "2026-06-01", endDate: "2026-06-21", restDayPattern: "fixed_sunday" });
    expect(coverage.spanDays).toBe(21);
    expect(coverage.restDaysInWeek).toBe(1);
    expect(coverage.consecutiveDays).toBe(6);
  });

  it("finds the long run when a rest day is missing from the middle", () => {
    // A fortnight with no pattern rest day at all: thirteen straight working days.
    const coverage = rosterCoverage({ startDate: "2026-06-01", endDate: "2026-06-13", restDayPattern: "none" });
    expect(coverage.restDaysInWeek).toBe(0);
    expect(coverage.consecutiveDays).toBe(13);
  });

  it("breaks the run on a holiday without counting it as a rest day", () => {
    const coverage = rosterCoverage({
      startDate: "2026-06-01",
      endDate: "2026-06-13",
      restDayPattern: "none",
      holidays: ["2026-06-05"],
    });
    // The holiday is not a weekly off, so the rest-day count stays zero...
    expect(coverage.restDaysInWeek).toBe(0);
    // ...but it does break the working run: 1-4 then 6-13.
    expect(coverage.consecutiveDays).toBe(8);
  });

  it("returns null rather than zero when the pattern does not name a day", () => {
    // A rotational weekly off is set by the roster, not by the calendar. Reporting zero
    // would claim the employee has no rest day at all.
    const coverage = rosterCoverage({ startDate: "2026-06-01", endDate: "2026-06-07", restDayPattern: "rotational_weekly_off" });
    expect(coverage.restDaysInWeek).toBeNull();
    expect(coverage.consecutiveDays).toBe(7);
  });

  it("treats a weekly-off override as covering every day it spans", () => {
    const coverage = rosterCoverage({
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      restDayPattern: "fixed_sunday",
      dayTypeOverride: "weekly_off",
    });
    expect(coverage.restDaysInWeek).toBe(3);
    expect(coverage.consecutiveDays).toBe(0);
  });

  it("is empty for an inverted range rather than guessing at it", () => {
    expect(rosterCoverage({ startDate: "2026-06-10", endDate: "2026-06-01", restDayPattern: "fixed_sunday" }))
      .toEqual({ restDaysInWeek: null, consecutiveDays: 0, spanDays: 0 });
  });
});
