import { describe, expect, it } from "vitest";
import { aggregate, csvCell, filterRecords, monthToDate, summarize, type TeamHistoryRow } from "./data";

const row = (over: Partial<TeamHistoryRow>): TeamHistoryRow => ({
  employee_id: "e1", employee_code: "E1", first_name: "Asha", last_name: "K", department: "Ops", location: null,
  basic_salary_minor: 5000000, attendance_date: null, attendance_status: null, payable_ot_minutes: null, ...over,
});

describe("mis aggregation", () => {
  it("computes attendance from stored statuses and dedupes days", () => {
    const [rec] = aggregate([
      row({ attendance_date: "2026-11-01", attendance_status: "present", payable_ot_minutes: 90 }),
      row({ attendance_date: "2026-11-01", attendance_status: "present", payable_ot_minutes: 90 }),
      row({ attendance_date: "2026-11-02", attendance_status: "half_day" }),
      row({ attendance_date: "2026-11-03", attendance_status: "absent" }),
      row({ attendance_date: "2026-11-04", attendance_status: "holiday" }),
    ]);
    expect(rec).toMatchObject({ attendancePct: 50, overtimeHrs: 1.5, recordedDays: 4, basicSalary: 50000 });
  });

  it("reports no attendance rather than zero when nothing is recorded", () => {
    const recs = aggregate([row({ basic_salary_minor: null }), row({ employee_id: "e2", employee_code: "E2", department: "Eng" })]);
    expect(recs[0]).toMatchObject({ attendancePct: null, basicSalary: null });
    expect(summarize(recs)).toMatchObject({ total: 2, averageAttendance: null, withAttendance: 0 });
    expect(filterRecords(recs, "Eng", "").map((r) => r.empId)).toEqual(["E2"]);
  });

  it("builds a month-to-date range and neutralises formula cells", () => {
    expect(monthToDate(new Date(2026, 10, 23))).toEqual({ from: "2026-11-01", to: "2026-11-23" });
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
