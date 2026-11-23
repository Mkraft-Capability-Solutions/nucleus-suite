import { describe, expect, it } from "vitest";

import {
  averageProficiency,
  bandPosition,
  bucketRatings,
  competencyTargets,
  guidedCurve,
  proficiencyLevel,
} from "./performance-calibration";

describe("bucketRatings", () => {
  it("counts every submitted rating at the point it was given", () => {
    const counted = bucketRatings([
      { ratings: { delivery: 4, collaboration: 3 } },
      { ratings: { delivery: 4 } },
      { ratings: { delivery: 1, ownership: 5 } },
    ]);
    expect(counted.counts).toEqual([1, 0, 1, 2, 1]);
    expect(counted.ratingsCounted).toBe(5);
    expect(counted.ignored).toBe(0);
  });

  it("ignores a value off the scale instead of clamping it onto a neighbouring bucket", () => {
    const counted = bucketRatings([{ ratings: { delivery: 0, ownership: 9, judgement: "n/a", craft: 2.5 } }]);
    expect(counted.counts).toEqual([0, 0, 0, 0, 0]);
    expect(counted.ratingsCounted).toBe(0);
    expect(counted.ignored).toBe(4);
  });

  it("honours a wider configured scale", () => {
    const counted = bucketRatings([{ ratings: { a: 7 } }], 10);
    expect(counted.counts).toHaveLength(10);
    expect(counted.counts[6]).toBe(1);
  });

  it("survives a response with no ratings object", () => {
    const counted = bucketRatings([{ ratings: {} }]);
    expect(counted.ratingsCounted).toBe(0);
  });
});

describe("guidedCurve", () => {
  it("turns a configured share of the population into a comparable head count", () => {
    const curve = guidedCurve({ "1": 10, "2": 20, "3": 40, "4": 20, "5": 10 }, 200);
    expect(curve).not.toBeNull();
    expect(curve?.counts).toEqual([20, 40, 80, 40, 20]);
  });

  it("refuses a curve that does not cover the whole scale", () => {
    expect(guidedCurve({ "1": 50, "2": 50 }, 100)).toBeNull();
  });

  it("refuses a curve whose shares do not add up to a population", () => {
    expect(guidedCurve({ "1": 10, "2": 10, "3": 10, "4": 10, "5": 10 }, 100)).toBeNull();
  });

  it("refuses an out-of-range or non-numeric share", () => {
    expect(guidedCurve({ "1": -5, "2": 25, "3": 40, "4": 25, "5": 15 }, 100)).toBeNull();
    expect(guidedCurve({ "1": "a lot", "2": 25, "3": 40, "4": 25, "5": 5 }, 100)).toBeNull();
  });

  it("returns nothing at all when no policy is configured", () => {
    expect(guidedCurve(undefined, 100)).toBeNull();
    expect(guidedCurve(null, 100)).toBeNull();
  });
});

describe("proficiencyLevel", () => {
  it("reads the level the assessment recorded", () => {
    expect(proficiencyLevel("L3")).toBe(3);
    expect(proficiencyLevel("l5")).toBe(5);
  });

  it("returns nothing for an unrecorded or malformed level", () => {
    expect(proficiencyLevel(null)).toBeNull();
    expect(proficiencyLevel("expert")).toBeNull();
    expect(proficiencyLevel(3)).toBeNull();
  });
});

describe("averageProficiency", () => {
  it("averages only the rows that carry a recorded level", () => {
    const averages = averageProficiency([
      { department: "Engineering", skill: "TypeScript", proficiency: "L4" },
      { department: "Engineering", skill: "TypeScript", proficiency: "L2" },
      { department: "Engineering", skill: "TypeScript", proficiency: null },
      { department: "Sales", skill: "TypeScript", proficiency: "L1" },
    ]);
    const engineering = averages.find((entry) => entry.department === "Engineering");
    expect(engineering).toEqual({ department: "Engineering", skill: "TypeScript", average: 3, assessed: 2 });
    const sales = averages.find((entry) => entry.department === "Sales");
    expect(sales?.assessed).toBe(1);
  });

  it("orders by how well evidenced each average is", () => {
    const averages = averageProficiency([
      { department: "Sales", skill: "Negotiation", proficiency: "L3" },
      { department: "Engineering", skill: "Go", proficiency: "L3" },
      { department: "Engineering", skill: "Go", proficiency: "L4" },
    ]);
    expect(averages[0].skill).toBe("Go");
  });

  it("drops a row with no named skill", () => {
    expect(averageProficiency([{ department: "Ops", skill: "   ", proficiency: "L3" }])).toEqual([]);
  });
});

describe("competencyTargets", () => {
  it("keeps only benchmarks that sit on the scale", () => {
    const targets = competencyTargets({ TypeScript: 4, Negotiation: 0, Empathy: 9, "": 3 });
    expect([...targets.entries()]).toEqual([["TypeScript", 4]]);
  });

  it("is empty when no benchmark is configured", () => {
    expect(competencyTargets(undefined).size).toBe(0);
  });
});

describe("bandPosition", () => {
  it("places the bands low to high so the grid reads as a matrix", () => {
    expect(bandPosition("low")).toBe(1);
    expect(bandPosition("medium")).toBe(2);
    expect(bandPosition("high")).toBe(3);
  });
});
