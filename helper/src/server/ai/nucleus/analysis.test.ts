import { describe, expect, it } from "vitest";
import { bucketByMonth, clampMonths, headcountByMonth, trailingMonths, windowFor } from "@/server/ai/nucleus/analysis";
import { ratio, round1 } from "@/server/cockpits/source";

/**
 * Window arithmetic and the no-invented-values rule.
 *
 * "Six months" has to mean the same six months every time it is spoken, and a
 * figure with nothing behind it has to stay absent all the way through the
 * pipeline. Both are easy to get subtly wrong and impossible to notice in a
 * spoken answer, which is why they are pinned here.
 */

describe("spoken window", () => {
  it("defaults to six months when the model omits or garbles the number", () => {
    expect(clampMonths(undefined)).toBe(6);
    expect(clampMonths("half a year")).toBe(6);
    expect(clampMonths(null)).toBe(6);
  });

  it("keeps the window inside what the feeds can answer for", () => {
    expect(clampMonths(0)).toBe(1);
    expect(clampMonths(-3)).toBe(1);
    expect(clampMonths(120)).toBe(24);
    expect(clampMonths(6.7)).toBe(6);
  });

  it("returns the trailing months oldest first, including the current one", () => {
    expect(trailingMonths("2026-09-15", 6)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("crosses a year boundary without losing a month", () => {
    expect(trailingMonths("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("starts the window at the first day of the oldest month, so six months means six whole months", () => {
    expect(windowFor("2026-09-15", 6)).toMatchObject({ from: "2026-04-01", to: "2026-09-15", monthCount: 6 });
  });

  it("survives a month-end anchor that the previous month does not have", () => {
    expect(windowFor("2026-03-31", 2).from).toBe("2026-02-01");
  });
});

describe("bucketing records by month", () => {
  it("counts only dates that fall inside the window", () => {
    const months = ["2026-08", "2026-09"];
    expect(bucketByMonth(["2026-08-03", "2026-08-29", "2026-09-30", "2026-07-31"], months)).toEqual({ "2026-08": 2, "2026-09": 1 });
  });

  it("keeps an empty month present at zero, because zero here is a real count", () => {
    expect(bucketByMonth([], ["2026-08", "2026-09"])).toEqual({ "2026-08": 0, "2026-09": 0 });
  });

  it("ignores a record with no usable date rather than guessing one", () => {
    expect(bucketByMonth([null, undefined, "", "not-a-date"], ["2026-09"])).toEqual({ "2026-09": 0 });
  });
});

describe("deriving headcount backwards", () => {
  it("walks today's roster back through joiners and leavers", () => {
    const trend = headcountByMonth(["2026-07", "2026-08", "2026-09"], { "2026-08": 5, "2026-09": 2 }, { "2026-09": 1 }, 50);
    expect(trend.map((point) => point.headcount)).toEqual([44, 49, 50]);
  });

  it("never reports a negative headcount when the records are incomplete", () => {
    const trend = headcountByMonth(["2026-08", "2026-09"], { "2026-09": 400 }, {}, 10);
    expect(trend.every((point) => point.headcount >= 0)).toBe(true);
  });

  it("returns the closing figure unchanged when nothing moved", () => {
    expect(headcountByMonth(["2026-09"], {}, {}, 12)).toEqual([{ month: "2026-09", headcount: 12, joiners: 0, leavers: 0 }]);
  });
});

describe("refusing to invent a figure", () => {
  it("returns null, not zero, when there is nothing to divide by", () => {
    expect(ratio(0, 0)).toBeNull();
    expect(round1(ratio(3, 0))).toBeNull();
  });

  it("still reports a real measured zero", () => {
    expect(ratio(0, 40)).toBe(0);
  });
});
