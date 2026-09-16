import { describe, expect, it } from "vitest";
import { buildReportingTree, type ReportingRow } from "./reporting-line";

function row(id: string, code: string, manager: string | null, department = "Weaving"): ReportingRow {
  return {
    id,
    employee_code: code,
    first_name: code,
    last_name: "Person",
    designation: "Operator",
    department,
    location: "Plant North",
    manager_employee_id: manager,
    status: "active",
  };
}

describe("buildReportingTree (R-23)", () => {
  it("derives the chart from the reporting manager on each record", () => {
    const { roots } = buildReportingTree([
      row("1", "MK-001", null),
      row("2", "MK-002", "1"),
      row("3", "MK-003", "2"),
    ]);
    expect(roots).toHaveLength(1);
    expect(roots[0].employeeCode).toBe("MK-001");
    expect(roots[0].reports[0].employeeCode).toBe("MK-002");
    expect(roots[0].reports[0].reports[0].employeeCode).toBe("MK-003");
  });

  it("counts everyone at or below a node, not just direct reports", () => {
    const { roots } = buildReportingTree([
      row("1", "MK-001", null),
      row("2", "MK-002", "1"),
      row("3", "MK-003", "2"),
      row("4", "MK-004", "1"),
    ]);
    expect(roots[0].reportCount).toBe(3);
    expect(roots[0].reports.find((node) => node.employeeCode === "MK-002")?.reportCount).toBe(1);
  });

  it("moves a change of reporting manager without any other maintenance", () => {
    const before = buildReportingTree([row("1", "MK-001", null), row("2", "MK-002", null), row("3", "MK-003", "1")]);
    expect(before.roots.find((node) => node.id === "1")?.reportCount).toBe(1);
    const after = buildReportingTree([row("1", "MK-001", null), row("2", "MK-002", null), row("3", "MK-003", "2")]);
    expect(after.roots.find((node) => node.id === "1")?.reportCount).toBe(0);
    expect(after.roots.find((node) => node.id === "2")?.reportCount).toBe(1);
  });

  it("surfaces a report whose manager has left rather than dropping them", () => {
    const { roots, orphans } = buildReportingTree([row("2", "MK-002", "gone")]);
    expect(orphans).toBe(1);
    expect(roots).toHaveLength(1);
    expect(roots[0].employeeCode).toBe("MK-002");
  });

  it("orders each level by employee code so the chart is stable between reads", () => {
    const { roots } = buildReportingTree([
      row("1", "MK-001", null),
      row("3", "MK-003", "1"),
      row("2", "MK-002", "1"),
    ]);
    expect(roots[0].reports.map((node) => node.employeeCode)).toEqual(["MK-002", "MK-003"]);
  });
});
