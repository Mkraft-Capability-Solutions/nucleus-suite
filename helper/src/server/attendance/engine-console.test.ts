import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORKER_CATEGORY_CODE_MAX,
  deriveCurrentSession,
  deriveTimesheetStatus,
  isWorkerCategoryRow,
  monthDays,
} from "./engine-console";

const WORKING_DAY = {
  recorded: true,
  status: "Present",
  dayType: "Working",
  firstIn: "07:55",
  latestIn: "09:29",
  grossMinutes: 731,
};

describe("deriveTimesheetStatus", () => {
  it("reports a day with no record rather than assuming absence", () => {
    expect(deriveTimesheetStatus({ recorded: false })).toBe("not_recorded");
    expect(deriveTimesheetStatus(null)).toBe("not_recorded");
    expect(deriveTimesheetStatus(undefined)).toBe("not_recorded");
  });

  it("marks a worked day in", () => {
    expect(deriveTimesheetStatus(WORKING_DAY)).toBe("in");
  });

  it("marks a day late when the first punch is past the shift's latest in window", () => {
    expect(deriveTimesheetStatus({ ...WORKING_DAY, firstIn: "09:30" })).toBe("late");
    // Exactly on the boundary is still within the window.
    expect(deriveTimesheetStatus({ ...WORKING_DAY, firstIn: "09:29" })).toBe("in");
    // A stored status of Late is honoured even without a shift window.
    expect(deriveTimesheetStatus({ ...WORKING_DAY, status: "Late", latestIn: null })).toBe("late");
  });

  it("cannot call a day late without both the punch and the shift window", () => {
    expect(deriveTimesheetStatus({ ...WORKING_DAY, latestIn: null })).toBe("in");
    expect(deriveTimesheetStatus({ ...WORKING_DAY, firstIn: null })).toBe("in");
  });

  it("lets the leave day type win over the imported Present status", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: "Present", dayType: "On Leave", firstIn: null, latestIn: null, grossMinutes: 0,
    })).toBe("leave");
    expect(deriveTimesheetStatus({
      recorded: true, status: "On Leave", dayType: "Working", firstIn: null, latestIn: null, grossMinutes: 0,
    })).toBe("leave");
  });

  it("reads an unworked weekly off or holiday as off", () => {
    for (const dayType of ["Weekly Off", "Holiday", "Rest Day"]) {
      expect(deriveTimesheetStatus({
        recorded: true, status: "Present", dayType, firstIn: null, latestIn: null, grossMinutes: 0,
      })).toBe("off");
    }
  });

  it("never hides rest-day working behind an off label", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: "Present", dayType: "Weekly Off", firstIn: "08:04", latestIn: "09:29", grossMinutes: 728,
    })).toBe("in");
    expect(deriveTimesheetStatus({
      recorded: true, status: "Present", dayType: "Holiday", firstIn: null, latestIn: null, grossMinutes: 480,
    })).toBe("in");
  });

  it("marks an explicit absent status absent", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: "Absent", dayType: "Working", firstIn: null, latestIn: null, grossMinutes: 0,
    })).toBe("absent");
    // An absent day type still loses to a leave day type, which is the stronger fact.
    expect(deriveTimesheetStatus({
      recorded: true, status: "Absent", dayType: "On Leave", firstIn: null, latestIn: null, grossMinutes: 0,
    })).toBe("leave");
  });

  it("treats half days as present rather than inventing a seventh state", () => {
    expect(deriveTimesheetStatus({ ...WORKING_DAY, status: "Half Day", grossMinutes: 300 })).toBe("in");
  });

  it("leaves a record with no usable status unrecorded instead of guessing", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: null, dayType: null, firstIn: null, latestIn: null, grossMinutes: null,
    })).toBe("not_recorded");
    expect(deriveTimesheetStatus({
      recorded: true, status: "   ", dayType: "Working", firstIn: "", latestIn: "", grossMinutes: 0,
    })).toBe("not_recorded");
    expect(deriveTimesheetStatus({
      recorded: true, status: "Weird Import Value", dayType: "Working", firstIn: null, latestIn: null, grossMinutes: 0,
    })).toBe("not_recorded");
  });

  it("trusts punches even when the status is unrecognised", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: "Weird Import Value", dayType: "Working", firstIn: "08:00", latestIn: "09:29", grossMinutes: 600,
    })).toBe("in");
  });

  it("ignores a non-finite gross figure", () => {
    expect(deriveTimesheetStatus({
      recorded: true, status: "Present", dayType: "Weekly Off", firstIn: null, latestIn: null, grossMinutes: Number.NaN,
    })).toBe("off");
  });
});

describe("monthDays", () => {
  it("covers every calendar day of the month", () => {
    expect(monthDays("2026-09")).toHaveLength(30);
    expect(monthDays("2026-09")[0]).toBe("2026-09-01");
    expect(monthDays("2026-09")[29]).toBe("2026-09-30");
    expect(monthDays("2026-01")).toHaveLength(31);
    expect(monthDays("2024-02")).toHaveLength(29);
    expect(monthDays("2026-02")).toHaveLength(28);
  });

  it("returns nothing for an unusable period", () => {
    expect(monthDays("")).toEqual([]);
    expect(monthDays("2026-13")).toEqual([]);
    expect(monthDays("not-a-period")).toEqual([]);
  });
});

describe("isWorkerCategoryRow", () => {
  it("keeps every real category code", () => {
    for (const code of ["FTE", "WC-PERM", "WC-3PE", "regular"]) {
      expect(isWorkerCategoryRow(code)).toBe(true);
    }
  });

  it("drops the imported prose note row", () => {
    const prose = "Worker class carries time and pay policy, not just statutory applicability."
      + " Every attribute here is overridable on the individual assignment with a reason.";
    expect(prose.length).toBeGreaterThan(WORKER_CATEGORY_CODE_MAX);
    expect(isWorkerCategoryRow(prose)).toBe(false);
  });

  it("drops a missing or blank code", () => {
    expect(isWorkerCategoryRow(null)).toBe(false);
    expect(isWorkerCategoryRow(undefined)).toBe(false);
    expect(isWorkerCategoryRow("")).toBe(false);
    expect(isWorkerCategoryRow("   ")).toBe(false);
  });

  it("keeps a code exactly at the ceiling and drops the one past it", () => {
    expect(isWorkerCategoryRow("x".repeat(WORKER_CATEGORY_CODE_MAX))).toBe(true);
    expect(isWorkerCategoryRow("x".repeat(WORKER_CATEGORY_CODE_MAX + 1))).toBe(false);
  });
});

describe("attendance engine console contracts", () => {
  const sources = {
    console: readFileSync(resolve(process.cwd(), "src/server/attendance/engine-console.ts"), "utf8"),
  };
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);
  // The console also reads the relational attendance tables the first migration
  // creates (`attendance_punches`, `attendance_days`) — the session strip is
  // derived from the punch rows, which are not canonical jsonb tables and so are
  // absent from the 0008 topology list.
  const base = readFileSync(resolve(process.cwd(), "db/migrations/0000_greedy_invaders.sql"), "utf8");
  for (const match of base.matchAll(/CREATE TABLE "([a-z_]+)"/g)) known.add(match[1]);

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
    expect(source).not.toMatch(/\binsert\s+into\b|\bupdate\s+[a-z_]+\s+set\b|\bdelete\s+from\b/i);
  });

  it("gates every read behind the attendance read permission", () => {
    // Four tenant-wide reads keep the plain full key; the four reads that name one
    // employee go through `enforceEmployeeRead`, which resolves full -> team -> self
    // and confines a self key to its own holder. Eight gates, no ungated read.
    const enforced = sources.console.match(/enforce\(access\.context, READ_PERMISSION/g) ?? [];
    const perEmployee = sources.console.match(/enforceEmployeeRead\(access, employeeId\)/g) ?? [];
    expect(enforced.length).toBe(4);
    expect(perEmployee.length).toBe(4);
    expect(enforced.length + perEmployee.length).toBe(8);
    expect(sources.console).toContain('const READ_PERMISSION = "attendance.read"');
  });

  it("isolates the auxiliary rule-statement read so a failure never fails the card", () => {
    expect(sources.console).toContain("statements = [];");
  });

  it("re-derives the gate-pass ceiling from policy instead of copying the number", () => {
    const sql = sqlOf(sources.console);
    expect(sql).toContain("max_hours_per_month");
    expect(sql).toContain("monthly_minutes");
    // The ceiling is only ever read out of the policy table: the figure is
    // never restated as a literal in any statement this module runs.
    expect(sql).not.toMatch(/\b240\b/);
  });
});

describe("deriveCurrentSession", () => {
  const EMPLOYEE = "3c1d9f2e-7a44-4b10-9c3e-5d81b0a27f64";
  const IN_AT = "2026-09-15T09:02:11+05:30";
  const SECOND_IN_AT = "2026-09-15T14:05:00+05:30";

  it("reports an open session when the day's last punch is an in", () => {
    expect(
      deriveCurrentSession(EMPLOYEE, { lastType: "in", openInAt: IN_AT, firstInAt: IN_AT, elapsedMinutes: 37 }),
    ).toEqual({ employeeId: EMPLOYEE, checkedInAt: IN_AT, elapsedMinutes: 37, open: true });
  });

  it("closes the session as soon as an out follows, and stops the running clock", () => {
    // The worked figure for a closed day is the engine's, not a clock still ticking.
    expect(
      deriveCurrentSession(EMPLOYEE, { lastType: "out", openInAt: IN_AT, firstInAt: IN_AT, elapsedMinutes: 480 }),
    ).toEqual({ employeeId: EMPLOYEE, checkedInAt: IN_AT, elapsedMinutes: null, open: false });
  });

  it("runs an after-break session from the latest in, not the first one", () => {
    const view = deriveCurrentSession(EMPLOYEE, {
      lastType: "in",
      openInAt: SECOND_IN_AT,
      firstInAt: IN_AT,
      elapsedMinutes: 12,
    });
    expect(view.checkedInAt).toBe(SECOND_IN_AT);
    expect(view.open).toBe(true);
  });

  it("still names the day's first in once the session has closed", () => {
    const view = deriveCurrentSession(EMPLOYEE, {
      lastType: "out",
      openInAt: SECOND_IN_AT,
      firstInAt: IN_AT,
      elapsedMinutes: 12,
    });
    expect(view.checkedInAt).toBe(IN_AT);
    expect(view.open).toBe(false);
  });

  it("reports nothing rather than a fabricated zero on a day with no punches", () => {
    expect(
      deriveCurrentSession(EMPLOYEE, { lastType: null, openInAt: null, firstInAt: null, elapsedMinutes: null }),
    ).toEqual({ employeeId: EMPLOYEE, checkedInAt: null, elapsedMinutes: null, open: false });
  });

  it("cannot call a session open without the in punch that anchors it", () => {
    expect(
      deriveCurrentSession(EMPLOYEE, { lastType: "in", openInAt: null, firstInAt: null, elapsedMinutes: 9 }).open,
    ).toBe(false);
    // An open session with no measured elapsed time says so instead of guessing.
    expect(
      deriveCurrentSession(EMPLOYEE, { lastType: "IN", openInAt: IN_AT, firstInAt: IN_AT, elapsedMinutes: null }),
    ).toEqual({ employeeId: EMPLOYEE, checkedInAt: IN_AT, elapsedMinutes: null, open: true });
  });
});

describe("the session read model is derived from punches, not from attendance_sessions", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/attendance/engine-console.ts"), "utf8");
  const sessionSelect = source.slice(source.indexOf("const SESSION_SELECT"), source.indexOf("export type SessionPunchFacts"));

  it("reads attendance_punches and never attendance_sessions", () => {
    expect(sessionSelect).toContain("from attendance_punches punch");
    expect(sessionSelect).not.toContain("attendance_sessions");
  });

  it("scopes the punches to the tenant's own work date", () => {
    expect(sessionSelect).toContain("att_day.attendance_date = ((now() at time zone coalesce(tn.timezone, $3))::date)");
    expect(sessionSelect).toContain("att_day.employee_id = $2::uuid");
  });

  it("decides openness from the latest punch, and measures elapsed time from the latest in", () => {
    expect(sessionSelect).toContain("(array_agg(lower(punch.type) order by punch.punched_at desc))[1] as last_type");
    expect(sessionSelect).toContain("max(punch.punched_at) filter (where lower(punch.type) = 'in')");
    expect(sessionSelect).toContain("min(punch.punched_at) filter (where lower(punch.type) = 'in')");
  });

  it("reads both stored spellings of the shift window so the targets are not blank", () => {
    // The seeder writes start_time/end_time; ensureShift writes starts_at/ends_at.
    expect(source).toContain("coalesce(nullif(s.attributes->>'starts_at', ''), nullif(s.attributes->>'start_time', '')) as starts_at");
    expect(source).toContain("coalesce(nullif(s.attributes->>'ends_at', ''), nullif(s.attributes->>'end_time', '')) as ends_at");
  });

  it("gates every per-employee read through the shared attendance scope resolver", () => {
    expect(source).toContain("const scope = attendanceScope(access, \"read\");");
    expect(source).toContain("assertSelfScopeTarget(scope, access.context.employeeId, employeeId);");
    for (const reader of ["getCurrentSession", "getActiveShiftAssignment", "getGatePassQuota", "listMonthlyTimesheet"]) {
      const body = source.slice(source.indexOf(`export async function ${reader}`));
      expect(body.slice(0, 400)).toContain("enforceEmployeeRead(access, employeeId)");
    }
  });

  it("still writes nothing", () => {
    expect(source).not.toMatch(/\binsert into\b|\bupdate\s+attendance_|\bdelete from\b/i);
  });
});
