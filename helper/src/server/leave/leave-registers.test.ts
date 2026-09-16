import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { approvalStepLabel, deriveLeaveRequestState } from "./request-register";
import { deriveLedgerState, projectLedger, splitMovement } from "./ledger-register";
import { POLICY_TRANSITIONS, deriveLeavePolicyState } from "./policy-register";

describe("deriveLeaveRequestState", () => {
  it("collapses every approval step onto pending approval", () => {
    for (const status of ["pending_supervisor", "pending_hod", "pending_hr"]) {
      expect(deriveLeaveRequestState(status, "2026-09-20", null, "2026-09-14")).toBe("pending_approval");
    }
  });

  it("closes rejected, cancelled and withdrawn requests", () => {
    for (const status of ["rejected", "cancelled", "canceled", "withdrawn", "REJECTED"]) {
      expect(deriveLeaveRequestState(status, "2026-09-20", null, "2026-09-14")).toBe("closed");
    }
  });

  it("short-closes a request once an early return is recorded", () => {
    expect(deriveLeaveRequestState("approved", "2026-09-20", "2026-09-16", "2026-09-14")).toBe("closed");
    // The early return wins even while the approval chain is still open.
    expect(deriveLeaveRequestState("pending_hod", "2026-09-20", "2026-09-16", "2026-09-14")).toBe("closed");
  });

  it("marks an approved request as availed only once its last day has passed", () => {
    expect(deriveLeaveRequestState("approved", "2026-09-20", null, "2026-09-14")).toBe("approved");
    expect(deriveLeaveRequestState("approved", "2026-09-13", null, "2026-09-14")).toBe("availed");
    // A missing end date cannot prove the leave was availed.
    expect(deriveLeaveRequestState("approved", null, null, "2026-09-14")).toBe("approved");
    expect(deriveLeaveRequestState("approved", "", null, "2026-09-14")).toBe("approved");
  });

  it("keeps draft distinct and treats anything unrecognised as validated", () => {
    expect(deriveLeaveRequestState("draft", null, null, "2026-09-14")).toBe("draft");
    expect(deriveLeaveRequestState("submitted", null, null, "2026-09-14")).toBe("validated");
    expect(deriveLeaveRequestState(null, null, null, "2026-09-14")).toBe("validated");
    expect(deriveLeaveRequestState(undefined, null, null, "2026-09-14")).toBe("validated");
  });
});

describe("approvalStepLabel", () => {
  it("names each step in the chain", () => {
    expect(approvalStepLabel("pending_supervisor")).toBe("Pending supervisor");
    expect(approvalStepLabel("pending_hod")).toBe("Pending HOD");
    expect(approvalStepLabel("pending_hr")).toBe("Pending HR");
    expect(approvalStepLabel("approved")).toBe("Approved");
    expect(approvalStepLabel("")).toBe("Not recorded");
    expect(approvalStepLabel(null)).toBe("Not recorded");
  });
});

describe("splitMovement", () => {
  it("sends credits and debits to their own columns", () => {
    expect(splitMovement("Credit", 18)).toEqual({ credit: 18, debit: 0 });
    expect(splitMovement("Debit", 5)).toEqual({ credit: 0, debit: 5 });
  });

  it("treats reversals and encashments as withdrawals", () => {
    expect(splitMovement("Reversal", 2)).toEqual({ credit: 0, debit: 2 });
    expect(splitMovement("Encashment", 3)).toEqual({ credit: 0, debit: 3 });
  });

  it("normalises the application's lower-case kind and negative days", () => {
    expect(splitMovement("credit", 6)).toEqual({ credit: 6, debit: 0 });
    expect(splitMovement("debit", -4)).toEqual({ credit: 0, debit: 4 });
  });

  it("scores an unknown or absent movement as zero rather than guessing", () => {
    expect(splitMovement("", 9)).toEqual({ credit: 0, debit: 0 });
    expect(splitMovement(null, 9)).toEqual({ credit: 0, debit: 0 });
    expect(splitMovement("Credit", Number.NaN)).toEqual({ credit: 0, debit: 0 });
  });
});

describe("deriveLedgerState", () => {
  it("marks an entry reversed by a later entry", () => {
    expect(deriveLedgerState("Credit", null, true, "2026-09-14")).toBe("reversed");
    expect(deriveLedgerState("Reversal", null, false, "2026-09-14")).toBe("reversed");
  });

  it("marks encashments", () => {
    expect(deriveLedgerState("Encashment", null, false, "2026-09-14")).toBe("encashed");
  });

  it("expires a dated credit once its expiry has passed", () => {
    expect(deriveLedgerState("Credit", "2026-08-31", false, "2026-09-14")).toBe("expired");
    expect(deriveLedgerState("Credit", "2026-12-31", false, "2026-09-14")).toBe("projected");
  });

  it("projects undated movements", () => {
    expect(deriveLedgerState("Credit", null, false, "2026-09-14")).toBe("projected");
    expect(deriveLedgerState(null, "", false, "2026-09-14")).toBe("projected");
  });
});

describe("projectLedger", () => {
  const base = {
    ledger_reference: "LL",
    employee_code: "E1",
    employee_name: "A B",
    leave_type_name: "Earned Leave",
    effective_date: "2026-01-01",
    expires_on: null,
    narration: null,
    source_reference: null,
    reversed: false,
  };

  it("carries a running balance per employee and leave type", () => {
    const rows = projectLedger([
      { ...base, id: "1", employee_id: "e1", leave_type: "EL", transaction_type: "Credit", days: 18 },
      { ...base, id: "2", employee_id: "e1", leave_type: "EL", transaction_type: "Debit", days: 5 },
      { ...base, id: "3", employee_id: "e1", leave_type: "CL", transaction_type: "Credit", days: 6 },
      { ...base, id: "4", employee_id: "e2", leave_type: "EL", transaction_type: "Credit", days: 12 },
    ]);
    expect(rows.map((row) => row.balance)).toEqual([18, 13, 6, 12]);
    expect(rows.map((row) => row.credit)).toEqual([18, 0, 6, 12]);
    expect(rows.map((row) => row.debit)).toEqual([0, 5, 0, 0]);
  });

  it("rounds the balance to avoid floating-point drift on half days", () => {
    const rows = projectLedger([
      { ...base, id: "1", employee_id: "e1", leave_type: "EL", transaction_type: "Credit", days: 1.5 },
      { ...base, id: "2", employee_id: "e1", leave_type: "EL", transaction_type: "Debit", days: 0.3 },
    ]);
    expect(rows[1].balance).toBe(1.2);
  });

  it("returns an empty projection for no movements", () => {
    expect(projectLedger([])).toEqual([]);
  });
});

describe("deriveLeavePolicyState", () => {
  it("maps each stored record status", () => {
    expect(deriveLeavePolicyState("draft")).toBe("draft");
    expect(deriveLeavePolicyState("simulated")).toBe("simulated");
    expect(deriveLeavePolicyState("active")).toBe("effective");
    expect(deriveLeavePolicyState("superseded")).toBe("superseded");
    expect(deriveLeavePolicyState("archived")).toBe("superseded");
    expect(deriveLeavePolicyState("inactive")).toBe("superseded");
    expect(deriveLeavePolicyState(null)).toBe("effective");
    expect(deriveLeavePolicyState(undefined)).toBe("effective");
  });
});

describe("POLICY_TRANSITIONS", () => {
  it("never allows a superseded rule back into effect", () => {
    for (const transition of Object.values(POLICY_TRANSITIONS)) {
      expect(transition.from).not.toContain("superseded");
    }
  });

  it("only activates from draft or simulated", () => {
    expect(POLICY_TRANSITIONS.activate.from).toEqual(["draft", "simulated"]);
    expect(POLICY_TRANSITIONS.activate.to).toBe("active");
  });
});

describe("leave register contracts", () => {
  const sources = {
    request: readFileSync(resolve(process.cwd(), "src/server/leave/request-register.ts"), "utf8"),
    ledger: readFileSync(resolve(process.cwd(), "src/server/leave/ledger-register.ts"), "utf8"),
    policy: readFileSync(resolve(process.cwd(), "src/server/leave/policy-register.ts"), "utf8"),
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

  it("keeps the policy transition behind an approval permission", () => {
    expect(sources.policy).toContain('enforce(access.context, "leave.approve"');
  });
});
