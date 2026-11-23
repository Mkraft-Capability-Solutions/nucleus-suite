import { describe, expect, it } from "vitest";
import { filterMembers, pods, toMember, type PersonItem } from "./data";

const p = (over: Partial<PersonItem>): PersonItem => ({
  id: "1", employeeCode: "E1", firstName: "Ravi", lastName: "S", workEmail: "r@x.test", designation: "Engineer",
  department: "Eng", location: "Pune", status: "active", metadata: {}, ...over,
});

describe("team directory", () => {
  it("never invents a shift or skills", () => {
    expect(toMember(p({}))).toMatchObject({ shift: null, skills: [], name: "Ravi S" });
    expect(toMember(p({ metadata: { shift: "Night", skills: ["Go", 3] } }))).toMatchObject({ shift: "Night", skills: ["Go"] });
  });

  it("filters by pod and skill", () => {
    const members = [toMember(p({ metadata: { skills: ["Rust"] } })), toMember(p({ id: "2", department: null, employeeCode: "E2" }))];
    expect(pods(members)).toEqual(["Eng"]);
    expect(filterMembers(members, "Eng", "rust").map((m) => m.id)).toEqual(["1"]);
    expect(filterMembers(members, "all", "").length).toBe(2);
  });
});
