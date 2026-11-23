import { describe, expect, it } from "vitest";
import {
  addDays,
  attritionTone,
  buildFlowGraph,
  buildRadarAxes,
  crossTab,
  dedupeExits,
  headcountTrend,
  healthIndex,
  inWindow,
  leaveDaysInWindow,
  separationRate,
  shiftMonths,
} from "./people-command-centre";
import type { ClearanceBoardRow } from "@/server/lifecycle/clearance-board";

function clearanceRow(overrides: Partial<ClearanceBoardRow>): ClearanceBoardRow {
  return {
    id: "item-1",
    case_id: "case-1",
    leaver_code: "E-1",
    leaver_name: "A Leaver",
    owner_code: null,
    owner_name: null,
    item_name: "Laptop",
    blocking: true,
    cleared_on: null,
    status: "open",
    last_working_day: "2026-03-31",
    resigned_on: null,
    ff_state: null,
    recovery_amount_minor: null,
    waive_reason: null,
    recovery_description: null,
    ...overrides,
  };
}

describe("attritionTone", () => {
  it("applies the specification bands at their boundaries", () => {
    expect(attritionTone(7.9)).toBe("success");
    expect(attritionTone(8)).toBe("warning");
    expect(attritionTone(12)).toBe("warning");
    expect(attritionTone(12.1)).toBe("danger");
  });

  it("stays neutral rather than green when there is no measurement", () => {
    expect(attritionTone(null)).toBe("neutral");
    expect(attritionTone(Number.NaN)).toBe("neutral");
  });
});

describe("shiftMonths and addDays", () => {
  it("clamps to the shorter month's last day", () => {
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("walks whole years backwards", () => {
    expect(shiftMonths("2026-09-15", -12)).toBe("2025-09-15");
  });

  it("steps days across a month boundary", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(shiftMonths("not-a-date", -1)).toBe("not-a-date");
    expect(addDays("", 3)).toBe("");
  });
});

describe("inWindow", () => {
  it("is inclusive at both ends and rejects blank or partial dates", () => {
    expect(inWindow("2026-01-01", "2026-01-01", "2026-12-31")).toBe(true);
    expect(inWindow("2026-12-31", "2026-01-01", "2026-12-31")).toBe(true);
    expect(inWindow("2025-12-31", "2026-01-01", "2026-12-31")).toBe(false);
    expect(inWindow(null, "2026-01-01", "2026-12-31")).toBe(false);
    expect(inWindow("2026-01", "2026-01-01", "2026-12-31")).toBe(false);
  });
});

describe("separationRate", () => {
  it("divides exits by everyone exposed to leaving", () => {
    expect(separationRate(10, 90)).toBe(10);
    expect(separationRate(0, 40)).toBe(0);
  });

  it("refuses to invent a rate with nobody in the denominator", () => {
    expect(separationRate(0, 0)).toBeNull();
  });
});

describe("headcountTrend", () => {
  it("walks today's roster backwards through joiners and leavers", () => {
    const points = headcountTrend(
      ["2026-07", "2026-08", "2026-09"],
      { "2026-08": 4, "2026-09": 2 },
      { "2026-09": 5 },
      100,
    );
    expect(points.map((point) => point.label)).toEqual(["2026-07", "2026-08", "2026-09"]);
    // September closes at today's roster; August closes before September's net -3.
    expect(points.map((point) => point.left)).toEqual([99, 103, 100]);
    expect(points.map((point) => point.right)).toEqual([0, 4, -3]);
  });

  it("sorts the months it is handed and returns nothing for an empty period", () => {
    expect(headcountTrend([], {}, {}, 50)).toEqual([]);
    expect(headcountTrend(["2026-02", "2026-01"], {}, {}, 10).map((point) => point.label)).toEqual(["2026-01", "2026-02"]);
  });

  it("never reports a negative historical headcount", () => {
    expect(headcountTrend(["2026-01"], { "2026-01": 400 }, {}, 10)[0].left).toBe(10);
  });
});

describe("crossTab", () => {
  const people = [
    { department: "Spinning", location: "Unit 1", separated: true },
    { department: "Spinning", location: "Unit 1", separated: false },
    { department: "Spinning", location: "Unit 2", separated: false },
    { department: "Weaving", location: "Unit 1", separated: false },
  ];

  it("counts the measured rows per cell", () => {
    const matrix = crossTab(people, (row) => row.department, (row) => row.location, (row) => row.separated);
    expect(matrix.rows).toEqual(["Spinning", "Weaving"]);
    expect(matrix.columns).toEqual(["Unit 1", "Unit 2"]);
    expect(matrix.values[0]).toEqual([1, 0]);
  });

  it("leaves a cell with nobody in it as no reading, not as zero", () => {
    const matrix = crossTab(people, (row) => row.department, (row) => row.location, (row) => row.separated);
    expect(matrix.values[1]).toEqual([0, null]);
  });

  it("falls back to Unassigned for a blank key", () => {
    const matrix = crossTab([{ d: "", l: "" }], (row) => row.d, (row) => row.l, () => false);
    expect(matrix.rows).toEqual(["Unassigned"]);
    expect(matrix.columns).toEqual(["Unassigned"]);
  });
});

describe("buildRadarAxes", () => {
  it("keeps only the dimensions measurable in both windows", () => {
    const { axes, omitted } = buildRadarAxes([
      { axis: "Retention", current: 92, comparison: 88, missingReason: "no exits" },
      { axis: "Parity", current: null, comparison: null, missingReason: "no band midpoints" },
      { axis: "Capability", current: 61, comparison: null, missingReason: "no prior baseline" },
    ]);
    expect(axes).toEqual([{ axis: "Retention", current: 92, comparison: 88 }]);
    expect(omitted.map((entry) => entry.axis)).toEqual(["Parity", "Capability"]);
    expect(omitted[0].reason).toBe("no band midpoints");
  });

  it("never draws more than six axes", () => {
    const candidates = Array.from({ length: 9 }, (_unused, index) => ({
      axis: `Axis ${index}`,
      current: 50,
      comparison: 50,
      missingReason: "n/a",
    }));
    expect(buildRadarAxes(candidates).axes).toHaveLength(6);
  });
});

describe("healthIndex", () => {
  it("averages the axes that resolved", () => {
    expect(healthIndex([
      { axis: "a", current: 90, comparison: 0 },
      { axis: "b", current: 81, comparison: 0 },
    ])).toBe(85.5);
  });

  it("returns null rather than zero for an empty web", () => {
    expect(healthIndex([])).toBeNull();
  });
});

describe("dedupeExits", () => {
  it("collapses the clearance board to one record per offboarding case", () => {
    const exits = dedupeExits([
      clearanceRow({ id: "i1", case_id: "c1" }),
      clearanceRow({ id: "i2", case_id: "c1" }),
      clearanceRow({ id: "i3", case_id: "c2", leaver_code: "E-2", last_working_day: null }),
    ]);
    expect(exits).toEqual([
      { code: "E-1", lastWorkingDay: "2026-03-31" },
      { code: "E-2", lastWorkingDay: null },
    ]);
  });
});

describe("buildFlowGraph", () => {
  it("wires every inflow and outflow through the centre node", () => {
    const graph = buildFlowGraph(
      [{ label: "External hires", value: 12 }, { label: "Internal transfers", value: 3 }],
      "Active workforce",
      [{ label: "Resignation", value: 7 }],
    );
    expect(graph.nodes.map((node) => node.name)).toEqual(["External hires", "Internal transfers", "Active workforce", "Resignation"]);
    expect(graph.centreIndex).toBe(2);
    expect(graph.links).toEqual([
      { source: 0, target: 2, value: 12 },
      { source: 1, target: 2, value: 3 },
      { source: 2, target: 3, value: 7 },
    ]);
  });

  it("drops arms that carry no movement rather than drawing an empty band", () => {
    const graph = buildFlowGraph([{ label: "Rehires", value: 0 }], "Active workforce", [{ label: "Exits", value: 4 }]);
    expect(graph.nodes.map((node) => node.name)).toEqual(["Active workforce", "Exits"]);
    expect(graph.centreIndex).toBe(0);
    expect(graph.links).toEqual([{ source: 0, target: 1, value: 4 }]);
  });
});

describe("leaveDaysInWindow", () => {
  it("counts only the part of a span that falls inside the window", () => {
    expect(
      leaveDaysInWindow([{ startsOn: "2026-08-30", endsOn: "2026-09-03", days: 5 }], "2026-09-01", "2026-09-30"),
    ).toBe(3);
  });

  it("ignores a span that never touches the window or has no start", () => {
    expect(leaveDaysInWindow([{ startsOn: "2026-01-01", endsOn: "2026-01-02", days: 2 }], "2026-09-01", "2026-09-30")).toBe(0);
    expect(leaveDaysInWindow([{ startsOn: null, endsOn: "2026-09-02", days: 2 }], "2026-09-01", "2026-09-30")).toBe(0);
  });

  it("never counts more days than the request itself recorded", () => {
    expect(leaveDaysInWindow([{ startsOn: "2026-09-01", endsOn: "2026-09-10", days: 6 }], "2026-09-01", "2026-09-30")).toBe(6);
  });
});
