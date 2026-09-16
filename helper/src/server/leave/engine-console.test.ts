import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PIPELINE_STAGES,
  buildPipeline,
  deriveCompOffStatus,
  deriveRulePackRules,
  foldBalanceCards,
  isCatalogLeaveType,
  renderAccrualNote,
  splitCannotCombineWith,
} from "./engine-console";

describe("deriveCompOffStatus", () => {
  it("keeps a stored consumed verdict whatever the expiry says", () => {
    expect(deriveCompOffStatus("Consumed", "2026-08-28", "2026-09-14")).toBe("consumed");
    expect(deriveCompOffStatus("Consumed", "2026-12-31", "2026-09-14")).toBe("consumed");
    expect(deriveCompOffStatus("consumed", null, "2026-09-14")).toBe("consumed");
    expect(deriveCompOffStatus("  CONSUMED  ", null, "2026-09-14")).toBe("consumed");
  });

  it("keeps a stored lapsed verdict even when the expiry is still ahead", () => {
    expect(deriveCompOffStatus("Lapsed", "2026-12-31", "2026-09-14")).toBe("lapsed");
    expect(deriveCompOffStatus("lapsed", null, "2026-09-14")).toBe("lapsed");
  });

  it("lapses an open grant whose expiry has passed", () => {
    expect(deriveCompOffStatus("Open", "2026-07-30", "2026-09-14")).toBe("lapsed");
  });

  it("keeps an open grant open while its expiry is still ahead", () => {
    expect(deriveCompOffStatus("Open", "2026-11-05", "2026-09-14")).toBe("open");
  });

  it("treats an expiry falling today as not yet passed", () => {
    expect(deriveCompOffStatus("Open", "2026-09-14", "2026-09-14")).toBe("open");
  });

  it("trims a timestamp down to its date before comparing", () => {
    expect(deriveCompOffStatus("Open", "2026-09-13T23:59:00+05:30", "2026-09-14")).toBe("lapsed");
  });

  it("reads an unknown, absent or empty status as open", () => {
    expect(deriveCompOffStatus(null, null, "2026-09-14")).toBe("open");
    expect(deriveCompOffStatus(undefined, undefined, "2026-09-14")).toBe("open");
    expect(deriveCompOffStatus("", "", "2026-09-14")).toBe("open");
    expect(deriveCompOffStatus("Pending", null, "2026-09-14")).toBe("open");
    // An unknown status still lapses on a passed expiry.
    expect(deriveCompOffStatus("Pending", "2026-01-01", "2026-09-14")).toBe("lapsed");
  });
});

describe("isCatalogLeaveType", () => {
  it("keeps the real leave types", () => {
    expect(isCatalogLeaveType("EL", "Earned Leave")).toBe(true);
    expect(isCatalogLeaveType("COFF", "Compensatory Off")).toBe(true);
  });

  it("drops the narrative note row whose code is a whole sentence", () => {
    const prose =
      "Casual leave cannot be taken with or merged into earned or sick leave, and is capped at 2 days a month.";
    expect(isCatalogLeaveType(prose, null)).toBe(false);
    // Even had the note carried a name, a sentence is not a leave-type code.
    expect(isCatalogLeaveType(prose, "Validation note")).toBe(false);
  });

  it("drops a row with no name and a row with no code", () => {
    expect(isCatalogLeaveType("EL", null)).toBe(false);
    expect(isCatalogLeaveType("EL", "   ")).toBe(false);
    expect(isCatalogLeaveType("", "Earned Leave")).toBe(false);
    expect(isCatalogLeaveType(null, null)).toBe(false);
    expect(isCatalogLeaveType(undefined, undefined)).toBe(false);
  });

  it("keeps a code exactly on the twelve-character boundary", () => {
    expect(isCatalogLeaveType("ABCDEFGHIJKL", "Twelve")).toBe(true);
    expect(isCatalogLeaveType("ABCDEFGHIJKLM", "Thirteen")).toBe(false);
  });
});

describe("splitCannotCombineWith", () => {
  it("splits the stored list and trims each code", () => {
    expect(splitCannotCombineWith("EL, SL")).toEqual(["EL", "SL"]);
    expect(splitCannotCombineWith("  EL ,SL  ,  CL ")).toEqual(["EL", "SL", "CL"]);
    expect(splitCannotCombineWith("CL")).toEqual(["CL"]);
  });

  it("returns an empty list when nothing is stored", () => {
    expect(splitCannotCombineWith(null)).toEqual([]);
    expect(splitCannotCombineWith(undefined)).toEqual([]);
    expect(splitCannotCombineWith("")).toEqual([]);
    expect(splitCannotCombineWith("   ")).toEqual([]);
    expect(splitCannotCombineWith(",")).toEqual([]);
    expect(splitCannotCombineWith(", ,")).toEqual([]);
  });
});

describe("buildPipeline", () => {
  it("returns all three stages even when nothing is waiting", () => {
    const pipeline = buildPipeline([]);
    expect(pipeline.stages.map((stage) => stage.stage)).toEqual([...PIPELINE_STAGES]);
    expect(pipeline.stages.map((stage) => stage.count)).toEqual([0, 0, 0]);
    expect(pipeline.totalPending).toBe(0);
  });

  it("fills the counted stages and leaves the rest at zero", () => {
    const pipeline = buildPipeline([
      { status: "pending_hod", total: 6 },
      { status: "pending_supervisor", total: 6 },
    ]);
    expect(pipeline.stages.map((stage) => stage.count)).toEqual([6, 6, 0]);
    expect(pipeline.totalPending).toBe(12);
    expect(pipeline.stages.map((stage) => stage.label)).toEqual([
      "Pending supervisor",
      "Pending HOD",
      "Pending HR",
    ]);
  });

  it("ignores a status outside the chain", () => {
    const pipeline = buildPipeline([
      { status: "approved", total: 9 },
      { status: "PENDING_HR", total: 2 },
    ]);
    expect(pipeline.totalPending).toBe(2);
    expect(pipeline.stages[2].count).toBe(2);
  });
});

describe("deriveRulePackRules", () => {
  it("renders each stored setting as one line, keyed on the stored key", () => {
    expect(
      deriveRulePackRules({ code: "in-pay/v1", scope: "country-level-india", status: "approved" }),
    ).toEqual(["Scope: country-level-india", "Status: approved"]);
  });

  it("prefers an explicit stored rules list", () => {
    expect(deriveRulePackRules({ code: "x", rules: ["No negative balances", " Encash EL only "] })).toEqual([
      "No negative balances",
      "Encash EL only",
    ]);
    expect(deriveRulePackRules({ rules: [{ label: "Carry forward capped" }, { other: 1 }] })).toEqual([
      "Carry forward capped",
      '{"other":1}',
    ]);
  });

  it("returns an empty list when there is nothing stored", () => {
    expect(deriveRulePackRules(null)).toEqual([]);
    expect(deriveRulePackRules(undefined)).toEqual([]);
    expect(deriveRulePackRules({})).toEqual([]);
    expect(deriveRulePackRules({ code: "x", version: "1", demo_point: "Point 7" })).toEqual([]);
  });
});

describe("renderAccrualNote", () => {
  it("states one rule when every band accrues alike", () => {
    expect(
      renderAccrualNote([
        { accrualFrequency: "Annual", daysPerPeriod: 6, leaveBand: "AGM_AND_ABOVE" },
        { accrualFrequency: "Annual", daysPerPeriod: 6, leaveBand: "STANDARD" },
      ]),
    ).toBe("Annual, 6 days per period");
  });

  it("names the bands when they differ", () => {
    expect(
      renderAccrualNote([
        { accrualFrequency: "Annual", daysPerPeriod: 18, leaveBand: "AGM_AND_ABOVE" },
        { accrualFrequency: "Monthly", daysPerPeriod: 1.5, leaveBand: "STANDARD" },
      ]),
    ).toBe("Annual, 18 days per period (AGM_AND_ABOVE); Monthly, 1.5 days per period (STANDARD)");
  });

  it("renders a frequency with no stored days-per-period on its own", () => {
    expect(renderAccrualNote([{ accrualFrequency: "Annual", daysPerPeriod: null, leaveBand: null }])).toBe("Annual");
  });

  it("returns null when no rule stores either setting", () => {
    expect(renderAccrualNote([])).toBeNull();
    expect(renderAccrualNote([{ accrualFrequency: null, daysPerPeriod: null, leaveBand: "STANDARD" }])).toBeNull();
    expect(renderAccrualNote([{ accrualFrequency: "", daysPerPeriod: null, leaveBand: "" }])).toBeNull();
  });
});

describe("foldBalanceCards", () => {
  it("sums credits and debits per leave type across both stored shapes", () => {
    const cards = foldBalanceCards([
      { leaveType: "EL", leaveTypeName: "Earned Leave", transactionType: "Credit", days: 18 },
      { leaveType: "EL", leaveTypeName: "Earned Leave", transactionType: "Debit", days: 5 },
      { leaveType: "CL", leaveTypeName: "Casual Leave", transactionType: "credit", days: 6 },
      { leaveType: "CL", leaveTypeName: "Casual Leave", transactionType: "debit", days: 2 },
    ]);
    expect(cards).toEqual([
      { leaveType: "CL", leaveTypeName: "Casual Leave", allocated: 6, availed: 2, available: 4 },
      { leaveType: "EL", leaveTypeName: "Earned Leave", allocated: 18, availed: 5, available: 13 },
    ]);
  });

  it("counts every kind the application writes and scores an unrecognised movement as nothing", () => {
    const cards = foldBalanceCards([
      { leaveType: "EL", leaveTypeName: null, transactionType: "Credit", days: 10 },
      { leaveType: "EL", leaveTypeName: null, transactionType: "accrual", days: 1.5 },
      { leaveType: "EL", leaveTypeName: null, transactionType: "Reversal", days: 2 },
      // A submit-time hold is a withdrawal until it is released; it used to score
      // zero, along with grants, accruals, encashments and lapses.
      { leaveType: "EL", leaveTypeName: null, transactionType: "reserve", days: 3 },
      { leaveType: "EL", leaveTypeName: null, transactionType: "encash", days: 1 },
      { leaveType: "EL", leaveTypeName: null, transactionType: "not-a-movement", days: 4 },
      { leaveType: "EL", leaveTypeName: null, transactionType: null, days: 4 },
    ]);
    expect(cards[0]).toEqual({ leaveType: "EL", leaveTypeName: null, allocated: 11.5, availed: 6, available: 5.5 });
  });

  it("rounds half days rather than carrying floating-point drift", () => {
    const cards = foldBalanceCards([
      { leaveType: "EL", leaveTypeName: null, transactionType: "Credit", days: 1.5 },
      { leaveType: "EL", leaveTypeName: null, transactionType: "Debit", days: 0.3 },
    ]);
    expect(cards[0].available).toBe(1.2);
  });

  it("returns no cards for an employee with no movements", () => {
    expect(foldBalanceCards([])).toEqual([]);
  });
});

describe("leave engine console contracts", () => {
  const source = readFileSync(resolve(process.cwd(), "src/server/leave/engine-console.ts"), "utf8");
  const topology = readFileSync(resolve(process.cwd(), "db/migrations/0008_canonical_304_topology.sql"), "utf8");
  const known = new Set(topology.match(/'([a-z_]+)'/g)?.map((entry) => entry.replace(/'/g, "")) ?? []);

  // Only template literals that actually carry a statement are scanned, so an
  // error message such as "…from status draft" is never read as a table.
  function sqlOf(input: string): string {
    return [...input.matchAll(/`([\s\S]*?)`/g)]
      .map((span) => span[1].replace(/\$\{[^}]*\}/g, ""))
      .filter((span) => /\b(select|insert\s+into|update)\b/i.test(span))
      .join("\n");
  }

  it("reads the canonical topology", () => {
    expect(known.size).toBeGreaterThan(100);
  });

  it("references only migrated tables", () => {
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

  it("binds every SQL alias it references", () => {
    const sql = sqlOf(source);
    const bound = new Set<string>();
    for (const match of sql.matchAll(/(?:from|join)\s+"?([a-z_]+)"?(?:\s+(?:as\s+)?([a-z_]+))?/g)) {
      bound.add(match[1]);
      if (
        match[2] &&
        !["where", "order", "limit", "left", "right", "inner", "outer", "cross", "on", "group", "lateral", "set"].includes(match[2])
      ) {
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

  it("uses no DDL", () => {
    expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  });

  it("writes nothing — the console is read-only", () => {
    expect(source).not.toMatch(/\b(insert\s+into|update\s+[a-z_]+\s+set|delete\s+from)\b/i);
  });

  it("scopes every read to the caller's tenant behind a leave permission", () => {
    const enforcements = source.match(/enforce\(access\.context, "[a-z.]+"/g) ?? [];
    expect(enforcements.length).toBe(7);
    for (const enforcement of enforcements) expect(enforcement).toContain('"leave.read"');
    for (const statement of sqlOf(source).split(/limit \d+/)) {
      if (/\bfrom\b/.test(statement)) expect(statement).toMatch(/tenant_id = \$1/);
    }
  });

  it("never re-derives a balance from the service layer's known-buggy reader", () => {
    expect(source).not.toContain("getBalances");
    expect(source).not.toContain("leave/service");
  });
});
