import { describe, expect, it } from "vitest";

import {
  BIRTHDATE_COVERAGE_NOTE,
  BIRTHDATE_PERMISSION,
  birthdatesWithheld,
  completedYearsOfService,
  daysBetween,
  isIsoDate,
  joinerRelation,
  milestonesQuery,
  monthDayKey,
  monthDayLabel,
  occurrenceIn,
  projectAnniversaries,
  projectBirthdays,
  projectNewJoiners,
  rollingWindow,
  windowFilter,
  type AnniversarySource,
  type BirthdaySource,
} from "./milestones";

const ASHA: Omit<BirthdaySource, "month" | "day"> = {
  employeeId: "11111111-1111-4111-8111-111111111111",
  name: "Asha Rao",
  employeeCode: "MK-0001",
  department: "Weaving",
  designation: "Spinning Operator",
};

const BIJOY: Omit<BirthdaySource, "month" | "day"> = {
  employeeId: "22222222-2222-4222-8222-222222222222",
  name: "Bijoy Das",
  employeeCode: "MK-0002",
  department: "Quality",
  designation: "Inspector",
};

describe("isIsoDate", () => {
  it("accepts a real date and rejects a well-formed impossible one", () => {
    expect(isIsoDate("2025-02-28")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    // 2025 is not a leap year, so this is a string that looks like a date.
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2025-13-01")).toBe(false);
    expect(isIsoDate("2025-04-31")).toBe(false);
    expect(isIsoDate("15/09/2025")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("rollingWindow", () => {
  it("is inclusive of today and runs the requested number of days", () => {
    const window = rollingWindow("2025-09-15", 14);
    expect(window).toHaveLength(14);
    expect(window[0]).toEqual({ date: "2025-09-15", month: 9, day: 15, offset: 0 });
    expect(window[13]).toEqual({ date: "2025-09-28", month: 9, day: 28, offset: 13 });
  });

  it("crosses a year boundary into January", () => {
    const window = rollingWindow("2025-12-28", 14);
    expect(window[0].date).toBe("2025-12-28");
    expect(window[3]).toEqual({ date: "2025-12-31", month: 12, day: 31, offset: 3 });
    expect(window[4]).toEqual({ date: "2026-01-01", month: 1, day: 1, offset: 4 });
    expect(window[13].date).toBe("2026-01-10");
  });

  it("includes 29 February in a leap year and omits it in a common one", () => {
    const leap = rollingWindow("2024-02-20", 14).map((entry) => entry.date);
    expect(leap).toContain("2024-02-29");
    expect(leap).toContain("2024-03-04");

    const common = rollingWindow("2023-02-20", 14).map((entry) => entry.date);
    expect(common).not.toContain("2023-02-29");
    expect(common).toContain("2023-02-28");
    expect(common).toContain("2023-03-05");
  });

  it("returns nothing for a bad date or a non-positive span", () => {
    expect(rollingWindow("2025-02-29", 14)).toEqual([]);
    expect(rollingWindow("2025-09-15", 0)).toEqual([]);
    expect(rollingWindow("2025-09-15", -3)).toEqual([]);
  });
});

describe("windowFilter", () => {
  it("collects the distinct months and days the window spans", () => {
    const filter = windowFilter(rollingWindow("2025-12-28", 14));
    expect(filter.months).toEqual([12, 1]);
    expect(filter.days).toEqual([28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("matches a superset of the window, which occurrenceIn then narrows", () => {
    const window = rollingWindow("2025-12-28", 14);
    const { months, days } = windowFilter(window);
    // 1 December satisfies both arrays independently, so the SQL would return
    // it; it is not in the window, so the projection must drop it.
    expect(months).toContain(12);
    expect(days).toContain(1);
    expect(occurrenceIn(window, 12, 1)).toBeNull();
    expect(occurrenceIn(window, 1, 1)?.date).toBe("2026-01-01");
  });
});

describe("monthDayKey and monthDayLabel", () => {
  it("zero-pads the key so 1 February and 12 January never collide", () => {
    expect(monthDayKey(2, 1)).toBe("02-01");
    expect(monthDayKey(1, 12)).toBe("01-12");
    expect(monthDayKey(2, 1)).not.toBe(monthDayKey(1, 2));
  });

  it("labels a month and a day without any year", () => {
    expect(monthDayLabel(9, 15)).toBe("15 Sep");
    expect(monthDayLabel(2, 29)).toBe("29 Feb");
    expect(monthDayLabel(12, 31)).toBe("31 Dec");
    expect(monthDayLabel(13, 1)).toBe("");
    expect(monthDayLabel(0, 1)).toBe("");
    expect(monthDayLabel(1, 32)).toBe("");
  });
});

describe("completedYearsOfService", () => {
  it("counts a year only once the anniversary day has arrived", () => {
    expect(completedYearsOfService("2020-09-15", "2025-09-15")).toBe(5);
    expect(completedYearsOfService("2020-09-15", "2025-09-14")).toBe(4);
    expect(completedYearsOfService("2020-09-15", "2025-09-16")).toBe(5);
  });

  it("does not round a December joiner up on New Year's Day", () => {
    expect(completedYearsOfService("2019-12-30", "2020-01-02")).toBe(0);
    expect(completedYearsOfService("2019-12-30", "2020-12-29")).toBe(0);
    expect(completedYearsOfService("2019-12-30", "2020-12-30")).toBe(1);
    expect(completedYearsOfService("2019-12-31", "2026-01-01")).toBe(6);
  });

  it("handles a 29 February joiner", () => {
    // The anniversary only falls on 29 February in a leap year.
    expect(completedYearsOfService("2020-02-29", "2024-02-29")).toBe(4);
    // In a common year, 28 February has not reached the 29th yet.
    expect(completedYearsOfService("2020-02-29", "2023-02-28")).toBe(2);
    expect(completedYearsOfService("2020-02-29", "2023-03-01")).toBe(3);
  });

  it("never returns a negative count for a future joining date", () => {
    expect(completedYearsOfService("2026-03-01", "2025-09-15")).toBe(0);
    expect(completedYearsOfService("2025-09-16", "2025-09-15")).toBe(0);
  });

  it("returns 0 rather than guessing when a date is unusable", () => {
    expect(completedYearsOfService("", "2025-09-15")).toBe(0);
    expect(completedYearsOfService("2025-02-29", "2025-09-15")).toBe(0);
  });
});

describe("daysBetween and joinerRelation", () => {
  it("counts whole days in both directions across a year boundary", () => {
    expect(daysBetween("2025-09-15", "2025-09-15")).toBe(0);
    expect(daysBetween("2025-12-28", "2026-01-10")).toBe(13);
    expect(daysBetween("2025-09-15", "2025-08-16")).toBe(-30);
    // 2024 is a leap year: February has 29 days.
    expect(daysBetween("2024-02-01", "2024-03-01")).toBe(29);
    expect(daysBetween("2023-02-01", "2023-03-01")).toBe(28);
  });

  it("calls today's joiner joined, and tomorrow's joining", () => {
    expect(joinerRelation("2025-09-15", "2025-09-15")).toBe("joined");
    expect(joinerRelation("2025-09-14", "2025-09-15")).toBe("joined");
    expect(joinerRelation("2025-09-16", "2025-09-15")).toBe("joining");
  });
});

describe("projectBirthdays", () => {
  const window = rollingWindow("2025-12-28", 14);

  it("keeps only month/day pairs inside the window and orders them soonest first", () => {
    const entries = projectBirthdays(
      [
        { ...BIJOY, month: 1, day: 3 },
        { ...ASHA, month: 12, day: 29 },
        // Same day and month digits, but 1 December is outside the window.
        { ...ASHA, employeeId: "outside", name: "Outside Window", month: 12, day: 1 },
      ],
      window,
    );
    expect(entries.map((entry) => entry.name)).toEqual(["Asha Rao", "Bijoy Das"]);
    expect(entries[0]).toMatchObject({ dateLabel: "29 Dec", occursOn: "2025-12-29", daysAway: 1 });
    expect(entries[1]).toMatchObject({ dateLabel: "3 Jan", occursOn: "2026-01-03", daysAway: 6 });
  });

  it("returns no year anywhere in an entry", () => {
    const [entry] = projectBirthdays([{ ...ASHA, month: 12, day: 29 }], window);
    // `occursOn` is the upcoming occurrence derived from the window, not the
    // birth date; nothing in the entry can carry a birth year.
    expect(Object.keys(entry).sort()).toEqual(
      [
        "dateLabel",
        "day",
        "daysAway",
        "department",
        "designation",
        "employeeCode",
        "employeeId",
        "month",
        "name",
        "occursOn",
      ].sort(),
    );
    expect(entry.dateLabel).not.toMatch(/\d{4}/);
  });

  it("surfaces a 29 February birthday only in a leap year", () => {
    const leap = rollingWindow("2024-02-20", 14);
    const common = rollingWindow("2023-02-20", 14);
    const rows: BirthdaySource[] = [{ ...ASHA, month: 2, day: 29 }];
    expect(projectBirthdays(rows, leap)).toHaveLength(1);
    expect(projectBirthdays(rows, leap)[0].occursOn).toBe("2024-02-29");
    expect(projectBirthdays(rows, common)).toHaveLength(0);
  });

  it("is empty when no row carries a birth date, which is not the same as no birthdays", () => {
    expect(projectBirthdays([], window)).toEqual([]);
    expect(BIRTHDATE_COVERAGE_NOTE.none).toContain("gap in the data");
  });
});

describe("projectAnniversaries", () => {
  const window = rollingWindow("2025-09-15", 14);

  it("reports completed years on the anniversary date", () => {
    const rows: AnniversarySource[] = [
      { ...ASHA, joiningDate: "2020-09-20", month: 9, day: 20 },
      { ...BIJOY, joiningDate: "2015-09-16", month: 9, day: 16 },
    ];
    const entries = projectAnniversaries(rows, window);
    expect(entries.map((entry) => [entry.name, entry.years, entry.daysAway])).toEqual([
      ["Bijoy Das", 10, 1],
      ["Asha Rao", 5, 5],
    ]);
  });

  it("drops somebody whose first day falls inside the window", () => {
    const rows: AnniversarySource[] = [{ ...ASHA, joiningDate: "2025-09-20", month: 9, day: 20 }];
    // 0 completed years is a new joiner, not a work anniversary.
    expect(projectAnniversaries(rows, window)).toEqual([]);
  });

  it("counts the year correctly across a year boundary", () => {
    const december = rollingWindow("2025-12-28", 14);
    const rows: AnniversarySource[] = [
      { ...ASHA, joiningDate: "2019-12-30", month: 12, day: 30 },
      { ...BIJOY, joiningDate: "2020-01-02", month: 1, day: 2 },
    ];
    const entries = projectAnniversaries(rows, december);
    expect(entries.map((entry) => [entry.name, entry.occursOn, entry.years])).toEqual([
      ["Asha Rao", "2025-12-30", 6],
      ["Bijoy Das", "2026-01-02", 6],
    ]);
  });
});

describe("projectNewJoiners", () => {
  it("labels each joiner against today and orders most recent first", () => {
    const entries = projectNewJoiners(
      [
        { ...ASHA, joiningDate: "2025-09-01" },
        { ...BIJOY, joiningDate: "2025-09-22" },
      ],
      "2025-09-15",
    );
    expect(entries.map((entry) => [entry.name, entry.relation, entry.daysFromToday])).toEqual([
      ["Bijoy Das", "joining", 7],
      ["Asha Rao", "joined", -14],
    ]);
  });
});

describe("the birthday gate", () => {
  it("names the permission the migration registered and keeps the other panels", () => {
    expect(BIRTHDATE_PERMISSION).toBe("employee.birthdate.read");
    const withheld = birthdatesWithheld();
    expect(withheld.available).toBe(false);
    expect(withheld.permission).toBe("employee.birthdate.read");
    expect(withheld.reason).toContain("employee.birthdate.read");
    expect(withheld.reason).toContain("The other panels are unaffected.");
  });
});

describe("milestonesQuery", () => {
  it("clamps the window and refuses an unknown filter", () => {
    expect(milestonesQuery.parse({}).windowDays).toBeUndefined();
    expect(milestonesQuery.parse({ windowDays: "21" }).windowDays).toBe(21);
    expect(milestonesQuery.safeParse({ windowDays: "0" }).success).toBe(false);
    expect(milestonesQuery.safeParse({ windowDays: "61" }).success).toBe(false);
    expect(milestonesQuery.safeParse({ lookbackDays: "181" }).success).toBe(false);
    expect(milestonesQuery.safeParse({ birthYear: "1990" }).success).toBe(false);
  });
});
