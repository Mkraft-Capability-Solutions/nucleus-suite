import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ageInDays, deriveExceptionState } from "./exception-register";
import { deltaLabel, deriveRecomputeState } from "./recompute-monitor";
import { deriveHistoryState, historyRange, overtimeLabel } from "./team-history-register";

describe("deriveExceptionState", () => {
  it("closes an exception the time office has already settled", () => {
    for (const status of ["resolved", "regularized", "closed", "approved", "REGULARIZED", " Resolved "]) {
      expect(deriveExceptionState(status, false)).toBe("resolved");
      // A proposal cannot reopen a settled exception.
      expect(deriveExceptionState(status, true)).toBe("resolved");
    }
  });

  it("marks a rejected exception rejected", () => {
    expect(deriveExceptionState("rejected", false)).toBe("rejected");
    expect(deriveExceptionState("declined", true)).toBe("rejected");
  });

  it("lifts an open exception to proposed only when a proposal exists", () => {
    expect(deriveExceptionState("open", true)).toBe("proposed");
    expect(deriveExceptionState("pending", true)).toBe("proposed");
    expect(deriveExceptionState(null, true)).toBe("proposed");
  });

  it("leaves everything else open, including null and unknown statuses", () => {
    expect(deriveExceptionState("open", false)).toBe("open");
    expect(deriveExceptionState("", false)).toBe("open");
    expect(deriveExceptionState(null, false)).toBe("open");
    expect(deriveExceptionState(undefined, false)).toBe("open");
    expect(deriveExceptionState("something-new", false)).toBe("open");
  });

  it("normalises case, padding and word separators in the stored status", () => {
    expect(deriveExceptionState("  REGULARIZED  ", false)).toBe("resolved");
    expect(deriveExceptionState("Rejected", true)).toBe("rejected");
    // A separator-joined status the source system may emit still lands open,
    // never silently resolved.
    expect(deriveExceptionState("awaiting-review", false)).toBe("open");
  });
});

describe("ageInDays", () => {
  it("counts whole days between the exception date and today", () => {
    expect(ageInDays("2026-09-04", "2026-09-14")).toBe(10);
    expect(ageInDays("2026-09-14", "2026-09-14")).toBe(0);
  });

  it("returns a negative age for a future date rather than clamping it", () => {
    expect(ageInDays("2026-09-20", "2026-09-14")).toBe(-6);
  });

  it("spans month and year boundaries", () => {
    expect(ageInDays("2025-12-31", "2026-01-01")).toBe(1);
    expect(ageInDays("2026-08-31", "2026-09-01")).toBe(1);
  });

  it("reads a timestamp by its date part", () => {
    expect(ageInDays("2026-09-04T18:30:00.000Z", "2026-09-14")).toBe(10);
  });

  it("returns null for a missing or unusable date", () => {
    expect(ageInDays(null, "2026-09-14")).toBeNull();
    expect(ageInDays(undefined, "2026-09-14")).toBeNull();
    expect(ageInDays("", "2026-09-14")).toBeNull();
    expect(ageInDays("not-a-date", "2026-09-14")).toBeNull();
    expect(ageInDays("2026-13-45", "2026-09-14")).toBeNull();
    expect(ageInDays("2026-09-04", "rubbish")).toBeNull();
  });
});

describe("deriveRecomputeState", () => {
  it("maps every stored terminal status", () => {
    for (const status of ["succeeded", "success", "completed", "complete", "done", "SUCCEEDED"]) {
      expect(deriveRecomputeState(status, null)).toBe("completed");
    }
  });

  it("maps every stored failure status onto blocked", () => {
    for (const status of ["failed", "blocked", "dead", "cancelled", "canceled", "error"]) {
      expect(deriveRecomputeState(status, "2026-09-14T00:00:00Z")).toBe("blocked");
    }
  });

  it("maps in-flight and waiting statuses", () => {
    for (const status of ["running", "leased", "in_progress", "in progress", "processing"]) {
      expect(deriveRecomputeState(status, null)).toBe("running");
    }
    for (const status of ["queued", "pending", "available", "scheduled"]) {
      expect(deriveRecomputeState(status, null)).toBe("queued");
    }
  });

  it("falls back to the completion timestamp when the status says nothing", () => {
    expect(deriveRecomputeState(null, "2026-09-14T00:00:00Z")).toBe("completed");
    expect(deriveRecomputeState(undefined, "2026-09-14T00:00:00Z")).toBe("completed");
    expect(deriveRecomputeState("", null)).toBe("queued");
    expect(deriveRecomputeState("unknown-status", null)).toBe("queued");
  });
});

describe("deltaLabel", () => {
  it("renders a measured delta in minutes", () => {
    expect(deltaLabel(45)).toBe("45 min OT");
    expect(deltaLabel(-30)).toBe("-30 min OT");
  });

  it("says so when the recompute changed nothing", () => {
    expect(deltaLabel(0)).toBe("No change");
  });

  it("never renders an unmeasured delta as zero", () => {
    expect(deltaLabel(null)).toBe("—");
    expect(deltaLabel(Number.NaN)).toBe("—");
    expect(deltaLabel(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("deriveHistoryState", () => {
  it("schedules a range that has not started yet", () => {
    expect(deriveHistoryState("2026-09-15", "2026-09-30", "2026-09-14")).toBe("scheduled");
  });

  it("keeps a range that starts today ready", () => {
    expect(deriveHistoryState("2026-09-14", "2026-09-20", "2026-09-14")).toBe("ready");
  });

  it("expires a range that ended more than 90 days ago", () => {
    expect(deriveHistoryState("2026-05-01", "2026-05-31", "2026-09-14")).toBe("expired");
    // Exactly on the 90-day boundary the range is still ready.
    expect(deriveHistoryState("2026-06-01", "2026-06-16", "2026-09-14")).toBe("ready");
    expect(deriveHistoryState("2026-06-01", "2026-06-15", "2026-09-14")).toBe("expired");
  });

  it("keeps a recent or current range ready", () => {
    expect(deriveHistoryState("2026-08-16", "2026-09-14", "2026-09-14")).toBe("ready");
    expect(deriveHistoryState("2026-09-01", "2026-09-15", "2026-09-14")).toBe("ready");
  });
});

describe("overtimeLabel", () => {
  it("renders minutes as H:MM", () => {
    expect(overtimeLabel(440)).toBe("7:20");
    expect(overtimeLabel(12)).toBe("0:12");
    expect(overtimeLabel(728)).toBe("12:08");
    expect(overtimeLabel(60)).toBe("1:00");
  });

  it("renders an absent, zero or negative total as 0:00", () => {
    expect(overtimeLabel(0)).toBe("0:00");
    expect(overtimeLabel(null)).toBe("0:00");
    expect(overtimeLabel(undefined)).toBe("0:00");
    expect(overtimeLabel(Number.NaN)).toBe("0:00");
    expect(overtimeLabel(-15)).toBe("0:00");
  });
});

describe("historyRange", () => {
  it("keeps a supplied range", () => {
    expect(historyRange("2026-09-01", "2026-09-15", "2026-09-14")).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });

  it("defaults to the last 30 days when no range is supplied", () => {
    expect(historyRange(null, null, "2026-09-14")).toEqual({ from: "2026-08-16", to: "2026-09-14" });
    expect(historyRange("", "", "2026-09-14")).toEqual({ from: "2026-08-16", to: "2026-09-14" });
    expect(historyRange("junk", undefined, "2026-09-14")).toEqual({ from: "2026-08-16", to: "2026-09-14" });
  });

  it("orders an inverted range instead of returning nothing", () => {
    expect(historyRange("2026-09-15", "2026-09-01", "2026-09-14")).toEqual({ from: "2026-09-01", to: "2026-09-15" });
  });
});

describe("attendance operations register contracts", () => {
  const sources = {
    exception: readFileSync(resolve(process.cwd(), "src/server/attendance/exception-register.ts"), "utf8"),
    recompute: readFileSync(resolve(process.cwd(), "src/server/attendance/recompute-monitor.ts"), "utf8"),
    history: readFileSync(resolve(process.cwd(), "src/server/attendance/team-history-register.ts"), "utf8"),
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
      if (match[2] && !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral", "set", "union"].includes(match[2])) {
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

  it("isolates every audit trail read so a failure never fails the record", () => {
    for (const source of Object.values(sources)) {
      expect(source).toContain("auditTrail = [];");
    }
  });

  it("reads behind attendance.read and writes behind attendance.write", () => {
    expect(sources.exception).toContain('enforce(access.context, "attendance.read"');
    expect(sources.exception).toContain('enforce(access.context, "attendance.write"');
    expect(sources.recompute).toContain('enforce(access.context, "attendance.read"');
    expect(sources.recompute).toContain('enforce(access.context, "attendance.write"');
    // The history register takes its scope (and its read check) from the shared
    // attendance scope resolver.
    expect(sources.history).toContain("resolveAttendanceScope");
  });

  it("names the audited actions through constants", () => {
    expect(sources.exception).toContain('EXCEPTION_ACCEPT_ACTION = "attendance.exception_accept"');
    expect(sources.exception).toContain('EXCEPTION_RESOLVE_ACTION = "attendance.exception_resolve"');
    expect(sources.recompute).toContain('RECOMPUTE_QUEUE_ACTION = "attendance.recompute_queue"');
  });

  it("invents no recompute job table: the queue writes an audit event only", () => {
    const sql = sqlOf(sources.recompute);
    const insertTargets = [...sql.matchAll(/insert\s+into\s+([a-z_]+)/gi)].map((match) => match[1]);
    expect(insertTargets).toEqual(["audit_events"]);
    expect(sources.recompute).not.toMatch(/recompute_jobs|attendance_recompute_runs/);
  });

  it("casts every request id before it reaches a uuid column", () => {
    for (const source of [sources.exception, sources.recompute]) {
      expect(source).toContain("uuidOrNull(requestId)");
    }
  });
});
