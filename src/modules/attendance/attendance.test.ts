import { describe, expect, it } from "vitest";
import { REDESIGNED_MODULES, redesignedModuleForTab, usesRedesign } from "@/lib/ui-mode";
import { viewerAccess } from "./data";
import {
  addMinutes, attendanceRate, calendarWeeks, countDays, dayKind, hm, hoursLabel, monthRange, requestTone, shiftMonth, statusLabel,
} from "./format";

describe("attendance formatting", () => {
  it("prints durations as H:MM and never a misleading zero", () => {
    expect(hm(503)).toBe("8:23");
    expect(hm(60)).toBe("1:00");
    expect(hm(0)).toBe("—");
    expect(hm(null)).toBe("—");
    expect(hoursLabel(0)).toBe("0 h");
    expect(hoursLabel(150)).toBe("2 h 30 m");
    expect(hoursLabel(120)).toBe("2 h");
  });

  it("moves between months across year ends", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange({ year: 2026, month: 11 })).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("lays a month out in whole Monday-first weeks", () => {
    const weeks = calendarWeeks({ year: 2026, month: 11 }); // 1 Nov 2026 is a Sunday
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0]![6]).toBe("2026-11-01");
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(weeks.at(-1)!.at(-1)).toBe(null);
  });

  it("reads every stored day status into one vocabulary", () => {
    expect(dayKind("present")).toBe("present");
    expect(dayKind("Half day")).toBe("half_day");
    expect(dayKind("half_day")).toBe("half_day");
    expect(dayKind("leave")).toBe("leave");
    expect(dayKind("On Leave")).toBe("leave");
    expect(dayKind("holiday")).toBe("holiday");
    expect(dayKind("pending")).toBe("pending");
    expect(dayKind("mystery")).toBe("other");
    expect(dayKind(null)).toBe("other");
  });

  it("counts a half day as half and leaves holidays out of the rate", () => {
    const counts = countDays(["present", "present", "present", "half_day", "absent", "holiday", "leave"]);
    expect(counts).toMatchObject({ present: 3, half_day: 1, absent: 1, holiday: 1, leave: 1 });
    expect(attendanceRate(counts)).toBe(70);
    expect(attendanceRate({ present: 0, half_day: 0, absent: 0 })).toBeNull();
  });

  it("labels and colours request states", () => {
    expect(statusLabel("submitted")).toBe("Awaiting approval");
    expect(statusLabel("pending_approval")).toBe("Awaiting approval");
    expect(statusLabel("tagged_to_run")).toBe("Tagged to pay run");
    expect(requestTone("approved")).toBe("success");
    expect(requestTone("rejected")).toBe("danger");
    expect(requestTone("submitted")).toBe("warning");
    expect(requestTone("proposed")).toBe("info");
  });

  it("works out when a gate pass ends", () => {
    expect(addMinutes("10:30", 120)).toBe("12:30");
    expect(addMinutes("22:30", 240)).toBeNull();
    expect(addMinutes("bad", 120)).toBeNull();
  });
});

describe("who sees what", () => {
  it("gives decisions only to attendance.write and the team view to HR roles and managers", () => {
    const employee = viewerAccess({ employeeId: "e1", roles: ["employee"], permissions: ["attendance.read", "attendance.self.read", "attendance.self.write"] });
    expect(employee).toMatchObject({ canDecide: false, canRequest: false, selfOnlyRequests: true, seesTeam: false });
    const manager = viewerAccess({ employeeId: "e2", roles: ["manager"], permissions: ["attendance.read", "attendance.self.write"] });
    expect(manager).toMatchObject({ canDecide: false, seesTeam: true, tenantWide: false });
    const hr = viewerAccess({ employeeId: "e3", roles: ["hr-manager"], permissions: ["attendance.read", "attendance.write"] });
    expect(hr).toMatchObject({ canDecide: true, canRequest: true, seesTeam: true, tenantWide: true });
    expect(viewerAccess(undefined)).toMatchObject({ canDecide: false, seesTeam: false });
  });
});

describe("interface mode", () => {
  it("shows the redesigned attendance only in Redesigned mode", () => {
    expect(REDESIGNED_MODULES.attendance?.tabs).toEqual(["attendance"]);
    expect(redesignedModuleForTab("attendance")).toBe("attendance");
    expect(usesRedesign("redesigned", "attendance")).toBe(true);
    expect(usesRedesign("classic", "attendance")).toBe(false);
  });
});
