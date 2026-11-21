import { describe, expect, it } from "vitest";
import { activeEntries, buildCareer, durationLabel, monthsBetween, type CareerEntry, type Company } from "./career";

const companies: Company[] = [
  { id: "group", name: "Tata Industries", code: "TIL", parentId: null, kind: "holding", industry: null, status: "active" },
  { id: "hotels", name: "Taj Hotels", code: "IHCL", parentId: "group", kind: "subsidiary", industry: "Hospitality", status: "active" },
  { id: "steel", name: "Tata Steel", code: "TSL", parentId: "group", kind: "subsidiary", industry: "Manufacturing", status: "active" },
  { id: "steel-corp", name: "Tata Steel Corporate Office", code: "TSL-CO", parentId: "steel", kind: "division", industry: null, status: "active" },
];

let sequence = 0;
function entry(overrides: Partial<CareerEntry>): CareerEntry {
  sequence += 1;
  return {
    id: `e${sequence}`, movementType: "transfer", effectiveFrom: "2020-01-01", companyId: null, companyName: null,
    location: null, department: null, designation: null, grade: null, category: null, managerId: null, managerName: null,
    reason: null, source: "move", supersedesId: null, recordedAt: `2026-01-01T00:00:0${sequence % 10}Z`, recordedBy: null,
    ...overrides,
  };
}

// The example from the requirement: hotel executive → sister manufacturing company as plant
// supervisor → promoted to staff head there → the same company's corporate office as senior manager.
const example = [
  entry({ id: "joined", movementType: "joined", effectiveFrom: "2018-04-01", companyId: "hotels", companyName: "Taj Hotels", designation: "Executive", department: "Front office", location: "Mumbai" }),
  entry({ id: "moved", movementType: "group_transfer", effectiveFrom: "2021-04-01", companyId: "steel", companyName: "Tata Steel", designation: "Plant supervisor", department: "Operations", location: "Jamshedpur" }),
  entry({ id: "promoted", movementType: "promotion", effectiveFrom: "2023-07-01", companyId: "steel", companyName: "Tata Steel", designation: "Staff head", department: "Operations", location: "Jamshedpur" }),
  entry({ id: "corporate", movementType: "group_transfer", effectiveFrom: "2025-10-01", companyId: "steel-corp", companyName: "Tata Steel Corporate Office", designation: "Senior manager, people development", department: "Human resources", location: "Mumbai" }),
];

describe("career history", () => {
  it("turns entries into consecutive stints with end dates and durations", () => {
    const view = buildCareer(example, companies, { today: "2026-11-20", groupName: "Tata group" });
    expect(view.stints.map((stint) => [stint.designation, stint.effectiveFrom, stint.endsOn, stint.current])).toEqual([
      ["Executive", "2018-04-01", "2021-03-31", false],
      ["Plant supervisor", "2021-04-01", "2023-06-30", false],
      ["Staff head", "2023-07-01", "2025-09-30", false],
      ["Senior manager, people development", "2025-10-01", null, true],
    ]);
    expect(durationLabel(view.stints[0]!.months)).toBe("3 yrs");
    expect(view.totals).toMatchObject({ companies: 3, positions: 4, promotions: 1, moves: 3 });
    expect(durationLabel(view.totals.months)).toBe("8 yrs 7 mos");
  });

  it("describes what changed at each move", () => {
    const view = buildCareer(example, companies, { today: "2026-11-20", groupName: "Tata group" });
    expect(view.stints[0]!.changes).toEqual([]);
    expect(view.stints[1]!.changes).toEqual([
      "Company: Taj Hotels → Tata Steel",
      "Designation: Executive → Plant supervisor",
      "Department: Front office → Operations",
      "Location: Mumbai → Jamshedpur",
    ]);
    expect(view.stints[2]!.changes).toEqual(["Designation: Plant supervisor → Staff head"]);
  });

  it("builds a group → company → position tree that follows the company structure", () => {
    const { tree } = buildCareer(example, companies, { today: "2026-11-20", groupName: "Tata group" });
    expect(tree.label).toBe("Tata group");
    const holding = tree.children[0]!;
    expect(holding.label).toBe("Tata Industries");
    expect(holding.children.map((node) => node.label)).toEqual(["Taj Hotels", "Tata Steel"]);
    const steel = holding.children[1]!;
    expect(steel.children.map((node) => [node.kind, node.label])).toEqual([
      ["role", "Plant supervisor"], ["role", "Staff head"], ["company", "Tata Steel Corporate Office"],
    ]);
    expect(steel.children[2]!.children[0]!.current).toBe(true);
    expect(steel.detail).toBe("Subsidiary · Manufacturing");
  });

  it("leaves out superseded entries and marks the correction", () => {
    const wrong = entry({ id: "wrong", movementType: "joined", effectiveFrom: "2019-01-01", designation: "Trainee" });
    const fix = entry({ id: "fix", movementType: "joined", effectiveFrom: "2018-06-01", designation: "Executive", supersedesId: "wrong", source: "correction" });
    expect(activeEntries([wrong, fix]).map((item) => item.id)).toEqual(["fix"]);
    const view = buildCareer([wrong, fix], companies, { today: "2019-06-01", groupName: "G" });
    expect(view.stints).toHaveLength(1);
    expect(view.stints[0]!.corrected).toBe(true);
  });

  it("closes the last stint on the exit date and ignores entries after it", () => {
    const view = buildCareer(example, companies, { today: "2026-11-20", exitedOn: "2024-12-31", groupName: "G" });
    expect(view.stints.map((stint) => stint.designation)).toEqual(["Executive", "Plant supervisor", "Staff head"]);
    expect(view.stints[2]!.endsOn).toBe("2024-12-31");
    expect(view.stints[2]!.current).toBe(false);
  });

  it("falls back to the stored company name when the company is no longer in the structure", () => {
    const view = buildCareer([entry({ companyId: null, companyName: "Old Co", designation: "Clerk" })], [], { today: "2021-01-01", groupName: "G" });
    expect(view.stints[0]!.companyPath).toEqual(["Old Co"]);
    expect(view.tree.children[0]!.label).toBe("Old Co");
  });

  it("measures and labels durations", () => {
    expect(monthsBetween("2020-01-01", "2020-01-01")).toBe(0);
    expect(durationLabel(0.4)).toBe("Less than a month");
    expect(durationLabel(14)).toBe("1 yr 2 mos");
    expect(durationLabel(monthsBetween("2020-01-15", "2020-03-15"))).toBe("2 mos");
  });
});
