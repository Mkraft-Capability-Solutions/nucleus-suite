import { describe, expect, it } from "vitest";
import {
  assertAcyclicCascade,
  checkSiblingWeights,
  createCascadingObjectiveSchema,
  deriveHealth,
  findParentCycle,
  HEALTH_NOT_CONFIGURED_REASON,
  keyResultProgressPct,
  linkObjectiveSchema,
  okrHealthThresholdsSchema,
  okrTreeWriteSchema,
  rollupObjectives,
  weightedMean,
  wouldCreateCycle,
  type ObjectiveInput,
} from "@/server/performance/okr";
import { HttpError } from "@/server/platform/http";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function objective(partial: Partial<ObjectiveInput> & { id: string }): ObjectiveInput {
  return {
    parentId: null,
    title: `Objective ${partial.id}`,
    ownerEmployeeId: null,
    weightPct: null,
    ownWeightPct: null,
    storedProgressPct: null,
    keyResults: [],
    ...partial,
  };
}

describe("key-result attainment", () => {
  it("is current over target as a clamped percentage", () => {
    expect(keyResultProgressPct({ current: 45, target: 90 })).toBe(50);
    expect(keyResultProgressPct({ current: 120, target: 100 })).toBe(100);
    expect(keyResultProgressPct({ current: -5, target: 100 })).toBe(0);
  });

  it("is undetermined rather than zero when the target cannot produce a percentage", () => {
    expect(keyResultProgressPct({ current: 10, target: 0 })).toBeNull();
    expect(keyResultProgressPct({ current: 10, target: -2 })).toBeNull();
    expect(keyResultProgressPct({ current: Number.NaN, target: 10 })).toBeNull();
  });
});

describe("weighted mean", () => {
  it("weights by the declared shares", () => {
    const result = weightedMean([
      { weightPct: 70, valuePct: 90 },
      { weightPct: 30, valuePct: 50 },
    ]);
    expect(result.pct).toBe(78);
    expect(result.weightMode).toBe("declared");
    expect(result.usedWeightSum).toBe(100);
  });

  it("falls back to equal weighting when any contributor has no declared weight", () => {
    const result = weightedMean([
      { weightPct: 70, valuePct: 90 },
      { weightPct: null, valuePct: 50 },
    ]);
    expect(result.pct).toBe(70);
    expect(result.weightMode).toBe("equal-fallback");
  });

  it("normalises by the weights that survive rather than counting a missing value as zero", () => {
    const result = weightedMean([
      { weightPct: 60, valuePct: 80 },
      { weightPct: 40, valuePct: null },
    ]);
    expect(result.pct).toBe(80);
    expect(result.usedWeightSum).toBe(60);
    expect(result.skippedUndetermined).toBe(1);
  });

  it("is undetermined when nothing contributes", () => {
    expect(weightedMean([]).pct).toBeNull();
    expect(weightedMean([{ weightPct: 100, valuePct: null }]).pct).toBeNull();
  });
});

describe("weighted rollup arithmetic", () => {
  it("rolls key-result progress up through the cascade by weight", () => {
    const tree: ObjectiveInput[] = [
      objective({ id: "root", weightPct: 100 }),
      objective({
        id: "childA",
        parentId: "root",
        weightPct: 60,
        keyResults: [
          { id: "kr1", title: "KR1", current: 90, target: 100, unit: "pct", weightPct: null },
          { id: "kr2", title: "KR2", current: 70, target: 100, unit: "pct", weightPct: null },
        ],
      }),
      objective({
        id: "childB",
        parentId: "root",
        weightPct: 40,
        keyResults: [{ id: "kr3", title: "KR3", current: 30, target: 100, unit: "pct", weightPct: null }],
      }),
    ];
    const { nodes } = rollupObjectives(tree, null);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(byId.get("childA")?.derivedProgressPct).toBe(80);
    expect(byId.get("childB")?.derivedProgressPct).toBe(30);
    // 0.6 * 80 + 0.4 * 30 = 60
    expect(byId.get("root")?.derivedProgressPct).toBe(60);
    expect(byId.get("root")?.progressSource).toBe("children");
  });

  it("weights key results inside one objective when their shares are declared", () => {
    const { nodes } = rollupObjectives(
      [
        objective({
          id: "solo",
          keyResults: [
            { id: "kr1", title: "KR1", current: 100, target: 100, unit: "pct", weightPct: 25 },
            { id: "kr2", title: "KR2", current: 40, target: 100, unit: "pct", weightPct: 75 },
          ],
        }),
      ],
      null,
    );
    expect(nodes[0].derivedProgressPct).toBe(55);
    expect(nodes[0].weightMode).toBe("declared");
  });

  it("shows the derived number when the stored literal disagrees with it", () => {
    const { nodes } = rollupObjectives(
      [
        objective({ id: "root", storedProgressPct: 82 }),
        objective({
          id: "child",
          parentId: "root",
          weightPct: 100,
          keyResults: [
            { id: "kr1", title: "KR1", current: 90, target: 100, unit: "pct", weightPct: null },
            { id: "kr2", title: "KR2", current: 80, target: 100, unit: "pct", weightPct: null },
          ],
        }),
      ],
      null,
    );
    const root = nodes.find((node) => node.id === "root");
    expect(root?.storedProgressPct).toBe(82);
    expect(root?.derivedProgressPct).toBe(85);
    expect(root?.storedDisagrees).toBe(true);
    expect(root?.notes.some((note) => note.includes("does not follow"))).toBe(true);
  });

  it("excludes a parent's own key results from its rollup unless their weight is recorded, and says so", () => {
    const tree: ObjectiveInput[] = [
      objective({ id: "root", keyResults: [{ id: "kr0", title: "own", current: 100, target: 100, unit: "pct", weightPct: null }] }),
      objective({ id: "child", parentId: "root", weightPct: 100, keyResults: [{ id: "kr1", title: "KR1", current: 20, target: 100, unit: "pct", weightPct: null }] }),
    ];
    const excluded = rollupObjectives(tree, null).nodes.find((node) => node.id === "root");
    expect(excluded?.derivedProgressPct).toBe(20);
    expect(excluded?.ownKeyResultProgressPct).toBe(100);
    expect(excluded?.notes.some((note) => note.includes("own key results are excluded"))).toBe(true);

    const weighted = rollupObjectives(
      tree.map((node) => (node.id === "root" ? { ...node, ownWeightPct: 50 } : { ...node, weightPct: 50 })),
      null,
    ).nodes.find((node) => node.id === "root");
    expect(weighted?.derivedProgressPct).toBe(60);
    expect(weighted?.progressSource).toBe("children-and-own-key-results");
  });

  it("leaves an objective with no measurable key result undetermined instead of zero", () => {
    const { nodes } = rollupObjectives(
      [
        objective({ id: "root" }),
        objective({ id: "measured", parentId: "root", weightPct: 50, keyResults: [{ id: "kr1", title: "KR1", current: 50, target: 100, unit: "pct", weightPct: null }] }),
        objective({ id: "empty", parentId: "root", weightPct: 50 }),
      ],
      null,
    );
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(byId.get("empty")?.derivedProgressPct).toBeNull();
    expect(byId.get("root")?.derivedProgressPct).toBe(50);
  });
});

describe("cycles in the parent chain", () => {
  it("finds a cycle and refuses the rollup", () => {
    const cyclic: ObjectiveInput[] = [
      objective({ id: "a", parentId: "c" }),
      objective({ id: "b", parentId: "a" }),
      objective({ id: "c", parentId: "b" }),
    ];
    const cycle = findParentCycle(cyclic.map((node) => ({ id: node.id, parentId: node.parentId })));
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(() => rollupObjectives(cyclic, null)).toThrow(HttpError);
    try {
      rollupObjectives(cyclic, null);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(422);
      expect((error as HttpError).code).toBe("POLICY_VIOLATION");
      expect((error as HttpError).details.length).toBeGreaterThan(0);
    }
  });

  it("catches an objective pointed at itself", () => {
    expect(findParentCycle([{ id: "a", parentId: "a" }])).toEqual(["a"]);
    expect(() => assertAcyclicCascade([{ id: "a", parentId: "a" }])).toThrow(HttpError);
  });

  it("accepts a forest and a deep chain", () => {
    expect(
      findParentCycle([
        { id: "a", parentId: null },
        { id: "b", parentId: "a" },
        { id: "c", parentId: "b" },
        { id: "d", parentId: null },
      ]),
    ).toBeNull();
    expect(() => assertAcyclicCascade([{ id: "a", parentId: null }, { id: "b", parentId: "a" }])).not.toThrow();
  });

  it("refuses a proposed edge that would close a loop", () => {
    const edges = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(wouldCreateCycle(edges, "a", "c")).toBe(true);
    expect(wouldCreateCycle(edges, "a", "a")).toBe(true);
    expect(wouldCreateCycle(edges, "c", null)).toBe(false);
    expect(wouldCreateCycle(edges, "b", null)).toBe(false);
  });
});

describe("sibling weights that do not sum to 100", () => {
  it("reports a mismatched set and keeps the rollup running over the weights declared", () => {
    const tree: ObjectiveInput[] = [
      objective({ id: "root" }),
      objective({ id: "a", parentId: "root", weightPct: 50, keyResults: [{ id: "kr1", title: "KR1", current: 100, target: 100, unit: "pct", weightPct: null }] }),
      objective({ id: "b", parentId: "root", weightPct: 30, keyResults: [{ id: "kr2", title: "KR2", current: 0, target: 100, unit: "pct", weightPct: null }] }),
    ];
    const { nodes, weightChecks } = rollupObjectives(tree, null);
    const check = weightChecks.find((entry) => entry.parentId === "root");
    expect(check?.status).toBe("mismatched");
    expect(check?.sumPct).toBe(80);
    expect(check?.message).toContain("80%");
    // 50/80 of 100 + 30/80 of 0 = 62.5 — normalised by the 80% actually declared.
    expect(nodes.find((node) => node.id === "root")?.derivedProgressPct).toBe(62.5);
  });

  it("reports a partly weighted set and weights it equally", () => {
    const checks = checkSiblingWeights([
      objective({ id: "root" }),
      objective({ id: "a", parentId: "root", weightPct: 100 }),
      objective({ id: "b", parentId: "root" }),
    ]);
    const check = checks.find((entry) => entry.parentId === "root");
    expect(check?.status).toBe("partial");
    expect(check?.declaredCount).toBe(1);
  });

  it("reports an unweighted set without complaining about a missing total", () => {
    const checks = checkSiblingWeights([objective({ id: "a" }), objective({ id: "b" })]);
    expect(checks[0].parentId).toBeNull();
    expect(checks[0].status).toBe("unweighted");
  });

  it("accepts a set that adds to 100", () => {
    const checks = checkSiblingWeights([
      objective({ id: "root" }),
      objective({ id: "a", parentId: "root", weightPct: 62.5 }),
      objective({ id: "b", parentId: "root", weightPct: 37.5 }),
    ]);
    expect(checks.find((entry) => entry.parentId === "root")?.status).toBe("valid");
  });
});

describe("health thresholds", () => {
  it("is undetermined when no threshold is configured", () => {
    const verdict = deriveHealth(91, null);
    expect(verdict.status).toBe("undetermined");
    expect(verdict.reason).toBe(HEALTH_NOT_CONFIGURED_REASON);
    const { nodes, thresholdsConfigured } = rollupObjectives(
      [objective({ id: "a", keyResults: [{ id: "kr", title: "KR", current: 95, target: 100, unit: "pct", weightPct: null }] })],
      null,
    );
    expect(thresholdsConfigured).toBe(false);
    expect(nodes[0].derivedProgressPct).toBe(95);
    expect(nodes[0].health.status).toBe("undetermined");
  });

  it("bands only against configured cut-offs", () => {
    const thresholds = { greenAtOrAbovePct: 80, amberAtOrAbovePct: 60 };
    expect(deriveHealth(80, thresholds).status).toBe("green");
    expect(deriveHealth(79.9, thresholds).status).toBe("amber");
    expect(deriveHealth(60, thresholds).status).toBe("amber");
    expect(deriveHealth(59.9, thresholds).status).toBe("red");
    expect(deriveHealth(null, thresholds).status).toBe("undetermined");
  });

  it("refuses a threshold pair that is not ordered", () => {
    expect(okrHealthThresholdsSchema.safeParse({ greenAtOrAbovePct: 80, amberAtOrAbovePct: 60 }).success).toBe(true);
    expect(okrHealthThresholdsSchema.safeParse({ greenAtOrAbovePct: 60, amberAtOrAbovePct: 80 }).success).toBe(false);
    expect(okrHealthThresholdsSchema.safeParse({ greenAtOrAbovePct: 60, amberAtOrAbovePct: 60 }).success).toBe(false);
    expect(okrHealthThresholdsSchema.safeParse({ greenAtOrAbovePct: null, amberAtOrAbovePct: null }).success).toBe(false);
  });
});

describe("write payloads", () => {
  it("accepts a cascading objective with weights and key results", () => {
    const parsed = createCascadingObjectiveSchema.safeParse({
      mode: "create",
      title: "Lift plant OEE",
      ownerEmployeeId: UUID_A,
      parentObjectiveId: UUID_B,
      weightPct: 40,
      keyResults: [{ title: "OEE to 85", target: 85 }],
    });
    expect(parsed.success).toBe(true);
    expect(createCascadingObjectiveSchema.safeParse({ mode: "create", title: "", ownerEmployeeId: UUID_A }).success).toBe(false);
    expect(createCascadingObjectiveSchema.safeParse({ mode: "create", title: "x", ownerEmployeeId: UUID_A, weightPct: 140 }).success).toBe(false);
  });

  it("accepts a link that detaches an objective and routes both modes through the union", () => {
    expect(linkObjectiveSchema.safeParse({ mode: "link", objectiveId: UUID_A, parentObjectiveId: null }).success).toBe(true);
    expect(linkObjectiveSchema.safeParse({ mode: "link", objectiveId: UUID_A, parentObjectiveId: "not-a-uuid" }).success).toBe(false);
    expect(okrTreeWriteSchema.safeParse({ mode: "link", objectiveId: UUID_A, parentObjectiveId: UUID_B, weightPct: 25 }).success).toBe(true);
    expect(okrTreeWriteSchema.safeParse({ mode: "unknown" }).success).toBe(false);
  });
});
