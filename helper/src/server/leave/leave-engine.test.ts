import { describe, expect, it } from "vitest";
import { buildLeaveScheme, leaveSchemeGaps, parseLeaveSchemeSettings } from "./configuration";
import { foldLedgerBalances } from "./ledger";
import { movementDirection, splitMovement } from "./ledger-register";
import {
  addMonths,
  coffLapseDate,
  combinationConflict,
  monthlyAvailingViolation,
  planLeaveAccrual,
  resolveJoiningProration,
  yearEndTreatment,
  type LeaveScheme,
} from "./scheme";

/**
 * The client's worked examples, run through the engine that will answer them.
 *
 * Every case below is a line from `05-rules-and-calculations.md` or
 * `10-acceptance-tests.md`, and every expectation calls application code — the
 * scheme loader, the accrual planner, the ledger fold, the lapse date. Nothing
 * here restates a constant back to itself.
 */

/** A tenant that has answered the three open questions the engine is blocked on. */
function answeredScheme(overrides: Parameters<typeof buildLeaveScheme>[1] = {}): LeaveScheme {
  return buildLeaveScheme([], {
    seniorGradeRank: 7,
    coffLapseDayBasis: "calendar",
    ...overrides,
    types: {
      CL: { joiningAfterCutoffDays: 0, ...(overrides?.types?.CL ?? {}) },
      SL: { joiningAfterCutoffDays: 0, ...(overrides?.types?.SL ?? {}) },
      ...(overrides?.types ?? {}),
    },
  });
}

describe("scheme configuration (09-configuration-register: the LVE and EMP rows)", () => {
  it("falls back to the client's own stated policy when nothing is configured", () => {
    const scheme = buildLeaveScheme([], null);
    expect(scheme.types.EL.annualDays).toBe(18);
    expect(scheme.types.EL.daysPerPeriod).toBe(1.5);
    expect(scheme.types.CL.maxAvailedPerMonth).toBe(2);
    expect(scheme.types.EL.maxAvailedPerMonth).toBe(10);
    expect(scheme.types.CL.cannotCombineWith).toEqual(["EL", "SL"]);
  });

  it("leaves the three unstated values unset rather than defaulting them", () => {
    const scheme = buildLeaveScheme([], null);
    expect(scheme.seniorGradeRank).toBeNull();
    expect(scheme.coffLapseDayBasis).toBeNull();
    expect(scheme.types.CL.joiningAfterCutoffDays).toBeNull();
    expect(leaveSchemeGaps(scheme).map((gap) => gap.question)).toEqual(
      expect.arrayContaining(["Q-06", "Q-07", "Q-02"]),
    );
  });

  it("reads the stored leave type configuration in place of the stated figures", () => {
    const scheme = buildLeaveScheme(
      [
        {
          code: "EL",
          configuration: { annual_days: 24, accrual_frequency: "monthly", eligibility_wait_days: 90, excluded_with: ["SL"] },
          year_end_action: "Lapse",
          max_per_month: 8,
          cannot_combine_with: null,
          annual_days: 24,
          accrual_frequency: "monthly",
          days_per_period: null,
          eligibility_wait_months: null,
          credit_on_completion: 6,
        },
      ],
      null,
    );
    expect(scheme.types.EL.annualDays).toBe(24);
    expect(scheme.types.EL.daysPerPeriod).toBe(2);
    expect(scheme.types.EL.minimumServiceMonths).toBe(3);
    expect(scheme.types.EL.catchUpDays).toBe(6);
    expect(scheme.types.EL.maxAvailedPerMonth).toBe(8);
    expect(scheme.types.EL.cannotCombineWith).toEqual(["SL"]);
    expect(yearEndTreatment(scheme, "EL")).toBe("lapse");
  });

  it("does not let an unfilled exclusion field remove RL-11's restriction", () => {
    // FRM-LVE-01 stores `excluded_with: []` when the field is simply left blank.
    const scheme = buildLeaveScheme(
      [
        {
          code: "CL",
          configuration: { excluded_with: [] },
          year_end_action: null,
          max_per_month: null,
          cannot_combine_with: null,
          annual_days: null,
          accrual_frequency: null,
          days_per_period: null,
          eligibility_wait_months: null,
          credit_on_completion: null,
        },
      ],
      null,
    );
    expect(scheme.types.CL.cannotCombineWith).toEqual(["EL", "SL"]);
    // Saying so explicitly in the scheme settings does clear it.
    const cleared = buildLeaveScheme([], { types: { CL: { cannotCombineWith: [] } } });
    expect(cleared.types.CL.cannotCombineWith).toEqual([]);
  });

  it("rejects a malformed scheme setting rather than half-reading it", () => {
    expect(parseLeaveSchemeSettings({ seniorGradeRank: "AGM" })).toBeNull();
    expect(parseLeaveSchemeSettings(null)).toBeNull();
    expect(parseLeaveSchemeSettings({ seniorGradeRank: 7 })?.seniorGradeRank).toBe(7);
  });
});

describe("RL-07 / T-11 senior grade annual credit", () => {
  it("credits an AGM who joined 15 June the full 18/6/6 the next 1 January, in one movement", () => {
    const plan = planLeaveAccrual({
      scheme: answeredScheme(),
      gradeRank: 7,
      joiningDate: "2025-06-15",
      asOf: "2026-01-01",
    });
    expect(plan.senior).toBe(true);
    expect(plan.onRollsOnJanuaryFirst).toBe(true);
    expect(plan.lines.map((line) => [line.leaveType, line.days])).toEqual([
      ["EL", 18],
      ["CL", 6],
      ["SL", 6],
    ]);
    // One movement, not three unrelated credits: every line shares the occurrence.
    expect(new Set(plan.lines.map((line) => line.occurrence)).size).toBe(1);
  });

  it("does not turn the senior branch on for a joining date inside the accrual year", () => {
    const plan = planLeaveAccrual({
      scheme: answeredScheme(),
      gradeRank: 7,
      joiningDate: "2026-06-15",
      asOf: "2026-06-30",
    });
    expect(plan.onRollsOnJanuaryFirst).toBe(false);
    expect(plan.lines.map((line) => [line.leaveType, line.days])).toEqual([
      ["CL", 3],
      ["SL", 3],
    ]);
  });

  it("refuses every employee while the senior grade rank is unanswered (Q-06)", () => {
    expect(() =>
      planLeaveAccrual({ scheme: buildLeaveScheme([], null), gradeRank: 7, joiningDate: "2020-01-01", asOf: "2026-01-01" }),
    ).toThrow(/Q-06/);
  });
});

describe("RL-08 / T-12 monthly EL and the once-a-year CL and SL", () => {
  it("accrues 1.5 EL a month and 18 across the year for an established employee", () => {
    const scheme = answeredScheme();
    const months = Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}-01`);
    const el = months.flatMap(
      (asOf) => planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2020-04-01", asOf }).lines.filter((line) => line.leaveType === "EL"),
    );
    expect(el).toHaveLength(12);
    expect(el.every((line) => line.days === 1.5)).toBe(true);
    expect(el.reduce((total, line) => total + line.days, 0)).toBe(18);
    expect(new Set(el.map((line) => line.occurrence)).size).toBe(12);
  });

  it("credits CL and SL once, in January, and never again that year", () => {
    const scheme = answeredScheme();
    const january = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2020-04-01", asOf: "2026-01-01" });
    expect(january.lines.filter((line) => line.leaveType !== "EL").map((line) => [line.leaveType, line.days])).toEqual([
      ["CL", 6],
      ["SL", 6],
    ]);
    const february = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2020-04-01", asOf: "2026-02-01" });
    expect(february.lines.filter((line) => line.leaveType !== "EL")).toEqual([]);
  });

  it("stops applying the joining-month proration once the joining year is over", () => {
    const scheme = answeredScheme();
    // A 20 April 2025 joiner takes 4 CL in 2025 and the full 6 from 2026 on.
    const joiningYear = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2025-04-20", asOf: "2025-04-20" });
    expect(joiningYear.lines.find((line) => line.leaveType === "CL")?.days).toBe(4);
    const nextYear = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2025-04-20", asOf: "2026-01-01" });
    expect(nextYear.lines.find((line) => line.leaveType === "CL")?.days).toBe(6);
  });
});

describe("RL-09 / T-13 new joiner EL hold and catch-up", () => {
  const scheme = answeredScheme();

  it("counts six months as calendar months, not 180 or 183 days", () => {
    expect(addMonths("2026-03-01", 6)).toBe("2026-09-01");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("withholds EL for a 1 March joiner through to 31 August", () => {
    for (const asOf of ["2026-03-01", "2026-04-01", "2026-06-01", "2026-08-01", "2026-08-31"]) {
      const plan = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2026-03-01", asOf });
      expect(plan.lines.filter((line) => line.leaveType === "EL")).toEqual([]);
    }
  });

  it("releases a single credit of 9 EL on 1 September", () => {
    const plan = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2026-03-01", asOf: "2026-09-01" });
    const el = plan.lines.filter((line) => line.leaveType === "EL");
    expect(el).toHaveLength(1);
    expect(el[0].days).toBe(9);
    expect(el[0].basis).toBe("catch_up");
  });

  it("returns to the monthly 1.5 from the month after the catch-up", () => {
    const october = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2026-03-01", asOf: "2026-10-01" });
    expect(october.lines.filter((line) => line.leaveType === "EL").map((line) => [line.basis, line.days])).toEqual([
      ["monthly", 1.5],
    ]);
  });

  it("holds EL past the joining year when the six months straddle 1 January", () => {
    const january = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2025-11-01", asOf: "2026-01-01" });
    expect(january.lines.filter((line) => line.leaveType === "EL")).toEqual([]);
    // CL and SL still arrive in full, because the employee IS on the rolls on 1 January.
    expect(january.lines.map((line) => [line.leaveType, line.days])).toEqual([
      ["CL", 6],
      ["SL", 6],
    ]);
    const may = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2025-11-01", asOf: "2026-05-01" });
    expect(may.lines.filter((line) => line.leaveType === "EL").map((line) => line.days)).toEqual([9]);
  });
});

describe("RL-10 / T-14 new joiner CL and SL proration", () => {
  const scheme = answeredScheme();

  it.each([
    ["2026-01-15", 6],
    ["2026-04-20", 4],
    ["2026-12-02", 1],
  ])("credits a %s joiner %i CL and SL", (joiningDate, expected) => {
    const plan = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate, asOf: joiningDate });
    expect(plan.lines.filter((line) => line.leaveType !== "EL").map((line) => line.days)).toEqual([expected, expected]);
  });

  it("refuses a joiner after 4 December instead of assuming zero (Q-02)", () => {
    const unanswered = buildLeaveScheme([], { seniorGradeRank: 7, coffLapseDayBasis: "calendar" });
    expect(() => resolveJoiningProration(unanswered.types.CL, 12, 10)).toThrow(/Q-02/);
    expect(() => planLeaveAccrual({ scheme: unanswered, gradeRank: 3, joiningDate: "2026-12-10", asOf: "2026-12-10" })).toThrow(
      /Q-02/,
    );
  });

  it("uses the client's answer once it is configured", () => {
    const answered = answeredScheme({ types: { CL: { joiningAfterCutoffDays: 0 }, SL: { joiningAfterCutoffDays: 0 } } });
    expect(resolveJoiningProration(answered.types.CL, 12, 10)).toBe(0);
  });
});

describe("RL-13 trainee CL eligibility", () => {
  const scheme = answeredScheme();

  it("accrues CL for a GET trainee and withholds it from another trainee type", () => {
    const get = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2020-01-01", asOf: "2026-01-01", traineeType: "GET" });
    expect(get.lines.some((line) => line.leaveType === "CL")).toBe(true);
    const apprentice = planLeaveAccrual({ scheme, gradeRank: 3, joiningDate: "2020-01-01", asOf: "2026-01-01", traineeType: "APPRENTICE" });
    expect(apprentice.lines.some((line) => line.leaveType === "CL")).toBe(false);
    expect(apprentice.lines.some((line) => line.leaveType === "SL")).toBe(true);
  });
});

describe("RL-11 / T-15 combination restriction", () => {
  const scheme = answeredScheme();

  it("blocks CL beside EL or SL, in either direction", () => {
    expect(combinationConflict(scheme, "CL", "EL")).toBe(true);
    expect(combinationConflict(scheme, "EL", "CL")).toBe(true);
    expect(combinationConflict(scheme, "CL", "SL")).toBe(true);
  });

  it("leaves EL and SL free to sit beside each other", () => {
    expect(combinationConflict(scheme, "EL", "SL")).toBe(false);
    expect(combinationConflict(scheme, "EL", "EL")).toBe(false);
  });

  it("follows the configured matrix rather than the stated one", () => {
    const relaxed = answeredScheme({ types: { CL: { cannotCombineWith: [], joiningAfterCutoffDays: 0 }, SL: { cannotCombineWith: [], joiningAfterCutoffDays: 0 } } });
    expect(combinationConflict(relaxed, "CL", "EL")).toBe(false);
  });
});

describe("RL-12 / T-16 monthly availing caps", () => {
  const scheme = answeredScheme();

  it("holds 2 CL and blocks the third day in the month", () => {
    expect(monthlyAvailingViolation(scheme, "CL", 2)).toBeNull();
    expect(monthlyAvailingViolation(scheme, "CL", 3)).toEqual({ leaveType: "CL", cap: 2, requested: 3 });
  });

  it("holds 10 EL and blocks the eleventh day in the month", () => {
    expect(monthlyAvailingViolation(scheme, "EL", 10)).toBeNull();
    expect(monthlyAvailingViolation(scheme, "EL", 11)).toEqual({ leaveType: "EL", cap: 10, requested: 11 });
  });

  it("does not cap a type the scheme gives no cap", () => {
    expect(monthlyAvailingViolation(scheme, "SL", 30)).toBeNull();
  });

  it("caps at the configured figure once one is stored", () => {
    const tightened = answeredScheme({ types: { CL: { maxAvailedPerMonth: 1, joiningAfterCutoffDays: 0 } } });
    expect(monthlyAvailingViolation(tightened, "CL", 2)).toEqual({ leaveType: "CL", cap: 1, requested: 2 });
  });
});

describe("RL-06 / T-10 COFF lapse date", () => {
  it("lapses a COFF earned 10 March on 9 May under a 60-day calendar window", () => {
    expect(coffLapseDate("2026-03-10", answeredScheme())).toBe("2026-05-09");
  });

  it("refuses while the calendar-or-working-day basis is unanswered (Q-07)", () => {
    expect(() => coffLapseDate("2026-03-10", buildLeaveScheme([], null))).toThrow(/Q-07/);
  });

  it("refuses a working-day basis that has no work calendar behind it", () => {
    const working = buildLeaveScheme([], { seniorGradeRank: 7, coffLapseDayBasis: "working" });
    expect(() => coffLapseDate("2026-03-10", working)).toThrow(/work calendar/);
  });

  it("follows a configured window length", () => {
    const shorter = buildLeaveScheme([], { seniorGradeRank: 7, coffLapseDayBasis: "calendar", coffLapseDays: 30 });
    expect(coffLapseDate("2026-03-10", shorter)).toBe("2026-04-09");
  });
});

describe("RL-14 / T-17 year-end treatment", () => {
  const scheme = answeredScheme();

  it("encashes EL and lapses CL and SL", () => {
    expect(yearEndTreatment(scheme, "EL")).toBe("encash");
    expect(yearEndTreatment(scheme, "CL")).toBe("lapse");
    expect(yearEndTreatment(scheme, "SL")).toBe("lapse");
  });

  it("encashes 7 days and lapses 5 for the worked example, counting days not employees", () => {
    // The closing balances come out of the ledger fold, so this is the same
    // arithmetic the run does rather than three numbers typed into the test.
    const balances = foldLedgerBalances([
      { leaveType: "EL", kind: "accrual", days: 18 },
      { leaveType: "EL", kind: "debit", days: 11 },
      { leaveType: "CL", kind: "accrual", days: 6 },
      { leaveType: "CL", kind: "debit", days: 4 },
      { leaveType: "SL", kind: "accrual", days: 6 },
      { leaveType: "SL", kind: "debit", days: 3 },
    ]);
    expect([balances.EL.balance, balances.CL.balance, balances.SL.balance]).toEqual([7, 2, 3]);
    let encashed = 0;
    let lapsed = 0;
    for (const [code, entry] of Object.entries(balances)) {
      if (yearEndTreatment(scheme, code) === "encash") encashed += entry.balance;
      else lapsed += entry.balance;
    }
    expect({ encashed, lapsed }).toEqual({ encashed: 7, lapsed: 5 });
  });

  it("refuses a type whose year-end treatment nobody has configured", () => {
    expect(() => yearEndTreatment(scheme, "COFF")).toThrow(/year-end treatment for COFF/);
  });
});

describe("ledger movement kinds", () => {
  it("scores every kind the application writes", () => {
    for (const kind of ["credit", "accrual", "grant", "release", "carry_forward"]) {
      expect(movementDirection(kind)).toBe("credit");
    }
    for (const kind of ["debit", "reserve", "reversal", "encash", "encashment", "lapse", "lapsed"]) {
      expect(movementDirection(kind)).toBe("debit");
    }
    expect(movementDirection("something else")).toBe("none");
  });

  it("moves a year-end encashment and a lapse off the balance", () => {
    const balances = foldLedgerBalances([
      { leaveType: "EL", kind: "accrual", days: 7 },
      { leaveType: "EL", kind: "encash", days: 7 },
      { leaveType: "CL", kind: "accrual", days: 2 },
      { leaveType: "CL", kind: "lapse", days: 2 },
    ]);
    expect(balances.EL.balance).toBe(0);
    expect(balances.CL.balance).toBe(0);
  });

  it("deducts an approved request once, not twice, across reserve, release and debit", () => {
    const balances = foldLedgerBalances([
      { leaveType: "EL", kind: "accrual", days: 18 },
      { leaveType: "EL", kind: "reserve", days: 3 },
      { leaveType: "EL", kind: "release", days: 3 },
      { leaveType: "EL", kind: "debit", days: 3 },
    ]);
    expect(balances.EL.balance).toBe(15);
  });

  it("puts a comp-off grant on the balance and a lapse run back off it", () => {
    const balances = foldLedgerBalances([
      { leaveType: "COFF", kind: "grant", days: 1 },
      { leaveType: "COFF", kind: "lapse", days: 1 },
    ]);
    expect(balances.COFF.balance).toBe(0);
    expect(splitMovement("grant", 1)).toEqual({ credit: 1, debit: 0 });
    expect(splitMovement("lapse", 1)).toEqual({ credit: 0, debit: 1 });
  });
});
