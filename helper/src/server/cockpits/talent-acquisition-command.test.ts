import { describe, expect, it } from "vitest";
import {
  buildHiringFunnel,
  buildOfferBridge,
  isOpenRequisition,
  stageConversions,
} from "./talent-acquisition-command";

describe("buildHiringFunnel", () => {
  it("counts each milestone cumulatively, because a later stage implies the earlier ones", () => {
    const funnel = buildHiringFunnel([
      "applied",
      "applied",
      "screening",
      "shortlisted",
      "interview",
      "offered",
      "accepted",
      "converted",
    ]);
    expect(funnel.stages).toEqual([
      { label: "Applied", value: 8 },
      { label: "Screened", value: 6 },
      { label: "Interviewed", value: 4 },
      { label: "Offered", value: 3 },
      { label: "Joined", value: 1 },
    ]);
    expect(funnel.total).toBe(8);
  });

  it("counts an ended application at Applied only, since the row loses its furthest stage", () => {
    const funnel = buildHiringFunnel(["applied", "rejected", "withdrawn", "declined", "closed"]);
    expect(funnel.terminal).toBe(4);
    expect(funnel.stages.map((stage) => stage.value)).toEqual([5, 0, 0, 0, 0]);
  });

  it("returns zeroed milestones with no applications at all", () => {
    const funnel = buildHiringFunnel([]);
    expect(funnel.total).toBe(0);
    expect(funnel.stages.every((stage) => stage.value === 0)).toBe(true);
  });
});

describe("buildOfferBridge", () => {
  it("closes exactly on the joined total with no balancing figure", () => {
    const bridge = buildOfferBridge([
      "applied",
      "interview",
      "offer_review",
      "offered",
      "offered",
      "accepted",
      "declined",
      "declined",
      "converted",
      "converted",
      "converted",
    ]);
    expect(bridge.reachedOffer).toBe(9);
    expect(bridge.joined).toBe(3);
    expect(bridge.items).toEqual([
      { label: "Reached offer", value: 9, kind: "base" },
      { label: "Declined", value: -2, kind: "delta" },
      { label: "Awaiting decision", value: -3, kind: "delta" },
      { label: "Accepted, not joined", value: -1, kind: "delta" },
      { label: "Joined", value: 3, kind: "total" },
    ]);
    const base = bridge.items[0].value;
    const deltas = bridge.items.slice(1, -1).reduce((total, item) => total + item.value, 0);
    expect(base + deltas).toBe(bridge.joined);
  });

  it("omits a category with no records rather than drawing an empty bucket", () => {
    const bridge = buildOfferBridge(["offered", "converted"]);
    expect(bridge.items.map((item) => item.label)).toEqual(["Reached offer", "Awaiting decision", "Joined"]);
  });

  it("renders nothing when no application has reached an offer", () => {
    expect(buildOfferBridge(["applied", "screening", "rejected"])).toEqual({
      items: [],
      reachedOffer: 0,
      joined: 0,
    });
  });
});

describe("isOpenRequisition", () => {
  it("treats anything not recorded as finished as still open", () => {
    expect(isOpenRequisition("draft")).toBe(true);
    expect(isOpenRequisition("submitted")).toBe(true);
    expect(isOpenRequisition("approved")).toBe(true);
    expect(isOpenRequisition("Filled")).toBe(false);
    expect(isOpenRequisition(" closed ")).toBe(false);
    expect(isOpenRequisition("cancelled")).toBe(false);
  });
});

describe("stageConversions", () => {
  it("reports stage-over-stage conversion and refuses to divide by an empty stage", () => {
    const conversions = stageConversions([
      { label: "Applied", value: 200 },
      { label: "Screened", value: 50 },
      { label: "Interviewed", value: 0 },
      { label: "Offered", value: 0 },
    ]);
    expect(conversions).toEqual([
      { label: "Applied", percent: null },
      { label: "Screened", percent: 25 },
      { label: "Interviewed", percent: 0 },
      { label: "Offered", percent: null },
    ]);
  });
});
