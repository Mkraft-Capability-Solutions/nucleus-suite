import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sqlClient: () => ({}) }));
vi.mock("@/server/platform/access", () => ({ enforce: vi.fn(), tenantTx: vi.fn(), uuidOrNull: (value: string) => value }));

const feed = await import("@/server/engagement/recognition-feed");

describe("recognition likes", () => {
  it("counts each person once", () => {
    expect(feed.likeState({ liked_by: ["a", "a", "b"] }, "a")).toEqual({ likeCount: 2, likedByViewer: true });
  });

  it("adds legacy anonymous counts and ignores junk", () => {
    expect(feed.likeState({ liked_by: ["a", 3], likes: 4 }, null)).toEqual({ likeCount: 5, likedByViewer: false });
    expect(feed.likeState({ likes: -2 }, "a")).toEqual({ likeCount: 0, likedByViewer: false });
  });
});
