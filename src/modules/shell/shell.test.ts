import { describe, expect, it } from "vitest";
import navigation from "@/config/ui/navigation.catalog.json";
import { entitlementForApiPath } from "@/lib/entitlements/routes";
import { usesRedesign } from "@/lib/ui-mode";
import { ACCENTS, accentBootstrap, normaliseAccent } from "@/lib/accent";
import { PREFERENCE_SCHEMAS, isPreferenceKey } from "@/server/preferences/service";
import { navTarget } from "./navigation";
import { availableActions, DEFAULT_PINS, MAX_PINS, normalisePersona, pinnedActions, QUICK_ACTIONS } from "./quick-actions";
import { AREAS, DEFAULT_RAIL, MAX_RAIL, MAX_RECENT, areaFor, defaultOpenGroup, displayLabel, mergeGroups, pushRecent, railAreas } from "./side-nav";

const ids = new Set((navigation as { domains: Array<{ groups: Array<{ items: Array<{ id: string }> }> }> }).domains.flatMap((domain) => domain.groups.flatMap((group) => group.items.map((item) => item.id))));
const FORMS = ["oneOnOne", "kudos", "ticket"];

describe("quick actions", () => {
  it("point at navigation items or action forms that exist", () => {
    for (const action of QUICK_ACTIONS) {
      if (action.nav) expect(ids.has(action.nav), `${action.id} → ${action.nav}`).toBe(true);
      if (action.form) expect(FORMS, action.id).toContain(action.form);
      expect(Boolean(action.nav) !== Boolean(action.form), action.id).toBe(true);
    }
  });

  it("give every persona defaults it is offered, within the limit", () => {
    for (const [persona, pins] of Object.entries(DEFAULT_PINS)) {
      expect(pins.length).toBeLessThanOrEqual(MAX_PINS);
      const offered = availableActions(persona as never, () => true).map((action) => action.id);
      for (const pin of pins) expect(offered, `${persona}: ${pin}`).toContain(pin);
    }
  });

  it("differ by role", () => {
    const employee = availableActions("EMPLOYEE", () => true).map((action) => action.id);
    const hr = availableActions("HR_MANAGER", () => true).map((action) => action.id);
    expect(employee).not.toContain("add_employee");
    expect(employee).not.toContain("approvals");
    expect(hr).toContain("add_employee");
    expect(normalisePersona("hr_manager")).toBe("HR_MANAGER");
    expect(normalisePersona("unknown")).toBe("EMPLOYEE");
  });

  it("show the member's own pins, dropping any they can no longer open", () => {
    const available = availableActions("MANAGER", (navId) => navId !== "payslips");
    expect(pinnedActions(null, "MANAGER", available).map((action) => action.id)).toEqual(DEFAULT_PINS.MANAGER);
    expect(pinnedActions(["payslips", "kudos", "approvals"], "MANAGER", available).map((action) => action.id)).toEqual(["kudos", "approvals"]);
    expect(pinnedActions([], "MANAGER", available)).toEqual([]);
  });

  it("resolve navigation items to their workspace tab and domain", () => {
    expect(navTarget("leave_requests")).toMatchObject({ domain: "core_hr", tab: "leave_requests" });
    expect(navTarget("nope")).toBeNull();
  });
});

describe("member preferences", () => {
  it("accept only known keys and valid values", () => {
    expect(isPreferenceKey("quick_actions")).toBe(true);
    expect(isPreferenceKey("theme")).toBe(false);
    expect(PREFERENCE_SCHEMAS.quick_actions.safeParse(["punch", "apply_leave"]).success).toBe(true);
    expect(PREFERENCE_SCHEMAS.quick_actions.safeParse(Array.from({ length: 9 }, (_, index) => `a${index}x`)).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.quick_actions.safeParse(["<script>"]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.default_dashboard.safeParse("s3").success).toBe(true);
    expect(PREFERENCE_SCHEMAS.default_dashboard.safeParse(null).success).toBe(true);
    expect(PREFERENCE_SCHEMAS.default_dashboard.safeParse("s11").success).toBe(false);
  });

  it("are served on an always-on path and the shell is redesigned only in Redesigned mode", () => {
    expect(entitlementForApiPath("/api/v1/me/preferences/quick_actions")).toMatchObject({ kind: "always-on" });
    expect(usesRedesign("classic", "shell")).toBe(false);
    expect(usesRedesign("redesigned", "shell")).toBe(true);
  });
});

describe("side menu", () => {
  const domainIds = (navigation as { domains: Array<{ id: string }> }).domains.map((domain) => domain.id);

  it("offers one rail area per navigation domain", () => {
    expect(AREAS.map((area) => area.id).sort()).toEqual([...domainIds].sort());
    expect(DEFAULT_RAIL.length).toBeLessThanOrEqual(MAX_RAIL);
    for (const id of DEFAULT_RAIL) expect(domainIds).toContain(id);
  });

  it("maps workspace aliases to their area", () => {
    expect(areaFor("people")).toBe("core_hr");
    expect(areaFor("helpdesk")).toBe("core_hr");
    expect(areaFor("payroll")).toBe("payroll_finance");
    expect(areaFor("settings")).toBe("platform");
    expect(areaFor("talent")).toBe("talent");
    expect(areaFor(null)).toBe("dashboard");
  });

  it("keeps the saved order, drops areas the person may not open and puts the rest under More", () => {
    const allowed = AREAS.filter((area) => area.id !== "payroll_finance");
    const { rail, more } = railAreas(["platform", "payroll_finance", "dashboard", "platform"], allowed);
    expect(rail.map((area) => area.id)).toEqual(["platform", "dashboard"]);
    expect(more.map((area) => area.id)).toEqual(["core_hr", "documents", "talent", "workforce_ops", "analytics_ai"]);
    expect(railAreas(null, AREAS).rail.map((area) => area.id)).toEqual(DEFAULT_RAIL);
  });

  it("validates the saved rail", () => {
    expect(isPreferenceKey("rail_items")).toBe(true);
    expect(PREFERENCE_SCHEMAS.rail_items.safeParse(["dashboard", "core_hr"]).success).toBe(true);
    expect(PREFERENCE_SCHEMAS.rail_items.safeParse([]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.rail_items.safeParse(["dashboard", "dashboard"]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.rail_items.safeParse(["unknown"]).success).toBe(false);
    expect(PREFERENCE_SCHEMAS.rail_items.safeParse(AREAS.map((area) => area.id)).success).toBe(false);
  });
});

describe("accent colour", () => {
  it("offers Indigo (default), Red #E50914 and Sky #CCE5FF", () => {
    expect(ACCENTS.map((accent) => [accent.id, accent.swatch.toLowerCase()])).toEqual([["indigo", "#4338ca"], ["red", "#e50914"], ["sky", "#cce5ff"]]);
  });

  it("falls back to the default for unknown values", () => {
    expect(normaliseAccent("red")).toBe("red");
    expect(normaliseAccent("purple")).toBe("indigo");
    expect(normaliseAccent(null)).toBe("indigo");
  });

  it("applies a stored choice before paint and ignores anything else", () => {
    const run = (stored: string | null) => {
      const root = { dataset: {} as Record<string, string> };
      new Function("localStorage", "document", accentBootstrap)({ getItem: () => stored }, { documentElement: root });
      return root.dataset.accent;
    };
    expect(run("sky")).toBe("sky");
    expect(run("<script>")).toBe("indigo");
    expect(run(null)).toBe("indigo");
  });
});

describe("screens panel", () => {
  it("reads catalogue labels evenly", () => {
    expect(displayLabel("Assignment And Policy Attributes")).toBe("Assignment and Policy Attributes");
    expect(displayLabel("announcements")).toBe("Announcements");
    expect(displayLabel("And Then")).toBe("And Then");
  });

  it("merges groups with the same heading and shows a screen once", () => {
    const merged = mergeGroups([
      { heading: "Workforce Operations", items: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
      { heading: "Other", items: [{ id: "a", label: "A" }] },
      { heading: "workforce operations", items: [{ id: "c", label: "C" }] },
    ]);
    expect(merged.map((group) => [group.heading, group.items.map((item) => item.id)])).toEqual([["Workforce Operations", ["a", "b", "c"]]]);
  });

  it("opens the group holding the open screen, otherwise the first", () => {
    const groups = [{ heading: "One", items: [{ id: "a", label: "A" }] }, { heading: "Two", items: [{ id: "b", label: "B" }] }];
    expect(defaultOpenGroup(groups, "b")).toBe(1);
    expect(defaultOpenGroup(groups, "zzz")).toBe(0);
    expect(defaultOpenGroup(groups, null)).toBe(0);
  });

  it("keeps the most recent screens per area, newest first, without repeats", () => {
    let recent: Record<string, string[]> = {};
    for (const id of ["a", "b", "c", "b", "d"]) recent = pushRecent(recent, "core_hr", id);
    expect(recent.core_hr).toEqual(["d", "b", "c"].slice(0, MAX_RECENT));
    expect(pushRecent(recent, "talent", "x").core_hr).toEqual(recent.core_hr);
  });
});
