import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Access } from "@/server/platform/access";

vi.mock("server-only", () => ({}));
const runNucleusTool = vi.fn();
vi.mock("@/server/ai/nucleus/analysis", () => ({ runNucleusTool: (...args: unknown[]) => runNucleusTool(...args) }));

const { runChat, buildChatInstruction } = await import("@/server/ai/nucleus/chat");
const { APP_SCREENS } = await import("@/server/ai/nucleus/app-knowledge");

const access: Access = {
  tenantId: "tenant-1",
  context: { actorUserId: "user-1", membershipId: "membership-1", tenantId: "tenant-1", employeeId: "employee-1", permissions: ["employee.read"], roles: ["hr-manager"] },
};

function modelReplies(...turns: unknown[][]): typeof fetch {
  const queue = [...turns];
  return vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: queue.shift() ?? [] } }] }), { status: 200 })) as unknown as typeof fetch;
}

describe("nucleus chat", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_API_KEY", "test-key");
    runNucleusTool.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("runs a read tool under the caller's access and returns its data with the answer", async () => {
    runNucleusTool.mockResolvedValue({ activeHeadcount: { available: true, value: 120 } });
    const fetcher = modelReplies([{ functionCall: { name: "workforce_analysis", args: { months: 3 } } }], [{ text: "Headcount is 120." }]);
    const reply = await runChat(access, { message: "headcount?", history: [], context: {} }, { fetcher, today: "2026-11-23" });
    expect(runNucleusTool).toHaveBeenCalledWith(access, "workforce_analysis", { months: 3 }, undefined);
    expect(reply.answer).toBe("Headcount is 120.");
    expect(reply.data).toEqual([{ tool: "workforce_analysis", args: { months: 3 }, result: { activeHeadcount: { available: true, value: 120 } } }]);
  });

  it("turns open_screen into a navigation target from the application map", async () => {
    const screen = APP_SCREENS[0];
    const fetcher = modelReplies([{ functionCall: { name: "open_screen", args: { screenId: screen.id } } }], [{ text: "Opened." }]);
    const reply = await runChat(access, { message: "open it", history: [], context: {} }, { fetcher });
    expect(reply.navigate).toMatchObject({ sub: screen.id, tab: screen.tab });
  });

  it("refuses tools outside the read set without running them", async () => {
    const fetcher = modelReplies([{ functionCall: { name: "apply_leave", args: {} } }], [{ text: "Open the leave form instead." }]);
    const reply = await runChat(access, { message: "apply leave", history: [], context: {} }, { fetcher });
    expect(runNucleusTool).not.toHaveBeenCalled();
    expect(reply.data).toEqual([]);
  });

  it("fails clearly when no model key is configured", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(runChat(access, { message: "hi", history: [], context: {} }, { fetcher: modelReplies() })).rejects.toThrow(/not configured/);
  });

  it("gives the model the current screen and the full application map", () => {
    const instruction = buildChatInstruction(access, { activeTab: "leave" }, "2026-11-23");
    expect(instruction).toContain('"leave"');
    expect(instruction).toContain(APP_SCREENS[0].id);
  });
});
