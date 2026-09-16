import { describe, expect, it, vi } from "vitest";
import { findAction } from "@/lib/ai/nucleus-catalog";
import { AWAITING_CONFIRMATION, createDispatcher, validateDraft, type ActionDraft } from "@/lib/ai/nucleus-dispatch";

/**
 * Slot-filling acceptance.
 *
 * The behaviour worth protecting is not that a valid call succeeds — it is that
 * an incomplete or wrong one comes back as a question rather than as a write, a
 * silent default, or a 400 the person never sees.
 */

const LEAVE = findAction("apply_leave")!;
const EMPLOYEE = "11111111-2222-4333-8444-555555555555";

function harness(overrides: Partial<Parameters<typeof createDispatcher>[0]> = {}) {
  const drafts: ActionDraft[] = [];
  const navigated: string[] = [];
  const dispatch = createDispatcher({
    analyze: vi.fn(async () => ({ ok: true })),
    onDraft: (draft) => drafts.push(draft),
    onNavigate: (moduleId) => navigated.push(moduleId),
    ...overrides,
  });
  return { dispatch, drafts, navigated };
}

describe("validating a spoken draft", () => {
  it("names every required field the person has not supplied", () => {
    const result = validateDraft(LEAVE, {});
    expect(result.missing.map((field) => field.field)).toEqual(["employeeId", "leaveType", "startsOn", "endsOn", "days"]);
    expect(result.body).toEqual({});
  });

  it("hands the model the options for a constrained field, so it can ask precisely", () => {
    const leaveType = validateDraft(LEAVE, {}).missing.find((field) => field.field === "leaveType");
    expect(leaveType?.options).toEqual(["EL", "CL", "SL", "COFF", "BIRTHDAY"]);
  });

  it("refuses a leave type outside the published set", () => {
    const result = validateDraft(LEAVE, { employeeId: EMPLOYEE, leaveType: "SABBATICAL", startsOn: "2026-09-21", endsOn: "2026-09-23", days: 3 });
    expect(result.invalid.map((field) => field.field)).toEqual(["leaveType"]);
  });

  it("refuses a date that was never resolved to a calendar date", () => {
    const result = validateDraft(LEAVE, { employeeId: EMPLOYEE, leaveType: "EL", startsOn: "next Monday", endsOn: "2026-09-23", days: 3 });
    expect(result.invalid[0]).toMatchObject({ field: "startsOn" });
    expect(result.invalid[0].issue).toContain("YYYY-MM-DD");
  });

  it("refuses an invented identifier instead of letting it reach the server as a not-found", () => {
    const result = validateDraft(LEAVE, { employeeId: "ravi-kumar", leaveType: "EL", startsOn: "2026-09-21", endsOn: "2026-09-23", days: 3 });
    expect(result.invalid[0]).toMatchObject({ field: "employeeId" });
    expect(result.invalid[0].issue).toContain("find_employee");
  });

  it("builds the body and records which values the person actually supplied", () => {
    const result = validateDraft(LEAVE, { employeeId: EMPLOYEE, leaveType: "EL", startsOn: "2026-09-21", endsOn: "2026-09-23", days: 3, reason: "Family event" });
    expect(result.missing).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.body).toMatchObject({ employeeId: EMPLOYEE, leaveType: "EL", startsOn: "2026-09-21", endsOn: "2026-09-23", days: 3, reason: "Family event" });
    expect(result.fields.every((field) => field.origin === "supplied")).toBe(true);
  });

  it("marks a value the catalog supplied, so the confirm card can say the person did not", () => {
    const withDefault = {
      ...LEAVE,
      operation: { ...LEAVE.operation, body: { kind: "object", fields: [{ name: "channel", kind: "text", default: "web" }] } },
    };
    const result = validateDraft(withDefault, {});
    expect(result.fields).toEqual([{ name: "channel", label: "Channel", value: "web", optional: false, origin: "default" }]);
  });
});

describe("dispatching a function call", () => {
  it("asks rather than writing when a required value is missing", async () => {
    const { dispatch, drafts } = harness();
    const [response] = await dispatch([{ id: "c1", name: "apply_leave", args: { leaveType: "EL" } }]);
    expect(response.response.status).toBe("needs_more_info");
    expect(drafts).toEqual([]);
  });

  it("raises a draft and tells the model nothing has been submitted", async () => {
    const { dispatch, drafts } = harness();
    const [response] = await dispatch([
      { id: "c2", name: "apply_leave", args: { employeeId: EMPLOYEE, leaveType: "CL", startsOn: "2026-09-21", endsOn: "2026-09-21", days: 1 } },
    ]);
    expect(response.response.status).toBe("awaiting_confirmation");
    expect(response.response.instruction).toBe(AWAITING_CONFIRMATION);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].body).toMatchObject({ leaveType: "CL", days: 1 });
  });

  it("forwards a read to the analyzer and returns its result", async () => {
    const analyze = vi.fn(async () => ({ activeHeadcount: { value: 42, available: true } }));
    const { dispatch } = harness({ analyze });
    const [response] = await dispatch([{ id: "c3", name: "workforce_analysis", args: { months: 6 } }]);
    expect(analyze).toHaveBeenCalledWith("workforce_analysis", { months: 6 });
    expect(response.response.result).toMatchObject({ activeHeadcount: { value: 42 } });
  });

  it("answers a tool that does not exist rather than leaving the turn open", async () => {
    const { dispatch } = harness();
    const [response] = await dispatch([{ id: "c4", name: "finalize_payroll", args: {} }]);
    expect(String(response.response.error)).toContain("no tool called finalize_payroll");
  });

  it("answers with the failure when a read throws, so the model is never left waiting", async () => {
    const { dispatch } = harness({ analyze: vi.fn(async () => { throw new Error("Payroll is outside your role."); }) });
    const [response] = await dispatch([{ id: "c5", name: "payroll_analysis", args: { months: 3 } }]);
    expect(response.response.error).toBe("Payroll is outside your role.");
  });

  it("navigates on request and reports where it went", async () => {
    const { dispatch, navigated } = harness();
    const [response] = await dispatch([{ id: "c6", name: "open_screen", args: { moduleId: "leave" } }]);
    expect(navigated).toEqual(["leave"]);
    expect(response.response.opened).toBe("leave");
  });

  it("answers every call in a batch, in order", async () => {
    const { dispatch } = harness();
    const responses = await dispatch([
      { id: "a", name: "open_screen", args: { moduleId: "people" } },
      { id: "b", name: "apply_leave", args: {} },
    ]);
    expect(responses.map((response) => response.id)).toEqual(["a", "b"]);
  });
});
