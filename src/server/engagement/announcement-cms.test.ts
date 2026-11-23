import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (value: string) => value }));

const cms = await import("@/server/engagement/announcement-cms");

type Item = Parameters<typeof cms.sortAnnouncements>[0][number];
const item = (id: string, pinned: boolean, createdAt: string) => ({ id, pinned, createdAt }) as unknown as Item;

describe("announcement CMS", () => {
  it("sorts pinned first, then newest", () => {
    const sorted = cms.sortAnnouncements([item("a", false, "2026-01-02"), item("b", true, "2026-01-01"), item("c", false, "2026-01-03")]);
    expect(sorted.map((row) => row.id)).toEqual(["b", "c", "a"]);
  });

  it("rejects short titles and invalid categories", () => {
    expect(cms.publishCmsAnnouncementSchema.safeParse({ title: "ab", body: "x", category: "general", audience: "all" }).success).toBe(false);
    expect(cms.publishCmsAnnouncementSchema.safeParse({ title: "Town hall", body: "x", category: "nope", audience: "all" }).success).toBe(false);
    expect(cms.publishCmsAnnouncementSchema.safeParse({ title: "Town hall", body: "x", category: "general", audience: "all" }).success).toBe(true);
  });

  it("pin payload must be a boolean", () => {
    expect(cms.pinAnnouncementSchema.safeParse({ pinned: "yes" }).success).toBe(false);
  });
});
