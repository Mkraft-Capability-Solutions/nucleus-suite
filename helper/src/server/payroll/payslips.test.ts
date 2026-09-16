import { describe, expect, it } from "vitest";

import { HttpError } from "@/server/platform/http";
import {
  PAYSLIP_ACTIONS,
  PAYSLIP_STATES,
  allowedPayslipActions,
  assertPayslipTransition,
  buildPayslipLines,
  buildTraceIndex,
  displayPayslipCode,
  nextPayslipState,
  normalizePayslipFilters,
  normalizePayslipState,
  payslipScopeFrom,
  payslipTimeline,
  transitionPayslipSchema,
  type CalculationTraceRow,
  type PayslipComponentView,
  type PayslipLineInput,
} from "./payslips";

const COMPONENTS: PayslipComponentView[] = [
  { id: "c-basic", code: "basic", kind: "earning", payslipLabel: "Basic", payslipSequence: 10, printOnPayslipWhenZero: true },
  { id: "c-hra", code: "hra", kind: "earning", payslipLabel: "House rent allowance", payslipSequence: 30, printOnPayslipWhenZero: true },
  { id: "c-conveyance", code: "conveyance", kind: "earning", payslipLabel: "Conveyance", payslipSequence: 40, printOnPayslipWhenZero: false },
  { id: "c-pf", code: "pf", kind: "deduction", payslipLabel: "Provident fund", payslipSequence: 110, printOnPayslipWhenZero: true },
  { id: "c-tds", code: "tds", kind: "deduction", payslipLabel: "TDS", payslipSequence: 140, printOnPayslipWhenZero: true },
  { id: "c-esi", code: "esi", kind: "deduction", payslipLabel: "ESI", payslipSequence: 120, printOnPayslipWhenZero: false },
  { id: "c-employer-pf", code: "employer_pf", kind: "employer_contribution", payslipLabel: "Employer PF", payslipSequence: 200, printOnPayslipWhenZero: false },
];

const LINES: PayslipLineInput[] = [
  { componentId: "c-pf", code: "pf", kind: "deduction", amountMinor: 180_000 },
  { componentId: "c-hra", code: "hra", kind: "earning", amountMinor: 2_000_000 },
  { componentId: "c-basic", code: "basic", kind: "earning", amountMinor: 5_000_000 },
  { componentId: "c-esi", code: "esi", kind: "deduction", amountMinor: 0 },
  { componentId: "c-tds", code: "tds", kind: "deduction", amountMinor: 0 },
  { componentId: "c-conveyance", code: "conveyance", kind: "earning", amountMinor: 0 },
];

describe("payslip distribution state machine (SCR-053)", () => {
  it("accepts only the four defined states and defaults anything else to generated", () => {
    expect([...PAYSLIP_STATES]).toEqual(["generated", "published", "viewed", "archived"]);
    for (const state of PAYSLIP_STATES) expect(normalizePayslipState(state)).toBe(state);
    expect(normalizePayslipState("PUBLISHED")).toBe("published");
    expect(normalizePayslipState("shredded")).toBe("generated");
    expect(normalizePayslipState(undefined)).toBe("generated");
  });

  it("walks generated to published to viewed to archived", () => {
    expect(nextPayslipState("generated", "publish")).toBe("published");
    expect(nextPayslipState("published", "view")).toBe("viewed");
    expect(nextPayslipState("viewed", "archive")).toBe("archived");
  });

  it("allows archiving straight from published, skipping viewed", () => {
    expect(nextPayslipState("published", "archive")).toBe("archived");
  });

  it("refuses every transition that is not on the defined path", () => {
    const illegal: Array<[string, (typeof PAYSLIP_ACTIONS)[number]]> = [
      ["generated", "view"],
      ["generated", "archive"],
      ["published", "publish"],
      ["viewed", "publish"],
      ["viewed", "view"],
      ["archived", "publish"],
      ["archived", "view"],
      ["archived", "archive"],
    ];
    for (const [from, action] of illegal) {
      expect(nextPayslipState(from, action), `${from} + ${action}`).toBeNull();
    }
  });

  it("rejects an illegal transition as a 409 naming the current and attempted state", () => {
    try {
      assertPayslipTransition("archived", "publish");
      throw new Error("the transition should have been refused");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const failure = error as HttpError;
      expect(failure.status).toBe(409);
      expect(failure.code).toBe("VERSION_CONFLICT");
      expect(failure.message).toContain("archived");
      expect(failure.message).toContain("published");
      expect(failure.details[0]?.field).toBe("action");
    }
  });

  it("returns the produced state for a legal transition instead of throwing", () => {
    expect(assertPayslipTransition("generated", "publish")).toBe("published");
  });

  it("reports exactly the actions that are legal right now, so no button is offered falsely", () => {
    expect(allowedPayslipActions("generated")).toEqual(["publish"]);
    expect(allowedPayslipActions("published")).toEqual(["view", "archive"]);
    expect(allowedPayslipActions("viewed")).toEqual(["archive"]);
    expect(allowedPayslipActions("archived")).toEqual([]);
  });

  it("parses only the three defined actions from a request body", () => {
    for (const action of PAYSLIP_ACTIONS) {
      expect(transitionPayslipSchema.safeParse({ action }).success).toBe(true);
    }
    expect(transitionPayslipSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(transitionPayslipSchema.safeParse({}).success).toBe(false);
    expect(transitionPayslipSchema.safeParse(null).success).toBe(false);
  });

  it("marks the timeline from recorded stamps, so an unviewed archive does not claim a view", () => {
    const timeline = payslipTimeline("archived", ["published", "archived"]);
    expect(timeline.map((step) => step.state)).toEqual(["done", "done", "todo", "current"]);
    expect(timeline.map((step) => step.label)).toEqual(["Generated", "Published", "Viewed", "Archived"]);
  });

  it("falls back to positional order when a row carries no stamps", () => {
    expect(payslipTimeline("viewed").map((step) => step.state)).toEqual(["done", "done", "current", "todo"]);
    expect(payslipTimeline("generated").map((step) => step.state)).toEqual(["current", "todo", "todo", "todo"]);
  });
});

describe("payslip line breakdown (SCR-053)", () => {
  it("orders lines by the component's payslip sequence, not by the order they were stored", () => {
    const breakdown = buildPayslipLines(LINES, COMPONENTS);
    expect(breakdown.earnings.map((line) => line.code)).toEqual(["basic", "hra"]);
    expect(breakdown.deductions.map((line) => line.code)).toEqual(["pf", "tds"]);
  });

  it("labels every line from the component master rather than from its code", () => {
    const breakdown = buildPayslipLines(LINES, COMPONENTS);
    expect(breakdown.earnings.map((line) => line.label)).toEqual(["Basic", "House rent allowance"]);
    expect(breakdown.deductions.map((line) => line.label)).toEqual(["Provident fund", "TDS"]);
  });

  it("suppresses a zero line unless its component prints on the payslip when zero", () => {
    const breakdown = buildPayslipLines(LINES, COMPONENTS);
    const codes = [...breakdown.earnings, ...breakdown.deductions].map((line) => line.code);
    // tds is zero but prints when zero; esi and conveyance are zero and do not.
    expect(codes).toContain("tds");
    expect(codes).not.toContain("esi");
    expect(codes).not.toContain("conveyance");
  });

  it("splits lines by the component kind and nets only earnings against deductions", () => {
    const breakdown = buildPayslipLines(
      [...LINES, { componentId: "c-employer-pf", code: "employer_pf", kind: "earning", amountMinor: 180_000 }],
      COMPONENTS,
    );
    expect(breakdown.earningsMinor).toBe(7_000_000);
    expect(breakdown.deductionsMinor).toBe(180_000);
    expect(breakdown.netMinor).toBe(6_820_000);
    // An employer contribution is shown but never netted into the employee's pay.
    expect(breakdown.informational.map((line) => line.code)).toEqual(["employer_pf"]);
  });

  it("falls back to the stored line code and kind when no component row matches", () => {
    const breakdown = buildPayslipLines(
      [{ componentId: null, code: "arrear", kind: "earning", amountMinor: 250_000 }],
      COMPONENTS,
    );
    expect(breakdown.earnings).toHaveLength(1);
    expect(breakdown.earnings[0]?.label).toBe("arrear");
    expect(breakdown.earnings[0]?.sequence).toBe(900);
  });

  it("reports a line with no recorded calculation as trace-absent instead of inventing one", () => {
    const breakdown = buildPayslipLines(LINES, COMPONENTS, {});
    for (const line of [...breakdown.earnings, ...breakdown.deductions]) {
      expect(line.traceAvailable).toBe(false);
      expect(line.trace).toBeNull();
    }
  });

  it("attaches the recorded calculation trace to the line whose component produced it", () => {
    const rows: CalculationTraceRow[] = [
      { id: "calc-1", parentId: null, componentId: "c-pf", attributes: { step: "pf.wage_base", amount_minor: 5_500_000 } },
      { id: "calc-2", parentId: "calc-1", componentId: "c-pf", attributes: { step: "pf.rate", rate: 0.12 } },
    ];
    const breakdown = buildPayslipLines(LINES, COMPONENTS, buildTraceIndex(rows));
    const pf = breakdown.deductions.find((line) => line.code === "pf");
    expect(pf?.traceAvailable).toBe(true);
    expect(pf?.trace?.[0]?.attributes.step).toBe("pf.wage_base");
    expect(pf?.trace?.[0]?.children[0]?.attributes.rate).toBe(0.12);
    expect(breakdown.earnings.find((line) => line.code === "basic")?.traceAvailable).toBe(false);
  });
});

describe("payslip calculation trace tree (SCR-053)", () => {
  it("nests children under their parent and keeps a parentless row as a root", () => {
    const index = buildTraceIndex([
      { id: "a", parentId: null, componentId: "c-basic", attributes: { step: "structure" } },
      { id: "b", parentId: "a", componentId: "c-basic", attributes: { step: "proration" } },
      { id: "c", parentId: "b", componentId: "c-basic", attributes: { step: "rounding" } },
    ]);
    expect(index["c-basic"]).toHaveLength(1);
    expect(index["c-basic"]?.[0]?.children[0]?.children[0]?.id).toBe("c");
  });

  it("treats a row whose parent is absent from the set as a root rather than dropping it", () => {
    const index = buildTraceIndex([
      { id: "orphan", parentId: "missing", componentId: "c-pf", attributes: {} },
    ]);
    expect(index["c-pf"]).toHaveLength(1);
  });

  it("yields no entry for a row with no component, so no line claims it", () => {
    expect(buildTraceIndex([{ id: "x", parentId: null, componentId: null, attributes: {} }])).toEqual({});
  });
});

describe("payslip retrieval filters (SCR-053, RL-350)", () => {
  it("accepts a period on its own", () => {
    const filters = normalizePayslipFilters({ period: "2026-03" });
    expect(filters.period).toBe("2026-03");
    expect(filters.runId).toBeNull();
  });

  it("accepts a run selector on its own", () => {
    const runId = "11111111-2222-4333-8444-555555555555";
    const filters = normalizePayslipFilters({ runId });
    expect(filters.runId).toBe(runId);
    expect(filters.period).toBeNull();
  });

  it("accepts a period and a run together, because one period holds several runs", () => {
    const runId = "11111111-2222-4333-8444-555555555555";
    const filters = normalizePayslipFilters({ period: "2026-03", runId });
    expect(filters).toEqual({ employeeId: null, period: "2026-03", runId, state: null });
  });

  it("drops a malformed period, identifier or state instead of passing it to the query", () => {
    expect(normalizePayslipFilters({ period: "March 2026" }).period).toBeNull();
    expect(normalizePayslipFilters({ runId: "not-a-uuid" }).runId).toBeNull();
    expect(normalizePayslipFilters({ employeeId: "42" }).employeeId).toBeNull();
    expect(normalizePayslipFilters({ state: "shredded" }).state).toBeNull();
    expect(normalizePayslipFilters({ state: "Published" }).state).toBe("published");
  });

  it("treats blank query parameters as no filter at all", () => {
    expect(normalizePayslipFilters({ period: "  ", runId: "", employeeId: null, state: undefined })).toEqual({
      employeeId: null,
      period: null,
      runId: null,
      state: null,
    });
  });
});

describe("payslip access scope (SCR-053)", () => {
  it("gives a payroll.read holder the whole tenant", () => {
    expect(payslipScopeFrom(["payroll.read"])).toBe("all");
    expect(payslipScopeFrom(["payroll.read", "payroll.run"])).toBe("all");
  });

  it("falls back to self only when payroll.read is absent, because net pay is sensitive", () => {
    expect(payslipScopeFrom([])).toBe("self");
    expect(payslipScopeFrom(["employee.read"])).toBe("self");
    expect(payslipScopeFrom(["payroll.run"])).toBe("self");
  });
});

describe("payslip display code (SCR-053)", () => {
  it("derives a stable code from the period and the row id", () => {
    expect(displayPayslipCode("2026-03", "abcd1234-0000-4000-8000-000000000000")).toBe("PS-2026-03-ABCD");
  });

  it("stays renderable when the period or the id is missing", () => {
    expect(displayPayslipCode("", "")).toBe("PS-----/---0000");
  });
});
