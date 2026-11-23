import { describe, expect, it } from "vitest";
import { redesignedModuleForTab } from "@/lib/ui-mode";
import { templateSteps } from "@/server/lifecycle/service";
import { groupCases, type ClearanceItem } from "./data";
import { daysUntil, exitState, joinerState, progress, taskKey } from "./format";

const item = (patch: Partial<ClearanceItem>): ClearanceItem => ({
  id: "i", case_id: "c1", leaver_code: "TG1", leaver_name: "A", owner_code: "it", owner_name: null, item_name: "IT assets", blocking: false,
  cleared_on: null, recovery_amount_minor: null, recovery_description: null, waive_reason: null, status: "open", last_working_day: "2026-12-07",
  resigned_on: "2026-11-07", ff_state: null, case_status: "clearance_active", ...patch,
});

describe("joiners", () => {
  it("is ready once every required step is done", () => {
    const tasks = [{ required: true, status: "done" }, { required: false, status: "pending" }];
    expect(joinerState({ status: "active", total: 2, done: 1, tasks }).key).toBe("ready");
    expect(joinerState({ status: "active", total: 2, done: 0, tasks: [{ required: true, status: "pending" }, { required: true, status: "pending" }] }).key).toBe("not_started");
    expect(joinerState({ status: "active", total: 2, done: 1, tasks: [{ required: true, status: "done" }, { required: true, status: "pending" }] }).key).toBe("in_progress");
    expect(joinerState({ status: "active", total: 0, done: 0, tasks: [] }).key).toBe("no_steps");
    expect(joinerState({ status: "completed", total: 0, done: 0, tasks: [] }).key).toBe("ready");
    expect(progress({ total: 7, done: 5 })).toBe(71);
  });

  it("starts onboarding from the template's own steps", () => {
    expect(templateSteps([{ code: "T1", title: "Sign the offer" }, { key: "it", title: "Laptop", required: false, owner: "it" }, { title: "" }])).toEqual([
      { key: "T1", title: "Sign the offer", required: true, owner: "hr" },
      { key: "it", title: "Laptop", required: false, owner: "it" },
    ]);
    expect(templateSteps(null).length).toBeGreaterThan(0);
    expect(taskKey("Laptop and access card")).toBe("laptop-and-access-card");
  });
});

describe("exits", () => {
  it("groups clearance items by case and counts what is settled", () => {
    const cases = groupCases([item({ id: "a" }), item({ id: "b", status: "cleared" }), item({ id: "c", status: "waived", blocking: true }), item({ id: "d", blocking: true }), item({ id: "e", case_id: "c2", status: "cleared", case_status: "settled" })]);
    expect(cases).toHaveLength(2);
    const first = cases.find((entry) => entry.caseId === "c1")!;
    expect(first).toMatchObject({ settled: 2, blockingOpen: 1, settledCase: false });
    expect(cases.find((entry) => entry.caseId === "c2")!.settledCase).toBe(true);
  });

  it("allows settlement only when every item is cleared or waived", () => {
    expect(exitState({ settledCase: false, items: 3, settled: 3, blockingOpen: 0 }).canSettle).toBe(true);
    expect(exitState({ settledCase: false, items: 3, settled: 2, blockingOpen: 1 })).toMatchObject({ canSettle: false, label: "Clearance pending" });
    expect(exitState({ settledCase: true, items: 3, settled: 3, blockingOpen: 0 })).toMatchObject({ canSettle: false, label: "Settled" });
    expect(daysUntil("2026-12-07", "2026-11-23")).toBe(14);
    expect(daysUntil(null)).toBeNull();
  });

  it("shows onboarding & exit in Redesigned mode for the onboarding tab", () => {
    expect(redesignedModuleForTab("onboarding")).toBe("lifecycle");
  });
});
