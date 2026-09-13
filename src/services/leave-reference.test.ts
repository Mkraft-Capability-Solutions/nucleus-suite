import { describe, it, expect } from "vitest";
import {
  getLeaveEmployees,
  leaveCalendarPolicy,
  workbookLeaveReferences,
} from "./leave-reference";
import { readData } from "./workspace-data.mjs";
describe("leave workbook references", () => {
  it("retains every workbook employee without inventing identity links", () => {
    const rows = readData("workbook").sheets["12_Employees"].filter(
      (row: Record<string, string>) => /^E\d+$/.test(row["Employee code"]),
    );
    const employees = getLeaveEmployees();
    expect(employees.filter((e) => e.employeeId.startsWith("E"))).toHaveLength(
      rows.length,
    );
    expect(employees.find((e) => e.employeeId === "MK-107")?.name).toBe(
      "Vikas Yadav",
    );
    expect(employees.find((e) => e.employeeId === "E1001")?.name).toBe(
      "Arvind Raghunathan",
    );
  });
  it("keeps all seven supplied requests as read-only reference records", () => {
    const requests = workbookLeaveReferences();
    expect(requests).toHaveLength(7);
    expect(
      requests.every((r: { reference_only: boolean }) => r.reference_only),
    ).toBe(true);
  });
  it("uses source location holidays and the permanent-worker Sunday calendar", () => {
    const policy = leaveCalendarPolicy("E1001");
    expect(policy.holidays).toContain("2026-01-26");
    expect(policy.holidays).toContain("2026-01-01");
    expect(policy.weekendDays).toEqual([0]);
  });
});
