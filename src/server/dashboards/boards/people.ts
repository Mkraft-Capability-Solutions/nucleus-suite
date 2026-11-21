import "server-only";

import {
  annualisedAttrition, barPanel, dayLabel, partsPanel, headcountInsight, heatmapPanel, humanise, largest, linePanel,
  listPanel, monthLabel, num, pct, periodLabel, plural, round, tablePanel, TENURE_BANDS, withSource,
} from "../compose";
import { can, runAll, scoped, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};
const named = (rows: Row[] | null) => rowsOf(rows).map((row) => ({ name: String(row.name ?? "Not recorded"), value: num(row.value) }));

/* ================================================================== */
/* S1 · People command centre                                          */
/* ================================================================== */

export async function peopleCommandCentre(scope: Scope): Promise<Built> {
  const months = scope.filters.months;
  const trendMonths = Math.max(months, 6);
  const data = await runAll(scope.access, {
    summary: scoped(scope, `
      select
        count(*) filter (where active and joined_on <= t.d)::int as headcount,
        count(*) filter (where joined_on > t.d - make_interval(months => $5::int) and joined_on <= t.d)::int as joiners,
        count(*) filter (where exit_date > t.d - make_interval(months => $5::int) and exit_date <= t.d)::int as leavers,
        count(*) filter (where joined_on <= t.d - make_interval(months => $5::int)
          and (exit_date is null or exit_date > t.d - make_interval(months => $5::int))
          and (active or exit_date is not null))::int as headcount_at_start,
        coalesce(avg(case when active and joined_on <= t.d then (t.d - joined_on) / 365.25 end), 0)::float as avg_tenure,
        count(*) filter (where active and joined_on <= t.d and department is null)::int as no_department
      from emp, today t`, [months]),
    trend: scoped(scope, `
      with months as (
        select gs::date as month_start,
          least((gs + interval '1 month' - interval '1 day')::date, (select d from today)) as month_end
        from generate_series(date_trunc('month', (select d from today)::timestamp) - make_interval(months => $5::int - 1),
                             date_trunc('month', (select d from today)::timestamp), interval '1 month') gs
      )
      select to_char(m.month_start, 'YYYY-MM') as month,
        count(e.id) filter (where e.joined_on <= m.month_end and (e.exit_date is null or e.exit_date > m.month_end)
                              and (e.active or e.exit_date is not null))::int as headcount,
        count(e.id) filter (where e.joined_on between m.month_start and m.month_end)::int as joiners,
        count(e.id) filter (where e.exit_date between m.month_start and m.month_end)::int as leavers
      from months m left join emp e on true
      group by m.month_start order by m.month_start`, [trendMonths]),
    byDepartment: scoped(scope, `
      select coalesce(department, 'Not recorded') as name,
        count(*) filter (where active and joined_on <= t.d)::int as value,
        count(*) filter (where exit_date > t.d - make_interval(months => $5::int) and exit_date <= t.d)::int as leavers,
        count(*) filter (where joined_on <= t.d - make_interval(months => $5::int)
          and (exit_date is null or exit_date > t.d - make_interval(months => $5::int))
          and (active or exit_date is not null))::int as at_start
      from emp, today t group by 1`, [months]),
    byLocation: scoped(scope, `
      select coalesce(location, 'Not recorded') as name, count(*)::int as value
      from emp, today t where active and joined_on <= t.d group by 1 order by 2 desc`),
    tenure: scoped(scope, `
      select case when years < 1 then 'Under 1 year' when years < 3 then '1–3 years' when years < 5 then '3–5 years'
                  when years < 10 then '5–10 years' else '10+ years' end as name, count(*)::int as value
      from (select (t.d - joined_on) / 365.25 as years from emp, today t where active and joined_on <= t.d) s
      group by 1`),
    category: scoped(scope, `
      select coalesce(category, 'Not recorded') as name, count(*)::int as value
      from emp, today t where active and joined_on <= t.d group by 1 order by 2 desc`),
    heat: scoped(scope, `
      select coalesce(location, 'Not recorded') as x, coalesce(department, 'Not recorded') as y, count(*)::int as value
      from emp, today t where active and joined_on <= t.d group by 1, 2`),
    attendance: scoped(scope, `
      select count(*) filter (where a.status in ('present', 'half_day'))::int as present, count(*)::int as recorded
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date = t.d and e.active`),
  });

  const summary = first(data.summary);
  const headcount = num(summary.headcount);
  const leavers = num(summary.leavers);
  const joiners = num(summary.joiners);
  const atStart = num(summary.headcount_at_start);
  const attrition = annualisedAttrition(leavers, (headcount + atStart) / 2, months);
  const attendance = first(data.attendance);
  const recorded = num(attendance.recorded);
  const period = periodLabel(months);

  const kpis: Kpi[] = [
    { id: "headcount", label: "Active headcount", value: data.summary ? headcount : null, format: "count", hint: "Employees on the rolls today", target: "people_core" },
    { id: "joiners", label: "Joiners", value: data.summary ? joiners : null, format: "count", hint: period, tone: "positive" },
    { id: "leavers", label: "Leavers", value: data.summary ? leavers : null, format: "count", hint: period, tone: leavers > 0 ? "attention" : "neutral" },
    { id: "attrition", label: "Annualised attrition", value: attrition, format: "percent", hint: attrition === null ? "Needs headcount history" : `Leavers ÷ average headcount, ${period}`, tone: attrition !== null && attrition >= 15 ? "risk" : "neutral" },
    { id: "attendance", label: "Attendance today", value: recorded ? pct(num(attendance.present), headcount) : null, format: "percent", hint: recorded ? `${num(attendance.present).toLocaleString("en-IN")} present of ${headcount.toLocaleString("en-IN")}` : "No attendance recorded today", target: "attendance" },
    { id: "tenure", label: "Average tenure", value: headcount ? round(num(summary.avg_tenure), 1) : null, format: "years", hint: "Active employees" },
  ];

  const trend = rowsOf(data.trend);
  const monthKeys = trend.map((row) => String(row.month));
  const monthNames = monthKeys.map(monthLabel);
  const headcountSeries = trend.map((row) => num(row.headcount));

  const departments = rowsOf(data.byDepartment).map((row) => {
    const value = num(row.value);
    const departmentLeavers = num(row.leavers);
    const rate = annualisedAttrition(departmentLeavers, (value + num(row.at_start)) / 2, months);
    return { name: String(row.name), value, leavers: departmentLeavers, rate };
  });
  const byHeadcount = [...departments].filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 12);
  const byAttrition = departments.filter((row) => row.leavers > 0 && row.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0)).slice(0, 12);
  const locations = named(data.byLocation).slice(0, 12);
  const tenure = named(data.tenure);

  const panels: Panel[] = [
    withSource(data.trend, linePanel(
      { id: "headcount-trend", title: "Headcount trend", subtitle: `Month-end headcount, last ${trendMonths} months`, span: 7, format: "count", emptyMessage: "Appears once employees with joining dates are recorded.", target: "people_core" },
      monthNames, [{ name: "Headcount", data: headcountSeries }],
    )),
    withSource(data.trend, barPanel(
      { id: "joiners-leavers", title: "Joiners and leavers", subtitle: "By month", span: 5, format: "count", emptyMessage: "Appears once joining or exit dates are recorded." },
      monthNames, [{ name: "Joiners", data: trend.map((row) => num(row.joiners)) }, { name: "Leavers", data: trend.map((row) => num(row.leavers)) }],
    )),
    withSource(data.byDepartment, barPanel(
      { id: "department", title: "Headcount by department", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once employees are recorded.", target: "people_core" },
      byHeadcount.map((row) => row.name).reverse(), [{ name: "Employees", data: byHeadcount.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.byDepartment, barPanel(
      { id: "attrition-department", title: "Attrition by department", subtitle: `Annualised, ${period}`, span: 6, format: "percent", emptyMessage: `No one has left in the ${period}.` },
      byAttrition.map((row) => row.name).reverse(), [{ name: "Attrition %", data: byAttrition.map((row) => row.rate ?? 0).reverse() }], true,
    )),
    withSource(data.byLocation, barPanel(
      { id: "location", title: "Headcount by location", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once employees have locations recorded." },
      locations.map((row) => row.name).reverse(), [{ name: "Employees", data: locations.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.tenure, barPanel(
      { id: "tenure", title: "Length of service", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once joining dates are recorded." },
      TENURE_BANDS, [{ name: "Employees", data: TENURE_BANDS.map((band) => tenure.find((row) => row.name === band)?.value ?? 0) }],
    )),
    withSource(data.category, partsPanel(
      { id: "category", title: "Workforce mix", subtitle: "By worker category", span: 6, format: "count", emptyMessage: "Appears once employees are recorded." },
      named(data.category).map((row) => ({ name: humanise(row.name), value: row.value })),
    )),
    withSource(data.heat, heatmapPanel(
      { id: "heat", title: "Department × location", subtitle: "Active headcount", span: 6, format: "count", emptyMessage: "Appears when employees span more than one department and location." },
      rowsOf(data.heat).map((row) => ({ x: String(row.x), y: String(row.y), value: num(row.value) })),
    )),
  ];

  const insights: string[] = [];
  const headline = headcountInsight(monthKeys, headcountSeries);
  if (headline) insights.push(headline);
  if (joiners || leavers) insights.push(`${plural(joiners, "joiner")} and ${plural(leavers, "leaver")} in the ${period}.`);
  const topAttrition = byAttrition[0];
  if (topAttrition && topAttrition.rate !== null) insights.push(`Attrition is highest in ${topAttrition.name}: ${topAttrition.rate}% annualised (${plural(topAttrition.leavers, "leaver")}).`);
  const biggest = largest(byHeadcount);
  if (biggest && headcount) insights.push(`${biggest.name} is the largest department with ${pct(biggest.value, headcount, 0)}% of headcount.`);
  const noDepartment = num(summary.no_department);
  if (noDepartment) insights.push(`${plural(noDepartment, "active employee has", "active employees have")} no department recorded.`);

  return { kpis, panels, insights, employeesInScope: headcount };
}

/* ================================================================== */
/* S2 · HR operations console                                          */
/* ================================================================== */

export async function hrOperations(scope: Scope): Promise<Built> {
  const showBirthdays = can(scope.access, "employee.birthdate.read");
  const data = await runAll(scope.access, {
    today: scoped(scope, `
      select
        (select count(*) from emp, today t where active and joined_on <= t.d)::int as headcount,
        count(*) filter (where a.status in ('present', 'half_day'))::int as present,
        count(*) filter (where a.status = 'absent')::int as absent,
        count(*)::int as recorded,
        (select count(distinct l.employee_id) from leave_requests l join emp e on e.id = l.employee_id, today t
          where l.tenant_id = $1::uuid and l.status = 'approved' and t.d between l.starts_on and l.ends_on)::int as on_leave
      from attendance_days a join emp e on e.id = a.employee_id and e.active, today t
      where a.tenant_id = $1::uuid and a.attendance_date = t.d`),
    joining: scoped(scope, `
      select name, designation, department, location, to_char(joining_date, 'YYYY-MM-DD') as joining_date
      from emp, today t
      where joining_date > t.d and joining_date <= t.d + 30 and (active or exit_date is null)
      order by joining_date, name limit 15`),
    joiningWeek: scoped(scope, `
      select count(*)::int as value from emp, today t where joining_date > t.d and joining_date <= t.d + 7`),
    exits: scoped(scope, `
      select count(*)::int as value from offboarding_cases o
      join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id
      join emp e on e.id = em.employee_id
      where o.tenant_id = $1::uuid and coalesce(o.attributes->>'status', '') not in ('settled', 'closed', 'completed', 'cancelled', 'withdrawn')`),
    completeness: scoped(scope, `
      select count(*)::int as total,
        count(*) filter (where work_email is null)::int as work_email,
        count(*) filter (where department is null)::int as department,
        count(*) filter (where location is null)::int as location,
        count(*) filter (where designation is null)::int as designation,
        count(*) filter (where manager_employee_id is null)::int as manager,
        count(*) filter (where joining_date is null)::int as joining_date,
        count(*) filter (where date_of_birth is null)::int as date_of_birth
      from emp, today t where active and joined_on <= t.d`),
    queue: scoped(scope, `
      select
        (select count(*) from leave_requests l join emp e on e.id = l.employee_id
          where l.tenant_id = $1::uuid and l.status like 'pending%')::int as leave,
        (select count(*) from attendance_regularizations r
          where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', '') in ('submitted', 'pending')
            and (r.attributes->>'employee_id' is null or (r.attributes->>'employee_id') in (select id::text from emp)))::int as regularisations,
        (select count(*) from helpdesk_tickets h
          where h.tenant_id = $1::uuid and upper(coalesce(h.status, '')) not in ('CLOSED', 'RESOLVED', 'CANCELLED'))::int
          + (select count(*) from hrms_operation_records r
          where r.tenant_id = $1::uuid and r.resource = 'tickets' and r.status not in ('closed', 'resolved', 'cancelled', 'rejected'))::int as tickets,
        (select count(*) from onboarding_instances o join emp e on e.id = o.employee_id
          where o.tenant_id = $1::uuid and coalesce(o.attributes->>'status', '') = 'active')::int as onboarding,
        (select count(*) from clearance_items i
          where i.tenant_id = $1::uuid and coalesce(i.attributes->>'status', 'pending') not in ('cleared', 'waived'))::int as clearance`),
    absence: scoped(scope, `
      select to_char(gs_day, 'YYYY-MM-DD') as day,
        count(distinct l.employee_id) filter (where l.status = 'approved')::int as approved,
        count(distinct l.employee_id) filter (where l.status like 'pending%')::int as pending
      from today t
      cross join lateral generate_series(t.d::timestamp, (t.d + 13)::timestamp, interval '1 day') gs_day
      left join leave_requests l on l.tenant_id = $1::uuid and gs_day::date between l.starts_on and l.ends_on
        and l.employee_id in (select id from emp where active)
      group by gs_day order by gs_day`),
    moments: scoped(scope, `
      with upcoming as (
        select name, 'Work anniversary' as kind, years_done + 1 as years,
          (joining_date + make_interval(years => years_done + 1))::date as on_day
        from (select name, joining_date, extract(year from age((select d from today) - 1, joining_date))::int as years_done
              from emp where active and joining_date is not null and joining_date < (select d from today)) a
        union all
        select name, 'Birthday', null,
          (date_of_birth + make_interval(years => extract(year from age((select d from today) - 1, date_of_birth))::int + 1))::date
        from emp where $5::boolean and active and date_of_birth is not null
      )
      select name, kind, years, to_char(on_day, 'YYYY-MM-DD') as on_day from upcoming, today t
      where on_day between t.d and t.d + 13 and (kind <> 'Work anniversary' or years > 0)
      order by on_day, name limit 20`, [showBirthdays]),
    tickets: scoped(scope, `
      select status as name, count(*)::int as value from (
        select upper(coalesce(status, 'OPEN')) as status from helpdesk_tickets where tenant_id = $1::uuid
        union all
        select upper(status) from hrms_operation_records where tenant_id = $1::uuid and resource = 'tickets'
      ) s group by 1 order by 2 desc`),
  });

  const today = first(data.today);
  const headcount = num(today.headcount);
  const recorded = num(today.recorded);
  const completeness = first(data.completeness);
  const total = num(completeness.total);
  const checks = [
    ["Work email", "work_email"], ["Department", "department"], ["Location", "location"], ["Designation", "designation"],
    ["Reporting manager", "manager"], ["Joining date", "joining_date"], ["Date of birth", "date_of_birth"],
  ] as const;
  const missingCells = checks.reduce((sum, [, key]) => sum + num(completeness[key]), 0);
  const completePct = total ? pct(total * checks.length - missingCells, total * checks.length, 0) : null;
  const queue = first(data.queue);

  const kpis: Kpi[] = [
    { id: "present", label: "Present today", value: data.today ? num(today.present) : null, of: headcount || null, format: "count", hint: recorded ? "From today's attendance" : "No attendance recorded today", tone: "positive", target: "attendance" },
    { id: "on-leave", label: "On approved leave", value: data.today ? num(today.on_leave) : null, format: "count", hint: "Today", target: "leaves" },
    { id: "absent", label: "Absent", value: data.today ? num(today.absent) : null, format: "count", hint: "Marked absent today", tone: num(today.absent) ? "attention" : "neutral" },
    { id: "not-recorded", label: "No attendance record", value: data.today ? Math.max(headcount - recorded, 0) : null, format: "count", hint: "Active employees without a record today" },
    { id: "joining", label: "Joining this week", value: data.joiningWeek ? num(first(data.joiningWeek).value) : null, format: "count", hint: "Next 7 days", target: "onboarding" },
    { id: "exits", label: "Exits in progress", value: data.exits ? num(first(data.exits).value) : null, format: "count", hint: "Open exit cases", target: "offboarding" },
    { id: "completeness", label: "Record completeness", value: completePct, format: "percent", hint: total ? "Core fields on active records" : "No active employees", tone: completePct !== null && completePct < 80 ? "attention" : "neutral", target: "people_core" },
  ];

  const queueItems = [
    { label: "Leave requests awaiting a decision", value: num(queue.leave), target: "leaves" },
    { label: "Attendance regularisations submitted", value: num(queue.regularisations), target: "attendance" },
    { label: "Open helpdesk tickets", value: num(queue.tickets), target: "helpdesk" },
    { label: "Onboarding in progress", value: num(queue.onboarding), target: "onboarding" },
    { label: "Exit clearance items pending", value: num(queue.clearance), target: "offboarding" },
  ].filter((item) => item.value > 0).map((item) => ({ ...item, format: "count" as const }));

  const absence = rowsOf(data.absence);
  const moments = rowsOf(data.moments);

  const panels: Panel[] = [
    withSource(data.queue, listPanel(
      { id: "queue", title: "Work waiting on HR", subtitle: "Open items across modules", span: 5, emptyMessage: "Nothing is waiting: no pending leave, regularisations, tickets, onboarding or clearance items." },
      queueItems,
    )),
    withSource(data.joining, tablePanel(
      { id: "joining", title: "Joining in the next 30 days", span: 7, emptyMessage: "No joiners are scheduled in the next 30 days.", target: "onboarding" },
      [{ key: "name", label: "Name" }, { key: "designation", label: "Designation" }, { key: "department", label: "Department" }, { key: "joining_date", label: "Joins", format: "date" }],
      rowsOf(data.joining).map((row) => ({ name: str(row.name), designation: str(row.designation), department: str(row.department), joining_date: str(row.joining_date) })),
    )),
    withSource(data.absence, barPanel(
      { id: "absence", title: "Leave in the next 14 days", subtitle: "People away per day", span: 8, format: "count", emptyMessage: "No approved or pending leave in the next 14 days.", target: "leaves" },
      absence.map((row) => dayLabel(String(row.day))),
      [{ name: "Approved", data: absence.map((row) => num(row.approved)), stack: "leave" }, { name: "Pending", data: absence.map((row) => num(row.pending)), stack: "leave" }],
    )),
    withSource(data.tickets, partsPanel(
      { id: "tickets", title: "Helpdesk tickets", subtitle: "By status", span: 4, format: "count", emptyMessage: "No helpdesk tickets have been raised.", target: "helpdesk" },
      named(data.tickets).map((row) => ({ name: humanise(row.name), value: row.value })),
    )),
    withSource(data.moments, listPanel(
      { id: "moments", title: "People moments", subtitle: showBirthdays ? "Birthdays and work anniversaries, next 14 days" : "Work anniversaries, next 14 days", span: 6, emptyMessage: "No birthdays or work anniversaries in the next 14 days." },
      moments.map((row) => ({
        label: str(row.name) ?? "",
        detail: row.kind === "Work anniversary" ? `${num(row.years)} ${num(row.years) === 1 ? "year" : "years"} of service` : "Birthday",
        status: dayLabel(String(row.on_day)),
      })),
    )),
    withSource(data.completeness, barPanel(
      { id: "missing", title: "Missing employee details", subtitle: "Active records without each field", span: 6, format: "count", emptyMessage: total ? "Every active record has these details." : "No active employees yet.", target: "people_core" },
      checks.map(([label]) => label).reverse(), [{ name: "Records missing it", data: checks.map(([, key]) => num(completeness[key])).reverse() }], true,
    )),
  ];

  const insights: string[] = [];
  if (recorded) insights.push(`${num(today.present).toLocaleString("en-IN")} of ${headcount.toLocaleString("en-IN")} active employees are present today.`);
  else if (headcount) insights.push("No attendance has been recorded for today yet.");
  const waiting = queueItems.reduce((sum, item) => sum + (item.value ?? 0), 0);
  if (waiting) insights.push(`${plural(waiting, "item is", "items are")} waiting on HR across ${plural(queueItems.length, "queue")}.`);
  const busiest = absence.reduce<Row | null>((best, row) => (num(row.approved) + num(row.pending) > num(best?.approved) + num(best?.pending) ? row : best), null);
  if (busiest && num(busiest.approved) + num(busiest.pending) > 0) insights.push(`The most people away in the next two weeks is on ${dayLabel(String(busiest.day))}: ${num(busiest.approved) + num(busiest.pending)}.`);
  if (completePct !== null && completePct < 100) insights.push(`Employee records are ${completePct}% complete on core fields.`);

  return { kpis, panels, insights, employeesInScope: headcount };
}

/* ------------------------------------------------------------------ */

function str(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}
