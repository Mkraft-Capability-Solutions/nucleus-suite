import "server-only";

import {
  annualisedAttrition, barPanel, bridgePanel, dayLabel, heatmapPanel, humanise, linePanel, listPanel, matrixPanel, monthLabel, num, numOrNull, partsPanel, pct,
  plural, radarPanel, round, sankeyPanel, scatterPanel, tablePanel, withSource,
} from "../compose";
import { can, plain, runAll, scoped, type Row, type Scope } from "../query";
import type { HeatmapPanel, Insight, ListItem, MatrixCell, Panel, PanelState } from "../types";

/**
 * The panels each classic console had beyond the redesign's first cut, now computed from the
 * organisation's records: nine-box, competency profile, calibration checks, cost bridge, skill
 * coverage, approvals, SLA, absence calendar and the rest. Each builder returns panels that its
 * board appends; a panel with no records says what would fill it.
 */

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};
const text = (value: unknown, fallback = "—") => (value === null || value === undefined || value === "" ? fallback : String(value));
const NUMBER = `'^-?[0-9]+(\\.[0-9]+)?$'`;
const DATE = `'^\\d{4}-\\d{2}-\\d{2}'`;
const OPEN_EXIT = `coalesce(o.attributes->>'status', '') not in ('settled', 'closed', 'completed', 'cancelled', 'withdrawn')`;
const FINAL_RUN = `lower(coalesce(status, '')) in ('finalized', 'final', 'approved', 'paid', 'locked', 'disbursed')`;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Latest finalised review assessment per employee (rating 1–5, potential 1–3), from the newest cycle that has one. */
const LATEST_ASSESSMENT = `latest as (
  select distinct on (p.employee_id) p.employee_id, p.manager_employee_id, p.id as participant_id,
    (p.attributes->>'final_rating')::numeric as rating,
    case when p.attributes->>'potential' ~ '^[1-3]$' then (p.attributes->>'potential')::int end as potential,
    coalesce(c.attributes->>'name', c.attributes->>'code', 'Review') as cycle
  from review_participants p join review_cycles c on c.tenant_id = p.tenant_id and c.id = p.review_cycle_id
  where p.tenant_id = $1::uuid and p.attributes->>'final_rating' ~ '^[1-5](\\.[0-9]+)?$'
  order by p.employee_id, coalesce(c.attributes->>'ends_on', '') desc, p.created_at desc)`;

/** A heatmap whose axes keep the order given (weeks, weekdays), unlike the alphabetical default. */
function orderedHeatmap(common: Omit<HeatmapPanel, "kind" | "state" | "x" | "y" | "cells">, x: string[], y: string[], cells: Array<[number, number, number]>): HeatmapPanel {
  const ok = x.length > 1 && y.length > 1 && cells.some((cell) => cell[2] > 0);
  return { ...common, kind: "heatmap", x, y, cells, state: ok ? "ok" : "empty" };
}

function stateOf(rows: Row[] | null, ok: boolean): PanelState {
  return rows === null ? "unavailable" : ok ? "ok" : "empty";
}

/* ================================================================== */
/* S1 · People command centre                                          */
/* ================================================================== */

const INTERNAL_MOVES = `('promotion', 'transfer', 'group_transfer', 'redesignation', 'secondment', 'demotion')`;
/** On the rolls at day `d` (a SQL expression), for the `emp` row aliased `e`. */
const ON_ROLLS = (d: string) => `e.joined_on <= ${d} and (e.exit_date is null or e.exit_date > ${d}) and (e.active or e.exit_date is not null)`;

/** The six organisation-health measures, each 0–100, and how they are defined. */
export const HEALTH_MEASURES = [
  ["Retention", "people on the rolls at the start of the 90 days who were still there at the end"],
  ["Capability", "skills their roles require that people hold"],
  ["Engagement", "favourable answers (4–5 of 5) to the engagement questions of the employee pulse"],
  ["Mobility", "roles filled by internal moves rather than hiring, over the 12 months to the period end"],
  ["Manager quality", "favourable answers to the pulse's questions about the manager"],
  ["Diversity", "gender balance: 100 is an even split"],
] as const;

export function healthScores(row: Row): Array<number | null> {
  const share = (part: unknown, whole: unknown) => (num(whole) > 0 ? round((num(part) / num(whole)) * 100, 0) : null);
  const female = num(row.female), male = num(row.male);
  return [
    num(row.at_start) > 0 ? round(100 - (num(row.leavers) / num(row.at_start)) * 100, 0) : null,
    share(row.met, row.required),
    row.engagement === null || row.engagement === undefined ? null : round(num(row.engagement) * 100, 0),
    share(row.moves, num(row.moves) + num(row.hires)),
    row.manager === null || row.manager === undefined ? null : round(num(row.manager) * 100, 0),
    female + male > 0 ? round((Math.min(female, male) / (female + male)) * 200, 0) : null,
  ];
}

/** Where a department sits on pay against performance: the colour group of its bubble. */
export function payQuadrant(compa: number, rating: number, averageRating: number): string {
  if (compa >= 100) return rating >= averageRating ? "Paid and performing" : "Pay ahead of performance";
  return rating >= averageRating ? "Pay behind performance" : "Developing";
}
const QUADRANT_HUES: Record<string, number> = { "Paid and performing": 2, "Pay ahead of performance": 3, "Pay behind performance": 7, Developing: 0 };

/** Exit reason text from the exit case → the flow it leaves by. */
export const EXIT_ROUTES = ["Resignations", "End of contract", "Retirement", "Terminations", "Other exits", "Reason not recorded"] as const;
const EXIT_ROUTE_SQL = (reason: string) => `case when ${reason} is null or trim(${reason}) = '' then 'Reason not recorded'
  when ${reason} ilike 'resign%' then 'Resignations' when ${reason} ilike '%contract%' then 'End of contract'
  when ${reason} ilike '%retire%' or ${reason} ilike '%superannuat%' then 'Retirement'
  when ${reason} ilike '%terminat%' or ${reason} ilike '%dismiss%' then 'Terminations' else 'Other exits' end`;
const FLOW_HUES: Record<string, number> = { "External hires": 0, Returning: 5, "Internal moves": 6, Active: 2, Resignations: 7, "End of contract": 3, Retirement: 1, Terminations: 4, "Other exits": -1, "Reason not recorded": -1 };

export async function peopleExtras(scope: Scope): Promise<{ panels: Panel[]; insights: Insight[] }> {
  const seesPay = can(scope.access, "payroll.rate.read");
  const months = scope.filters.months;
  const period = months === 1 ? "last month" : months === 12 ? "last 12 months" : `last ${months} months`;
  const data = await runAll(scope.access, {
    // Two 90-day windows: the latest (to today) and the one before it.
    health: scoped(scope, `
      with bounds as (select k, t.d - 90 * (k + 1) + 1 as s, t.d - 90 * k as e from today t, (values (0), (1)) w(k))
      select b.k,
        (select count(*) from emp e where e.exit_date between b.s and b.e)::int as leavers,
        (select count(*) from emp e where ${ON_ROLLS("b.s - 1")})::int as at_start,
        (select count(*) from emp e join job_profiles jp on jp.tenant_id = $1::uuid and jp.attributes->>'name' = e.designation
          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(jp.attributes->'required_skills') = 'array' then jp.attributes->'required_skills' else '[]'::jsonb end) skill
          where ${ON_ROLLS("b.e")})::int as required,
        (select count(*) from emp e join job_profiles jp on jp.tenant_id = $1::uuid and jp.attributes->>'name' = e.designation
          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(jp.attributes->'required_skills') = 'array' then jp.attributes->'required_skills' else '[]'::jsonb end) skill
          where ${ON_ROLLS("b.e")} and exists (select 1 from employee_skills s join skills k on k.tenant_id = s.tenant_id and k.id = s.skill_id
            where s.tenant_id = $1::uuid and s.employee_id = e.id and k.attributes->>'name' = skill and s.created_at::date <= b.e))::int as met,
        (select count(*) filter (where (a.attributes->>'score')::int >= 4)::float / nullif(count(*), 0)
          from survey_answers a join survey_responses r on r.tenant_id = a.tenant_id and r.id = a.survey_response_id
          join survey_questions q on q.tenant_id = a.tenant_id and q.id = a.survey_question_id
          where a.tenant_id = $1::uuid and r.employee_id in (select id from emp) and r.created_at::date between b.s and b.e
            and q.attributes->>'theme' = 'engagement' and a.attributes->>'score' ~ '^[1-5]$') as engagement,
        (select count(*) filter (where (a.attributes->>'score')::int >= 4)::float / nullif(count(*), 0)
          from survey_answers a join survey_responses r on r.tenant_id = a.tenant_id and r.id = a.survey_response_id
          join survey_questions q on q.tenant_id = a.tenant_id and q.id = a.survey_question_id
          where a.tenant_id = $1::uuid and r.employee_id in (select id from emp) and r.created_at::date between b.s and b.e
            and q.attributes->>'theme' = 'manager' and a.attributes->>'score' ~ '^[1-5]$') as manager,
        (select count(*) from employee_job_history h where h.tenant_id = $1::uuid and h.employee_id in (select id from emp)
          and h.movement_type in ${INTERNAL_MOVES} and h.effective_from between b.e - 364 and b.e
          and not exists (select 1 from employee_job_history c where c.tenant_id = h.tenant_id and c.supersedes_id = h.id))::int as moves,
        (select count(*) from emp e where e.joined_on between b.e - 364 and b.e)::int as hires,
        (select count(*) from emp e join employees x on x.id = e.id where ${ON_ROLLS("b.e")} and lower(x.metadata->>'gender') = 'female')::int as female,
        (select count(*) from emp e join employees x on x.id = e.id where ${ON_ROLLS("b.e")} and lower(x.metadata->>'gender') = 'male')::int as male
      from bounds b order by b.k`),
    flowIn: scoped(scope, `
      select
        (select count(*) from emp e where e.joined_on > t.d - make_interval(months => $5::int) and e.joined_on <= t.d and not exists (
          select 1 from employments em where em.tenant_id = $1::uuid and em.employee_id = e.id and em.attributes->>'end_date' ~ '^\\d{4}-\\d{2}-\\d{2}' and left(em.attributes->>'end_date', 10)::date < e.joined_on))::int as hires,
        (select count(*) from emp e where e.joined_on > t.d - make_interval(months => $5::int) and e.joined_on <= t.d and exists (
          select 1 from employments em where em.tenant_id = $1::uuid and em.employee_id = e.id and em.attributes->>'end_date' ~ '^\\d{4}-\\d{2}-\\d{2}' and left(em.attributes->>'end_date', 10)::date < e.joined_on))::int as returning,
        (select count(*) from employee_job_history h where h.tenant_id = $1::uuid and h.employee_id in (select id from emp)
          and h.movement_type in ${INTERNAL_MOVES} and h.effective_from > t.d - make_interval(months => $5::int) and h.effective_from <= t.d
          and not exists (select 1 from employee_job_history c where c.tenant_id = h.tenant_id and c.supersedes_id = h.id))::int as moves,
        (select count(*) from emp e where e.active and e.joined_on <= t.d)::int as active
      from today t`, [months]),
    flowOut: scoped(scope, `
      select ${EXIT_ROUTE_SQL("reason")} as name, count(*)::int as value from (
        select (select o.attributes->>'reason' from offboarding_cases o join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id
                where em.tenant_id = $1::uuid and em.employee_id = e.id order by o.created_at desc limit 1) as reason
        from emp e, today t where e.exit_date > t.d - make_interval(months => $5::int) and e.exit_date <= t.d) x
      group by 1`, [months]),
    attritionHeat: scoped(scope, `
      select coalesce(e.location, 'Not recorded') as x, coalesce(e.department, 'Not recorded') as y,
        count(*) filter (where e.exit_date > t.d - make_interval(months => $5::int) and e.exit_date <= t.d)::int as leavers,
        count(*) filter (where e.active and e.joined_on <= t.d)::int as headcount,
        count(*) filter (where ${ON_ROLLS("t.d - make_interval(months => $5::int)")})::int as at_start,
        string_agg(e.name, ', ' order by e.name) filter (where e.exit_date > t.d - make_interval(months => $5::int) and e.exit_date <= t.d) as names
      from emp e, today t group by 1, 2`, [months]),
    pay: seesPay ? scoped(scope, `
      with ${LATEST_ASSESSMENT},
      grade_median as (
        -- Median pay in the grade (the middle salary on record; the lower middle when the count is even).
        select designation_level as level, (array_agg(basic_salary_minor order by basic_salary_minor))[(count(*)::int + 1) / 2] as median
        from employees where tenant_id = $1::uuid and basic_salary_minor is not null
          and coalesce(lower(status), 'active') not in ('separated', 'exited', 'relieved', 'archived', 'inactive')
        group by 1),
      rated as (
        select coalesce(e.department, 'Not recorded') as department, l.rating, 100.0 * x.basic_salary_minor / nullif(g.median, 0) as compa
        from latest l join emp e on e.id = l.employee_id and e.active
        join employees x on x.id = e.id
        left join grade_median g on g.level = x.designation_level
        where x.basic_salary_minor is not null)
      select department as name, round(avg(compa), 1)::float as compa, round(avg(rating), 2)::float as rating, count(*)::int as people,
        (select round(avg(rating), 2) from rated)::float as overall
      from rated where compa is not null group by 1`) : plain(scope, `select 1 where false`),
  });

  // Organisation health: the latest 90 days against the 90 days before.
  const healthRows = rowsOf(data.health);
  const now = healthScores(healthRows.find((row) => num(row.k) === 0) ?? {});
  const before = healthScores(healthRows.find((row) => num(row.k) === 1) ?? {});
  const indexOf = (scores: Array<number | null>) => { const measured = scores.filter((value): value is number => value !== null); return measured.length ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length) : null; };
  const index = indexOf(now), indexBefore = indexOf(before);
  const measured = now.filter((value) => value !== null).length;
  const change = index !== null && indexBefore !== null ? index - indexBefore : null;

  // Talent flow
  const flowIn = first(data.flowIn);
  const exits = rowsOf(data.flowOut).map((row) => ({ name: String(row.name), value: num(row.value) })).filter((row) => row.value > 0)
    .sort((a, b) => EXIT_ROUTES.indexOf(a.name as (typeof EXIT_ROUTES)[number]) - EXIT_ROUTES.indexOf(b.name as (typeof EXIT_ROUTES)[number]));
  const label = (name: string, value: number) => `${name} (${value.toLocaleString("en-IN")})`;
  const active = num(flowIn.active);
  const core = label("Active", active);
  const inflows = [["External hires", num(flowIn.hires)], ["Internal moves", num(flowIn.moves)], ["Returning", num(flowIn.returning)]] as const;

  // Attrition heat
  const heatRows = rowsOf(data.attritionHeat).filter((row) => num(row.headcount) + num(row.leavers) > 0);
  const heat = heatRows.map((row) => {
    const rate = annualisedAttrition(num(row.leavers), (num(row.headcount) + num(row.at_start)) / 2, months) ?? (num(row.leavers) ? 100 : 0);
    return { x: String(row.x), y: String(row.y), value: Math.min(rate, 100), note: `${plural(num(row.leavers), "leaver")}, ${plural(num(row.headcount), "person", "people")} now${row.names ? ` · left: ${String(row.names)}` : ""}` };
  });
  const heatPanel = heatmapPanel(
    { id: "attrition-heat", title: "Attrition heat: function × location", subtitle: `Annualised %, ${period} · hover a cell for who left`, span: 6, format: "percent", emptyMessage: `No one has left in the ${period}.` },
    heat.map(({ x, y, value }) => ({ x, y, value })),
  );
  // Notes in the order of the panel's cells.
  const notes = heatPanel.cells.map(([xi, yi]) => heat.find((row) => row.x === heatPanel.x[xi] && row.y === heatPanel.y[yi])?.note ?? "");

  // Pay position vs performance, by department
  const pay = rowsOf(data.pay);
  const overall = num(pay[0]?.overall);
  const payPanel: Panel = seesPay
      ? { ...withSource(data.pay, scatterPanel(
        { id: "pay-performance", title: "Pay position vs performance", subtitle: "By department · bubble size = people rated · pay as % of the grade median", span: 6,
          emptyMessage: "Appears once employees have a finalised review rating and a basic salary.",
          note: `Pay: basic salary as % of the median basic in the same grade. Rating: latest finalised review (1–5). Lines at 100% and the organisation's average rating (${overall.toFixed(2)}).` },
        { xLabel: "Pay vs grade median (%)", yLabel: "Average rating (1–5)", xFormat: "count", yFormat: "decimal" },
        pay.map((row) => ({ x: num(row.compa), y: num(row.rating), label: text(row.name), group: payQuadrant(num(row.compa), num(row.rating), overall), size: num(row.people) })),
      )), sizeLabel: "People rated", xRef: 100, yRef: overall, groupHues: QUADRANT_HUES }
      : { id: "pay-performance", title: "Pay position vs performance", span: 6, kind: "scatter", xLabel: "", yLabel: "", xFormat: "count", yFormat: "count", points: [], state: "forbidden", emptyMessage: "Your role cannot see pay." };

  const insights: Insight[] = [];
  if (index !== null && measured >= 3) {
    const weakest = HEALTH_MEASURES.map(([name], position) => ({ name, value: now[position] })).filter((row): row is { name: (typeof HEALTH_MEASURES)[number][0]; value: number } => row.value !== null).sort((a, b) => a.value - b.value)[0];
    insights.push({
      tone: change === null || change === 0 ? "info" : change > 0 ? "positive" : "attention", title: "Organisation health", figure: `${index}`, panel: "org-health",
      text: `${change === null ? "Index of 100" : change === 0 ? "Level with the previous 90 days" : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} on the previous 90 days`}${weakest ? `; weakest: ${weakest.name.toLowerCase()} (${weakest.value})` : ""}.`,
    });
  }
  const behind = pay.filter((row) => payQuadrant(num(row.compa), num(row.rating), overall) === "Pay behind performance").map((row) => text(row.name));
  if (behind.length) insights.push({ tone: "attention", title: "Pay behind performance", figure: `${behind.length}`, panel: "pay-performance",
    text: `${behind.slice(0, 3).join(", ")}${behind.length > 3 ? ` and ${behind.length - 3} more` : ""}: rated above average, paid below the grade median.` });
  const exitTotal = exits.reduce((sum, row) => sum + row.value, 0);
  const resignations = exits.find((row) => row.name === "Resignations")?.value ?? 0;
  if (exitTotal) insights.push({ tone: "info", panel: "talent-flow", text: `${resignations} of ${plural(exitTotal, "exit")} in the ${period} ${resignations === 1 ? "was a resignation" : "were resignations"}.` });

  const panels: Panel[] = [
    withSource(data.health, {
      ...radarPanel(
        { id: "org-health", title: "Organisation health index", subtitle: index === null ? "Six measures, 0–100" : `Index ${index} of 100${change === null ? "" : change === 0 ? ", level with the previous 90 days" : `, ${change > 0 ? "up" : "down"} ${Math.abs(change)} on the previous 90 days`}`, span: 5, format: "percent",
          emptyMessage: "Appears once employees, skills, pulse answers and moves are recorded.",
          note: HEALTH_MEASURES.map(([name, meaning], position) => `${name}: ${meaning}${now[position] === null ? " (not measured yet)" : ""}`).join(". ") + "." },
        HEALTH_MEASURES.map(([name]) => ({ name, max: 100 })),
        [{ name: "Last 90 days", data: now.map((value) => value ?? 0), hue: 0 }, { name: "The 90 days before", data: before.map((value) => value ?? 0), hue: 1, dashed: true }],
      ),
      ...(measured < 3 ? { state: "empty" as const } : {}),
    }),
    withSource(data.flowIn && data.flowOut, sankeyPanel(
      { id: "talent-flow", title: "Talent flow", subtitle: `Into the active workforce (${active.toLocaleString("en-IN")}) and out of it, ${period}`, span: 6, emptyMessage: `No joiners, moves or exits in the ${period}.`,
        note: "Returning: joiners with an earlier employment with the group. Exit routes come from the reason on each exit case." },
      [
        ...inflows.map(([name, value]) => ({ name: label(name, value), value, side: "in" as const, hue: FLOW_HUES[name]! })),
        { name: core, value: active, side: "core", hue: FLOW_HUES.Active! },
        ...exits.map((row) => ({ name: label(row.name, row.value), value: row.value, side: "out" as const, hue: FLOW_HUES[row.name] ?? -1 })),
      ],
      [
        ...inflows.map(([name, value]) => ({ source: label(name, value), target: core, value })),
        ...exits.map((row) => ({ source: core, target: label(row.name, row.value), value: row.value })),
      ],
    )),
    payPanel,
    withSource(data.attritionHeat, { ...heatPanel, scale: "warm" as const, showZero: true, notes }),
  ];
  return { panels, insights };
}

/* ================================================================== */
/* S2 · HR operations console                                          */
/* ================================================================== */

/** First-response and resolution targets in hours, by priority (the helpdesk's service levels). */
export const HELPDESK_SLA: Record<string, { response: number; resolution: number }> = {
  URGENT: { response: 2, resolution: 24 }, HIGH: { response: 8, resolution: 48 }, MEDIUM: { response: 24, resolution: 120 }, LOW: { response: 48, resolution: 240 },
};

export function helpdeskSla(rows: Array<{ status: string; priority: string; created: string; updated: string; firstReply: string | null }>, now = Date.now()) {
  const hours = (from: string, to: string | number) => ((typeof to === "number" ? to : Date.parse(to)) - Date.parse(from)) / 3_600_000;
  let responded = 0, respondedOnTime = 0, resolved = 0, resolvedOnTime = 0, overdueOpen = 0;
  for (const row of rows) {
    const sla = HELPDESK_SLA[row.priority] ?? HELPDESK_SLA.MEDIUM!;
    if (row.firstReply) { responded += 1; if (hours(row.created, row.firstReply) <= sla.response) respondedOnTime += 1; }
    const done = ["RESOLVED", "CLOSED"].includes(row.status);
    if (done) { resolved += 1; if (hours(row.created, row.updated) <= sla.resolution) resolvedOnTime += 1; }
    else if (hours(row.created, now) > sla.resolution) overdueOpen += 1;
  }
  return { total: rows.length, responded, respondedOnTime, resolved, resolvedOnTime, overdueOpen };
}

export async function hrOperationsExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    approvals: scoped(scope, `
      select * from (
        select e.name, 'Leave · ' || l.leave_type as kind, (t.d - l.created_at::date)::int as age, to_char(l.starts_on, 'YYYY-MM-DD') as on_day
        from leave_requests l join emp e on e.id = l.employee_id, today t
        where l.tenant_id = $1::uuid and l.status like 'pending%'
        union all
        select e.name, 'Attendance regularisation', (t.d - r.created_at::date)::int, r.attributes->>'date'
        from attendance_regularizations r join emp e on e.id::text = r.attributes->>'employee_id', today t
        where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', '') in ('submitted', 'pending')
      ) q order by age desc, name limit 12`),
    onboarding: scoped(scope, `
      select e.name, e.designation, to_char(coalesce(e.joining_date, o.created_at::date), 'YYYY-MM-DD') as starts, coalesce(o.attributes->>'status', 'active') as status,
        case when jsonb_typeof(o.attributes->'tasks') = 'array' then (select count(*) from jsonb_array_elements(o.attributes->'tasks') task where task->>'status' = 'done') else 0 end::int as done,
        case when jsonb_typeof(o.attributes->'tasks') = 'array' then jsonb_array_length(o.attributes->'tasks') else 0 end::int as total,
        case when jsonb_typeof(o.attributes->'tasks') = 'array' then (select task->>'title' from jsonb_array_elements(o.attributes->'tasks') task where coalesce(task->>'status', 'open') <> 'done' limit 1) end as next_step
      from onboarding_instances o join emp e on e.id = o.employee_id
      where o.tenant_id = $1::uuid
      order by (coalesce(o.attributes->>'status', 'active') = 'completed'), coalesce(e.joining_date, o.created_at::date) desc limit 10`),
    tickets: plain(scope, `
      select upper(coalesce(status, 'OPEN')) as status, upper(coalesce(attributes->>'priority', 'MEDIUM')) as priority,
        created_at::text as created, updated_at::text as updated, attributes->'messages'->0->>'at' as first_reply,
        coalesce(nullif(attributes->>'category', ''), 'Other') as category
      from helpdesk_tickets where tenant_id = $1::uuid`),
    absences: scoped(scope, `
      select to_char(date_trunc('week', a.attendance_date), 'YYYY-MM-DD') as week, extract(isodow from a.attendance_date)::int as dow, count(*)::int as value
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 84 and a.attendance_date <= t.d and a.status in ('absent', 'leave')
      group by 1, 2`),
    renewals: scoped(scope, `
      select * from (
        select coalesce(d.attributes->>'title', 'Document') as item, left(d.attributes->>'expires_at', 10) as due, e.name as owner, 'Document' as kind
        from documents d join emp e on e.id = d.employee_id, today t
        where d.tenant_id = $1::uuid and d.record_status <> 'deleted' and d.attributes->>'expires_at' ~ ${DATE}
          and left(d.attributes->>'expires_at', 10)::date between t.d - 30 and t.d + 90
          and coalesce(d.attributes->>'verification', '') <> 'replaced'
        union all
        select coalesce(c.attributes->>'title', c.attributes->>'form_code', 'Statutory filing'), left(c.attributes->>'due_date', 10), coalesce(le.legal_name, 'Organisation'), 'Statutory'
        from compliance_calendar_items c left join legal_entities le on le.tenant_id = c.tenant_id and le.id = c.legal_entity_id, today t
        where c.tenant_id = $1::uuid and c.attributes->>'due_date' ~ ${DATE}
          and left(c.attributes->>'due_date', 10)::date between t.d - 7 and t.d + 60
          and coalesce(c.attributes->>'status', 'scheduled') not in ('filed', 'completed', 'closed')
      ) x order by due limit 15`),
  });

  const today = Date.now();
  const tickets = rowsOf(data.tickets);
  const sla = helpdeskSla(tickets.map((row) => ({ status: String(row.status), priority: String(row.priority), created: String(row.created), updated: String(row.updated), firstReply: row.first_reply ? String(row.first_reply) : null })), today);
  const responsePct = pct(sla.respondedOnTime, sla.responded, 0);
  const resolutionPct = pct(sla.resolvedOnTime, sla.resolved, 0);
  const slaItems: ListItem[] = [
    { label: "First response within target", detail: `${sla.responded} of ${sla.total} tickets answered · target 90%`, value: responsePct, format: "percent", status: responsePct === null ? "No replies yet" : responsePct >= 90 ? "On target" : "Below target", tone: responsePct === null ? "neutral" : responsePct >= 90 ? "positive" : "attention" },
    { label: "Resolved within target", detail: `${sla.resolved} resolved or closed · target 90%`, value: resolutionPct, format: "percent", status: resolutionPct === null ? "None resolved" : resolutionPct >= 90 ? "On target" : "Below target", tone: resolutionPct === null ? "neutral" : resolutionPct >= 90 ? "positive" : "attention" },
    { label: "Open past their resolution target", detail: "Urgent 24 h · High 48 h · Medium 5 days · Low 10 days", value: sla.overdueOpen, format: "count", status: sla.overdueOpen ? "Needs attention" : "None", tone: sla.overdueOpen ? "risk" : "positive" },
  ];

  const byCategory = new Map<string, number>();
  for (const row of tickets) byCategory.set(String(row.category), (byCategory.get(String(row.category)) ?? 0) + 1);
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const absences = rowsOf(data.absences);
  const weeks = [...new Set(absences.map((row) => String(row.week)))].sort();
  const days = [...new Set(absences.map((row) => num(row.dow)))].sort((a, b) => a - b);
  const weekdayRows = days.length ? Array.from({ length: Math.max(...days) }, (_, i) => i + 1).filter((day) => day <= 6 || days.includes(day)) : [];

  const dueStatus = (due: string) => {
    const left = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${new Date(today).toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000);
    return left < 0 ? { status: "Overdue", tone: "risk" as const } : left <= 14 ? { status: "Urgent", tone: "risk" as const } : left <= 45 ? { status: "Approaching", tone: "attention" as const } : { status: "On track", tone: "positive" as const };
  };

  return [
    withSource(data.approvals, listPanel(
      { id: "approvals", title: "Approvals waiting on you", subtitle: "Oldest first; over two days counts as a service breach", span: 6, emptyMessage: "No leave requests or regularisations are waiting for a decision.", target: "leaves" },
      rowsOf(data.approvals).map((row) => ({ label: text(row.name), detail: `${text(row.kind)}${row.on_day ? ` · ${dayLabel(String(row.on_day))}` : ""}`, status: `${num(row.age)} ${num(row.age) === 1 ? "day" : "days"}`, tone: num(row.age) > 2 ? "risk" : "neutral" })),
    )),
    withSource(data.onboarding, tablePanel(
      { id: "onboarding", title: "Onboarding pipeline", subtitle: "Recent and upcoming joiners, by checklist progress", span: 6, emptyMessage: "No onboarding is under way.", target: "onboarding" },
      [{ key: "name", label: "Joiner" }, { key: "starts", label: "Starts", format: "date" }, { key: "progress", label: "Checklist" }, { key: "next", label: "Next step" }],
      rowsOf(data.onboarding).map((row) => ({ name: text(row.name), starts: text(row.starts, ""), progress: `${num(row.done)} / ${num(row.total)}`, next: row.status === "completed" ? "Complete" : text(row.next_step) })),
    )),
    withSource(data.tickets, { ...listPanel({ id: "sla", title: "Helpdesk SLA performance", subtitle: "All tickets against response and resolution targets", span: 4, emptyMessage: "No helpdesk tickets have been raised.", target: "helpdesk" }, slaItems), state: stateOf(data.tickets, tickets.length > 0) }),
    orderedHeatmap(
      { id: "absence-calendar", title: "Absence density calendar", subtitle: "People absent or on leave, last 12 weeks by weekday", span: 8, format: "count", emptyMessage: "No absences or leave recorded in the last 12 weeks.", target: "attendance" },
      weeks.map((week) => `w/c ${dayLabel(week)}`), weekdayRows.map((day) => WEEKDAYS[day - 1]!),
      absences.map((row) => [weeks.indexOf(String(row.week)), weekdayRows.indexOf(num(row.dow)), num(row.value)] as [number, number, number]).filter((cell) => cell[1] >= 0),
    ),
    withSource(data.tickets, barPanel(
      { id: "ticket-categories", title: "Requests by category", subtitle: "Helpdesk tickets raised", span: 4, format: "count", emptyMessage: "No helpdesk tickets have been raised.", target: "helpdesk" },
      categories.map(([name]) => name).reverse(), [{ name: "Tickets", data: categories.map(([, value]) => value).reverse() }], true,
    )),
    withSource(data.renewals, tablePanel(
      { id: "renewals", title: "Documents and statutory renewals", subtitle: "Expiring documents and filings due soon", span: 8, emptyMessage: "Nothing expires or falls due in the coming weeks.", target: "people_core" },
      [{ key: "item", label: "Item" }, { key: "due", label: "Due", format: "date" }, { key: "owner", label: "Owner" }, { key: "status", label: "Status" }],
      rowsOf(data.renewals).map((row) => ({ item: text(row.item), due: text(row.due, ""), owner: text(row.owner), status: dueStatus(String(row.due)).status })),
    )),
  ];
}

/* ================================================================== */
/* S3 · Attendance                                                     */
/* ================================================================== */

export async function attendanceExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    coverage: scoped(scope, `
      with people as (
        select coalesce(e.department, 'Not recorded') as name,
          count(*) filter (where not exists (select 1 from leave_requests l where l.tenant_id = $1::uuid and l.employee_id = e.id
            and l.status = 'approved' and t.d + 1 between l.starts_on and l.ends_on))::int as available,
          count(*)::int as people
        from emp e, today t where e.active and e.joined_on <= t.d + 1 group by 1)
      select p.name, p.available, p.people,
        (select coalesce(sum(case when ml.attributes->>'sanctioned' ~ '^[0-9]+$' then (ml.attributes->>'sanctioned')::int else 0 end), 0)
          from manpower_plan_lines ml join departments dp on dp.tenant_id = ml.tenant_id and dp.id = ml.department_id
          where ml.tenant_id = $1::uuid and dp.attributes->>'name' = p.name
            -- Only plan lines already in force tomorrow (later quarters' growth roles are not yet sanctioned).
            and (ml.attributes->>'effective_from' is null or ml.attributes->>'effective_from' !~ '^\\d{4}-\\d{2}-\\d{2}'
              or left(ml.attributes->>'effective_from', 10)::date <= (select d from today) + 1))::int as required
      from people p order by p.name`),
    months: scoped(scope, `
      select to_char(date_trunc('month', a.attendance_date), 'YYYY-MM') as month,
        count(*) filter (where a.status in ('present', 'half_day'))::int as present,
        count(*) filter (where a.status = 'absent')::int as absent,
        count(*) filter (where a.status = 'leave')::int as on_leave,
        count(*) filter (where a.status in ('present', 'half_day', 'absent', 'leave'))::int as workdays
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date >= date_trunc('month', t.d) - interval '5 months' and a.attendance_date <= t.d
      group by 1 order by 1`),
    punctuality: scoped(scope, `
      select coalesce(e.location, 'Not recorded') as name,
        count(*) filter (where a.status in ('present', 'half_day') and coalesce(a.exception_reason, '') not ilike '%late%')::int as on_time,
        count(*) filter (where a.exception_reason ilike '%late%')::int as late
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 30 and a.attendance_date <= t.d group by 1`),
    late: scoped(scope, `
      select e.name, count(*)::int as value from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 30 and a.exception_reason ilike '%late%'
      group by e.name having count(*) >= 3 order by 2 desc limit 5`),
    weekdayAbsence: scoped(scope, `
      select count(*) filter (where extract(isodow from a.attendance_date) in (1, 5))::int as mon_fri, count(*)::int as total
      from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 84 and a.status in ('absent', 'leave')`),
    missing: scoped(scope, `
      select e.name, count(*)::int as value from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 30 and a.status = 'pending'
      group by e.name having count(*) >= 2 order by 2 desc limit 5`),
    overtime: scoped(scope, `
      select e.name, round(sum(a.payable_ot_minutes) / 60.0, 1)::float as value from attendance_days a join emp e on e.id = a.employee_id, today t
      where a.tenant_id = $1::uuid and a.attendance_date > t.d - 30
      group by e.name having sum(a.payable_ot_minutes) > 1200 order by 2 desc limit 5`),
    regularisations: scoped(scope, `
      select e.name, r.attributes->>'date' as day, r.attributes->>'reason' as reason, r.attributes->>'claimed_out' as claimed_out,
        (t.d - r.created_at::date)::int as age
      from attendance_regularizations r join emp e on e.id::text = r.attributes->>'employee_id', today t
      where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', '') in ('submitted', 'pending')
      order by r.created_at limit 12`),
  });

  const coverage = rowsOf(data.coverage).filter((row) => num(row.people) > 0);
  const months = rowsOf(data.months);
  const punctuality = rowsOf(data.punctuality).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const weekday = first(data.weekdayAbsence);
  const signals: ListItem[] = [];
  for (const row of rowsOf(data.late)) signals.push({ label: `${text(row.name)}: repeated late arrival`, detail: `${num(row.value)} late days in the last 30`, status: "Pattern", tone: "attention", target: "attendance" });
  const monFri = num(weekday.mon_fri), total = num(weekday.total);
  if (total >= 6 && monFri / total > 0.5) signals.push({ label: "Absence concentrated on Mondays and Fridays", detail: `${Math.round((monFri / total) * 100)}% of absence days in 12 weeks fell on a Monday or Friday (about 33–40% expected)`, status: "Pattern", tone: "attention" });
  for (const row of rowsOf(data.missing)) signals.push({ label: `${text(row.name)}: repeated missing punches`, detail: `${num(row.value)} days waiting for regularisation in the last 30`, status: "Anomaly", tone: "risk", target: "attendance" });
  for (const row of rowsOf(data.overtime)) signals.push({ label: `${text(row.name)}: high overtime`, detail: `${num(row.value)} payable hours in the last 30 days`, status: "Fatigue risk", tone: "attention" });

  return [
    withSource(data.coverage, barPanel(
      { id: "coverage", title: "Coverage tomorrow: sanctioned vs available", subtitle: "Sanctioned strength against people not on approved leave tomorrow", span: 8, format: "count", emptyMessage: "Appears once employees and a manpower plan are recorded.", target: "attendance" },
      coverage.map((row) => String(row.name)).reverse(), [{ name: "Sanctioned", data: coverage.map((row) => num(row.required)).reverse() }, { name: "Available", data: coverage.map((row) => num(row.available)).reverse() }], true,
    )),
    withSource(data.months, linePanel(
      { id: "attendance-absenteeism", title: "Attendance vs absenteeism", subtitle: "Share of workdays, last 6 months", span: 6, format: "percent", emptyMessage: "Appears once attendance is recorded." },
      months.map((row) => monthLabel(String(row.month))),
      [{ name: "Attendance", data: months.map((row) => pct(num(row.present), num(row.workdays)) ?? 0) }, { name: "Absenteeism", data: months.map((row) => pct(num(row.absent) + num(row.on_leave), num(row.workdays)) ?? 0) }],
    )),
    withSource(data.punctuality, barPanel(
      { id: "punctuality", title: "Punctuality by site", subtitle: "Days worked, on time vs late, last 30 days", span: 6, format: "count", emptyMessage: "Appears once attendance is recorded." },
      punctuality.map((row) => String(row.name)), [{ name: "On time", data: punctuality.map((row) => num(row.on_time)), stack: "days" }, { name: "Late", data: punctuality.map((row) => num(row.late)), stack: "days" }], true,
    )),
    { ...listPanel({ id: "signals", title: "Pattern detection and anomaly signals", subtitle: "Rules run over the last 30–90 days of attendance", span: 6, emptyMessage: "No repeated lateness, missing punches, weekday clustering or excess overtime found." }, signals), state: stateOf(data.late, signals.length > 0) },
    withSource(data.regularisations, tablePanel(
      { id: "regularisations", title: "Regularisation requests pending approval", subtitle: "Oldest first", span: 6, emptyMessage: "No regularisation requests are waiting.", target: "attendance" },
      [{ key: "name", label: "Employee" }, { key: "day", label: "Day", format: "date" }, { key: "claimed", label: "Claimed out" }, { key: "reason", label: "Reason" }, { key: "age", label: "Waiting", format: "days" }],
      rowsOf(data.regularisations).map((row) => ({ name: text(row.name), day: text(row.day, ""), claimed: text(row.claimed_out), reason: text(row.reason), age: num(row.age) })),
    )),
  ];
}

/* ================================================================== */
/* S4 · Talent acquisition                                             */
/* ================================================================== */

export async function talentExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    yield: plain(scope, `
      select coalesce(nullif(c.attributes->>'source', ''), 'Not recorded') as source, count(distinct c.id)::int as candidates,
        count(distinct a.id) filter (where a.attributes->>'stage' in ('interview', 'offer', 'hired', 'offer_declined'))::int as interviewed,
        count(distinct a.id) filter (where a.attributes->>'stage' in ('offer', 'hired', 'offer_declined'))::int as offered,
        count(distinct a.id) filter (where a.attributes->>'stage' = 'hired')::int as hired
      from candidates c left join applications a on a.tenant_id = c.tenant_id and a.candidate_id = c.id
      where c.tenant_id = $1::uuid group by 1 order by 2 desc`),
    shortlist: plain(scope, `
      select coalesce(c.attributes->>'name', 'Candidate') as name, coalesce(r.attributes->>'title', '—') as role, coalesce(a.attributes->>'stage', 'applied') as stage,
        case when a.attributes->>'match_score' ~ ${NUMBER} then (a.attributes->>'match_score')::float end as score,
        a.attributes->>'match_reason' as reason
      from applications a join candidates c on c.tenant_id = a.tenant_id and c.id = a.candidate_id
      left join requisitions r on r.tenant_id = a.tenant_id and r.id = a.requisition_id
      where a.tenant_id = $1::uuid and coalesce(a.attributes->>'stage', 'applied') in ('applied', 'screening') and a.attributes->>'match_score' ~ ${NUMBER}
      order by score desc limit 10`),
    offers: plain(scope, `
      select coalesce(attributes->>'status', 'drafted') as status, count(*)::int as value,
        count(*) filter (where attributes->>'joining_date' ~ ${DATE} and left(attributes->>'joining_date', 10)::date <= t.d)::int as joined
      from offers, today t where tenant_id = $1::uuid group by 1`),
    experience: plain(scope, `
      select coalesce(q.attributes->>'text', 'Question') as question, avg((a.attributes->>'score')::numeric)::float as score, count(*)::int as answers
      from surveys s join survey_questions q on q.tenant_id = s.tenant_id and q.survey_id = s.id
      join survey_answers a on a.tenant_id = q.tenant_id and a.survey_question_id = q.id
      where s.tenant_id = $1::uuid and s.attributes->>'audience' = 'candidates' and a.attributes->>'score' ~ '^[0-9]+$'
      group by 1, q.attributes->>'order' order by coalesce(q.attributes->>'order', '0')`),
  });

  const yields = rowsOf(data.yield);
  const offers = rowsOf(data.offers);
  const count = (status: string) => num(offers.find((row) => row.status === status)?.value);
  const accepted = offers.find((row) => row.status === "accepted");
  const joined = num(accepted?.joined);
  const made = offers.filter((row) => row.status !== "drafted").reduce((sum, row) => sum + num(row.value), 0);
  const experience = rowsOf(data.experience);
  const responses = experience.reduce((max, row) => Math.max(max, num(row.answers)), 0);

  return [
    withSource(data.yield, tablePanel(
      { id: "source-yield", title: "Source channel yield", subtitle: "Candidates by source and how far they got", span: 6, emptyMessage: "No candidates have been added yet.", target: "recruitment" },
      [{ key: "source", label: "Source" }, { key: "candidates", label: "Candidates", format: "count" }, { key: "interviewed", label: "Interviewed", format: "count" }, { key: "offered", label: "Offered", format: "count" }, { key: "hired", label: "Hired", format: "count" }, { key: "yield", label: "Yield", format: "percent" }],
      yields.map((row) => ({ source: text(row.source), candidates: num(row.candidates), interviewed: num(row.interviewed), offered: num(row.offered), hired: num(row.hired), yield: pct(num(row.hired), num(row.candidates), 0) })),
    )),
    withSource(data.shortlist, tablePanel(
      { id: "shortlist", title: "Shortlist ready: match scores", subtitle: "New applications scored against the role, best match first", span: 6, emptyMessage: "No new applications have a match score. Scores appear once screening has run.", target: "recruitment" },
      [{ key: "name", label: "Candidate" }, { key: "role", label: "Role" }, { key: "score", label: "Match", format: "percent" }, { key: "reason", label: "Why" }],
      rowsOf(data.shortlist).map((row) => ({ name: text(row.name), role: text(row.role), score: numOrNull(row.score), reason: text(row.reason) })),
    )),
    withSource(data.offers, bridgePanel(
      { id: "leakage", title: "Offer-to-joining leakage", subtitle: "From offers made to people who have joined", span: 6, format: "count", emptyMessage: "No offers have been made.", target: "recruitment" },
      made ? [
        { name: "Offers made", value: made, total: true }, { name: "Declined", value: -count("declined") }, { name: "Withdrawn", value: -count("withdrawn") },
        { name: "Awaiting answer", value: -count("offered") }, { name: "Joining soon", value: -(count("accepted") - joined) }, { name: "Joined", value: joined, total: true },
      ] : [],
    )),
    withSource(data.experience, { ...barPanel(
      { id: "candidate-experience", title: "Candidate experience survey", subtitle: responses ? `Average score out of 5 · ${responses} responses` : "Average score out of 5", span: 6, format: "decimal", emptyMessage: "No candidate experience survey responses yet." },
      experience.map((row) => text(row.question)).reverse(), [{ name: "Average score", data: experience.map((row) => round(num(row.score), 1)).reverse() }], true,
    ) }),
  ];
}

/* ================================================================== */
/* S5 · Payroll control room                                           */
/* ================================================================== */

const COMPONENT_LABELS: Record<string, string> = {
  basic: "Basic pay", hra: "House rent allowance", da: "Dearness allowance", special: "Special allowance", conveyance: "Conveyance", ot: "Overtime",
  overtime: "Overtime", bonus: "Bonus", arrears: "Arrears", pf: "Provident fund", pt: "Professional tax", tds: "Income tax (TDS)", esi: "ESI", lwf: "Labour welfare fund",
};

export async function payrollExtras(scope: Scope): Promise<Panel[]> {
  const latestRun = `(select id from payroll_runs where tenant_id = $1::uuid and scope = 'regular' and ${FINAL_RUN} order by period desc limit 1)`;
  const data = await runAll(scope.access, {
    movement: plain(scope, `
      with runs as (select id, period from payroll_runs where tenant_id = $1::uuid and scope = 'regular' and ${FINAL_RUN} order by period desc limit 2)
      select r.period, e.employee_id::text as employee_id, case when e.attributes->>'gross_minor' ~ '^-?[0-9]+$' then (e.attributes->>'gross_minor')::bigint else 0 end as gross
      from payroll_run_employees e join runs r on r.id = e.payroll_run_id
      where e.tenant_id = $1::uuid and coalesce(e.attributes->>'correction', 'false') <> 'true'`),
    composition: plain(scope, `
      select lower(coalesce(l.attributes->>'code', 'other')) as code, coalesce(l.attributes->>'kind', 'earning') as kind,
        sum(case when l.attributes->>'amount_minor' ~ '^-?[0-9]+$' then (l.attributes->>'amount_minor')::bigint else 0 end)::bigint as amount
      from payroll_lines l join payroll_run_employees e on e.tenant_id = l.tenant_id and e.id = l.payroll_run_employee_id
      where l.tenant_id = $1::uuid and e.payroll_run_id = ${latestRun} group by 1, 2`),
    perFunction: plain(scope, `
      select coalesce(emp.department, 'Not recorded') as name,
        sum(case when e.attributes->>'gross_minor' ~ '^-?[0-9]+$' then (e.attributes->>'gross_minor')::bigint else 0 end)::bigint as gross, count(*)::int as people
      from payroll_run_employees e join employees emp on emp.tenant_id = e.tenant_id and emp.id = e.employee_id
      where e.tenant_id = $1::uuid and e.payroll_run_id = ${latestRun} group by 1`),
    exceptions: plain(scope, `
      select a.rule_code, coalesce(a.severity, 'medium') as severity, r.period, trim(coalesce(emp.first_name, '') || ' ' || coalesce(emp.last_name, '')) as name
      from payroll_anomalies a join payroll_runs r on r.tenant_id = a.tenant_id and r.id = a.payroll_run_id
      left join employees emp on emp.tenant_id = a.tenant_id and emp.id = a.employee_id
      where a.tenant_id = $1::uuid and coalesce(a.status, 'open') not in ('resolved', 'dismissed', 'closed')
      order by case lower(coalesce(a.severity, '')) when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, r.period desc limit 10`),
    accuracy: plain(scope, `
      select r.period, coalesce(r.employee_count, 0)::int as employees,
        (select count(distinct a.employee_id) from payroll_anomalies a where a.tenant_id = r.tenant_id and a.payroll_run_id = r.id)::int as flagged,
        (select count(distinct c.employee_id) from payroll_run_employees c join payroll_runs cr on cr.tenant_id = c.tenant_id and cr.id = c.payroll_run_id
          where c.tenant_id = r.tenant_id and cr.period = r.period and c.attributes->>'correction' = 'true')::int as corrected
      from payroll_runs r where r.tenant_id = $1::uuid and r.scope = 'regular' and ${FINAL_RUN.replace("status", "r.status")}
      order by r.period desc limit 12`),
  });

  const movement = rowsOf(data.movement);
  const periods = [...new Set(movement.map((row) => String(row.period)))].sort();
  const steps: Array<{ name: string; value: number; total?: boolean }> = [];
  let bridgeSubtitle = "Needs two finalised payroll runs";
  if (periods.length === 2) {
    const [previous, latest] = periods as [string, string];
    const pay = (period: string) => new Map(movement.filter((row) => row.period === period).map((row) => [String(row.employee_id), num(row.gross) / 100]));
    const before = pay(previous), after = pay(latest);
    let joiners = 0, leavers = 0, changes = 0;
    for (const [id, amount] of after) { if (before.has(id)) changes += amount - before.get(id)!; else joiners += amount; }
    for (const [id, amount] of before) if (!after.has(id)) leavers += amount;
    const total = (map: Map<string, number>) => [...map.values()].reduce((sum, value) => sum + value, 0);
    steps.push({ name: monthLabel(previous), value: Math.round(total(before)), total: true }, { name: "Joiners", value: Math.round(joiners) }, { name: "Leavers", value: -Math.round(leavers) }, { name: "Pay changes", value: Math.round(changes) }, { name: monthLabel(latest), value: Math.round(total(after)), total: true });
    bridgeSubtitle = `Gross pay, ${monthLabel(previous)} to ${monthLabel(latest)}`;
  }

  const composition = rowsOf(data.composition);
  const earnings = composition.filter((row) => row.kind === "earning").map((row) => ({ name: COMPONENT_LABELS[String(row.code)] ?? humanise(String(row.code)), value: Math.round(num(row.amount) / 100) }));
  const deductions = composition.filter((row) => row.kind !== "earning" && num(row.amount) > 0).map((row) => ({ name: COMPONENT_LABELS[String(row.code)] ?? humanise(String(row.code)), value: Math.round(num(row.amount) / 100) }));
  const perFunction = rowsOf(data.perFunction).map((row) => ({ name: String(row.name), value: num(row.people) ? Math.round(num(row.gross) / num(row.people) / 100) : 0 })).sort((a, b) => b.value - a.value);
  const accuracy = [...rowsOf(data.accuracy)].reverse();

  return [
    withSource(data.movement, { ...bridgePanel({ id: "cost-bridge", title: "Why the cost moved", subtitle: bridgeSubtitle, span: 8, format: "money", emptyMessage: "Appears once two payroll runs have been finalised.", target: "payroll" }, steps) }),
    withSource(data.composition, partsPanel(
      { id: "composition", title: "Cost composition", subtitle: "Earnings in the latest finalised run", span: 4, format: "money", emptyMessage: "Appears once a payroll run has been finalised.", target: "payroll" },
      earnings,
    )),
    withSource(data.exceptions, listPanel(
      { id: "exceptions", title: "Exceptions to clear before lock", subtitle: "Open payroll anomalies, most severe first", span: 6, emptyMessage: "No open payroll anomalies: nothing blocks the lock.", target: "payroll" },
      rowsOf(data.exceptions).map((row) => ({ label: humanise(String(row.rule_code)), detail: `${text(row.name, "Run level")} · ${text(row.period)}`, status: humanise(String(row.severity)), tone: ["critical", "high"].includes(String(row.severity).toLowerCase()) ? "risk" : "attention" })),
    )),
    withSource(data.perFunction, barPanel(
      { id: "cost-per-employee", title: "Cost per employee by department", subtitle: "Average gross pay in the latest finalised run", span: 6, format: "money", emptyMessage: "Appears once a payroll run has been finalised." },
      perFunction.map((row) => row.name).reverse(), [{ name: "Gross per employee", data: perFunction.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.accuracy, linePanel(
      { id: "accuracy", title: "Payroll accuracy trend", subtitle: "Employees paid without an anomaly or correction, by finalised run", span: 6, format: "percent", emptyMessage: "Appears once payroll runs have been finalised." },
      accuracy.map((row) => monthLabel(String(row.period))),
      [{ name: "Accuracy", data: accuracy.map((row) => (num(row.employees) ? round(100 - ((num(row.flagged) + num(row.corrected)) / num(row.employees)) * 100, 1) : 0)) }],
    )),
    withSource(data.composition, partsPanel(
      { id: "deductions", title: "Deductions", subtitle: "Latest finalised run", span: 6, format: "money", emptyMessage: "No deductions in the latest finalised run." },
      deductions,
    )),
  ];
}

/* ================================================================== */
/* S6 · Performance and talent                                         */
/* ================================================================== */

/** Nine-box bands: rows are potential (high to low), columns performance (low to high). */
export const NINE_BOX: Array<{ row: number; col: number; label: string; tone: MatrixCell["tone"] }> = [
  { row: 0, col: 0, label: "Enigma", tone: "attention" }, { row: 0, col: 1, label: "Growth", tone: "positive" }, { row: 0, col: 2, label: "Star", tone: "positive" },
  { row: 1, col: 0, label: "Dilemma", tone: "attention" }, { row: 1, col: 1, label: "Core", tone: "neutral" }, { row: 1, col: 2, label: "High impact", tone: "positive" },
  { row: 2, col: 0, label: "Risk", tone: "risk" }, { row: 2, col: 1, label: "Effective", tone: "neutral" }, { row: 2, col: 2, label: "Trusted pro", tone: "neutral" },
];

/** Performance column from a 1–5 rating: 1–2 low, 3 medium, 4–5 high. */
export function performanceBand(rating: number): 0 | 1 | 2 {
  return rating >= 4 ? 2 : rating >= 3 ? 1 : 0;
}

/** The share of each rating the organisation guides managers towards (1 to 5). */
export const GUIDED_DISTRIBUTION = [0.05, 0.15, 0.5, 0.2, 0.1];

type Assessment = { name: string; manager: string | null; managerId: string | null; rating: number; potential: number | null; joinedDays: number; exiting: boolean; department: string };

/** Calibration checks over one cycle's final ratings: flat ratings, leniency, new-joiner skew, top performers leaving. */
export function calibrationFlags(rows: Assessment[]): ListItem[] {
  const flags: ListItem[] = [];
  if (rows.length < 3) return flags;
  const mean = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
  const byManager = new Map<string, Assessment[]>();
  for (const row of rows) if (row.managerId) byManager.set(row.managerId, [...(byManager.get(row.managerId) ?? []), row]);
  for (const team of byManager.values()) {
    if (team.length < 3) continue;
    const manager = team[0]!.manager ?? "A manager";
    const ratings = team.map((row) => row.rating);
    const average = ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
    if (new Set(ratings).size === 1) flags.push({ label: "Rating flatline", detail: `${manager} gave all ${team.length} direct reports the same rating (${ratings[0]}).`, status: "Review", tone: "attention", target: "performance" });
    else if (average - mean >= 0.75) flags.push({ label: "Lenient rating pattern", detail: `${manager}'s team averages ${round(average, 1)} against ${round(mean, 1)} across the organisation.`, status: "Review", tone: "attention", target: "performance" });
    else if (mean - average >= 0.75) flags.push({ label: "Severe rating pattern", detail: `${manager}'s team averages ${round(average, 1)} against ${round(mean, 1)} across the organisation.`, status: "Review", tone: "attention", target: "performance" });
  }
  const recent = rows.filter((row) => row.joinedDays < 365);
  const settled = rows.filter((row) => row.joinedDays >= 365);
  if (recent.length >= 2 && settled.length >= 2) {
    const gap = settled.reduce((s, r) => s + r.rating, 0) / settled.length - recent.reduce((s, r) => s + r.rating, 0) / recent.length;
    if (gap >= 0.5) flags.push({ label: "Tenure skew", detail: `People with under a year of service are rated ${round(gap, 1)} lower on average (${recent.length} people).`, status: "Review", tone: "attention" });
  }
  const leaving = rows.filter((row) => row.rating >= 4 && row.exiting);
  if (leaving.length) flags.push({ label: "Top-box flight risk", detail: `${leaving.map((row) => row.name).join(", ")} ${leaving.length === 1 ? "is" : "are"} rated 4–5 and leaving.`, status: "Act", tone: "risk", target: "offboarding" });
  return flags;
}

export async function performanceExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    assessments: scoped(scope, `
      with ${LATEST_ASSESSMENT}
      select e.name, coalesce(e.department, 'Not recorded') as department, (t.d - e.joined_on)::int as joined_days, l.rating::float as rating, l.potential, l.cycle,
        l.manager_employee_id::text as manager_id,
        (select trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')) from employees m where m.tenant_id = $1::uuid and m.id = l.manager_employee_id) as manager,
        exists (select 1 from offboarding_cases o join employments em on em.tenant_id = o.tenant_id and em.id = o.employment_id
          where o.tenant_id = $1::uuid and em.employee_id = e.id and ${OPEN_EXIT}) as exiting
      from latest l join emp e on e.id = l.employee_id, today t where e.active`),
    competencies: scoped(scope, `
      with ${LATEST_ASSESSMENT}
      select kv.key as competency, avg(kv.value::numeric)::float as score
      from latest l join emp e on e.id = l.employee_id
      join review_responses r on r.tenant_id = $1::uuid and r.review_participant_id = l.participant_id and coalesce(r.attributes->>'kind', '') = 'manager'
      cross join lateral jsonb_each_text(case when jsonb_typeof(r.attributes->'ratings') = 'object' then r.attributes->'ratings' else '{}'::jsonb end) kv
      where kv.value ~ ${NUMBER} group by 1 order by 1`),
    benchmark: plain(scope, `
      select attributes->'benchmarks' as benchmarks from review_templates
      where tenant_id = $1::uuid and jsonb_typeof(attributes->'benchmarks') = 'object' order by created_at desc limit 1`),
    succession: plain(scope, `
      select coalesce(sp.attributes->>'title', pos.attributes->>'name', 'Critical role') as role,
        (select trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) from employee_assignments a
          join employments em on em.tenant_id = a.tenant_id and em.id = a.employment_id join employees e on e.tenant_id = em.tenant_id and e.id = em.employee_id
          where a.tenant_id = sp.tenant_id and a.position_id = sp.position_id and a.record_status = 'active' limit 1) as incumbent,
        count(sc.id) filter (where sc.attributes->>'readiness' ilike 'ready now%')::int as ready_now,
        count(sc.id) filter (where sc.attributes->>'readiness' ilike '%1%2%')::int as ready_soon,
        count(sc.id)::int as candidates
      from succession_plans sp left join positions pos on pos.tenant_id = sp.tenant_id and pos.id = sp.position_id
      left join succession_candidates sc on sc.tenant_id = sp.tenant_id and sc.succession_plan_id = sp.id
      where sp.tenant_id = $1::uuid group by sp.id, sp.tenant_id, sp.position_id, sp.attributes, pos.attributes order by 1`),
  });

  const assessments: Assessment[] = rowsOf(data.assessments).map((row) => ({
    name: text(row.name), manager: row.manager ? String(row.manager) : null, managerId: row.manager_id ? String(row.manager_id) : null,
    rating: num(row.rating), potential: numOrNull(row.potential), joinedDays: num(row.joined_days), exiting: row.exiting === true, department: String(row.department),
  }));
  const cycle = text(first(data.assessments).cycle, "latest review");
  const withPotential = assessments.filter((row) => row.potential !== null);
  const cells: MatrixCell[] = NINE_BOX.map((box) => {
    const people = withPotential.filter((row) => 3 - (row.potential ?? 0) === box.row && performanceBand(row.rating) === box.col);
    return { row: box.row, col: box.col, label: box.label, value: people.length, tone: box.tone, hint: `${["Low", "Medium", "High"][box.col]} / ${["High", "Medium", "Low"][box.row]}`, people: people.map((row) => row.name) };
  });
  const distribution = [1, 2, 3, 4, 5].map((rating) => assessments.filter((row) => Math.round(row.rating) === rating).length);
  const totalRated = assessments.length;
  const competencies = rowsOf(data.competencies);
  const benchmarks = (first(data.benchmark).benchmarks ?? {}) as Record<string, unknown>;
  const succession = rowsOf(data.succession);

  return [
    withSource(data.assessments, matrixPanel(
      { id: "nine-box", title: "Nine-box talent grid", subtitle: `Performance × potential, ${cycle} (n = ${withPotential.length})`, span: 6, emptyMessage: "Appears once a review cycle records final ratings and potential.", target: "performance" },
      { rows: ["High", "Medium", "Low"], cols: ["Low", "Medium", "High"], rowAxis: "Potential", colAxis: "Performance" }, cells,
    )),
    withSource(data.assessments, barPanel(
      { id: "rating-distribution", title: "Rating distribution", subtitle: `Final ratings against the guided curve, ${cycle}`, span: 6, format: "count", emptyMessage: "Appears once a review cycle records final ratings.", target: "performance" },
      ["1 · Below", "2", "3 · Meets", "4", "5 · Outstanding"],
      [{ name: "Actual", data: distribution }, { name: "Guided curve", data: GUIDED_DISTRIBUTION.map((share) => round(share * totalRated, 1)), kind: "line", dashed: true }],
    )),
    withSource(data.competencies, radarPanel(
      { id: "competencies", title: "Competency profile", subtitle: "Average manager rating against the role benchmark (out of 5)", span: 6, format: "decimal", emptyMessage: "Appears once managers rate competencies in a review." },
      competencies.map((row) => ({ name: String(row.competency), max: 5 })),
      [
        { name: "Average rating", data: competencies.map((row) => round(num(row.score), 1)) },
        ...(Object.keys(benchmarks).length ? [{ name: "Role benchmark", data: competencies.map((row) => num(benchmarks[String(row.competency)])), dashed: true }] : []),
      ],
    )),
    { ...listPanel({ id: "calibration", title: "Calibration checks: patterns and bias flags", subtitle: `Rules run over the final ratings, ${cycle}`, span: 6, emptyMessage: "No flat ratings, lenient or severe patterns, tenure skew or departing top performers found.", target: "performance" }, calibrationFlags(assessments)), state: stateOf(data.assessments, calibrationFlags(assessments).length > 0) },
    withSource(data.succession, tablePanel(
      { id: "succession-cover", title: "Succession cover for critical roles", subtitle: "Bench strength and single points of failure", span: 12, emptyMessage: "No succession plans have been created.", target: "performance" },
      [{ key: "role", label: "Critical role" }, { key: "incumbent", label: "Incumbent" }, { key: "ready_now", label: "Ready now", format: "count" }, { key: "ready_soon", label: "Ready in 1–2 years", format: "count" }, { key: "risk", label: "Bench risk" }],
      succession.map((row) => ({ role: text(row.role), incumbent: text(row.incumbent), ready_now: num(row.ready_now), ready_soon: num(row.ready_soon), risk: num(row.ready_now) >= 1 ? "Covered" : num(row.candidates) <= 1 ? "Single point" : "Thin bench" })),
    )),
  ];
}

/* ================================================================== */
/* S7 · Manager cockpit                                                */
/* ================================================================== */

export async function managerExtras(scope: Scope, managerId: string): Promise<Panel[]> {
  const team = `team as (select id, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as name from employees
    where tenant_id = $1::uuid and manager_employee_id = $3::uuid and coalesce(lower(status), 'active') not in ('separated', 'exited', 'relieved', 'archived', 'inactive'))`;
  const data = await runAll(scope.access, {
    approvals: plain(scope, `
      with ${team}
      select * from (
        select m.name, 'Leave · ' || l.leave_type as kind, (t.d - l.created_at::date)::int as age, to_char(l.starts_on, 'YYYY-MM-DD') as on_day
        from leave_requests l join team m on m.id = l.employee_id, today t where l.tenant_id = $1::uuid and l.status = 'pending_supervisor'
        union all
        select m.name, 'Attendance regularisation', (t.d - r.created_at::date)::int, r.attributes->>'date'
        from attendance_regularizations r join team m on m.id::text = r.attributes->>'employee_id', today t
        where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', '') in ('submitted', 'pending')
        union all
        select m.name, case h.resource when 'timesheets' then 'Timesheet' when 'allocations' then 'Project allocation' else initcap(h.resource) end,
          (t.d - h.created_at::date)::int, coalesce(h.data->>'workDate', h.data->>'startDate')
        from hrms_operation_records h join team m on m.id = h.employee_id, today t
        where h.tenant_id = $1::uuid and h.status = 'submitted' and h.resource in ('timesheets', 'allocations', 'travel', 'expenses')
      ) q order by age desc, name limit 12`, [managerId]),
    capacity: plain(scope, `
      with ${team}
      select to_char(gs::date, 'YYYY-MM-DD') as day, extract(isodow from gs)::int as dow, (select count(*) from team)::int as size,
        (select count(distinct l.employee_id) from leave_requests l join team m on m.id = l.employee_id
          where l.tenant_id = $1::uuid and l.status = 'approved' and gs::date between l.starts_on and l.ends_on)::int as away
      from today t, generate_series(t.d::timestamp, (t.d + 13)::timestamp, interval '1 day') gs order by gs`, [managerId]),
    skills: plain(scope, `
      with ${team}
      select m.name as y, coalesce(k.attributes->>'name', 'Skill') as x,
        case lower(coalesce(s.attributes->>'proficiency', '')) when 'expert' then 3 when 'advanced' then 2 else 1 end as value
      from employee_skills s join team m on m.id = s.employee_id join skills k on k.tenant_id = s.tenant_id and k.id = s.skill_id
      where s.tenant_id = $1::uuid`, [managerId]),
  });

  const capacity = rowsOf(data.capacity).filter((row) => num(row.dow) !== 7);
  return [
    withSource(data.approvals, listPanel(
      { id: "my-approvals", title: "Approvals waiting on you", subtitle: "Your team's requests, oldest first", span: 6, emptyMessage: "Nothing from your team is waiting for your decision.", target: "approvals" },
      rowsOf(data.approvals).map((row) => ({ label: text(row.name), detail: `${text(row.kind)}${row.on_day ? ` · ${dayLabel(String(row.on_day))}` : ""}`, status: `${num(row.age)} ${num(row.age) === 1 ? "day" : "days"}`, tone: num(row.age) > 2 ? "risk" : "neutral" })),
    )),
    withSource(data.capacity, barPanel(
      { id: "capacity", title: "Team capacity", subtitle: "People available vs on approved leave, next two weeks", span: 6, format: "count", emptyMessage: "No active employees report to you yet." },
      capacity.map((row) => dayLabel(String(row.day))),
      [{ name: "Available", data: capacity.map((row) => num(row.size) - num(row.away)), stack: "team" }, { name: "On leave", data: capacity.map((row) => num(row.away)), stack: "team" }],
    )),
    withSource(data.skills, heatmapPanel(
      { id: "skill-coverage", title: "Team skill coverage", subtitle: "Proficiency: 1 intermediate · 2 advanced · 3 expert", span: 12, format: "decimal", emptyMessage: "Appears once your team's skills are recorded.", target: "learning" },
      rowsOf(data.skills).map((row) => ({ x: String(row.x), y: String(row.y), value: num(row.value) })),
    )),
  ];
}

/* ================================================================== */
/* S8 · Employee home                                                  */
/* ================================================================== */

export async function employeeExtras(scope: Scope, employeeId: string): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    payslip: plain(scope, `
      select r.period, r.attributes->>'pay_date' as pay_date,
        case when e.attributes->>'gross_minor' ~ '^-?[0-9]+$' then (e.attributes->>'gross_minor')::bigint end as gross,
        case when e.attributes->>'deductions_minor' ~ '^-?[0-9]+$' then (e.attributes->>'deductions_minor')::bigint end as deductions,
        case when e.attributes->>'net_minor' ~ '^-?[0-9]+$' then (e.attributes->>'net_minor')::bigint end as net
      from payroll_run_employees e join payroll_runs r on r.tenant_id = e.tenant_id and r.id = e.payroll_run_id
      where e.tenant_id = $1::uuid and e.employee_id = $3::uuid and ${FINAL_RUN.replace("status", "r.status")} and coalesce(e.attributes->>'correction', 'false') <> 'true'
      order by r.period desc limit 1`, [employeeId]),
    goals: plain(scope, `
      select coalesce(attributes->>'title', 'Objective') as title, case when attributes->>'progress_pct' ~ ${NUMBER} then (attributes->>'progress_pct')::float end as progress,
        coalesce(attributes->>'status', 'active') as status, attributes->>'due_date' as due
      from objectives where tenant_id = $1::uuid and owner_employee_id = $3::uuid and coalesce(attributes->>'status', 'active') not in ('cancelled', 'archived')
      order by created_at`, [employeeId]),
    timesheets: plain(scope, `
      select h.data->>'workDate' as day, coalesce(p.data->>'name', 'Project') as project, sum((h.data->>'minutes')::int)::int as minutes
      from hrms_operation_records h left join hrms_operation_records p on p.tenant_id = h.tenant_id and p.id = h.parent_id, today t
      where h.tenant_id = $1::uuid and h.resource = 'timesheets' and h.employee_id = $3::uuid and h.status not in ('cancelled', 'rejected')
        and h.data->>'workDate' ~ ${DATE} and (h.data->>'workDate')::date > t.d - 14 and (h.data->>'workDate')::date <= t.d
      group by 1, 2 order by 1`, [employeeId]),
    allocations: plain(scope, `
      select coalesce(p.data->>'name', 'Project') as name, (a.data->>'allocationPercent')::int as value, coalesce(a.data->>'role', '') as role
      from hrms_operation_records a left join hrms_operation_records p on p.tenant_id = a.tenant_id and p.id = a.parent_id
      where a.tenant_id = $1::uuid and a.resource = 'allocations' and a.employee_id = $3::uuid and a.status = 'approved'`, [employeeId]),
  });

  const payslip = first(data.payslip);
  const goals = rowsOf(data.goals);
  const timesheets = rowsOf(data.timesheets);
  const days = [...new Set(timesheets.map((row) => String(row.day)))].sort();
  const projects = [...new Set(timesheets.map((row) => String(row.project)))].sort();

  return [
    withSource(data.payslip, listPanel(
      { id: "payslip", title: data.payslip?.length ? `Payslip · ${monthLabel(String(payslip.period))}` : "Latest payslip", subtitle: payslip.pay_date ? `Paid on ${dayLabel(String(payslip.pay_date))}` : "Latest finalised payroll", span: 4, emptyMessage: "No payslip yet: it appears once a payroll run that includes you is finalised.", target: "payroll" },
      data.payslip?.length ? [
        { label: "Gross pay", value: Math.round(num(payslip.gross) / 100), format: "money" },
        { label: "Deductions", value: Math.round(num(payslip.deductions) / 100), format: "money" },
        { label: "Net pay", value: Math.round(num(payslip.net) / 100), format: "money", status: "Paid", tone: "positive" },
      ] : [],
    )),
    withSource(data.goals, listPanel(
      { id: "my-goals", title: "My goals", subtitle: "Objectives for this cycle", span: 4, emptyMessage: "No objectives have been set for you yet.", target: "performance" },
      goals.map((row) => ({ label: text(row.title), detail: row.due ? `Due ${dayLabel(String(row.due))}` : undefined, value: numOrNull(row.progress), format: "percent", status: humanise(String(row.status)), tone: row.status === "at_risk" ? "attention" : row.status === "on_track" ? "positive" : "neutral" })),
    )),
    withSource(data.allocations, partsPanel(
      { id: "allocation", title: "Project allocation", subtitle: "Approved share of your time", span: 4, format: "percent", emptyMessage: "You are not allocated to a project.", target: "projects" },
      rowsOf(data.allocations).map((row) => ({ name: text(row.name), value: num(row.value) })),
    )),
    withSource(data.timesheets, barPanel(
      { id: "timesheet", title: "My timesheet", subtitle: "Hours logged per project, last two weeks", span: 12, format: "hours", emptyMessage: "No project time logged in the last two weeks.", target: "timesheets" },
      days.map((day) => dayLabel(day)),
      projects.map((project) => ({ name: project, data: days.map((day) => round(num(timesheets.find((row) => row.day === day && row.project === project)?.minutes) / 60, 1)), stack: "hours" })),
    )),
  ];
}

/* ================================================================== */
/* S9 · Capability and learning                                        */
/* ================================================================== */

export async function capabilityExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    matrix: scoped(scope, `
      select coalesce(e.department, 'Not recorded') as y, coalesce(k.attributes->>'name', 'Skill') as x, count(distinct s.employee_id)::int as value
      from employee_skills s join emp e on e.id = s.employee_id and e.active join skills k on k.tenant_id = s.tenant_id and k.id = s.skill_id
      where s.tenant_id = $1::uuid group by 1, 2`),
    movement: scoped(scope, `
      select to_char(date_trunc('month', s.created_at), 'YYYY-MM') as month, count(*)::int as added,
        count(*) filter (where s.attributes->>'verified' = 'true')::int as verified
      from employee_skills s join emp e on e.id = s.employee_id where s.tenant_id = $1::uuid group by 1 order by 1`),
    funnel: scoped(scope, `
      select count(*)::int as enrolled,
        count(*) filter (where n.attributes->>'status' in ('in_progress', 'started', 'completed', 'verified')
          or exists (select 1 from learning_completions c where c.tenant_id = n.tenant_id and c.enrollment_id = n.id))::int as started,
        count(*) filter (where exists (select 1 from learning_completions c where c.tenant_id = n.tenant_id and c.enrollment_id = n.id))::int as completed,
        count(*) filter (where n.attributes->>'status' = 'verified')::int as verified
      from enrollments n join emp e on e.id = n.employee_id where n.tenant_id = $1::uuid`),
    hours: scoped(scope, `
      select coalesce(e.department, 'Not recorded') as name,
        sum(case when co.attributes->>'duration_minutes' ~ '^[0-9]+$' then (co.attributes->>'duration_minutes')::int else 0 end)::int as minutes
      from learning_completions c join emp e on e.id = c.employee_id
      join enrollments n on n.tenant_id = c.tenant_id and n.id = c.enrollment_id
      left join course_versions cv on cv.tenant_id = n.tenant_id and cv.id = n.course_version_id
      left join courses co on co.tenant_id = cv.tenant_id and co.id = cv.course_id, today t
      where c.tenant_id = $1::uuid and c.created_at::date > t.d - 365 group by 1`),
    gaps: scoped(scope, `
      with required as (
        select e.id as employee_id, skill
        from emp e join job_profiles jp on jp.tenant_id = $1::uuid and jp.attributes->>'name' = e.designation
        cross join lateral jsonb_array_elements_text(case when jsonb_typeof(jp.attributes->'required_skills') = 'array' then jp.attributes->'required_skills' else '[]'::jsonb end) skill
        where e.active)
      select r.skill, count(*)::int as required,
        count(*) filter (where exists (select 1 from employee_skills s join skills k on k.tenant_id = s.tenant_id and k.id = s.skill_id
          where s.tenant_id = $1::uuid and s.employee_id = r.employee_id and k.attributes->>'name' = r.skill))::int as available,
        (select string_agg(co.attributes->>'title', '; ' order by co.attributes->>'title') from courses co
          where co.tenant_id = $1::uuid and jsonb_typeof(co.attributes->'skills') = 'array' and co.attributes->'skills' ? r.skill) as courses
      from required r group by r.skill`),
    impact: scoped(scope, `
      with ${LATEST_ASSESSMENT},
      learning as (select employee_id, count(*)::int as courses from learning_completions where tenant_id = $1::uuid and created_at > now() - interval '365 days' group by 1)
      select case when coalesce(g.courses, 0) >= 2 then 'Two or more courses' else 'Fewer than two courses' end as name,
        avg(l.rating)::float as rating, count(*)::int as people
      from latest l join emp e on e.id = l.employee_id and e.active left join learning g on g.employee_id = l.employee_id group by 1 order by 1 desc`),
  });

  const movement = rowsOf(data.movement);
  let added = 0, verified = 0;
  const cumulative = movement.map((row) => { added += num(row.added); verified += num(row.verified); return { month: String(row.month), added, verified }; }).slice(-12);
  const funnel = first(data.funnel);
  const hours = rowsOf(data.hours).map((row) => ({ name: String(row.name), value: round(num(row.minutes) / 60, 1) })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const gaps = rowsOf(data.gaps).map((row) => ({ skill: String(row.skill), required: num(row.required), available: num(row.available), courses: row.courses ? String(row.courses) : null }))
    .map((row) => ({ ...row, gap: row.required - row.available })).sort((a, b) => b.gap - a.gap);
  const impact = rowsOf(data.impact);

  return [
    withSource(data.matrix, heatmapPanel(
      { id: "skill-matrix", title: "Skill coverage matrix", subtitle: "People with each skill, by department", span: 12, format: "count", emptyMessage: "Appears once skills are recorded for employees in more than one department.", target: "learning" },
      rowsOf(data.matrix).map((row) => ({ x: String(row.x), y: String(row.y), value: num(row.value) })),
    )),
    withSource(data.movement, linePanel(
      { id: "capability-movement", title: "Capability movement", subtitle: "Skills on record and verified, cumulative by month", span: 6, format: "count", emptyMessage: "Appears once skills are recorded." },
      cumulative.map((row) => monthLabel(row.month)), [{ name: "Skills recorded", data: cumulative.map((row) => row.added) }, { name: "Verified", data: cumulative.map((row) => row.verified) }],
    )),
    withSource(data.funnel, barPanel(
      { id: "programme-funnel", title: "Programme funnel", subtitle: "Course enrolments by how far they have got", span: 6, format: "count", emptyMessage: "No courses have been assigned.", target: "learning" },
      ["Enrolled", "Started", "Completed", "Verified"], [{ name: "Enrolments", data: [num(funnel.enrolled), num(funnel.started), num(funnel.completed), num(funnel.verified)] }],
    )),
    withSource(data.hours, barPanel(
      { id: "learning-hours", title: "Learning hours by department", subtitle: "Completed courses, last 12 months", span: 6, format: "hours", emptyMessage: "No courses completed in the last 12 months." },
      hours.map((row) => row.name).reverse(), [{ name: "Hours", data: hours.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.gaps, barPanel(
      { id: "skill-deficit", title: "Biggest skill deficits", subtitle: "People whose role needs the skill vs those who have it", span: 6, format: "count", emptyMessage: "Appears once roles list the skills they need.", target: "learning" },
      gaps.filter((row) => row.gap > 0).slice(0, 8).map((row) => row.skill).reverse(),
      [{ name: "Needed", data: gaps.filter((row) => row.gap > 0).slice(0, 8).map((row) => row.required).reverse() }, { name: "Have it", data: gaps.filter((row) => row.gap > 0).slice(0, 8).map((row) => row.available).reverse() }], true,
    )),
    withSource(data.gaps, listPanel(
      { id: "gap-to-path", title: "Gap-to-path", subtitle: "Each skill gap with the courses that build it", span: 6, emptyMessage: "No skill gaps: everyone has the skills their role lists.", target: "learning" },
      gaps.filter((row) => row.gap > 0).slice(0, 8).map((row) => ({ label: row.skill, detail: row.courses ? `Path: ${row.courses}` : "No course builds this skill yet", value: row.gap, format: "count", status: row.courses ? "Path available" : "No path", tone: row.courses ? "positive" : "attention" })),
    )),
    withSource(data.impact, barPanel(
      { id: "learning-impact", title: "Does learning show up in the work?", subtitle: "Average latest review rating, by courses completed in the last year", span: 6, format: "decimal", emptyMessage: "Appears once employees have both review ratings and completed courses." },
      impact.map((row) => `${String(row.name)} (${num(row.people)})`), [{ name: "Average rating", data: impact.map((row) => round(num(row.rating), 2)) }],
    )),
  ];
}

/* ================================================================== */
/* S10 · Workspace governance: automation                              */
/* ================================================================== */

export async function governanceExtras(scope: Scope): Promise<Panel[]> {
  const data = await runAll(scope.access, {
    agents: plain(scope, `
      select coalesce(ap.attributes->>'name', ap.attributes->>'code', 'Agent') as agent, coalesce(ap.attributes->>'status', ap.record_status, 'active') as status,
        coalesce(r.name, r.code, 'Role') as role
      from agent_principals ap left join roles r on r.tenant_id = ap.tenant_id and r.id = ap.role_id
      where ap.tenant_id = $1::uuid order by 1 limit 20`),
    models: plain(scope, `
      select coalesce(attributes->>'model', attributes->>'workflow', 'Model') as model, count(*)::int as runs,
        count(*) filter (where coalesce(attributes->>'status', record_status) in ('failed', 'error'))::int as failed,
        to_char(max(created_at), 'YYYY-MM-DD') as last_run
      from ai_runs where tenant_id = $1::uuid group by 1 order by 2 desc limit 20`),
  });
  return [
    withSource(data.agents, tablePanel(
      { id: "agents", title: "Automated agents and allowed actions", subtitle: "Agents acting in this organisation and the role they act with", span: 6, emptyMessage: "No automated agents are configured for this organisation.", target: "integrations" },
      [{ key: "agent", label: "Agent" }, { key: "role", label: "Acts as" }, { key: "status", label: "Status" }],
      rowsOf(data.agents).map((row) => ({ agent: text(row.agent), role: text(row.role), status: humanise(String(row.status)) })),
    )),
    withSource(data.models, tablePanel(
      { id: "model-register", title: "Model register and audit history", subtitle: "AI analyses run in this organisation", span: 6, emptyMessage: "No AI analyses have been run in this organisation yet." },
      [{ key: "model", label: "Model or analysis" }, { key: "runs", label: "Runs", format: "count" }, { key: "failed", label: "Failed", format: "count" }, { key: "last", label: "Last run", format: "date" }],
      rowsOf(data.models).map((row) => ({ model: text(row.model), runs: num(row.runs), failed: num(row.failed), last: text(row.last_run, "") })),
    )),
  ];
}
