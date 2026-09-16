import { describe, expect, it } from "vitest";
import {
  CAPABILITY_COMPONENT_LABELS,
  aggregateWellbeing,
  capabilityComponents,
  pointsBalance,
  reconcileIndex,
  reduceReaction,
  weightedIndex,
  type CapabilityComponent,
  type PointsScheme,
  type ReactionRow,
  type RewardTransaction,
  type WellbeingSample,
} from "@/server/engagement/experience";
import { MIN_ANONYMITY_COHORT } from "@/server/engagement/service";

const MCI_WEIGHTS = { performance: 25, skills: 25, learning: 20, engagement: 15, tenure: 15 };

function sample(energy: number, stress: number, workload: number): WellbeingSample {
  return { energy, stress, workload };
}

describe("wellbeing anonymity-cohort suppression", () => {
  it("suppresses a cohort of four and releases a cohort of five", () => {
    expect(MIN_ANONYMITY_COHORT).toBe(5);
    const four = [sample(4, 2, 3), sample(3, 3, 3), sample(5, 1, 2), sample(2, 4, 4)];
    const suppressed = aggregateWellbeing(four);
    expect(suppressed.cohortSize).toBe(4);
    expect(suppressed.suppressed).toBe(true);
    expect(suppressed.averages).toBeNull();

    const five = [...four, sample(1, 5, 5)];
    const released = aggregateWellbeing(five);
    expect(released.cohortSize).toBe(5);
    expect(released.suppressed).toBe(false);
    expect(released.averages).toEqual({ energy: 3, stress: 3, workload: 3.4 });
  });

  it("suppresses an empty and a single-person cohort", () => {
    expect(aggregateWellbeing([]).suppressed).toBe(true);
    expect(aggregateWellbeing([]).averages).toBeNull();
    expect(aggregateWellbeing([sample(5, 1, 1)]).averages).toBeNull();
  });

  it("drops averages entirely rather than rounding or noising them", () => {
    const result = aggregateWellbeing([sample(4, 4, 4), sample(4, 4, 4)]);
    expect(result.averages).toBeNull();
    expect(Object.values(result)).not.toContain(4);
  });

  it("uses the threshold it is given and still reports the true cohort size", () => {
    const three = [sample(3, 3, 3), sample(4, 2, 2), sample(5, 1, 1)];
    expect(aggregateWellbeing(three, 3).suppressed).toBe(false);
    expect(aggregateWellbeing(three, 4).suppressed).toBe(true);
    expect(aggregateWellbeing(three, 4).cohortSize).toBe(3);
  });

  it("averages only the dimensions that were actually answered", () => {
    const partial: WellbeingSample[] = [
      { energy: 4, stress: null, workload: 2 },
      { energy: 2, stress: null, workload: 4 },
      { energy: 3, stress: null, workload: 3 },
      { energy: 3, stress: null, workload: 3 },
      { energy: 3, stress: null, workload: 3 },
    ];
    expect(aggregateWellbeing(partial).averages).toEqual({ energy: 3, stress: null, workload: 3 });
  });
});

describe("one reaction per person per post", () => {
  const active: ReactionRow = { id: "r1", kind: "like", state: "active" };
  const withdrawn: ReactionRow = { id: "r1", kind: "like", state: "withdrawn" };

  it("creates the first reaction and is idempotent on repeat", () => {
    expect(reduceReaction(null, { op: "react", kind: "like" })).toEqual({ effect: "insert", kind: "like", reacted: true });
    expect(reduceReaction(active, { op: "react", kind: "like" })).toEqual({ effect: "noop", kind: "like", reacted: true });
  });

  it("never yields a second row when the reaction kind changes", () => {
    const changed = reduceReaction(active, { op: "react", kind: "celebrate" });
    expect(changed.effect).toBe("change_kind");
    expect(changed.reacted).toBe(true);
    expect(changed.kind).toBe("celebrate");
    expect(changed.effect).not.toBe("insert");
  });

  it("reverses a reaction and stays idempotent on repeated withdrawal", () => {
    expect(reduceReaction(active, { op: "withdraw", kind: "like" })).toEqual({ effect: "withdraw", kind: "like", reacted: false });
    expect(reduceReaction(withdrawn, { op: "withdraw", kind: "like" })).toEqual({ effect: "noop", kind: "like", reacted: false });
    expect(reduceReaction(null, { op: "withdraw", kind: "like" }).reacted).toBe(false);
  });

  it("reinstates the same row after a withdrawal instead of inserting", () => {
    const again = reduceReaction(withdrawn, { op: "react", kind: "kudos" });
    expect(again.effect).toBe("reinstate");
    expect(again.reacted).toBe(true);
  });

  it("keeps a react/withdraw cycle settled at one reaction, whatever the repeat count", () => {
    let row: ReactionRow = null;
    let count = 0;
    const apply = (op: "react" | "withdraw") => {
      const decision = reduceReaction(row, { op, kind: "like" });
      if (decision.effect === "insert") {
        row = { id: "r1", kind: decision.kind, state: "active" };
        count += 1;
      } else if (decision.effect === "reinstate" || decision.effect === "change_kind") {
        row = { id: "r1", kind: decision.kind, state: "active" };
        count = 1;
      } else if (decision.effect === "withdraw") {
        row = { id: "r1", kind: decision.kind, state: "withdrawn" };
        count = 0;
      }
    };
    apply("react");
    apply("react");
    apply("react");
    expect(count).toBe(1);
    apply("withdraw");
    apply("withdraw");
    expect(count).toBe(0);
    apply("react");
    expect(count).toBe(1);
  });
});

describe("recognition points balance from real transactions", () => {
  const scheme: PointsScheme[] = [{ programId: "p1", name: "Star of the month", points: 500 }];

  it("reports no balance at all when no points scheme is configured", () => {
    const transactions: RewardTransaction[] = [{ id: "t1", points: 500, reversesTransactionId: null }];
    const result = pointsBalance([], transactions);
    expect(result.configured).toBe(false);
    expect(result.balance).toBeNull();
    expect(result.balance).not.toBe(0);
    expect(result.transactionCount).toBe(1);
  });

  it("sums only the transactions that exist", () => {
    const result = pointsBalance(scheme, [
      { id: "t1", points: 500, reversesTransactionId: null },
      { id: "t2", points: 250, reversesTransactionId: null },
    ]);
    expect(result.configured).toBe(true);
    expect(result.balance).toBe(750);
    expect(result.reversed).toBe(0);
  });

  it("is zero, not null, when a scheme exists but nothing was awarded", () => {
    const result = pointsBalance(scheme, []);
    expect(result.balance).toBe(0);
    expect(result.transactionCount).toBe(0);
  });

  it("nets out a reversed award and its reversal row", () => {
    const result = pointsBalance(scheme, [
      { id: "t1", points: 500, reversesTransactionId: null },
      { id: "t2", points: 300, reversesTransactionId: null },
      { id: "t3", points: 500, reversesTransactionId: "t1" },
    ]);
    expect(result.balance).toBe(300);
    expect(result.reversed).toBe(500);
    expect(result.awarded).toBe(300);
  });

  it("ignores a reversal that points at an unknown transaction", () => {
    const result = pointsBalance(scheme, [
      { id: "t1", points: 400, reversesTransactionId: null },
      { id: "t9", points: 400, reversesTransactionId: "gone" },
    ]);
    expect(result.balance).toBe(400);
  });

  it("never invents a value for a transaction that carries no points", () => {
    const result = pointsBalance(scheme, [
      { id: "t1", points: null, reversesTransactionId: null },
      { id: "t2", points: 120, reversesTransactionId: null },
    ]);
    expect(result.balance).toBe(120);
    expect(result.unpricedCount).toBe(1);
  });
});

describe("capability index agrees with the components it displays", () => {
  const inputs = { performance: 80, skills: 70, learning: 90, engagement: 60, tenure: 50 };

  it("builds the five mci/v2 components in order and labels the fifth Tenure", () => {
    const components = capabilityComponents(inputs, MCI_WEIGHTS);
    expect(components.map((component) => component.key)).toEqual(["performance", "skills", "learning", "engagement", "tenure"]);
    expect(components[4]!.label).toBe("Tenure");
    expect(CAPABILITY_COMPONENT_LABELS.tenure).toBe("Tenure");
    expect(Object.values(CAPABILITY_COMPONENT_LABELS)).not.toContain("Leadership Readiness");
  });

  it("recomputes the index as the weighted sum of the displayed components", () => {
    const components = capabilityComponents(inputs, MCI_WEIGHTS);
    // 20 + 17.5 + 18 + 9 + 7.5 = 72, matching the persisted computeMci result.
    expect(components.map((component) => component.contribution)).toEqual([20, 17.5, 18, 9, 7.5]);
    expect(weightedIndex(components)).toBe(72);
  });

  it("accepts a persisted index that matches its components", () => {
    const components = capabilityComponents(inputs, MCI_WEIGHTS);
    const reconciled = reconcileIndex(72, components);
    expect(reconciled.agrees).toBe(true);
    expect(reconciled.index).toBe(72);
    expect(reconciled.recomputed).toBe(72);
    expect(reconciled.weightTotal).toBe(100);
  });

  it("refuses to agree when the headline number does not follow from the rows beneath it", () => {
    // The reference screen shows 88.4 over sub-scores whose own formula gives 87.8.
    const reference: CapabilityComponent[] = [
      { key: "performance", label: "Performance", value: 92, weight: 25, contribution: 23 },
      { key: "skills", label: "Skills", value: 88, weight: 25, contribution: 22 },
      { key: "learning", label: "Learning", value: 85, weight: 20, contribution: 17 },
      { key: "engagement", label: "Engagement", value: 90, weight: 15, contribution: 13.5 },
      { key: "tenure", label: "Tenure", value: 82, weight: 15, contribution: 12.3 },
    ];
    expect(weightedIndex(reference)).toBe(87.8);
    expect(reconcileIndex(88.4, reference).agrees).toBe(false);
    expect(reconcileIndex(87.8, reference).agrees).toBe(true);
  });

  it("rounds the recomputed index to two decimals like the persisted formula", () => {
    const components = capabilityComponents({ performance: 77, skills: 63, learning: 91, engagement: 55, tenure: 48 }, MCI_WEIGHTS);
    // 19.25 + 15.75 + 18.2 + 8.25 + 7.2 = 68.65.
    expect(weightedIndex(components)).toBe(68.65);
    expect(reconcileIndex(68.65, components).agrees).toBe(true);
  });

  it("drops a component the run never persisted rather than defaulting it to zero", () => {
    const components = capabilityComponents({ performance: 80, skills: 70 }, MCI_WEIGHTS);
    expect(components).toHaveLength(2);
    expect(reconcileIndex(37.5, components).weightTotal).toBe(50);
    expect(reconcileIndex(37.5, components).agrees).toBe(true);
  });
});
