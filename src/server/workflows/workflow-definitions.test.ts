import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (value: string) => value }));

const wf = await import("@/server/workflows/workflow-definitions");

type S = { key: string; type: "trigger" | "condition" | "approval" | "action" | "integration"; title: string; slaHours: number | null; operator: string | null };
const s = (key: string, type: S["type"], extra: Partial<S> = {}): S => ({ key, type, title: key, slaHours: null, operator: null, ...extra });

describe("workflow trace", () => {
  it("reports a runnable linear path", () => {
    const trace = wf.traceWorkflow([s("t", "trigger"), s("a", "approval", { slaHours: 24 }), s("x", "action")]);
    expect(trace.runnable).toBe(true);
    expect(trace.path.map((step) => step.next)).toEqual(["a", "x", null]);
  });

  it("flags every structural issue", () => {
    const codes = wf.traceWorkflow([s("a", "approval"), s("t", "trigger"), s("c", "condition")]).issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["first_not_trigger", "extra_trigger", "approval_without_sla", "condition_without_operator", "no_terminal_action"]));
    expect(wf.traceWorkflow([s("t", "trigger")]).issues.map((issue) => issue.code)).toContain("too_short");
  });

  it("blocks saving invalid steps but allows an unfinished draft", () => {
    expect(() => wf.assertSavable([s("a", "approval")])).toThrow();
    expect(() => wf.assertSavable([s("t", "trigger")])).not.toThrow();
  });

  it("assigns unique step keys", () => {
    const keys = wf.assignKeys([
      { type: "trigger", title: "T", description: "", slaHours: null, operator: null, key: "dup" },
      { type: "action", title: "A", description: "", slaHours: null, operator: null, key: "dup" },
      { type: "action", title: "B", description: "", slaHours: null, operator: null },
    ]).map((step) => step.key);
    expect(new Set(keys).size).toBe(3);
  });
});
