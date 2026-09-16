import { describe, expect, it } from "vitest";

import {
  AUDIENCE_SCOPES,
  DEFAULT_AUDIENCE_SCOPES,
  audienceRuleFor,
  audienceScopeFor,
  isBirthdayOn,
  isJoiningOn,
  occasionCopy,
  occasionKey,
  parseAudienceScopeConfig,
  planOccasions,
  type OccasionCandidate,
} from "./occasion-announcements";

const PUNE: OccasionCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  employeeCode: "MK-0001",
  name: "Asha Rao",
  department: "Weaving",
  location: "Plant North",
  designation: "Spinning Operator",
  legalEntityId: null,
  dateOfBirth: "1990-09-15",
  joiningDate: "2020-04-01",
};

const JOINER: OccasionCandidate = {
  ...PUNE,
  id: "22222222-2222-4222-8222-222222222222",
  employeeCode: "MK-0002",
  name: "Ravi Menon",
  dateOfBirth: "1988-02-02",
  joiningDate: "2026-09-15",
};

describe("occasion detection (R-21)", () => {
  it("matches a birthday on month and day, whatever the birth year", () => {
    expect(isBirthdayOn("1990-09-15", "2026-09-15")).toBe(true);
    expect(isBirthdayOn("1990-09-16", "2026-09-15")).toBe(false);
    expect(isBirthdayOn(null, "2026-09-15")).toBe(false);
    expect(isBirthdayOn("15/09/1990", "2026-09-15")).toBe(false);
  });

  it("matches a 29 February birthday only in a leap year, inventing no substitute date", () => {
    expect(isBirthdayOn("1992-02-29", "2028-02-29")).toBe(true);
    expect(isBirthdayOn("1992-02-29", "2026-02-28")).toBe(false);
    expect(isBirthdayOn("1992-02-29", "2026-03-01")).toBe(false);
  });

  it("announces a joiner on the joining date only", () => {
    expect(isJoiningOn("2026-09-15", "2026-09-15")).toBe(true);
    expect(isJoiningOn("2026-09-14", "2026-09-15")).toBe(false);
  });
});

describe("audience scope is configuration, not a coded rule (R-21)", () => {
  it("defaults birthdays to the location and joiners to everyone", () => {
    expect(DEFAULT_AUDIENCE_SCOPES.birthday).toBe("location");
    expect(DEFAULT_AUDIENCE_SCOPES.joiner).toBe("all");
    expect(audienceScopeFor("birthday", null)).toBe("location");
    expect(audienceScopeFor("joiner", null)).toBe("all");
  });

  it("lets a tenant override either type without touching the other", () => {
    const config = parseAudienceScopeConfig({ birthday: "department" });
    expect(audienceScopeFor("birthday", config)).toBe("department");
    expect(audienceScopeFor("joiner", config)).toBe("all");
  });

  it("ignores a configuration naming a scope that cannot be resolved", () => {
    // "grade" is the workbook's fourth option and has no employee relationship here.
    expect(AUDIENCE_SCOPES).not.toContain("grade");
    expect(parseAudienceScopeConfig({ birthday: "grade" })).toBeNull();
  });

  it("builds a rule from the employee's own value on the configured dimension", () => {
    expect(audienceRuleFor("location", PUNE)).toEqual({ ok: true, rule: "location:Plant North" });
    expect(audienceRuleFor("department", PUNE)).toEqual({ ok: true, rule: "department:Weaving" });
    expect(audienceRuleFor("all", PUNE)).toEqual({ ok: true, rule: "all" });
  });

  it("refuses rather than widening to everyone when the employee has no value there", () => {
    const noLocation = { ...PUNE, location: null };
    const result = audienceRuleFor("location", noLocation);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("MK-0001");
  });
});

describe("the occasion plan (T-35)", () => {
  const asOf = "2026-09-15";

  it("raises a birthday and a joiner without anyone typing them", () => {
    const plan = planOccasions({ asOf, employees: [PUNE, JOINER], config: null, existingKeys: new Set() });
    expect(plan.planned.map((entry) => entry.kind).sort()).toEqual(["birthday", "joiner"]);
    const birthday = plan.planned.find((entry) => entry.kind === "birthday");
    const joiner = plan.planned.find((entry) => entry.kind === "joiner");
    // Scoped to the configured audience: location for a birthday, everyone for a joiner.
    expect(birthday?.rule).toBe("location:Plant North");
    expect(joiner?.rule).toBe("all");
    expect(birthday?.copy.title).toContain("Asha Rao");
    expect(joiner?.copy.body).toContain("Ravi Menon");
  });

  it("writes nothing on a second run of the same day", () => {
    const first = planOccasions({ asOf, employees: [PUNE, JOINER], config: null, existingKeys: new Set() });
    const keys = new Set(first.planned.map((entry) => entry.key));
    const second = planOccasions({ asOf, employees: [PUNE, JOINER], config: null, existingKeys: keys });
    expect(second.planned).toEqual([]);
    expect(second.skipped).toEqual([]);
  });

  it("keys one occasion per employee per year, so next year raises again", () => {
    expect(occasionKey("birthday", PUNE.id, "2026-09-15")).toBe(`birthday:${PUNE.id}:2026`);
    expect(occasionKey("birthday", PUNE.id, "2027-09-15")).not.toBe(occasionKey("birthday", PUNE.id, "2026-09-15"));
  });

  it("names the employee it could not announce instead of dropping them silently", () => {
    const plan = planOccasions({
      asOf,
      employees: [{ ...PUNE, location: "  " }],
      config: null,
      existingKeys: new Set(),
    });
    expect(plan.planned).toEqual([]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]?.kind).toBe("birthday");
  });

  it("writes copy that satisfies the publish endpoint's own length rules", () => {
    for (const kind of ["birthday", "joiner"] as const) {
      const copy = occasionCopy(kind, PUNE, asOf);
      expect(copy.title.length).toBeGreaterThanOrEqual(5);
      expect(copy.title.length).toBeLessThanOrEqual(120);
      expect(copy.body.length).toBeGreaterThanOrEqual(20);
      expect(copy.body.length).toBeLessThanOrEqual(5000);
    }
  });
});
