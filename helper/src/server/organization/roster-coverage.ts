/**
 * FRM-TIM-02's two derived roster fields: `rest_days_in_week` and `consecutive_days`.
 *
 * Both are properties of a published roster, not things a planner types — the form has
 * always listed them and nothing computed either, so a roster that gave an employee nine
 * straight working days looked exactly like one that gave six. They are derived here,
 * apart from the database, so the arithmetic is the same on the screen, in the service
 * and in a test.
 *
 * Nothing in this file decides policy. It reports what a roster contains; whether a run
 * of N days is permissible is a rule the workbook does not state.
 */

/** Rest-day patterns whose weekly off falls on a day this can name. */
const SUNDAY_PATTERNS = new Set(["fixed_sunday", "fixed_sunday_alt_saturday"]);

export type RosterCoverage = {
  /**
   * The fewest rest days in any seven-day window of the roster, or the count across the
   * whole span when it is shorter than a week. `null` where the pattern does not name a
   * day — a rotational weekly off is set by the roster itself, and reporting zero would
   * claim the employee has none.
   */
  restDaysInWeek: number | null;
  /** The longest run of consecutive working days, counting holidays as non-working. */
  consecutiveDays: number;
  /** Days the roster spans, inclusive of both ends. */
  spanDays: number;
};

function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

function isSunday(date: string): boolean {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

/**
 * What one roster row covers (pure).
 *
 * `dayTypeOverride` applies to the whole range, which is what the field means on the
 * form: a roster raised as a weekly off or a holiday is that for every day it spans.
 */
export function rosterCoverage(input: {
  startDate: string;
  endDate: string;
  restDayPattern: string | null;
  /** Holiday dates falling inside the span, from the location's calendar. */
  holidays?: readonly string[];
  dayTypeOverride?: string | null;
}): RosterCoverage {
  if (input.endDate < input.startDate) return { restDaysInWeek: null, consecutiveDays: 0, spanDays: 0 };
  const holidays = new Set(input.holidays ?? []);
  const override = (input.dayTypeOverride ?? "").trim().toLowerCase();
  const overrideIsRest = override.includes("off") || override.includes("rest");
  const overrideIsHoliday = override.includes("holiday");
  const pattern = (input.restDayPattern ?? "").trim().toLowerCase();
  // A pattern that does not name a day cannot be read off the calendar. `none` is a
  // definite answer (no rest days); a rotational pattern is an unknown, not a zero.
  const patternNamesADay = pattern === "none" || SUNDAY_PATTERNS.has(pattern);

  const dates: string[] = [];
  for (let date = input.startDate; date <= input.endDate; date = addDays(date, 1)) dates.push(date);

  const restDay = (date: string): boolean => overrideIsRest || (SUNDAY_PATTERNS.has(pattern) && isSunday(date));
  const working = (date: string): boolean => !restDay(date) && !overrideIsHoliday && !holidays.has(date);

  let consecutiveDays = 0;
  let run = 0;
  for (const date of dates) {
    run = working(date) ? run + 1 : 0;
    if (run > consecutiveDays) consecutiveDays = run;
  }

  let restDaysInWeek: number | null = null;
  if (patternNamesADay || overrideIsRest) {
    if (dates.length <= 7) {
      restDaysInWeek = dates.filter(restDay).length;
    } else {
      // The worst seven-day window, because a roster is acceptable only if *every* week
      // in it holds a rest day — averaging over the span would hide the week that does not.
      let worst = Number.POSITIVE_INFINITY;
      for (let start = 0; start + 7 <= dates.length; start += 1) {
        const inWindow = dates.slice(start, start + 7).filter(restDay).length;
        if (inWindow < worst) worst = inWindow;
      }
      restDaysInWeek = Number.isFinite(worst) ? worst : null;
    }
  }

  return { restDaysInWeek, consecutiveDays, spanDays: dates.length };
}
