import { describe, expect, it } from "vitest";
import {
  OVERTIME_BREACH_HOURS,
  OVERTIME_WATCH_HOURS,
  attendanceRates,
  clockMinutes,
  monthWindows,
  overtimeBand,
  punctualityOf,
  rosterCoversDay,
} from "./attendance-intelligence";

describe("monthWindows", () => {
  it("returns calendar month boundaries, oldest first, ending on the given month", () => {
    const windows = monthWindows("2026-03-17", 3);
    expect(windows.map((window) => window.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(windows[0]).toMatchObject({ from: "2026-01-01", to: "2026-01-31", label: "Jan" });
    expect(windows[1]).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    expect(windows[2]).toMatchObject({ from: "2026-03-01", to: "2026-03-31" });
  });

  it("crosses the year boundary and marks the older year in the label", () => {
    const windows = monthWindows("2026-01-05", 2);
    expect(windows.map((window) => window.key)).toEqual(["2025-12", "2026-01"]);
    expect(windows[0].label).toBe("Dec 25");
    expect(windows[1].label).toBe("Jan");
  });

  it("handles a leap February and refuses an unparseable date", () => {
    expect(monthWindows("2028-02-10", 1)[0].to).toBe("2028-02-29");
    expect(monthWindows("not-a-date", 3)).toEqual([]);
  });
});

describe("attendanceRates", () => {
  it("weights a half day as half a present day", () => {
    expect(attendanceRates({ present: 8, halfDay: 2, absent: 0 })).toEqual({
      attendancePercent: 90,
      absenteeismPercent: 0,
      classifiedDays: 10,
    });
  });

  it("excludes unrecorded days by counting only classified ones", () => {
    const rates = attendanceRates({ present: 90, halfDay: 0, absent: 10 });
    expect(rates.attendancePercent).toBe(90);
    expect(rates.absenteeismPercent).toBe(10);
    expect(rates.classifiedDays).toBe(100);
  });

  it("returns null rather than zero when nothing was classified", () => {
    expect(attendanceRates({ present: 0, halfDay: 0, absent: 0 })).toEqual({
      attendancePercent: null,
      absenteeismPercent: null,
      classifiedDays: 0,
    });
  });
});

describe("clockMinutes", () => {
  it("reads every shape the punch pipeline stores", () => {
    expect(clockMinutes("09:15")).toBe(555);
    expect(clockMinutes("09:15:42")).toBe(555);
    expect(clockMinutes("2026-03-17T09:15:00Z")).toBe(555);
    expect(clockMinutes("2026-03-17 09:15:00")).toBe(555);
    expect(clockMinutes("9:05")).toBe(545);
  });

  it("returns null for a missing or impossible reading rather than midnight", () => {
    expect(clockMinutes(null)).toBeNull();
    expect(clockMinutes("")).toBeNull();
    expect(clockMinutes("   ")).toBeNull();
    expect(clockMinutes("not a time")).toBeNull();
    expect(clockMinutes("25:00")).toBeNull();
    expect(clockMinutes("09:75")).toBeNull();
  });
});

describe("punctualityOf", () => {
  it("marks an arrival after the shift start plus grace as late", () => {
    expect(punctualityOf("08:00", "08:00")).toBe("on_time");
    expect(punctualityOf("08:01", "08:00")).toBe("late");
    expect(punctualityOf("08:10", "08:00", 15)).toBe("on_time");
    expect(punctualityOf("08:16", "08:00", 15)).toBe("late");
    expect(punctualityOf("07:45", "08:00")).toBe("on_time");
  });

  it("compares on the shorter way round the clock for a night shift", () => {
    expect(punctualityOf("20:05", "20:00")).toBe("late");
    // 00:10 is ten minutes after a 00:00 start, not most of a day early.
    expect(punctualityOf("00:10", "00:00")).toBe("late");
    // 23:55 against a 00:00 start is five minutes early on the previous day.
    expect(punctualityOf("23:55", "00:00")).toBe("on_time");
  });

  it("returns null when either clock is unreadable, never counting it as on time", () => {
    expect(punctualityOf(null, "08:00")).toBeNull();
    expect(punctualityOf("08:00", null)).toBeNull();
    expect(punctualityOf("", "")).toBeNull();
  });
});

describe("overtimeBand", () => {
  it("applies the statutory watch and breach thresholds strictly above the boundary", () => {
    expect(overtimeBand(0)).toBe("within");
    expect(overtimeBand(OVERTIME_WATCH_HOURS)).toBe("within");
    expect(overtimeBand(OVERTIME_WATCH_HOURS + 0.1)).toBe("watch");
    expect(overtimeBand(OVERTIME_BREACH_HOURS)).toBe("watch");
    expect(overtimeBand(OVERTIME_BREACH_HOURS + 0.1)).toBe("breach");
  });

  it("does not band an unreadable figure as a breach", () => {
    expect(overtimeBand(Number.NaN)).toBe("within");
  });
});

describe("rosterCoversDay", () => {
  const roster = { status: "published", startDate: "2026-03-01", endDate: "2026-03-31" };

  it("counts only a live roster that spans the day", () => {
    expect(rosterCoversDay(roster, "2026-03-17")).toBe(true);
    expect(rosterCoversDay(roster, "2026-03-01")).toBe(true);
    expect(rosterCoversDay(roster, "2026-03-31")).toBe(true);
    expect(rosterCoversDay(roster, "2026-04-01")).toBe(false);
    expect(rosterCoversDay({ ...roster, status: "approved" }, "2026-03-17")).toBe(true);
  });

  it("ignores drafts, returns and withdrawals, and rows with no dates", () => {
    expect(rosterCoversDay({ ...roster, status: "draft" }, "2026-03-17")).toBe(false);
    expect(rosterCoversDay({ ...roster, status: "withdrawn" }, "2026-03-17")).toBe(false);
    expect(rosterCoversDay({ status: "published" }, "2026-03-17")).toBe(false);
  });
});
