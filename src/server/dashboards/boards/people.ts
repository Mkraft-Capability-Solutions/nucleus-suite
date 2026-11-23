import "server-only";

import {
  annualisedAttrition, barPanel, dayLabel, partsPanel, headcountInsight, heatmapPanel, humanise, largest, linePanel,
  listPanel, monthLabel, num, numOrNull, pct, periodLabel, plural, round, tablePanel, TENURE_BANDS, withSource,
} from "../compose";
import { can, runAll, scoped, type Row, type Scope } from "../query";
import type { Insight, Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: Array<string | Insight>; employeesInScope: number; evidence?: string[] };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};
const named = (rows: Row[] | null) => rowsOf(rows).map((row) => ({ name: String(row.name ?? "Not recorded"), value: num(row.value) }));

/* ================================================================== */
/* S1 · People command centre                                          */
/* ================================================================== */

/** Attrition level by annualised rate: the colour bands of "Attrition by function". */
export function attritionLevel(rate: number): "positive" | "attention" | "risk" {
  return rate >= 20 ? "risk" : rate >= 10 ? "attention" : "positive";
}

/**
 * A simple run-rate model: what is already committed each month, plus the average net monthly
 * change of the last year carried forward, with an 80% range from how much that change varied.
 */
export function headcountModel(committed: number[], monthlyNet: number[]) {
  const mean = monthlyNet.length ? monthlyNet.reduce((sum, value) => sum + value, 0) / monthlyNet.length : 0;
  const variance = monthlyNet.length > 1 ? monthlyNet.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (monthlyNet.length - 1) : 0;
  const spread = Math.sqrt(variance);
  return committed.map((base, index) => {
    const horizon = index + 1;
    const centre = base + mean * horizon;
    const width = 1.2816 * spread * Math.sqrt(horizon);
    return { centre: round(centre, 0), lower: round(Math.max(0, centre - width), 0), upper: round(centre + width, 0) };
  });
}

const FORECAST_MONTHS = 6;

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
        count(*) filter (where joined_on > t.d - make_interval(months => $5::int * 2) and joined_on <= t.d - make_interval(months => $5::int))::int as joiners_prev,
        count(*) filter (where exit_date > t.d - make_interval(months => $5::int * 2) and exit_date <= t.d - make_interval(months => $5::int))::int as leavers_prev,
        count(*) filter (where joined_on <= t.d - make_interval(months => $5::int * 2)
          and (exit_date is null or exit_date > t.d - make_interval(months => $5::int * 2))
          and (active or exit_date is not null))::int as headcount_at_prev_start,
        coalesce(avg(case when active and joined_on <= t.d then (t.d - joined_on) / 365.25 end), 0)::float as avg_tenure,
        count(*) filter (where active and joined_on <= t.d and department is null)::int as no_department,
        count(*)::int as records,
        count(*) filter (where not active)::int as former,
        to_char(min(joined_on), 'YYYY') as earliest
      from emp, today t`, [months]),
    // Always a year of history: the model needs it even when a shorter period is shown.
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
        count(e.id) filter (where e.exit_date between m.month_start and m.month_end)::int as leavers,
        (select count(*) from employee_job_history h where h.tenant_id = $1::uuid and h.employee_id in (select id from emp)
          and h.movement_type in ('promotion', 'transfer', 'group_transfer', 'redesignation', 'secondment', 'demotion')
          and h.effective_from between m.month_start and m.month_end
          and not exists (select 1 from employee_job_history c where c.tenant_id = h.tenant_id and c.supersedes_id = h.id))::int as moves
      from months m left join emp e on true
      group by m.month_start, m.month_end order by m.month_start`, [Math.max(trendMonths, 12)]),
    // Headcount already committed: today's active staff, plus joiners with a joining date by each
    // month end, less exits with a last working day by then.
    committed: scoped(scope, `
      select to_char(gs, 'YYYY-MM') as month,
        (select count(*) filter (where active and joined_on <= t.d) + count(*) filter (where joining_date > t.d and joining_date <= (gs + interval '1 month' - interval '1 day')::date) from emp)::int
        - (select count(*) from offboarding_cases o join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id join emp e on e.id = em.employee_id
            where o.tenant_id = $1::uuid and coalesce(o.attributes->>'status', '') not in ('settled', 'closed', 'completed', 'cancelled', 'withdrawn')
              and o.attributes->>'last_working_day' ~ '^\\d{4}-\\d{2}-\\d{2}$' and (o.attributes->>'last_working_day')::date > t.d
              and (o.attributes->>'last_working_day')::date <= (gs + interval '1 month' - interval '1 day')::date)::int as committed
      from today t, generate_series(date_trunc('month', t.d::timestamp) + interval '1 month', date_trunc('month', t.d::timestamp) + make_interval(months => $5::int), interval '1 month') gs
      order by gs`, [FORECAST_MONTHS]),
    // Sanctioned strength in force at each month end: the manpower plan lines effective by then.
    plan: scoped(scope, `
      select to_char(gs, 'YYYY-MM') as month,
        (select sum(case when ml.attributes->>'sanctioned' ~ '^[0-9]+$' then (ml.attributes->>'sanctioned')::int end)
          from manpower_plan_lines ml
          left join departments dp on dp.tenant_id = ml.tenant_id and dp.id = ml.department_id
          left join locations lo on lo.tenant_id = ml.tenant_id and lo.id = ml.location_id
          where ml.tenant_id = $1::uuid and ml.attributes->>'effective_from' ~ '^\\d{4}-\\d{2}-\\d{2}'
            and left(ml.attributes->>'effective_from', 10)::date <= (gs + interval '1 month' - interval '1 day')::date
            and ($3::text is null or dp.attributes->>'name' = $3::text)
            and ($2::text is null or lo.attributes->>'code' = $2::text or lo.attributes->>'city' = $2::text))::int as planned
      from today t, generate_series(date_trunc('month', t.d::timestamp) - make_interval(months => $5::int - 1),
                                    date_trunc('month', t.d::timestamp) + make_interval(months => $6::int), interval '1 month') gs
      order by gs`, [trendMonths, FORECAST_MONTHS]),
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
    // The last earlier day with attendance recorded, for the change on the attendance tile.
    attendanceBefore: scoped(scope, `
      select to_char(a.attendance_date, 'YYYY-MM-DD') as day, count(*) filter (where a.status in ('present', 'half_day'))::int as present,
        count(*) filter (where a.status in ('present', 'half_day', 'absent', 'leave'))::int as recorded
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date < t.d and a.attendance_date >= t.d - 10
        and a.status in ('present', 'half_day', 'absent', 'leave')
      group by a.attendance_date order by a.attendance_date desc limit 1`),
  });

  const summary = first(data.summary);
  const headcount = num(summary.headcount);
  const leavers = num(summary.leavers);
  const joiners = num(summary.joiners);
  const atStart = num(summary.headcount_at_start);
  const attrition = annualisedAttrition(leavers, (headcount + atStart) / 2, months);
  const attritionBefore = annualisedAttrition(num(summary.leavers_prev), (atStart + num(summary.headcount_at_prev_start)) / 2, months);
  const attendance = first(data.attendance);
  const recorded = num(attendance.recorded);
  const attendanceRate = recorded ? pct(num(attendance.present), headcount) : null;
  const before = first(data.attendanceBefore);
  const attendanceBefore = num(before.recorded) ? pct(num(before.present), num(before.recorded)) : null;
  const period = periodLabel(months);
  const previousPeriod = months === 1 ? "the month before" : `the ${months} months before`;
  const versusPrevious = months === 1 ? "vs prior month" : `vs prior ${months} months`;

  const fullTrend = rowsOf(data.trend);
  const trend = fullTrend.slice(-trendMonths);
  const monthKeys = trend.map((row) => String(row.month));
  const monthNames = monthKeys.map(monthLabel);
  const headcountSeries = trend.map((row) => num(row.headcount));
  const lastMonthEnd = headcountSeries.length > 1 ? headcountSeries[headcountSeries.length - 2]! : null;

  const kpis: Kpi[] = [
    { id: "headcount", label: "Active headcount", value: data.summary ? headcount : null, format: "count", hint: "Employees on the rolls today", target: "people_core",
      ...(lastMonthEnd !== null && data.trend ? { delta: { value: headcount - lastMonthEnd, format: "count" as const, label: `vs end ${monthNames[monthNames.length - 2]}`, better: "neutral" as const } } : {}) },
    { id: "joiners", label: "Joiners", value: data.summary ? joiners : null, format: "count", hint: period, tone: "positive",
      ...(data.summary ? { delta: { value: joiners - num(summary.joiners_prev), format: "count" as const, label: versusPrevious, better: "neutral" as const } } : {}) },
    { id: "leavers", label: "Leavers", value: data.summary ? leavers : null, format: "count", hint: period, tone: leavers > 0 ? "attention" : "neutral",
      ...(data.summary ? { delta: { value: leavers - num(summary.leavers_prev), format: "count" as const, label: versusPrevious, better: "down" as const } } : {}) },
    { id: "attrition", label: "Annualised attrition", value: attrition, format: "percent", hint: attrition === null ? "Needs headcount history" : `Leavers ÷ average headcount, ${period}`, tone: attrition !== null && attrition >= 15 ? "risk" : "neutral",
      ...(attrition !== null && attritionBefore !== null ? { delta: { value: round(attrition - attritionBefore, 1), format: "decimal" as const, unit: " pts", label: versusPrevious, better: "down" as const } } : {}) },
    { id: "attendance", label: "Attendance today", value: attendanceRate, format: "percent", hint: recorded ? `${num(attendance.present).toLocaleString("en-IN")} present of ${headcount.toLocaleString("en-IN")}` : attendanceBefore !== null ? `No attendance recorded today · ${dayLabel(String(before.day))}: ${attendanceBefore}%` : "No attendance recorded today", target: "attendance",
      ...(attendanceRate !== null && attendanceBefore !== null ? { delta: { value: round(attendanceRate - attendanceBefore, 1), format: "decimal" as const, unit: " pts", label: `vs ${dayLabel(String(before.day))}`, better: "up" as const } } : {}) },
    { id: "tenure", label: "Average tenure", value: headcount ? round(num(summary.avg_tenure), 1) : null, format: "years", hint: "Active employees" },
  ];

  // Workforce momentum: actual, plan in force and a modelled six months ahead.
  const committed = rowsOf(data.committed);
  const forecastNames = committed.map((row) => monthLabel(String(row.month)));
  const monthlyNet = fullTrend.slice(-12).map((row) => num(row.joiners) - num(row.leavers));
  const model = headcountModel(committed.map((row) => num(row.committed)), monthlyNet);
  const planRows = rowsOf(data.plan);
  const planned = planRows.map((row) => numOrNull(row.planned));
  const lastActual = headcountSeries.length - 1;
  const atJoin = (values: number[]) => [...headcountSeries.map((value, index) => (index === lastActual ? value : null)), ...values];
  const hasPlan = planned.some((value) => value !== null);

  const departments = rowsOf(data.byDepartment).map((row) => {
    const value = num(row.value);
    const departmentLeavers = num(row.leavers);
    const rate = annualisedAttrition(departmentLeavers, (value + num(row.at_start)) / 2, months) ?? (departmentLeavers > 0 ? 100 : 0);
    return { name: String(row.name), value, leavers: departmentLeavers, rate };
  });
  const byHeadcount = [...departments].filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 12);
  const byAttrition = departments.filter((row) => row.value > 0 || row.leavers > 0).sort((a, b) => b.rate - a.rate || b.value - a.value).slice(0, 14).reverse();
  const levels = [["positive", "Under 10%"], ["attention", "10–20%"], ["risk", "20% and over"]] as const;
  const locations = named(data.byLocation).slice(0, 12);
  const tenure = named(data.tenure);

  const panels: Panel[] = [
    withSource(data.trend, {
      ...linePanel(
        { id: "headcount-trend", title: "Workforce momentum", subtitle: `Month-end headcount, plan and a ${FORECAST_MONTHS}-month model`, span: 7, format: "count", emptyMessage: "Appears once employees with joining dates are recorded.", target: "people_core",
          note: "Plan: sanctioned strength in force from the manpower plan. Model: joiners and exits already on record, plus the last 12 months' average net monthly change; the band is its 80% range." },
        [...monthNames, ...forecastNames],
        [
          { name: "Actual", data: [...headcountSeries, ...forecastNames.map(() => null)], hue: 0 },
          ...(hasPlan ? [{ name: "Plan", data: planned, hue: 2, dotted: true }] : []),
          ...(model.length ? [{ name: "Modelled", data: atJoin(model.map((step) => step.centre)), hue: 6, dashed: true }] : []),
        ],
      ),
      ...(model.length ? { band: { name: "Modelled range (80%)", of: "Modelled", lower: atJoin(model.map((step) => step.lower)), upper: atJoin(model.map((step) => step.upper)) } } : {}),
    }),
    withSource(data.byDepartment, barPanel(
      { id: "attrition-department", title: "Attrition by function", subtitle: `Annualised %, ${period}, highest first`, span: 6, format: "percent", emptyMessage: `No one has left in the ${period}.`,
        note: "Leavers ÷ average headcount of the department, scaled to a year. Under 10% healthy, 10–20% watch, 20% and over act." },
      byAttrition.map((row) => row.name),
      levels.map(([tone, name]) => ({ name, tone, stack: "level", data: byAttrition.map((row) => (attritionLevel(row.rate) === tone ? row.rate : null)) })),
      true,
    )),
    withSource(data.trend, barPanel(
      { id: "joiners-leavers", title: "Movement by month", subtitle: "Joiners, internal moves and leavers", span: 6, format: "count", emptyMessage: "Appears once joining, move or exit dates are recorded." },
      monthNames, [{ name: "Joiners", data: trend.map((row) => num(row.joiners)), hue: 2 }, { name: "Internal moves", data: trend.map((row) => num(row.moves)), hue: 6 }, { name: "Leavers", data: trend.map((row) => num(row.leavers)), hue: 7 }],
    )),
    withSource(data.byDepartment, barPanel(
      { id: "department", title: "Headcount by department", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once employees are recorded.", target: "people_core" },
      byHeadcount.map((row) => row.name).reverse(), [{ name: "Employees", data: byHeadcount.map((row) => row.value).reverse(), hue: 0 }], true,
    )),
    withSource(data.byLocation, barPanel(
      { id: "location", title: "Headcount by location", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once employees have locations recorded." },
      locations.map((row) => row.name).reverse(), [{ name: "Employees", data: locations.map((row) => row.value).reverse(), hue: 2 }], true,
    )),
    withSource(data.tenure, barPanel(
      { id: "tenure", title: "Length of service", subtitle: "Active employees", span: 6, format: "count", emptyMessage: "Appears once joining dates are recorded." },
      TENURE_BANDS, [{ name: "Employees", data: TENURE_BANDS.map((band) => tenure.find((row) => row.name === band)?.value ?? 0), hue: 6 }],
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

  // Findings: what to act on first (ranked by the board), then context the tiles do not already say.
  const insights: Array<string | Insight> = [];
  const topAttrition = [...byAttrition].reverse().find((row) => row.leavers > 0);
  if (topAttrition) {
    const level = attritionLevel(topAttrition.rate);
    insights.push({
      tone: level === "risk" ? "risk" : level === "attention" ? "attention" : "positive", title: `Attrition in ${topAttrition.name}`, figure: `${topAttrition.rate}%`, panel: "attrition-department",
      text: `${plural(topAttrition.leavers, "leaver")} in the ${period}, annualised${attrition !== null ? `; ${attrition}% across the organisation` : ""}.`,
    });
  }
  const lastModel = model[model.length - 1];
  const lastPlan = planned[planned.length - 1];
  const horizon = forecastNames[forecastNames.length - 1];
  if (lastModel && lastPlan !== null && lastPlan !== undefined) {
    const gap = lastPlan - lastModel.centre;
    insights.push(gap > 0
      ? { tone: "attention", title: `Short of plan by ${horizon}`, figure: `${gap}`, panel: "headcount-trend", text: `The model reaches ${lastModel.centre} against a plan of ${lastPlan}: ${plural(gap, "position")} still to fill.` }
      : { tone: "positive", title: `On plan by ${horizon}`, figure: `${lastModel.centre}`, panel: "headcount-trend", text: `The model reaches ${lastModel.centre}, ${gap === 0 ? "level with" : "above"} the plan of ${lastPlan}.` });
  }
  if (attrition !== null && attritionBefore !== null && Math.abs(attrition - attritionBefore) >= 2) {
    const rising = attrition > attritionBefore;
    insights.push({ tone: rising ? "attention" : "positive", title: rising ? "Attrition rising" : "Attrition falling", figure: `${rising ? "+" : "−"}${round(Math.abs(attrition - attritionBefore), 1)} pts`, panel: "attrition-department",
      text: `${attrition}% annualised, against ${attritionBefore}% in ${previousPeriod}.` });
  }
  const noDepartment = num(summary.no_department);
  if (noDepartment) insights.push({ tone: "attention", title: "Records without a department", figure: `${noDepartment}`, panel: "department", text: `${plural(noDepartment, "active employee is", "active employees are")} left out of the department views.` });
  const headline = headcountInsight(monthKeys, headcountSeries);
  if (headline) insights.push({ tone: "info", text: headline, panel: "headcount-trend" });
  const biggest = largest(byHeadcount);
  if (biggest && headcount) insights.push({ tone: "info", text: `${biggest.name} is the largest department, with ${pct(biggest.value, headcount, 0)}% of headcount.`, panel: "department" });
  const newcomers = tenure.find((row) => row.name === "Under 1 year")?.value ?? 0;
  if (newcomers && headcount) insights.push({ tone: "info", text: `${pct(newcomers, headcount, 0)}% of people have been here less than a year.`, panel: "tenure" });

  const evidence = data.summary ? [
    `${plural(num(summary.records), "employee record")} read: ${headcount.toLocaleString("en-IN")} active today, ${num(summary.former).toLocaleString("en-IN")} former.`,
    `Movement from ${monthNames[0] ?? "—"} to today; joining dates go back to ${summary.earliest ?? "—"}.`,
    `Attrition uses last working days from exit cases, ${period}, against the average headcount over the same period.`,
    ...(noDepartment ? [`${plural(noDepartment, "active employee")} without a department ${noDepartment === 1 ? "is" : "are"} left out of the department views.`] : []),
    ...(model.length ? [`The model's monthly net change: average ${round(monthlyNet.reduce((sum, value) => sum + value, 0) / Math.max(monthlyNet.length, 1), 2)} over ${plural(monthlyNet.length, "month")}.`] : []),
  ] : [];

  return { kpis, panels, insights, employeesInScope: headcount, evidence };
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
