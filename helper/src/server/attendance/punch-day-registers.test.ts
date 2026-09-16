import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePunchState } from "./punch-register";
import { deriveDayState, formatHoursLabel } from "./day-register";

describe("derivePunchState", () => {
  it("reads a punch already folded into an attendance entry as computed", () => {
    expect(derivePunchState("active", true)).toBe("computed");
    expect(derivePunchState("active", true, null)).toBe("computed");
    expect(derivePunchState("active", true, "accepted")).toBe("computed");
  });

  it("reads a landed punch with no attendance entry as ingested", () => {
    expect(derivePunchState("active", false)).toBe("ingested");
    expect(derivePunchState("active", false, "")).toBe("ingested");
  });

  it("lets a stored rejection win over an attendance entry", () => {
    for (const status of ["rejected", "REJECTED", "Invalid", "discarded", "error"]) {
      expect(derivePunchState("active", true, status)).toBe("rejected");
    }
  });

  it("lets a stored offline queue marker win over an attendance entry", () => {
    for (const status of ["queued_offline", "queued offline", "Queued", "offline", "pending-sync", "buffered"]) {
      expect(derivePunchState("active", true, status)).toBe("queued_offline");
    }
  });

  it("reads the record status when the attributes carry no status of their own", () => {
    expect(derivePunchState("rejected", true, null)).toBe("rejected");
    expect(derivePunchState("queued_offline", true, null)).toBe("queued_offline");
  });

  it("prefers the stored status over the record status when they disagree", () => {
    expect(derivePunchState("active", false, "rejected")).toBe("rejected");
    expect(derivePunchState("rejected", false, "queued_offline")).toBe("queued_offline");
    expect(derivePunchState("queued_offline", true, "rejected")).toBe("rejected");
  });

  it("never guesses from a missing or unrecognised status", () => {
    expect(derivePunchState(null, false)).toBe("ingested");
    expect(derivePunchState(undefined, false, undefined)).toBe("ingested");
    expect(derivePunchState(null, true, null)).toBe("computed");
    expect(derivePunchState("something_else", false, "something_else")).toBe("ingested");
  });
});

describe("deriveDayState", () => {
  it("locks a day whichever way the lock is recorded", () => {
    expect(deriveDayState("Present", false, true)).toBe("locked");
    expect(deriveDayState("locked", false, false)).toBe("locked");
    expect(deriveDayState("Locked", true, false)).toBe("locked");
    // The lock outranks an open exception.
    expect(deriveDayState("exception", true, true)).toBe("locked");
  });

  it("raises an exception ahead of a clean computation", () => {
    expect(deriveDayState("Present", true, false)).toBe("exception");
    for (const status of ["exception", "missing_punch", "Missing Punch", "mispunch", "anomaly", "incomplete", "disputed"]) {
      expect(deriveDayState(status, false, false)).toBe("exception");
    }
  });

  it("computes a clean day", () => {
    expect(deriveDayState("Present", false, false)).toBe("computed");
    expect(deriveDayState("Weekly Off", false, false)).toBe("computed");
  });

  it("treats a missing or unknown status as computed rather than guessing", () => {
    expect(deriveDayState(null, false, false)).toBe("computed");
    expect(deriveDayState(undefined, false, false)).toBe("computed");
    expect(deriveDayState("", false, false)).toBe("computed");
    expect(deriveDayState("whatever", false, false)).toBe("computed");
    // An unknown status still cannot suppress a flagged exception or a lock.
    expect(deriveDayState(null, true, false)).toBe("exception");
    expect(deriveDayState(undefined, false, true)).toBe("locked");
  });
});

describe("formatHoursLabel", () => {
  it("renders minutes as H:MM", () => {
    expect(formatHoursLabel(731)).toBe("12:11");
    expect(formatHoursLabel(60)).toBe("1:00");
    expect(formatHoursLabel(59)).toBe("0:59");
    expect(formatHoursLabel(1)).toBe("0:01");
    expect(formatHoursLabel(440)).toBe("7:20");
    expect(formatHoursLabel(728)).toBe("12:08");
    expect(formatHoursLabel(1440)).toBe("24:00");
  });

  it("pads the minute so the column always aligns", () => {
    expect(formatHoursLabel(605)).toBe("10:05");
    expect(formatHoursLabel(120)).toBe("2:00");
  });

  it("shows a dash rather than a misleading zero", () => {
    expect(formatHoursLabel(null)).toBe("—");
    expect(formatHoursLabel(0)).toBe("—");
    expect(formatHoursLabel(-30)).toBe("—");
    expect(formatHoursLabel(Number.NaN)).toBe("—");
    expect(formatHoursLabel(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatHoursLabel(Number.NEGATIVE_INFINITY)).toBe("—");
  });

  it("truncates a fractional minute instead of rounding a duration up", () => {
    expect(formatHoursLabel(731.9)).toBe("12:11");
    expect(formatHoursLabel(0.4)).toBe("—");
  });
});

describe("attendance register contracts", () => {
  const sources = {
    punch: readFileSync(resolve(process.cwd(), "src/server/attendance/punch-register.ts"), "utf8"),
    day: readFileSync(resolve(process.cwd(), "src/server/attendance/day-register.ts"), "utf8"),
  };
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);

  // Only template literals that actually carry a statement are scanned, so an
  // error message such as "…from status draft" is never read as a table.
  function sqlOf(source: string): string {
    return [...source.matchAll(/`([\s\S]*?)`/g)]
      .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
      .filter((span) => /\b(select|insert\s+into|update)\b/i.test(span))
      .join("\n");
  }

  it("reads the canonical topology", () => {
    expect(known.size).toBeGreaterThan(100);
  });

  it.each(Object.entries(sources))("%s references only migrated tables", (_name, source) => {
    const sql = sqlOf(source);
    const tables = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+([a-z_]+)/g)) {
      if (!["lateral", "select"].includes(match[1])) tables.add(match[1]);
    }
    expect(tables.size).toBeGreaterThan(0);
    for (const table of tables) {
      expect(known.has(table), `table ${table} is not in the migrated topology`).toBe(true);
    }
  });

  it.each(Object.entries(sources))("%s binds every SQL alias it references", (_name, source) => {
    const sql = sqlOf(source);
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral", "set"].includes(match[2])) {
        bound.add(match[2]);
      }
    }
    const referenced = new Set<string>();
    for (const match of sql.matchAll(/\b([a-z_]+)\.[a-z_]+/g)) referenced.add(match[1]);
    expect(referenced.size).toBeGreaterThan(0);
    for (const alias of referenced) {
      expect(bound.has(alias), `alias ${alias} is referenced but never bound`).toBe(true);
    }
  });

  it.each(Object.entries(sources))("%s uses no DDL", (_name, source) => {
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });

  it.each(Object.entries(sources))("%s is a read model and never writes", (_name, source) => {
    expect(sqlOf(source)).not.toMatch(/\b(insert\s+into|update\s+[a-z_]+\s+set|delete\s+from|truncate)\b/i);
  });

  it.each(Object.entries(sources))("%s enforces the attendance read permission", (_name, source) => {
    expect(source).toContain('enforce(access.context, "attendance.read"');
  });

  it.each(Object.entries(sources))("%s scopes every list to the caller's visible employees", (_name, source) => {
    expect(source).toContain("resolveAttendanceScope");
    expect(source).toContain("assertAttendanceEmployeeVisible");
    // The scope filter lives in the list query's where clause, which `sqlOf`
    // skips because the interpolated select is stripped out of that span.
    expect(source).toContain("employee_id = any($2::uuid[])");
  });

  it("isolates the audit trail so a failure never fails the record", () => {
    for (const source of Object.values(sources)) {
      expect(source).toContain("auditTrail = [];");
    }
  });

  it("keeps the punch source distinct from the punch reference", () => {
    const sql = sqlOf(sources.punch);
    expect(sql).toMatch(/as event_reference/);
    expect(sql).toMatch(/src\.attributes->>'name'[\s\S]*?as source/);
  });
});
