import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCapacityBars,
  buildSkillAxes,
  isPendingLeave,
  mondayOf,
  overlapsWindow,
  weekLabel,
  weekWindows,
} from "./manager-cockpit";

describe("manager cockpit date windows", () => {
  it("walks days in UTC so no local timezone shifts the date", () => {
    expect(addDays("2026-09-15", 1)).toBe("2026-09-16");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("snaps to the Monday on or before the date, including Sunday", () => {
    expect(mondayOf("2026-09-15")).toBe("2026-09-14"); // Tuesday
    expect(mondayOf("2026-09-14")).toBe("2026-09-14"); // Monday itself
    expect(mondayOf("2026-09-20")).toBe("2026-09-14"); // Sunday looks back six days
  });

  it("labels a window by the week commencing date", () => {
    expect(weekLabel("2026-09-14")).toBe("w/c 14 Sep");
  });

  it("builds Monday to Sunday windows starting with the current week", () => {
    const windows = weekWindows("2026-09-15", 4);
    expect(windows).toHaveLength(4);
    expect(windows[0]).toMatchObject({ start: "2026-09-14", end: "2026-09-20" });
    expect(windows[3]).toMatchObject({ start: "2026-10-05", end: "2026-10-11" });
  });

  it("returns no windows for an unusable date or count", () => {
    expect(weekWindows("not-a-date", 4)).toEqual([]);
    expect(weekWindows("2026-09-15", 0)).toEqual([]);
  });

  it("treats a range as overlapping when it touches the window at either edge", () => {
    const window = { start: "2026-09-14", end: "2026-09-20" };
    expect(overlapsWindow("2026-09-20", "2026-09-25", window)).toBe(true);
    expect(overlapsWindow("2026-09-01", "2026-09-14", window)).toBe(true);
    expect(overlapsWindow("2026-09-21", "2026-09-25", window)).toBe(false);
    expect(overlapsWindow(null, null, window)).toBe(false);
    expect(overlapsWindow("2026-09-16", null, window)).toBe(true);
  });
});

describe("buildCapacityBars", () => {
  const windows = weekWindows("2026-09-15", 2);
  const teamIds = ["a", "b", "c", "d"];

  it("returns nothing at all when there is no team to split", () => {
    expect(buildCapacityBars(windows, { teamIds: [], leaves: [], training: [], rosters: [] })).toEqual([]);
  });

  it("splits the head count into delivering, on leave and in training", () => {
    const bars = buildCapacityBars(windows, {
      teamIds,
      leaves: [{ employeeId: "a", startsOn: "2026-09-15", endsOn: "2026-09-17" }],
      training: [{ employeeId: "b", dueOn: "2026-09-18" }],
      rosters: [],
    });
    expect(bars[0]).toEqual({ label: "w/c 14 Sep", delivering: 2, onLeave: 1, inTraining: 1 });
    expect(bars[1]).toEqual({ label: "w/c 21 Sep", delivering: 4, onLeave: 0, inTraining: 0 });
  });

  it("never counts one person as both on leave and in training", () => {
    const bars = buildCapacityBars(windows, {
      teamIds: ["a", "b"],
      leaves: [{ employeeId: "a", startsOn: "2026-09-14", endsOn: "2026-09-20" }],
      training: [{ employeeId: "a", dueOn: "2026-09-16" }],
      rosters: [],
    });
    expect(bars[0]).toEqual({ label: "w/c 14 Sep", delivering: 1, onLeave: 1, inTraining: 0 });
  });

  it("uses the roster as the denominator when the roster covers the window", () => {
    const bars = buildCapacityBars(windows, {
      teamIds,
      leaves: [],
      training: [],
      rosters: [
        { employeeId: "a", startDate: "2026-09-14", endDate: "2026-09-20" },
        { employeeId: "b", startDate: "2026-09-14", endDate: "2026-09-20" },
      ],
    });
    expect(bars[0].delivering).toBe(2);
    expect(bars[1].delivering).toBe(4);
  });

  it("ignores people outside the team and undated training", () => {
    const bars = buildCapacityBars(windows, {
      teamIds: ["a"],
      leaves: [{ employeeId: "stranger", startsOn: "2026-09-15", endsOn: "2026-09-16" }],
      training: [{ employeeId: "a", dueOn: null }],
      rosters: [],
    });
    expect(bars[0]).toEqual({ label: "w/c 14 Sep", delivering: 1, onLeave: 0, inTraining: 0 });
  });
});

describe("buildSkillAxes", () => {
  it("reports verified and recorded coverage as percentages of the team", () => {
    const axes = buildSkillAxes(
      [
        { employeeId: "a", skill: "SQL", verified: true },
        { employeeId: "b", skill: "SQL", verified: false },
        { employeeId: "a", skill: "Payroll", verified: false },
      ],
      4,
    );
    expect(axes[0]).toEqual({ axis: "SQL", current: 25, comparison: 50 });
    expect(axes[1]).toEqual({ axis: "Payroll", current: 0, comparison: 25 });
  });

  it("counts a person once per skill however many evidence rows they have", () => {
    const axes = buildSkillAxes(
      [
        { employeeId: "a", skill: "SQL", verified: false },
        { employeeId: "a", skill: "SQL", verified: true },
      ],
      2,
    );
    expect(axes).toEqual([{ axis: "SQL", current: 50, comparison: 50 }]);
  });

  it("returns nothing rather than a zero web when the team is empty or unnamed", () => {
    expect(buildSkillAxes([{ employeeId: "a", skill: "SQL", verified: true }], 0)).toEqual([]);
    expect(buildSkillAxes([{ employeeId: "a", skill: "   ", verified: true }], 2)).toEqual([]);
  });

  it("caps the web at the requested number of axes, busiest first", () => {
    const rows = ["one", "two", "three", "four", "five", "six", "seven"].map((skill, index) => ({
      employeeId: `e${index}`,
      skill,
      verified: false,
    }));
    expect(buildSkillAxes(rows, 7, 6)).toHaveLength(6);
  });
});

describe("isPendingLeave", () => {
  it("recognises every stage of the approval chain as pending", () => {
    for (const status of ["pending_supervisor", "PENDING_HOD", " pending_hr ", "submitted"]) {
      expect(isPendingLeave(status)).toBe(true);
    }
  });

  it("does not treat a settled request as pending", () => {
    for (const status of ["approved", "rejected", "cancelled", null, undefined, ""]) {
      expect(isPendingLeave(status)).toBe(false);
    }
  });
});
