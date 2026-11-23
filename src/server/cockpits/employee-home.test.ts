import { describe, expect, it } from "vitest";
import {
  buildAttendanceMatrix,
  periodsCovering,
  pickPayslip,
  shiftTargetMinutes,
  toInstant,
  weekCompletionPct,
  weekDates,
} from "./employee-home";

describe("toInstant", () => {
  it("repairs the two-digit offset postgres writes with to_char OF", () => {
    expect(toInstant("2026-09-15T09:12:00+05")).toBe("2026-09-15T04:12:00.000Z");
  });

  it("passes a full ISO instant through unchanged in value", () => {
    expect(toInstant("2026-09-15T04:12:00.000Z")).toBe("2026-09-15T04:12:00.000Z");
  });

  it("returns null rather than an invented instant", () => {
    expect(toInstant(null)).toBeNull();
    expect(toInstant("")).toBeNull();
    expect(toInstant("   ")).toBeNull();
    expect(toInstant("not a timestamp")).toBeNull();
  });
});

describe("shiftTargetMinutes", () => {
  it("measures a normal day shift", () => {
    expect(shiftTargetMinutes("09:00", "18:00")).toBe(540);
  });

  it("wraps a night shift over midnight", () => {
    expect(shiftTargetMinutes("22:00", "06:00")).toBe(480);
  });

  it("returns null when either boundary is missing or unreadable", () => {
    expect(shiftTargetMinutes(null, "18:00")).toBeNull();
    expect(shiftTargetMinutes("09:00", null)).toBeNull();
    expect(shiftTargetMinutes("morning", "evening")).toBeNull();
  });

  it("rejects a zero-length shift", () => {
    expect(shiftTargetMinutes("09:00", "09:00")).toBeNull();
  });
});

describe("weekDates", () => {
  it("lists Monday through Sunday", () => {
    expect(weekDates("2026-09-14")).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});

describe("buildAttendanceMatrix", () => {
  it("lays weeks down and weekdays across, leaving unread days null", () => {
    const matrix = buildAttendanceMatrix(
      "2026-09-07",
      2,
      new Map([
        ["2026-09-07", 8.2],
        ["2026-09-15", 7.5],
      ]),
    );
    expect(matrix.rows).toEqual(["w/c 7 Sep", "w/c 14 Sep"]);
    expect(matrix.columns).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(matrix.values[0][0]).toBe(8.2);
    expect(matrix.values[0][1]).toBeNull();
    expect(matrix.values[1][1]).toBe(7.5);
  });

  it("returns an empty matrix for an unusable start or week count", () => {
    expect(buildAttendanceMatrix("nope", 4, new Map())).toEqual({ rows: [], columns: [], values: [] });
    expect(buildAttendanceMatrix("2026-09-07", 0, new Map())).toEqual({ rows: [], columns: [], values: [] });
  });
});

describe("pickPayslip", () => {
  const rows = [
    { period: "2026-07" },
    { period: "2026-08" },
  ];

  it("prefers the current period when the engine has produced it", () => {
    const picked = pickPayslip([...rows, { period: "2026-09" }], "2026-09");
    expect(picked).toEqual({ payslip: { period: "2026-09" }, isCurrentPeriod: true });
  });

  it("falls back to the newest released period and says so", () => {
    expect(pickPayslip(rows, "2026-09")).toEqual({ payslip: { period: "2026-08" }, isCurrentPeriod: false });
  });

  it("produces nothing when no payslip exists", () => {
    expect(pickPayslip([], "2026-09")).toEqual({ payslip: null, isCurrentPeriod: false });
  });
});

describe("periodsCovering", () => {
  it("lists every period a range touches, oldest first", () => {
    expect(periodsCovering("2026-07-20", "2026-09-15")).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("crosses a year boundary", () => {
    expect(periodsCovering("2026-12-01", "2027-01-05")).toEqual(["2026-12", "2027-01"]);
  });

  it("returns nothing for an inverted or unusable range", () => {
    expect(periodsCovering("2026-09-15", "2026-07-20")).toEqual([]);
    expect(periodsCovering("bad", "2026-09-15")).toEqual([]);
  });
});

describe("weekCompletionPct", () => {
  it("reports the share of the target that has been logged", () => {
    expect(weekCompletionPct(1350, 2700)).toBe(50);
  });

  it("refuses to invent a percentage without a target", () => {
    expect(weekCompletionPct(1350, null)).toBeNull();
    expect(weekCompletionPct(1350, 0)).toBeNull();
  });
});
