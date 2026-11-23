import { describe, expect, it } from "vitest";
import { daysBetween, dedupKey, evaluateCandidates, navigationFor, normaliseThresholds, severityFor } from "./compliance-alerts";

const base = { employeeId: "e1", companyId: "c1", rootGroupId: "g1", category: "VISA_EXPIRY" as const, sourceRef: "visa", title: "Visa expiry" };

describe("compliance alert rules", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-11-23", "2026-11-30")).toBe(7);
    expect(daysBetween("2026-11-23", "2026-11-20T00:00:00Z")).toBe(-3);
    expect(daysBetween("2026-11-23", "not a date")).toBeNull();
  });
  it("maps default thresholds 90/60/30/7/0 to severities", () => {
    expect(severityFor(91, [90, 60, 30, 7, 0])).toBeNull();
    expect(severityFor(90, [90, 60, 30, 7, 0])).toBe("INFO");
    expect(severityFor(30, [90, 60, 30, 7, 0])).toBe("WARNING");
    expect(severityFor(7, [90, 60, 30, 7, 0])).toBe("CRITICAL");
    expect(severityFor(-5, [90, 60, 30, 7, 0])).toBe("CRITICAL");
  });
  it("normalises thresholds and falls back to defaults", () => {
    expect(normaliseThresholds([30, 30, 7, -1, 1000])).toEqual([30, 7]);
    expect(normaliseThresholds([])).toEqual([90, 60, 30, 7, 0]);
  });
  it("evaluates candidates: out of range dropped, disabled rules skipped, duplicates keep the nearer date", () => {
    const out = evaluateCandidates([
      { ...base, triggerDate: "2026-12-20" },
      { ...base, triggerDate: "2026-12-01" },
      { ...base, sourceRef: "x", triggerDate: "2028-01-01" },
      { ...base, category: "DOCUMENT_EXPIRY", sourceRef: "document:d1", triggerDate: "2026-11-25" },
    ], { DOCUMENT_EXPIRY: { enabled: false, thresholds: [90] } }, "2026-11-23");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ triggerDate: "2026-12-01", daysRemaining: 8, severity: "WARNING", dedupKey: dedupKey("VISA_EXPIRY", "e1", "visa") });
  });
  it("deep-links to the profile's visa section", () => {
    expect(navigationFor({ employeeId: "e1", category: "WORK_PERMIT_EXPIRY" })).toEqual({ tab: "people_core", sub: "e1", section: "visa" });
    expect(navigationFor({ employeeId: "e1", category: "DOCUMENT_EXPIRY" }).section).toBe("documents");
  });
});
