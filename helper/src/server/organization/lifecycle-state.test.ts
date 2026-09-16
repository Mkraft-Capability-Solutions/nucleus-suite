import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPENSATION_VIEW_DECISION, resolveLifecycleState } from "./service";

describe("resolveLifecycleState", () => {
  it("marks separated and archived records regardless of leave", () => {
    expect(resolveLifecycleState("separated", false)).toBe("separated");
    expect(resolveLifecycleState("Exited", true)).toBe("separated");
    expect(resolveLifecycleState("archived", false)).toBe("archived");
    expect(resolveLifecycleState("Inactive", false)).toBe("archived");
  });

  it("marks approved leave cover as on leave", () => {
    expect(resolveLifecycleState("active", true)).toBe("on_leave");
  });

  it("defaults to active", () => {
    expect(resolveLifecycleState("active", false)).toBe("active");
    expect(resolveLifecycleState("Active", false)).toBe("active");
  });

  it("tolerates missing statuses instead of throwing", () => {
    expect(resolveLifecycleState(null, false)).toBe("active");
    expect(resolveLifecycleState(undefined, true)).toBe("on_leave");
  });
});

describe("compensation view audit decision", () => {
  it("uses a decision literal permitted by the access_events CHECK", () => {
    const migration = readFileSync(resolve(process.cwd(), "db/migrations/0005_foundation_operations.sql"), "utf8");
    const match = migration.match(/CREATE TABLE access_events \([\s\S]*?CHECK \(decision IN \((.*?)\)\)/);
    expect(match?.[1]).toBeTruthy();
    const permitted = (match?.[1] ?? "").split(",").map((entry) => entry.trim().replace(/^'|'$/g, ""));
    expect(permitted).toContain(COMPENSATION_VIEW_DECISION);
  });

  it("records the view with the audited decision", () => {
    const service = readFileSync(resolve(process.cwd(), "src/server/organization/service.ts"), "utf8");
    expect(service).toContain("COMPENSATION_VIEW_DECISION");
    expect(service).not.toMatch(/'profile-view', 'allow'/);
  });
});
