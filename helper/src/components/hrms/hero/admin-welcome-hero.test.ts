import { describe, expect, it, vi } from "vitest";

// The helpers under test are pure, but they live beside the component, which
// pulls in next/link. Stub it so the suite stays a node-environment unit test.
vi.mock("next/link", () => ({ default: () => null }));

import {
  FEED,
  QUEUE_CAP,
  UNREPORTED_REASON,
  feedReason,
  greetingFor,
  queueCountLabel,
  resolveFigure,
  resolveQueue,
} from "./admin-welcome-hero";

describe("admin hero greeting", () => {
  it("changes at midday and at 17:00, and nowhere else", () => {
    expect(greetingFor(0)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(16)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
  });

  it("falls back to a neutral greeting when the hour is not known", () => {
    expect(greetingFor(Number.NaN)).toBe("Welcome back");
  });
});

describe("a feed that did not resolve is never a zero", () => {
  const available = resolveFigure({
    value: 0,
    source: FEED.leave,
    feeds: [],
    valueNote: "Requests with no decision recorded.",
  });
  const unavailable = resolveFigure({
    value: 0, // what /api/v1/home coerces the figure to when the feed fails
    source: FEED.leave,
    feeds: [{ name: "leave", message: "Source unavailable for this role or tenant." }],
    valueNote: "Requests with no decision recorded.",
  });

  it("prints a genuine zero as 0", () => {
    expect(available.state).toBe("value");
    expect(available.display).toBe("0");
  });

  it("prints an unavailable feed as Unavailable, not as 0", () => {
    expect(unavailable.state).toBe("unavailable");
    expect(unavailable.display).toBe("Unavailable");
    expect(unavailable.display).not.toBe("0");
  });

  it("keeps the two states visibly distinct, value and wording alike", () => {
    // The whole point of the component: "0 pending approvals" and "approvals
    // unavailable" must not be the same tile.
    expect(unavailable.state).not.toBe(available.state);
    expect(unavailable.display).not.toBe(available.display);
    expect(unavailable.note).not.toBe(available.note);
  });

  it("surfaces the payload's own reason rather than inventing one", () => {
    expect(unavailable.note).toBe("Source unavailable for this role or tenant.");
  });

  it("says so plainly when the payload carried a name but no reason", () => {
    const nameOnly = resolveFigure({ value: 0, source: "attendance", feeds: ["attendance"], valueNote: "n/a" });
    expect(nameOnly.state).toBe("unavailable");
    expect(nameOnly.note).toBe(UNREPORTED_REASON);
    expect(feedReason(["attendance"], "leave")).toBeNull();
  });

  it("separates a missing feed from a figure the platform simply has not produced", () => {
    const empty = resolveFigure({
      value: null,
      source: FEED.compliance,
      feeds: [],
      valueNote: "Of registered obligations marked filed.",
      emptyNote: "No obligation is registered, so there is no ratio to report.",
    });
    expect(empty.state).toBe("empty");
    expect(empty.display).toBe("—");
    expect(empty.display).not.toBe("0");
  });

  it("reports every figure as unavailable while the fetch is failing or in flight", () => {
    const base = { value: 0, source: FEED.workforce, feeds: [], valueNote: "Active employees." };
    expect(resolveFigure({ ...base, loading: true }).state).toBe("loading");
    const failed = resolveFigure({ ...base, error: "Command centre is unreachable." });
    expect(failed.state).toBe("unavailable");
    expect(failed.note).toBe("Command centre is unreachable.");
  });
});

describe("the decision queue", () => {
  it("reads all clear on a genuine empty queue", () => {
    const queue = resolveQueue({ count: 0, feeds: [] });
    expect(queue.word).toBe("All clear");
    expect(queue.tone).toBe("success");
  });

  it("refuses to call an incomplete queue empty when a contributing feed failed", () => {
    const queue = resolveQueue({ count: 0, feeds: [{ name: "anomalies", message: "Source unavailable." }] });
    expect(queue.word).toBe("Incomplete");
    expect(queue.word).not.toBe("All clear");
    expect(queue.headline).toContain("anomalies");
    expect(queue.note).toBe("Source unavailable.");
  });

  it("states the state in words, never in tone alone", () => {
    for (const queue of [
      resolveQueue({ count: 0, feeds: [] }),
      resolveQueue({ count: 3, feeds: [] }),
      resolveQueue({ count: 0, feeds: ["leave"] }),
      resolveQueue({ count: 0, feeds: [], error: "unreachable" }),
    ]) {
      expect(queue.word.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not claim a total the payload cannot support", () => {
    expect(queueCountLabel(3)).toBe("3");
    expect(queueCountLabel(QUEUE_CAP)).toBe(`${QUEUE_CAP}+`);
    expect(resolveQueue({ count: QUEUE_CAP, feeds: [] }).headline).toContain(`${QUEUE_CAP}+`);
  });

  it("claims no urgency ranking, because the payload carries none", () => {
    expect(resolveQueue({ count: 2, feeds: [] }).note).toContain("no severity ranking");
  });
});
