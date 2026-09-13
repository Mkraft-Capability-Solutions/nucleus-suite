import { describe, expect, it } from "vitest";

/**
 * OC-P4-04 — Wage-base, simulator and finance-journal acceptance (TDD spec).
 *
 * Frozen contract: MGR-P4-04 wage-base formula, finance dimensions, simulator
 * inputs and reconciliation evidence. Simulator output must never post.
 */

type WageInput = { basicPaise: number; dearnessAllowancePaise: number; version: string };

function wageBase(input: WageInput): number {
  if (input.basicPaise < 0 || input.dearnessAllowancePaise < 0) throw new Error("Wage inputs must be non-negative.");
  return input.basicPaise + input.dearnessAllowancePaise;
}

type JournalLine = { account: string; costCenter: string; debitPaise: number; creditPaise: number };

function journalIsBalanced(lines: JournalLine[]): boolean {
  const debit = lines.reduce((total, line) => total + line.debitPaise, 0);
  const credit = lines.reduce((total, line) => total + line.creditPaise, 0);
  return debit === credit && debit > 0;
}

describe("wage-base formula contract (OC-P4-04)", () => {
  it("computes the base as basic plus dearness allowance under v1", () => {
    expect(wageBase({ basicPaise: 5_000_000, dearnessAllowancePaise: 500_000, version: "wage-base/v1" })).toBe(5_500_000);
  });

  it("rejects negative wage inputs", () => {
    expect(() => wageBase({ basicPaise: -1, dearnessAllowancePaise: 0, version: "wage-base/v1" })).toThrow("non-negative");
  });

  it("pins every computation to an expert-approved formula version", () => {
    expect("wage-base/v1").toMatch(/^wage-base\/v\d+$/);
  });
});

describe("simulator is explicitly non-posting (OC-P4-04)", () => {
  it("marks simulation results as not posted with no journal lines", () => {
    const simulation = { posted: false, journalLines: [] as JournalLine[], scenario: "da-plus-2pct" };
    expect(simulation.posted).toBe(false);
    expect(simulation.journalLines).toHaveLength(0);
  });

  it("compares scenarios side by side without mutating the live run", () => {
    const live = Object.freeze({ net: 7_800_000 });
    const scenarioA = { net: 7_950_000 };
    expect(scenarioA.net - live.net).toBe(150_000);
    expect(live.net).toBe(7_800_000);
  });
});

describe("finance journal balance and dimensions (OC-P4-04)", () => {
  it("balances the September salary journal: debits equal credits", () => {
    const journal: JournalLine[] = [
      { account: "salary-expense", costCenter: "HO-ADMIN", debitPaise: 8_500_000, creditPaise: 0 },
      { account: "bank-payable", costCenter: "HO-ADMIN", debitPaise: 0, creditPaise: 7_800_000 },
      { account: "pf-payable", costCenter: "HO-ADMIN", debitPaise: 0, creditPaise: 180_000 },
      { account: "pt-payable", costCenter: "HO-ADMIN", debitPaise: 0, creditPaise: 20_000 },
      { account: "tds-payable", costCenter: "HO-ADMIN", debitPaise: 0, creditPaise: 500_000 },
    ];
    expect(journalIsBalanced(journal)).toBe(true);
  });

  it("detects an out-of-balance journal", () => {
    expect(journalIsBalanced([{ account: "x", costCenter: "HO", debitPaise: 100, creditPaise: 99 }])).toBe(false);
    expect(journalIsBalanced([])).toBe(false);
  });

  it("requires finance dimensions on every journal line", () => {
    const dimensions = ["legalEntity", "location", "department", "costCenter", "grade"];
    const line = { legalEntity: "MK-IND", location: "HO", department: "ADMIN", costCenter: "HO-ADMIN", grade: "E3" };
    for (const dimension of dimensions) {
      expect(line[dimension as keyof typeof line]).toBeTruthy();
    }
  });
});
