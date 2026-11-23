/** Pure helpers turning GET /api/v1/reports/team-history day rows into per-employee MIS records. */

export type TeamHistoryRow = {
  employee_id: string;
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  location: string | null;
  basic_salary_minor: number | string | null;
  attendance_date: string | null;
  attendance_status: string | null;
  payable_ot_minutes: number | string | null;
};

export type TeamHistoryPayload = { from: string; to: string; compensationMasked: boolean; rows: TeamHistoryRow[] };

export type MisRecord = {
  employeeId: string;
  empId: string;
  name: string;
  dept: string | null;
  location: string | null;
  /** null when no attendance day in the period has a countable status. */
  attendancePct: number | null;
  recordedDays: number;
  overtimeHrs: number;
  /** Monthly basic salary in major units; null when masked or not stored. */
  basicSalary: number | null;
};

const COUNTED = new Set(["present", "half_day", "absent", "leave"]);
const num = (value: number | string | null): number => (value === null || value === "" ? 0 : Number(value) || 0);

export function aggregate(rows: TeamHistoryRow[]): MisRecord[] {
  const byEmployee = new Map<string, MisRecord & { credit: number; counted: number; seen: Set<string> }>();
  for (const row of rows) {
    let rec = byEmployee.get(row.employee_id);
    if (!rec) {
      rec = {
        employeeId: row.employee_id,
        empId: row.employee_code,
        name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.employee_code,
        dept: row.department,
        location: row.location,
        attendancePct: null,
        recordedDays: 0,
        overtimeHrs: 0,
        basicSalary: row.basic_salary_minor === null ? null : num(row.basic_salary_minor) / 100,
        credit: 0,
        counted: 0,
        seen: new Set(),
      };
      byEmployee.set(row.employee_id, rec);
    }
    // Leave joins can repeat a day; count each attendance date once.
    if (!row.attendance_date || rec.seen.has(row.attendance_date)) continue;
    rec.seen.add(row.attendance_date);
    rec.recordedDays += 1;
    rec.overtimeHrs += num(row.payable_ot_minutes) / 60;
    const status = row.attendance_status ?? "";
    if (COUNTED.has(status)) {
      rec.counted += 1;
      rec.credit += status === "present" ? 1 : status === "half_day" ? 0.5 : 0;
    }
  }
  return [...byEmployee.values()].map(({ credit, counted, seen: _seen, ...rec }) => ({
    ...rec,
    overtimeHrs: Math.round(rec.overtimeHrs * 10) / 10,
    attendancePct: counted ? Math.round((credit / counted) * 1000) / 10 : null,
  }));
}

export type MisSummary = { total: number; averageAttendance: number | null; totalOvertime: number; withAttendance: number };

export function summarize(records: MisRecord[]): MisSummary {
  const measured = records.filter((r) => r.attendancePct !== null);
  const avg = measured.length ? measured.reduce((sum, r) => sum + (r.attendancePct ?? 0), 0) / measured.length : null;
  return {
    total: records.length,
    withAttendance: measured.length,
    averageAttendance: avg === null ? null : Math.round(avg * 10) / 10,
    totalOvertime: Math.round(records.reduce((sum, r) => sum + r.overtimeHrs, 0) * 10) / 10,
  };
}

export function filterRecords(records: MisRecord[], dept: string, query: string): MisRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((r) =>
    (dept === "all" || (r.dept ?? "") === dept)
    && (!q || [r.empId, r.name, r.dept, r.location].some((v) => (v ?? "").toLowerCase().includes(q))));
}

/** Month-to-date range in the viewer's local calendar, as YYYY-MM-DD. */
export function monthToDate(now: Date): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
}

export function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
