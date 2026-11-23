import { describe, expect, it } from "vitest";
import { deptSummary, filterTree, flatten, fullName, type OrgChartNode } from "./data";

const node = (id: string, dept: string | null, children: OrgChartNode[] = []): OrgChartNode => ({
  id, employeeCode: id.toUpperCase(), firstName: `F${id}`, lastName: "", designation: "Eng",
  department: dept, location: null, status: "active", managerId: null, children,
});

describe("org chart data", () => {
  const tree = [node("a", "Ops", [node("b", "Eng"), node("c", "Ops")])];

  it("flattens and summarises by recorded department", () => {
    expect(flatten(tree).map((n) => n.id)).toEqual(["a", "b", "c"]);
    expect(deptSummary(flatten(tree))).toEqual([
      expect.objectContaining({ name: "Ops", count: 2 }),
      expect.objectContaining({ name: "Eng", count: 1 }),
    ]);
  });

  it("keeps the manager path to a match", () => {
    const out = filterTree(tree, "fb", "ALL");
    expect(out[0].id).toBe("a");
    expect(out[0].children?.map((n) => n.id)).toEqual(["b"]);
    expect(filterTree(tree, "", "Eng")[0].children?.map((n) => n.id)).toEqual(["b"]);
    expect(filterTree(tree, "zzz", "ALL")).toEqual([]);
  });

  it("falls back to the code, not an invented name", () => {
    expect(fullName({ ...node("x", null), firstName: "", lastName: "" })).toBe("X");
  });
});
