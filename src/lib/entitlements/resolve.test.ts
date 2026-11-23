import { describe, expect, it } from "vitest";
import { readConfig } from "./config";
import { catalogEntry, enabledDependants, isActive, resolveEntitlements, toSnapshot } from "./resolve";
import { snapshotAllows } from "./routes";

describe("resolveEntitlements", () => {
  it("uses catalog defaults when nothing is stored", () => {
    const resolved = resolveEntitlements([]);
    expect(isActive(resolved, "people")).toBe(true); // core
    expect(isActive(resolved, "leave")).toBe(true); // standard
    expect(isActive(resolved, "recruitment")).toBe(false); // add-on
    expect(isActive(resolved, "leave.encashment")).toBe(false); // off by default, also needs payroll
    expect(resolved.entries["leave.requests"]!.customised).toBe(false);
  });

  it("keeps core modules and locked sub-modules on whatever is stored", () => {
    const resolved = resolveEntitlements([
      { key: "people", enabled: false, config: {} },
      { key: "people.records", enabled: false, config: {} },
    ]);
    expect(isActive(resolved, "people")).toBe(true);
    expect(isActive(resolved, "people.records")).toBe(true);
  });

  it("makes children inactive when the parent is off, and says why", () => {
    const resolved = resolveEntitlements([{ key: "leave", enabled: false, config: {} }]);
    const requests = resolved.entries["leave.requests"]!;
    expect(requests.enabled).toBe(true);
    expect(requests.active).toBe(false);
    expect(requests.blockedBy).toBe("leave");
    expect(isActive(resolved, "leave.requests.early_return")).toBe(false);
  });

  it("makes an entry inactive while something it requires is off", () => {
    const off = resolveEntitlements([
      { key: "leave.encashment", enabled: true, config: {} },
      { key: "payroll", enabled: false, config: {} },
    ]);
    expect(off.entries["leave.encashment"]).toMatchObject({ enabled: true, active: false, blockedBy: "payroll" });
    const on = resolveEntitlements([{ key: "leave.encashment", enabled: true, config: {} }]);
    expect(isActive(on, "leave.encashment")).toBe(true);
  });

  it("lists enabled dependants of a key", () => {
    const resolved = resolveEntitlements([{ key: "leave.encashment", enabled: true, config: {} }]);
    expect(enabledDependants(resolved, "payroll")).toContain("leave.encashment");
    expect(enabledDependants(resolved, "attendance")).toEqual(expect.arrayContaining(["leave.comp_off", "dashboards.s3"]));
  });

  it("ignores stored rows for keys that are no longer in the catalog", () => {
    const resolved = resolveEntitlements([{ key: "retired_module", enabled: true, config: {} }]);
    expect(resolved.entries["retired_module"]).toBeUndefined();
  });

  it("produces a compact snapshot for the browser", () => {
    const snapshot = toSnapshot(resolveEntitlements([{ key: "recruitment", enabled: true, config: {} }]));
    expect(snapshot.active).toContain("recruitment.offers");
    expect(snapshot.config["leave.requests"]).toMatchObject({ maxDaysPerRequest: 60 });
    expect(snapshotAllows(snapshot, "recruitment.offers")).toBe(true);
    expect(snapshotAllows(snapshot, "ai.voice")).toBe(false);
    expect(snapshotAllows(snapshot, null)).toBe(true);
  });
});

describe("readConfig", () => {
  const fields = catalogEntry("leave.requests")!.config;

  it("merges stored values over defaults", () => {
    expect(readConfig(fields, { maxDaysPerRequest: 10 })).toMatchObject({ maxDaysPerRequest: 10, allowedLeaveTypes: ["EL", "CL", "SL", "COFF", "BIRTHDAY"] });
  });

  it("falls back to the default for a stored value that no longer fits", () => {
    expect(readConfig(fields, { maxDaysPerRequest: 500, allowedLeaveTypes: ["XX"], unknown: true })).toEqual({
      maxDaysPerRequest: 60,
      allowedLeaveTypes: ["EL", "CL", "SL", "COFF", "BIRTHDAY"],
    });
  });
});
