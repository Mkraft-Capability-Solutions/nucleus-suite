import { describe, expect, it } from "vitest";
import { bridgePanel, matrixPanel, radarPanel, scatterPanel, forbidden } from "./compose";
import { GUIDED_DISTRIBUTION, NINE_BOX, calibrationFlags, helpdeskSla, performanceBand } from "./boards/extras";

const person = (name: string, rating: number, managerId: string | null, extra: Partial<{ joinedDays: number; exiting: boolean; manager: string }> = {}) => ({
  name, rating, managerId, manager: extra.manager ?? (managerId ? `Manager ${managerId}` : null), potential: 2, joinedDays: extra.joinedDays ?? 800, exiting: extra.exiting ?? false, department: "Engineering",
});

describe("classic console panels: builders", () => {
  it("decide empty states from the data", () => {
    const common = { id: "x", title: "X", span: 6 as const, emptyMessage: "None" };
    expect(matrixPanel(common, { rows: ["High"], cols: ["Low"], rowAxis: "P", colAxis: "Q" }, [{ row: 0, col: 0, label: "A", value: 0 }]).state).toBe("empty");
    expect(radarPanel(common, [{ name: "A", max: 5 }, { name: "B", max: 5 }], [{ name: "S", data: [1, 2] }]).state).toBe("empty");
    expect(radarPanel(common, [{ name: "A", max: 5 }, { name: "B", max: 5 }, { name: "C", max: 5 }], [{ name: "S", data: [1, 2, 3] }]).state).toBe("ok");
    expect(scatterPanel(common, { xLabel: "x", yLabel: "y", xFormat: "count", yFormat: "count" }, [{ x: 1, y: 1, label: "a", group: "g" }]).state).toBe("empty");
    expect(bridgePanel(common, [{ name: "Start", value: 10, total: true }, { name: "End", value: 10, total: true }]).state).toBe("ok");
    expect(bridgePanel(common, []).state).toBe("empty");
    expect(forbidden({ ...common, kind: "matrix" }).state).toBe("forbidden");
  });
});

describe("nine-box and ratings", () => {
  it("bands performance and covers every box once", () => {
    expect([1, 2, 3, 4, 5].map(performanceBand)).toEqual([0, 0, 1, 2, 2]);
    expect(new Set(NINE_BOX.map((box) => `${box.row}:${box.col}`)).size).toBe(9);
    expect(NINE_BOX.find((box) => box.row === 0 && box.col === 2)?.label).toBe("Star");
    expect(NINE_BOX.find((box) => box.row === 2 && box.col === 0)?.label).toBe("Risk");
    expect(GUIDED_DISTRIBUTION.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1);
  });

  it("flags flat, lenient and departing-top-performer patterns, and stays quiet otherwise", () => {
    const rows = [
      person("A", 3, "m1"), person("B", 3, "m1"), person("C", 3, "m1"),
      person("D", 5, "m2"), person("E", 5, "m2"), person("F", 4, "m2", { exiting: true }),
      person("G", 2, "m3"), person("H", 3, "m3"), person("I", 2, "m3"),
    ];
    const labels = calibrationFlags(rows).map((flag) => flag.label);
    expect(labels).toContain("Rating flatline");
    expect(labels).toContain("Lenient rating pattern");
    expect(labels).toContain("Severe rating pattern");
    expect(labels).toContain("Top-box flight risk");
    expect(calibrationFlags([person("A", 3, "m1"), person("B", 4, "m1"), person("C", 2, "m1")])).toEqual([]);
  });

  it("flags lower ratings for people in their first year", () => {
    const rows = [person("A", 4, null), person("B", 4, null), person("C", 2, null, { joinedDays: 120 }), person("D", 3, null, { joinedDays: 200 })];
    expect(calibrationFlags(rows).map((flag) => flag.label)).toEqual(["Tenure skew"]);
  });
});

describe("helpdesk service levels", () => {
  it("measures first response and resolution against the targets by priority", () => {
    const at = (hours: number) => new Date(Date.UTC(2026, 10, 1) + hours * 3_600_000).toISOString();
    const result = helpdeskSla([
      { status: "RESOLVED", priority: "HIGH", created: at(0), updated: at(30), firstReply: at(4) },
      { status: "CLOSED", priority: "LOW", created: at(0), updated: at(300), firstReply: at(60) },
      { status: "OPEN", priority: "URGENT", created: at(0), updated: at(1), firstReply: null },
    ], Date.parse(at(48)));
    expect(result).toMatchObject({ total: 3, responded: 2, respondedOnTime: 1, resolved: 2, resolvedOnTime: 1, overdueOpen: 1 });
  });
});

describe("people command centre", () => {
  it("bands attrition and models headcount from what is committed plus the yearly run-rate", async () => {
    const { attritionLevel, headcountModel } = await import("./boards/people");
    expect([5, 10, 19.9, 20, 66].map(attritionLevel)).toEqual(["positive", "attention", "attention", "risk", "risk"]);
    const flat = headcountModel([40, 41], [0, 0, 0]);
    expect(flat).toEqual([{ centre: 40, lower: 40, upper: 40 }, { centre: 41, lower: 41, upper: 41 }]);
    const varied = headcountModel([40, 40], [1, -1, 1, -1]);
    expect(varied[0]!.centre).toBe(40);
    expect(varied[1]!.upper - varied[1]!.lower).toBeGreaterThan(varied[0]!.upper - varied[0]!.lower);
  });

  it("scores organisation health from the window's records, leaving unmeasured parts empty", async () => {
    const { healthScores, payQuadrant } = await import("./boards/extras");
    expect(healthScores({ leavers: 2, at_start: 40, required: 50, met: 40, engagement: 0.75, manager: null, moves: 5, hires: 15, female: 15, male: 25 }))
      .toEqual([95, 80, 75, 25, null, 75]);
    expect(healthScores({})).toEqual([null, null, null, null, null, null]);
    expect(payQuadrant(110, 4, 3.5)).toBe("Paid and performing");
    expect(payQuadrant(90, 4, 3.5)).toBe("Pay behind performance");
    expect(payQuadrant(110, 3, 3.5)).toBe("Pay ahead of performance");
    expect(payQuadrant(90, 3, 3.5)).toBe("Developing");
  });

  it("keeps only the flows that carry people", async () => {
    const { sankeyPanel } = await import("./compose");
    const panel = sankeyPanel({ id: "f", title: "F", span: 6, emptyMessage: "None" },
      [{ name: "In", value: 2, side: "in", hue: 0 }, { name: "Core", value: 9, side: "core", hue: 2 }, { name: "Out", value: 0, side: "out", hue: 7 }],
      [{ source: "In", target: "Core", value: 2 }, { source: "Core", target: "Out", value: 0 }]);
    expect(panel.state).toBe("ok");
    expect(panel.nodes.map((node) => node.name)).toEqual(["In", "Core"]);
    expect(sankeyPanel({ id: "f", title: "F", span: 6, emptyMessage: "None" }, [], []).state).toBe("empty");
  });
});

describe("findings", () => {
  it("lead with what to act on, then what to watch, then good news, then context", async () => {
    const { rankInsights } = await import("./compose");
    const ranked = rankInsights(["context", { text: "good", tone: "positive" }, { text: "watch", tone: "attention" }, { text: "act", tone: "risk" }, { text: "info", tone: "info" }]);
    expect(ranked.map((item) => (typeof item === "string" ? item : item.text))).toEqual(["act", "watch", "good", "context", "info"]);
  });
});
