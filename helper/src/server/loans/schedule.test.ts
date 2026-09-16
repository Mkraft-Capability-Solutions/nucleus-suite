import { describe, expect, it } from "vitest";

import { addMonths, buildSchedule, requireInterestMethod, requireMoratoriumInterest, summariseSchedule, type ScheduleInput } from "./schedule";

/**
 * SCR-080 — loan amortisation acceptance.
 *
 * Pure arithmetic only: no database, no transport. Every assertion is on
 * integer minor units, because a schedule that is a paisa out is a schedule
 * that never closes.
 */

const base: ScheduleInput = {
  principalMinor: 20_000_000, // 200,000.00
  annualRatePercent: 10,
  tenureMonths: 24,
  startMonth: "2026-04",
  method: "reducing_balance",
  moratoriumMonths: 0,
  moratoriumInterest: "waive",
};

function closesExactly(instalments: ReadonlyArray<{ closingMinor: number; principalMinor: number }>, principalMinor: number): void {
  expect(instalments[instalments.length - 1].closingMinor).toBe(0);
  expect(instalments.reduce((sum, row) => sum + row.principalMinor, 0)).toBe(principalMinor);
}

describe("reducing-balance amortisation (SCR-080)", () => {
  it("computes the standard EMI and charges one month of interest on the opening balance", () => {
    const schedule = buildSchedule(base);
    // P=200,000.00 @10% for 24 months -> EMI 9,228.99 (independently reviewed).
    expect(schedule.instalmentMinor).toBe(922_899);
    expect(schedule.instalments).toHaveLength(24);
    expect(schedule.instalments[0].openingMinor).toBe(20_000_000);
    expect(schedule.instalments[0].interestMinor).toBe(Math.round(20_000_000 * (10 / 100 / 12)));
    expect(schedule.instalments[0].principalMinor).toBe(922_899 - 166_667);
    expect(schedule.instalments[0].instalmentMinor).toBe(922_899);
  });

  it("reduces the balance monotonically and dates each instalment from the start month", () => {
    const schedule = buildSchedule(base);
    for (let index = 1; index < schedule.instalments.length; index += 1) {
      expect(schedule.instalments[index].openingMinor).toBe(schedule.instalments[index - 1].closingMinor);
      expect(schedule.instalments[index].interestMinor).toBeLessThanOrEqual(schedule.instalments[index - 1].interestMinor);
    }
    expect(schedule.instalments[0].dueMonth).toBe("2026-04");
    expect(schedule.instalments[8].dueMonth).toBe("2026-12");
    expect(schedule.instalments[9].dueMonth).toBe("2027-01");
    expect(schedule.instalments[23].dueMonth).toBe("2028-03");
  });

  it("charges interest only on the outstanding balance, so total interest is below the flat equivalent", () => {
    const reducing = buildSchedule(base);
    const flat = buildSchedule({ ...base, method: "flat" });
    expect(reducing.totalInterestMinor).toBeLessThan(flat.totalInterestMinor);
    expect(reducing.totalPayableMinor).toBe(reducing.principalMinor + reducing.totalInterestMinor);
  });
});

describe("flat-rate amortisation (SCR-080)", () => {
  it("spreads principal and P x rate x years interest evenly across the instalments", () => {
    const schedule = buildSchedule({ ...base, method: "flat" });
    // 200,000.00 x 10% x 2 years = 40,000.00 total interest over 24 instalments.
    expect(schedule.totalInterestMinor).toBe(4_000_000);
    expect(schedule.instalments[0].interestMinor).toBe(Math.round(4_000_000 / 24));
    expect(schedule.instalments[0].principalMinor).toBe(Math.round(20_000_000 / 24));
    expect(schedule.instalments[0].interestMinor).toBe(schedule.instalments[12].interestMinor);
  });

  it("closes the ledger exactly despite the per-instalment rounding", () => {
    const schedule = buildSchedule({ ...base, method: "flat", principalMinor: 10_000_00 + 1, tenureMonths: 7 });
    closesExactly(schedule.instalments, 10_000_00 + 1);
    expect(schedule.instalments.reduce((sum, row) => sum + row.interestMinor, 0)).toBe(schedule.totalInterestMinor);
  });
});

describe("zero interest rate (SCR-080)", () => {
  it("falls back to principal / tenure on reducing balance and charges no interest", () => {
    const schedule = buildSchedule({ ...base, annualRatePercent: 0, tenureMonths: 10, principalMinor: 1_000_000 });
    expect(schedule.instalmentMinor).toBe(100_000);
    expect(schedule.totalInterestMinor).toBe(0);
    for (const row of schedule.instalments) expect(row.interestMinor).toBe(0);
    closesExactly(schedule.instalments, 1_000_000);
  });

  it("charges no interest on the flat method either", () => {
    const schedule = buildSchedule({ ...base, method: "flat", annualRatePercent: 0, tenureMonths: 10, principalMinor: 1_000_000 });
    expect(schedule.totalInterestMinor).toBe(0);
    expect(schedule.totalPayableMinor).toBe(1_000_000);
    closesExactly(schedule.instalments, 1_000_000);
  });
});

describe("residual absorption (SCR-080)", () => {
  it.each([
    ["reducing_balance" as const, 100_003, 7, 13.37],
    ["reducing_balance" as const, 33_333_333, 11, 9.75],
    ["flat" as const, 100_003, 7, 13.37],
    ["flat" as const, 33_333_333, 11, 9.75],
  ])("lands the final closing balance on exactly zero (%s, %i paise, %i months)", (method, principalMinor, tenureMonths, annualRatePercent) => {
    const schedule = buildSchedule({ ...base, method, principalMinor, tenureMonths, annualRatePercent });
    closesExactly(schedule.instalments, principalMinor);
    const last = schedule.instalments[schedule.instalments.length - 1];
    expect(last.instalmentMinor).toBe(last.principalMinor + last.interestMinor);
    for (const row of schedule.instalments) {
      expect(Number.isInteger(row.instalmentMinor)).toBe(true);
      expect(row.closingMinor).toBe(row.openingMinor - row.principalMinor);
    }
  });
});

describe("unrecorded loan configuration (SCR-080)", () => {
  it("refuses to amortise a loan with no interest method rather than defaulting to reducing balance", () => {
    expect(() => requireInterestMethod(null, "LN-1")).toThrowError(/has no interest method recorded/);
    expect(() => requireInterestMethod("emi", "LN-1")).toThrowError(/reducing_balance or flat/);
    expect(() => buildSchedule({ ...base, method: undefined as unknown as ScheduleInput["method"] })).toThrowError(
      /no interest method recorded/,
    );
  });

  it("refuses to amortise with no recorded moratorium interest treatment", () => {
    expect(() => requireMoratoriumInterest(undefined, "LN-1")).toThrowError(/no moratorium interest treatment recorded/);
    expect(() => buildSchedule({ ...base, moratoriumInterest: "" as unknown as ScheduleInput["moratoriumInterest"] })).toThrowError(
      /accrue or waive/,
    );
  });

  it("passes a recorded method and treatment through unchanged", () => {
    expect(requireInterestMethod("flat", "LN-1")).toBe("flat");
    expect(requireMoratoriumInterest("accrue", "LN-1")).toBe("accrue");
  });

  it("rejects structurally invalid inputs by field", () => {
    expect(() => buildSchedule({ ...base, principalMinor: 0 })).toThrowError(/positive integer number of minor units/);
    expect(() => buildSchedule({ ...base, principalMinor: 100.5 })).toThrowError(/positive integer number of minor units/);
    expect(() => buildSchedule({ ...base, tenureMonths: 0 })).toThrowError(/positive whole number of months/);
    expect(() => buildSchedule({ ...base, annualRatePercent: -1 })).toThrowError(/zero or a positive percentage/);
    expect(() => buildSchedule({ ...base, startMonth: "2026-13" })).toThrowError(/valid repayment start month/);
    expect(() => buildSchedule({ ...base, moratoriumMonths: -1 })).toThrowError(/zero or a positive whole number/);
  });
});

describe("moratorium treatment (SCR-080)", () => {
  it("defers the first instalment by the moratorium under both treatments", () => {
    const waived = buildSchedule({ ...base, moratoriumMonths: 3, moratoriumInterest: "waive" });
    const accrued = buildSchedule({ ...base, moratoriumMonths: 3, moratoriumInterest: "accrue" });
    expect(waived.instalments[0].dueMonth).toBe("2026-07");
    expect(accrued.instalments[0].dueMonth).toBe("2026-07");
    expect(waived.instalments).toHaveLength(24);
    expect(accrued.instalments).toHaveLength(24);
  });

  it("waiving leaves the borrower on the sanctioned principal and the same instalment", () => {
    const waived = buildSchedule({ ...base, moratoriumMonths: 3, moratoriumInterest: "waive" });
    const none = buildSchedule(base);
    expect(waived.amortisedPrincipalMinor).toBe(base.principalMinor);
    expect(waived.instalmentMinor).toBe(none.instalmentMinor);
    expect(waived.totalInterestMinor).toBe(none.totalInterestMinor);
    closesExactly(waived.instalments, base.principalMinor);
  });

  it("accruing capitalises the moratorium interest, raising the instalment and total interest", () => {
    const accrued = buildSchedule({ ...base, moratoriumMonths: 3, moratoriumInterest: "accrue" });
    const waived = buildSchedule({ ...base, moratoriumMonths: 3, moratoriumInterest: "waive" });
    expect(accrued.amortisedPrincipalMinor).toBe(Math.round(20_000_000 * Math.pow(1 + 10 / 100 / 12, 3)));
    expect(accrued.amortisedPrincipalMinor).toBeGreaterThan(base.principalMinor);
    expect(accrued.instalmentMinor).toBeGreaterThan(waived.instalmentMinor);
    expect(accrued.totalInterestMinor).toBeGreaterThan(waived.totalInterestMinor);
    // The capitalised balance is what amortises to zero.
    closesExactly(accrued.instalments, accrued.amortisedPrincipalMinor);
  });

  it("finances the moratorium months on the flat method only when interest accrues", () => {
    const accrued = buildSchedule({ ...base, method: "flat", moratoriumMonths: 6, moratoriumInterest: "accrue" });
    const waived = buildSchedule({ ...base, method: "flat", moratoriumMonths: 6, moratoriumInterest: "waive" });
    // 200,000.00 x 10% over 30 financed months vs 24.
    expect(accrued.totalInterestMinor).toBe(Math.round((20_000_000 * 0.1 * 30) / 12));
    expect(waived.totalInterestMinor).toBe(Math.round((20_000_000 * 0.1 * 24) / 12));
    closesExactly(accrued.instalments, base.principalMinor);
    closesExactly(waived.instalments, base.principalMinor);
  });

  it("treats a zero-month moratorium as no moratorium under either treatment", () => {
    const accrued = buildSchedule({ ...base, moratoriumMonths: 0, moratoriumInterest: "accrue" });
    expect(accrued.amortisedPrincipalMinor).toBe(base.principalMinor);
    expect(accrued.instalmentMinor).toBe(buildSchedule(base).instalmentMinor);
  });
});

describe("month arithmetic (SCR-080)", () => {
  it("rolls the year over forwards and backwards", () => {
    expect(addMonths("2026-04", 0)).toBe("2026-04");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-04", 36)).toBe("2029-04");
  });

  it("rejects a malformed month", () => {
    expect(() => addMonths("2026-00", 1)).toThrowError(/not a valid month/);
  });
});

describe("schedule progress summary (SCR-080)", () => {
  const schedule = buildSchedule({ ...base, tenureMonths: 12 });

  it("reports nothing settled before the first recovery", () => {
    const summary = summariseSchedule(schedule.instalments, 0);
    expect(summary.paidToDateMinor).toBe(0);
    expect(summary.instalmentsRemaining).toBe(12);
    expect(summary.nextDue?.seq).toBe(1);
    expect(summary.outstandingMinor).toBe(schedule.totalPayableMinor);
  });

  it("settles instalments only once they are covered in full", () => {
    const twoInstalments = schedule.instalments[0].instalmentMinor + schedule.instalments[1].instalmentMinor;
    expect(summariseSchedule(schedule.instalments, twoInstalments - 1).nextDue?.seq).toBe(2);
    const summary = summariseSchedule(schedule.instalments, twoInstalments);
    expect(summary.nextDue?.seq).toBe(3);
    expect(summary.instalmentsRemaining).toBe(10);
    expect(summary.outstandingMinor).toBe(schedule.totalPayableMinor - twoInstalments);
  });

  it("closes out at full recovery and never reports a negative outstanding", () => {
    const summary = summariseSchedule(schedule.instalments, schedule.totalPayableMinor + 5_000);
    expect(summary.outstandingMinor).toBe(0);
    expect(summary.instalmentsRemaining).toBe(0);
    expect(summary.nextDue).toBeNull();
    expect(summary.paidToDateMinor).toBe(schedule.totalPayableMinor);
  });

  it("ignores a negative recovery total", () => {
    expect(summariseSchedule(schedule.instalments, -100).paidToDateMinor).toBe(0);
  });
});
