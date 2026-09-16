import { describe, expect, it } from "vitest";

import {
  buildVarianceBridge,
  componentLabel,
  composeGross,
  describeFacts,
  varianceCategory,
  type EarningCell,
} from "./payroll-control-room";

function cell(runId: string, employeeId: string, code: string, amountMinor: number): EarningCell {
  return { runId, employeeId, code, amountMinor };
}

describe("varianceCategory", () => {
  it("names the movements the engine posts as their own component", () => {
    expect(varianceCategory("ot")).toBe("Overtime");
    expect(varianceCategory("overtime_extra")).toBe("Overtime");
    expect(varianceCategory("arrear")).toBe("Arrears");
  });

  it("folds every other component into recurring pay rather than guessing at it", () => {
    expect(varianceCategory("basic")).toBe("Recurring pay");
    expect(varianceCategory("hra")).toBe("Recurring pay");
    expect(varianceCategory("some_new_component")).toBe("Recurring pay");
  });
});

describe("buildVarianceBridge", () => {
  it("ties the opening base to the closing total through attributed movements only", () => {
    const prior = [
      cell("prior", "alice", "basic", 5_000_00),
      cell("prior", "alice", "hra", 2_000_00),
      cell("prior", "bob", "basic", 4_000_00),
    ];
    const current = [
      // Alice got a rise and some overtime.
      cell("current", "alice", "basic", 5_500_00),
      cell("current", "alice", "hra", 2_000_00),
      cell("current", "alice", "ot", 300_00),
      // Bob left; Chandra joined.
      cell("current", "chandra", "basic", 3_000_00),
    ];

    const bridge = buildVarianceBridge({ priorLabel: "Aug gross", currentLabel: "Sep gross", prior, current });

    expect(bridge.ties).toBe(true);
    expect(bridge.residualMinor).toBe(0);
    expect(bridge.bars[0]).toEqual({ label: "Aug gross", amountMinor: 11_000_00, kind: "base" });
    expect(bridge.bars[bridge.bars.length - 1]).toEqual({ label: "Sep gross", amountMinor: 10_800_00, kind: "total" });

    const movements = Object.fromEntries(
      bridge.bars.filter((bar) => bar.kind === "delta").map((bar) => [bar.label, bar.amountMinor]),
    );
    expect(movements.Joiners).toBe(3_000_00);
    expect(movements.Leavers).toBe(-4_000_00);
    expect(movements.Overtime).toBe(300_00);
    expect(movements["Recurring pay"]).toBe(500_00);
  });

  it("draws no movement bar when nothing moved", () => {
    const rows = [cell("prior", "alice", "basic", 1_000_00)];
    const bridge = buildVarianceBridge({
      priorLabel: "Aug",
      currentLabel: "Sep",
      prior: rows,
      current: [cell("current", "alice", "basic", 1_000_00)],
    });
    expect(bridge.bars).toHaveLength(2);
    expect(bridge.attributed).toEqual([]);
    expect(bridge.ties).toBe(true);
  });

  it("always states the movements a payroll run cannot evidence", () => {
    const bridge = buildVarianceBridge({ priorLabel: "Aug", currentLabel: "Sep", prior: [], current: [] });
    expect(bridge.omitted.map((entry) => entry.category)).toEqual(["Increments", "Loss of pay", "Reversals"]);
    for (const entry of bridge.omitted) expect(entry.reason.length).toBeGreaterThan(20);
  });

  it("orders the continuing movements by size so the largest mover reads first", () => {
    const bridge = buildVarianceBridge({
      priorLabel: "Aug",
      currentLabel: "Sep",
      prior: [cell("prior", "alice", "basic", 1_000_00), cell("prior", "alice", "ot", 900_00)],
      current: [cell("current", "alice", "basic", 1_100_00), cell("current", "alice", "ot", 100_00)],
    });
    const deltas = bridge.bars.filter((bar) => bar.kind === "delta");
    expect(deltas[0].label).toBe("Overtime");
    expect(deltas[0].amountMinor).toBe(-800_00);
    expect(deltas[1].label).toBe("Recurring pay");
    expect(bridge.ties).toBe(true);
  });
});

describe("composeGross", () => {
  it("sums each component across everyone and reports its share", () => {
    const slices = composeGross([
      cell("run", "alice", "basic", 6_000_00),
      cell("run", "bob", "basic", 2_000_00),
      cell("run", "alice", "hra", 2_000_00),
    ]);
    expect(slices).toHaveLength(2);
    expect(slices[0]).toEqual({ code: "basic", label: "Basic", amountMinor: 8_000_00, sharePct: 80 });
    expect(slices[1]).toEqual({ code: "hra", label: "House rent allowance", amountMinor: 2_000_00, sharePct: 20 });
  });

  it("refuses to invent a share when there is nothing to divide by", () => {
    const slices = composeGross([cell("run", "alice", "basic", 0)]);
    expect(slices[0].sharePct).toBeNull();
  });
});

describe("componentLabel", () => {
  it("uses the engine's own component names", () => {
    expect(componentLabel("da")).toBe("Dearness allowance");
  });

  it("humanises a component it does not know rather than hiding it", () => {
    expect(componentLabel("site_allowance")).toBe("Site allowance");
  });
});

describe("describeFacts", () => {
  it("prefers the reason the rule recorded", () => {
    expect(describeFacts({ reason: "No basic salary available for calculation." })).toBe(
      "No basic salary available for calculation.",
    );
  });

  it("renders the recorded facts verbatim when there is no reason", () => {
    expect(describeFacts({ minutes: 3700 })).toBe("minutes: 3700");
  });

  it("returns nothing when the rule recorded nothing", () => {
    expect(describeFacts(null)).toBe("");
    expect(describeFacts({})).toBe("");
  });
});
