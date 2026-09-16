import { describe, expect, it } from "vitest";

import { flattenTraces, type CalculationTrace } from "@/server/payroll/service";

const COMPONENT_IDS = {
  basic: "11111111-1111-1111-1111-111111111111",
  pf: "22222222-2222-2222-2222-222222222222",
};

describe("payslip calculation trace (SCR-053)", () => {
  it("records a root step with no parent", () => {
    const traces: CalculationTrace[] = [
      { code: "basic", node: "Basic from salary assignment", inputs: { assignmentBasicMinor: 5_000_000 }, output: 5_000_000, rule: null },
    ];
    const rows = flattenTraces(traces, COMPONENT_IDS);
    expect(rows).toHaveLength(1);
    expect(rows[0].parentId).toBeNull();
    expect(rows[0].componentId).toBe(COMPONENT_IDS.basic);
    expect(rows[0].attributes.output).toBe(5_000_000);
    expect(rows[0].attributes.node).toBe("Basic from salary assignment");
  });

  it("threads a child step to its parent so the line drills back through its intermediates", () => {
    const traces: CalculationTrace[] = [
      {
        code: "pf", node: "Provident fund", inputs: { pfWageMinor: 5_500_000, rate: 0.12 }, output: 660_000, rule: "pf.employeeRate",
        children: [{ code: "pf", node: "PF wage base", inputs: { basicMinor: 5_000_000, daMinor: 500_000 }, output: 5_500_000, rule: "pf.wageBase" }],
      },
    ];
    const rows = flattenTraces(traces, COMPONENT_IDS);
    expect(rows).toHaveLength(2);
    const [parent, child] = rows;
    expect(parent.parentId).toBeNull();
    expect(child.parentId).toBe(parent.id);
    expect(child.attributes.node).toBe("PF wage base");
    expect(child.attributes.rule).toBe("pf.wageBase");
  });

  it("stamps every step with the rule pack version that produced it", () => {
    const rows = flattenTraces(
      [{ code: "pf", node: "Provident fund", inputs: {}, output: 1, rule: "pf.employeeRate", children: [{ code: "pf", node: "PF wage base", inputs: {}, output: 2, rule: "pf.wageBase" }] }],
      COMPONENT_IDS,
    );
    for (const row of rows) expect(row.attributes.rule_pack_version).toBe("in-pay/v1");
  });

  it("gives every step a distinct id", () => {
    const rows = flattenTraces(
      [
        { code: "basic", node: "a", inputs: {}, output: 1, rule: null },
        { code: "pf", node: "b", inputs: {}, output: 2, rule: null, children: [{ code: "pf", node: "c", inputs: {}, output: 3, rule: null }] },
      ],
      COMPONENT_IDS,
    );
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves the component link null when the code has no component id", () => {
    const rows = flattenTraces([{ code: "unmapped", node: "x", inputs: {}, output: 0, rule: null }], COMPONENT_IDS);
    expect(rows[0].componentId).toBeNull();
  });

  it("returns nothing for an empty forest", () => {
    expect(flattenTraces([], COMPONENT_IDS)).toEqual([]);
  });
});
