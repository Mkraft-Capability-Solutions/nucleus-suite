import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (value: string) => value }));

const h = await import("@/server/engagement/helpdesk");

describe("helpdesk ticket rules", () => {
  it("computes the SLA due time from priority", () => {
    expect(h.slaDueAt("2026-01-01T00:00:00.000Z", "urgent")).toBe("2026-01-01T02:00:00.000Z");
    expect(h.slaDueAt("2026-01-01T00:00:00.000Z", "low")).toBe("2026-01-03T00:00:00.000Z");
  });

  it("normalises legacy status and priority values", () => {
    expect(h.normalizeStatus("In Progress")).toBe("in_progress");
    expect(h.normalizeStatus("nonsense")).toBe("open");
    expect(h.normalizePriority("Critical")).toBe("urgent");
    expect(h.normalizePriority(undefined)).toBe("medium");
  });

  it("allows only listed transitions", () => {
    expect(h.canTransition("open", "resolved")).toBe(true);
    expect(h.canTransition("closed", "reopened")).toBe(true);
    expect(h.canTransition("closed", "in_progress")).toBe(false);
    expect(h.canTransition("resolved", "resolved")).toBe(true);
  });

  it("builds a stable reference", () => {
    expect(h.ticketReference("abcdef12-0000-0000-0000-000000000000", "2026-03-04T10:00:00Z")).toBe("HD-20260304-ABCDEF");
  });

  it("reads legacy messages and drops empty ones", () => {
    expect(h.normalizeMessage({ sender: "Asha", role: "Agent", text: "Hi" }, 2)).toEqual({ id: "legacy-2", authorName: "Asha", authorRole: "agent", text: "Hi", at: null, internal: false });
    expect(h.normalizeMessage({ text: "" }, 0)).toBeNull();
    expect(h.normalizeMessage(null, 0)).toBeNull();
  });

  it("maps legacy category labels to picklist slugs", () => {
    expect(h.toCategorySlug("Payroll and Taxes")).toBe("payroll");
  });
});
