import { describe, expect, it } from "vitest";

import { picklists, picklistLabel, picklistValues, type PicklistCode } from "./picklists";

const codes = Object.keys(picklists) as PicklistCode[];

describe("picklist registry (workbook sheet 03_Picklists)", () => {
  it("carries every picklist the workbook defines, plus the one the build sheet adds", () => {
    // 119 from Nucleus_Forms_and_Fields_Complete_MKraft.xlsx, plus PL_BREAK_TYPE, which the
    // demo build sheet states as EN_BREAK_TYPE.
    expect(codes).toHaveLength(120);
    expect(picklists.PL_BREAK_TYPE.values.map((entry) => entry.value)).toEqual([
      "meal", "personal", "gate_pass", "shift_break", "unclassified",
    ]);
  });

  // The workbook states a count for each vocabulary. Checking the transcription against
  // that count is what stops a value being quietly dropped or an extra one invented.
  it("matches the declared value count of each picklist", () => {
    for (const code of codes) {
      const list = picklists[code];
      const enumerated = list.values.length + (list.openSet ? 1 : 0);
      expect(enumerated, `${code} value count`).toBe(list.declared);
    }
  });

  it("names a seed source instead of enumerating an external standard", () => {
    const open = codes.filter((code) => picklists[code].openSet);
    expect(open.sort()).toEqual(["PL_COUNTRY", "PL_CURRENCY", "PL_NATIONALITY", "PL_TIMEZONE"]);
    for (const code of open) expect(picklists[code].openSet).toMatch(/\S/);
  });

  it("gives every value a distinct stored slug within its picklist", () => {
    for (const code of codes) {
      const values = picklists[code].values.map((entry) => entry.value);
      expect(new Set(values).size, `${code} has a duplicate slug`).toBe(values.length);
    }
  });

  it("stores lower snake case slugs and keeps the printable label", () => {
    for (const code of codes) {
      for (const entry of picklists[code].values) {
        expect(entry.value, `${code}.${entry.value}`).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
        expect(entry.label.trim()).not.toBe("");
      }
    }
  });

  it("keeps the sign in blood groups, which a naive slug would collapse", () => {
    const values = picklistValues("PL_BLOOD_GROUP");
    expect(values).toContain("a_positive");
    expect(values).toContain("a_negative");
    expect(picklistLabel("PL_BLOOD_GROUP", "a_negative")).toBe("A-");
  });

  it("returns the value itself when it is not part of the set", () => {
    expect(picklistLabel("PL_ACCOMMODATION", "houseboat")).toBe("houseboat");
  });

  it("records whether each vocabulary is tenant-editable", () => {
    for (const code of codes) expect(["config", "system"]).toContain(picklists[code].seededBy);
  });
});
