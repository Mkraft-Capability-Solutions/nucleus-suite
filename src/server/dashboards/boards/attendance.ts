import "server-only";

import { barPanel, dayLabel, partsPanel, humanise, num, pct, plural, round, tablePanel, withSource } from "../compose";
import { runAll, scoped, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number };

const WINDOW_DAYS = 30;
const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};

/** Present days count fully, half days count half; leave, holidays and rest days are not workdays. */
export function attendanceRate(present: number, halfDay: number, absent: number): number | null {
  return pct(present + halfDay * 0.5, present + halfDay + absent);
}

/* ================================================================== */
/* S3 · Attendance & shifts                                            */
/* ================================================================== */

export async function attendanceBoard(scope: Scope): Promise<Built> {
  const window = `a.attendance_date > t.d - ${WINDOW_DAYS} and a.attendance_date <= t.d`;
  const data = await runAll(scope.access, {
    summary: scoped(scope, `
      select
        (select count(*) from emp, today t where active and joined_on <= t.d)::int as headcount,
        count(*) filter (where a.status = 'present')::int as present,
        count(*) filter (where a.status = 'half_day')::int as half_day,
        count(*) filter (where a.status = 'absent')::int as absent,
        count(*) filter (where a.status = 'leave')::int as on_leave,
        count(*) filter (where a.status = 'pending')::int as pending,
        count(*) filter (where a.exception_reason is not null)::int as exceptions,
        coalesce(avg(a.productive_minutes) filter (where a.status in ('present', 'half_day') and a.productive_minutes > 0), 0)::float as avg_minutes,
        coalesce(sum(a.payable_ot_minutes), 0)::int as ot_minutes,
        count(*) filter (where a.attendance_date = t.d and a.status in ('present', 'half_day'))::int as present_today
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window}`),
    daily: scoped(scope, `
      select to_char(a.attendance_date, 'YYYY-MM-DD') as day,
        count(*) filter (where a.status = 'present')::int as present,
        count(*) filter (where a.status = 'half_day')::int as half_day,
        count(*) filter (where a.status = 'leave')::int as on_leave,
        count(*) filter (where a.status = 'absent')::int as absent
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window}
      group by a.attendance_date order by a.attendance_date`),
    status: scoped(scope, `
      select a.status as name, count(*)::int as value
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window} group by 1 order by 2 desc`),
    byLocation: scoped(scope, `
      select coalesce(e.location, 'Not recorded') as name,
        count(*) filter (where a.status = 'present')::int as present,
        count(*) filter (where a.status = 'half_day')::int as half_day,
        count(*) filter (where a.status = 'absent')::int as absent
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window} group by 1`),
    overtime: scoped(scope, `
      select coalesce(e.department, 'Not recorded') as name, round(sum(a.payable_ot_minutes) / 60.0, 1)::float as value
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window} and a.payable_ot_minutes > 0
      group by 1 order by 2 desc limit 12`),
    sources: scoped(scope, `
      select coalesce(p.source, 'Not recorded') as name, count(*)::int as value
      from attendance_punches p
      join attendance_days a on a.tenant_id = p.tenant_id and a.id = p.attendance_day_id
      join emp e on e.id = a.employee_id, today t
      where p.tenant_id = $1::uuid and ${window} group by 1 order by 2 desc`),
    regularisations: scoped(scope, `
      select count(*)::int as value from attendance_regularizations r
      where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', '') in ('submitted', 'pending')
        and (r.attributes->>'employee_id' is null or (r.attributes->>'employee_id') in (select id::text from emp))`),
    exceptions: scoped(scope, `
      select to_char(a.attendance_date, 'YYYY-MM-DD') as day, e.name, e.department, a.status, a.exception_reason as reason
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and ${window} and (a.exception_reason is not null or a.status = 'pending')
      order by a.attendance_date desc, e.name limit 12`),
  });

  const summary = first(data.summary);
  const present = num(summary.present);
  const halfDay = num(summary.half_day);
  const absent = num(summary.absent);
  const recorded = present + halfDay + absent + num(summary.on_leave) + num(summary.pending);
  const rate = attendanceRate(present, halfDay, absent);
  const headcount = num(summary.headcount);
  const otHours = round(num(summary.ot_minutes) / 60, 1);
  const hint = `Last ${WINDOW_DAYS} days`;

  const kpis: Kpi[] = [
    { id: "rate", label: "Attendance rate", value: rate, format: "percent", hint: rate === null ? "No workdays recorded yet" : `${hint}, present ÷ workdays`, tone: rate !== null && rate < 85 ? "attention" : "positive", target: "attendance" },
    { id: "present-today", label: "Present today", value: data.summary ? num(summary.present_today) : null, of: headcount || null, format: "count", hint: "Active employees" },
    { id: "hours", label: "Average productive hours", value: recorded ? round(num(summary.avg_minutes) / 60, 1) : null, format: "hours", hint: "Per day worked" },
    { id: "overtime", label: "Payable overtime", value: data.summary ? otHours : null, format: "hours", hint },
    { id: "exceptions", label: "Days with exceptions", value: data.summary ? num(summary.exceptions) : null, format: "count", hint, tone: num(summary.exceptions) ? "attention" : "neutral" },
    { id: "regularisations", label: "Regularisations waiting", value: data.regularisations ? num(first(data.regularisations).value) : null, format: "count", hint: "Submitted, not decided", target: "attendance" },
  ];

  const daily = rowsOf(data.daily);
  const locations = rowsOf(data.byLocation)
    .map((row) => ({ name: String(row.name), rate: attendanceRate(num(row.present), num(row.half_day), num(row.absent)) }))
    .filter((row) => row.rate !== null)
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
    .slice(0, 12);
  const overtime = rowsOf(data.overtime).map((row) => ({ name: String(row.name), value: num(row.value) }));

  const empty = "Appears once attendance is recorded (punches, device sync or the time office).";
  const panels: Panel[] = [
    withSource(data.daily, barPanel(
      { id: "daily", title: "Daily attendance", subtitle: hint, span: 8, format: "count", emptyMessage: empty, target: "attendance" },
      daily.map((row) => dayLabel(String(row.day))),
      [
        { name: "Present", data: daily.map((row) => num(row.present)), stack: "day" },
        { name: "Half day", data: daily.map((row) => num(row.half_day)), stack: "day" },
        { name: "On leave", data: daily.map((row) => num(row.on_leave)), stack: "day" },
        { name: "Absent", data: daily.map((row) => num(row.absent)), stack: "day" },
      ],
    )),
    withSource(data.status, partsPanel(
      { id: "status", title: "Day status mix", subtitle: hint, span: 4, format: "count", emptyMessage: empty },
      rowsOf(data.status).map((row) => ({ name: humanise(String(row.name)), value: num(row.value) })),
    )),
    withSource(data.byLocation, barPanel(
      { id: "location", title: "Attendance rate by location", subtitle: `${hint}, lowest first`, span: 6, format: "percent", emptyMessage: empty },
      locations.map((row) => row.name).reverse(), [{ name: "Attendance %", data: locations.map((row) => row.rate ?? 0).reverse() }], true,
    )),
    withSource(data.overtime, barPanel(
      { id: "overtime", title: "Overtime by department", subtitle: `Payable hours, ${hint.toLowerCase()}`, span: 6, format: "hours", emptyMessage: "No payable overtime in the last 30 days." },
      overtime.map((row) => row.name).reverse(), [{ name: "Hours", data: overtime.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.sources, partsPanel(
      { id: "sources", title: "How people punched", subtitle: `Punch source, ${hint.toLowerCase()}`, span: 4, format: "count", emptyMessage: "No punches recorded in the last 30 days." },
      rowsOf(data.sources).map((row) => ({ name: humanise(String(row.name)), value: num(row.value) })),
    )),
    withSource(data.exceptions, tablePanel(
      { id: "exceptions", title: "Recent exceptions", subtitle: "Days the time office could not settle", span: 8, emptyMessage: "No attendance exceptions in the last 30 days.", target: "attendance" },
      [{ key: "day", label: "Date", format: "date" }, { key: "name", label: "Employee" }, { key: "department", label: "Department" }, { key: "status", label: "Status" }, { key: "reason", label: "Reason" }],
      rowsOf(data.exceptions).map((row) => ({ day: String(row.day), name: String(row.name ?? ""), department: row.department ? String(row.department) : null, status: humanise(String(row.status)), reason: row.reason ? String(row.reason) : null })),
    )),
  ];

  const insights: string[] = [];
  if (rate !== null) insights.push(`Attendance over the last ${WINDOW_DAYS} days is ${rate}% across ${plural(recorded, "recorded day")}.`);
  const weakest = locations[0];
  if (weakest && locations.length > 1) insights.push(`${weakest.name} has the lowest attendance rate at ${weakest.rate}%.`);
  if (otHours > 0 && overtime[0]) insights.push(`${otHours.toLocaleString("en-IN")} payable overtime hours, most in ${overtime[0].name} (${overtime[0].value.toLocaleString("en-IN")} h).`);
  if (num(summary.exceptions)) insights.push(`${plural(num(summary.exceptions), "day needs", "days need")} review in the time office.`);

  return { kpis, panels, insights, employeesInScope: headcount };
}
