import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveGatePassState, rejectionNote } from "./gate-pass-register";
import { deriveOvertimeState, formatOvertimeHours, overtimeLabel } from "./overtime-register";

describe("deriveGatePassState", () => {
  it("reads the title-case statuses the imported rows carry", () => {
    expect(deriveGatePassState("Approved")).toBe("approved");
    expect(deriveGatePassState("Rejected")).toBe("rejected");
    expect(deriveGatePassState("Credited")).toBe("credited");
  });

  it("reads the lower-case statuses the application writes", () => {
    expect(deriveGatePassState("approved")).toBe("approved");
    expect(deriveGatePassState("rejected")).toBe("rejected");
    expect(deriveGatePassState("submitted")).toBe("pending_approval");
    expect(deriveGatePassState("pending")).toBe("pending_approval");
    expect(deriveGatePassState("awaiting approval")).toBe("pending_approval");
    expect(deriveGatePassState("declined")).toBe("rejected");
  });

  it("matches on a prefix so a rejection carrying its explanation still reads as rejected", () => {
    expect(deriveGatePassState("Rejected — monthly ceiling of 240 minutes already used and 2 instances taken")).toBe("rejected");
    expect(deriveGatePassState("rejected - ceiling used")).toBe("rejected");
    expect(deriveGatePassState("  Approved by supervisor  ")).toBe("approved");
  });

  it("never guesses a decided state from an unknown or absent status", () => {
    expect(deriveGatePassState("draft")).toBe("draft");
    expect(deriveGatePassState("something else")).toBe("draft");
    expect(deriveGatePassState("")).toBe("draft");
    expect(deriveGatePassState("   ")).toBe("draft");
    expect(deriveGatePassState(null)).toBe("draft");
    expect(deriveGatePassState(undefined)).toBe("draft");
  });
});

describe("rejectionNote", () => {
  it("returns the stored explanation after an em dash", () => {
    expect(rejectionNote("Rejected — monthly ceiling of 240 minutes already used and 2 instances taken"))
      .toBe("monthly ceiling of 240 minutes already used and 2 instances taken");
  });

  it("also reads an en dash or a spaced hyphen", () => {
    expect(rejectionNote("Rejected – ceiling used")).toBe("ceiling used");
    expect(rejectionNote("Rejected - ceiling used")).toBe("ceiling used");
  });

  it("keeps the rest of the sentence when it contains further dashes", () => {
    expect(rejectionNote("Rejected — ceiling used — see policy")).toBe("ceiling used — see policy");
  });

  it("returns null when the status carries no explanation", () => {
    expect(rejectionNote("Rejected")).toBe(null);
    expect(rejectionNote("Approved")).toBe(null);
    expect(rejectionNote("Rejected —   ")).toBe(null);
    expect(rejectionNote("")).toBe(null);
    expect(rejectionNote(null)).toBe(null);
    expect(rejectionNote(undefined)).toBe(null);
  });

  it("does not read a hyphenated word as an explanation", () => {
    expect(rejectionNote("Rejected-by-approver")).toBe(null);
  });
});

describe("deriveOvertimeState", () => {
  it("treats a payment as the strongest evidence", () => {
    expect(deriveOvertimeState("2026-09-09", "PR-2026-09-02", "9f1c2e5a-0000-4000-8000-000000000001")).toBe("paid");
    expect(deriveOvertimeState(null, null, "9f1c2e5a-0000-4000-8000-000000000001")).toBe("paid");
  });

  it("marks an entry tagged once a payroll run reference is stored", () => {
    expect(deriveOvertimeState("2026-09-09", "PR-2026-09-02", null)).toBe("tagged_to_run");
    expect(deriveOvertimeState(null, "PR-2026-09-02", null)).toBe("tagged_to_run");
  });

  it("marks an entry approved from its stored approval date alone", () => {
    expect(deriveOvertimeState("2026-09-07", null, null)).toBe("approved");
    expect(deriveOvertimeState("2026-09-07", "", null)).toBe("approved");
  });

  it("leaves an unapproved entry awaiting approval", () => {
    expect(deriveOvertimeState(null, null, null)).toBe("pending_approval");
    expect(deriveOvertimeState("", "", "")).toBe("pending_approval");
    expect(deriveOvertimeState("   ", "   ", "   ")).toBe("pending_approval");
  });

  it("does not read a stored absence marker as a payroll run tag", () => {
    // The comp-off row stores "Not paid" in pay_in_run; that is an absence,
    // not a run reference, so the entry stays merely approved.
    expect(deriveOvertimeState("2026-09-07", "Not paid", null)).toBe("approved");
    expect(deriveOvertimeState("2026-09-07", "-", null)).toBe("approved");
    expect(deriveOvertimeState("2026-09-07", "—", null)).toBe("approved");
  });
});

describe("formatOvertimeHours", () => {
  it("renders stored minutes as H:MM", () => {
    expect(formatOvertimeHours(440)).toBe("7:20");
    expect(formatOvertimeHours(12)).toBe("0:12");
    expect(formatOvertimeHours(728)).toBe("12:08");
    expect(formatOvertimeHours(60)).toBe("1:00");
  });

  it("renders an em dash rather than 0:00 when no overtime arose", () => {
    expect(formatOvertimeHours(0)).toBe("—");
    expect(formatOvertimeHours(null)).toBe("—");
    expect(formatOvertimeHours(undefined)).toBe("—");
    expect(formatOvertimeHours(Number.NaN)).toBe("—");
    expect(formatOvertimeHours(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("overtimeLabel", () => {
  it("prefers the stored label", () => {
    expect(overtimeLabel("7:20", 440)).toBe("7:20");
    expect(overtimeLabel("12:08", 728)).toBe("12:08");
  });

  it("derives the label when none was stored", () => {
    expect(overtimeLabel(null, 440)).toBe("7:20");
    expect(overtimeLabel("", 12)).toBe("0:12");
    // A stored dash is a placeholder, not a label.
    expect(overtimeLabel("-", 0)).toBe("—");
  });
});

describe("attendance operations register contracts", () => {
  const sources = {
    gatePass: readFileSync(resolve(process.cwd(), "src/server/attendance/gate-pass-register.ts"), "utf8"),
    overtime: readFileSync(resolve(process.cwd(), "src/server/attendance/overtime-register.ts"), "utf8"),
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

  it("isolates the audit trail so a failure never fails the record", () => {
    for (const source of Object.values(sources)) {
      expect(source).toContain("auditTrail = [];");
    }
  });

  it("keeps both registers behind the attendance read permission", () => {
    for (const source of Object.values(sources)) {
      expect(source).toContain('enforce(access.context, "attendance.read"');
    }
  });

  it("keeps the overtime actions behind the attendance write permission", () => {
    const writes = sources.overtime.match(/enforce\(access\.context, "attendance\.write"/g) ?? [];
    expect(writes.length).toBe(2);
  });

  it("never hardcodes the gate-pass monthly ceiling or the overtime multiplier", () => {
    // Both are stored values. The register reads them from gate_pass_policies
    // and from the entry / its overtime policy respectively.
    expect(sources.gatePass).toContain("gate_pass_policies");
    expect(sources.gatePass).toContain("max_hours_per_month");
    expect(sources.gatePass).toContain("monthly_minutes");
    expect(sources.gatePass).not.toMatch(/ceilingMinutes\s*=\s*240/);
    expect(sources.overtime).toContain("rate_multiplier");
    expect(sources.overtime).not.toMatch(/multiplier\s*[:=]\s*["']?2(\.0)?["']?\s*[;,]/);
  });

  it("counts only approved passes against the monthly quota", () => {
    expect(sources.gatePass).toContain("like 'approve%'");
  });

  it("reads both stored spellings of the gate-pass day", () => {
    expect(sources.gatePass).toContain("'pass_date'");
    expect(sources.gatePass).toContain("'date'");
  });

  it("holds the audit action strings outside the SQL text", () => {
    expect(sources.overtime).toContain('OVERTIME_APPROVE_ACTION = "attendance.overtime_approve"');
    expect(sources.overtime).toContain('OVERTIME_TAG_RUN_ACTION = "attendance.overtime_tag_run"');
    expect(sqlOf(sources.overtime)).not.toContain("attendance.overtime_");
  });

  it("raises a workflow conflict rather than overwriting a settled entry", () => {
    const conflicts = sources.overtime.match(/code: "WORKFLOW_CONFLICT"/g) ?? [];
    expect(conflicts.length).toBe(2);
  });
});
