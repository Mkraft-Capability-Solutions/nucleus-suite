import { describe, expect, it } from "vitest";
import { entitlementForApiPath } from "@/lib/entitlements/routes";
import { usesRedesign } from "@/lib/ui-mode";
import { formatCompact, formatValue } from "@/modules/dashboards/format";
import type { Access } from "@/server/platform/access";
import {
  annualisedAttrition, barPanel, headcountInsight, heatmapPanel, humanise, monthLabel, parseFilters, partsPanel, pct, tenureBand, withSource,
} from "./compose";
import { BOARD_DEFINITIONS, canOpenBoard, isBoardId, openableBoards } from ".";
import { BOARD_IDS } from "./types";

const access = (permissions: string[], roles: string[] = []): Access => ({
  tenantId: "t1",
  context: { actorUserId: "u1", membershipId: "m1", tenantId: "t1", employeeId: null, permissions, roles },
});

describe("dashboard figures", () => {
  it("divides safely and annualises attrition", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(1, 0)).toBeNull();
    expect(annualisedAttrition(3, 30, 12)).toBe(10);
    expect(annualisedAttrition(3, 30, 6)).toBe(20);
    expect(annualisedAttrition(1, 0, 12)).toBeNull();
  });

  it("reads filters with safe defaults", () => {
    expect(parseFilters(new URLSearchParams("location=Pune&department=all&months=6"))).toEqual({ location: "Pune", department: null, months: 6 });
    expect(parseFilters(new URLSearchParams("months=7")).months).toBe(12);
  });

  it("marks a panel empty when every value is zero, and unavailable when its source failed", () => {
    const common = { id: "x", title: "X", span: 6 as const, emptyMessage: "none" };
    expect(barPanel(common, ["a"], [{ name: "s", data: [0] }]).state).toBe("empty");
    expect(barPanel(common, ["a"], [{ name: "s", data: [2] }]).state).toBe("ok");
    expect(partsPanel(common, [{ name: "a", value: 0 }]).state).toBe("empty");
    expect(heatmapPanel(common, [{ x: "Pune", y: "HR", value: 3 }]).state).toBe("empty");
    expect(withSource(null, barPanel(common, ["a"], [{ name: "s", data: [2] }])).state).toBe("unavailable");
  });

  it("writes plain sentences and labels", () => {
    expect(headcountInsight(["2026-01", "2026-06"], [30, 34])).toBe("Headcount is 34, up 4 since Jan 2026.");
    expect(headcountInsight(["2026-01"], [0])).toBeNull();
    expect(monthLabel("2026-03")).toBe("Mar 2026");
    expect(humanise("pending_supervisor")).toBe("Pending supervisor");
    expect(humanise("platform.tenant_create")).toBe("Platform tenant create");
    expect(humanise("EL")).toBe("EL");
    expect(tenureBand(0.5)).toBe("Under 1 year");
    expect(tenureBand(12)).toBe("10+ years");
  });

  it("formats values for tiles and tables", () => {
    expect(formatValue(13.94, "percent")).toBe("13.9%");
    expect(formatCompact(1284)).toBe("1,284");
    expect(formatCompact(4625000, "money")).toMatch(/^₹46\.3L$|^₹4\.6M$/);
    expect(formatValue(null)).toBe("—");
  });
});

describe("dashboard access", () => {
  it("lets each role open only its boards", () => {
    expect(openableBoards(access(["employee.read", "attendance.read"]))).toEqual(["s7", "s8"]);
    expect(openableBoards(access(["payroll.read"]))).toEqual(["s5", "s7", "s8"]);
    expect(openableBoards(access(["hr.lifecycle.read", "employee.write", "attendance.write"]))).toEqual(["s1", "s2", "s3", "s4", "s6", "s7", "s8", "s9"]);
    expect(openableBoards(access([], ["super_admin"]))).toEqual([...BOARD_IDS]);
    expect(canOpenBoard(access(["employee.read"]), "s1")).toBe(false);
  });

  it("knows every board id and guards each API path by its own entitlement", () => {
    expect(isBoardId("s10")).toBe(true);
    expect(isBoardId("s11")).toBe(false);
    for (const board of BOARD_IDS) {
      expect(BOARD_DEFINITIONS[board].title.length).toBeGreaterThan(3);
      expect(entitlementForApiPath(`/api/v1/dashboards/${board}`)).toMatchObject({ key: `dashboards.${board}` });
    }
    expect(entitlementForApiPath("/api/v1/dashboards/filters")).toMatchObject({ key: "dashboards" });
  });

  it("shows the redesigned dashboards only in Redesigned mode", () => {
    expect(usesRedesign("classic", "dashboards")).toBe(false);
    expect(usesRedesign("redesigned", "dashboards")).toBe(true);
  });
});
