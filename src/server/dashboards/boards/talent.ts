import "server-only";

import { barPanel, dayLabel, partsPanel, humanise, linePanel, listPanel, monthLabel, num, pct, periodLabel, plural, tablePanel, withSource } from "../compose";
import { plain, runAll, scoped, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number | null };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};
const named = (rows: Row[] | null) => rowsOf(rows).map((row) => ({ name: humanise(String(row.name ?? "")), value: num(row.value) }));

/** Month buckets (YYYY-MM, oldest first) for a trend that ends this month. */
const MONTHS_CTE = (param: string) => `months as (
  select to_char(gs, 'YYYY-MM') as month from generate_series(
    date_trunc('month', (select d from today)::timestamp) - make_interval(months => ${param}::int - 1),
    date_trunc('month', (select d from today)::timestamp), interval '1 month') gs)`;

/* ================================================================== */
/* S4 · Talent acquisition                                             */
/* ================================================================== */

/** Application stages in pipeline order (src/server/talent/service.ts). */
export const PIPELINE = ["applied", "screening", "shortlisted", "interview", "background", "offer_review", "offered", "accepted", "converted"];
const CLOSED_REQUISITION = `('closed', 'filled', 'cancelled', 'rejected')`;
const TERMINAL_STAGE = `('withdrawn', 'rejected', 'declined', 'closed', 'accepted', 'converted')`;

export async function talentAcquisition(scope: Scope): Promise<Built> {
  const months = scope.filters.months;
  const trendMonths = Math.max(months, 6);
  // $1 tenant · $2 timezone · $3 window in months
  const data = await runAll(scope.access, {
    summary: plain(scope, `
      select
        (select count(*) from requisitions where tenant_id = $1::uuid and coalesce(attributes->>'status', 'draft') not in ${CLOSED_REQUISITION})::int as open_requisitions,
        (select count(*) from applications where tenant_id = $1::uuid and coalesce(attributes->>'stage', 'applied') not in ${TERMINAL_STAGE})::int as active_applications,
        (select count(*) from interview_sessions, today t where tenant_id = $1::uuid
          and attributes->>'scheduled_at' ~ '^\\d{4}-\\d{2}-\\d{2}'
          and left(attributes->>'scheduled_at', 10)::date between t.d and t.d + 6
          and coalesce(attributes->>'status', 'scheduled') = 'scheduled')::int as interviews_week,
        (select count(*) from offers where tenant_id = $1::uuid and attributes->>'status' = 'offered')::int as offers_out,
        (select count(*) from offers, today t where tenant_id = $1::uuid and attributes->>'status' = 'accepted'
          and updated_at::date > t.d - make_interval(months => $3::int))::int as accepted,
        (select count(*) from offers, today t where tenant_id = $1::uuid and attributes->>'status' = 'declined'
          and updated_at::date > t.d - make_interval(months => $3::int))::int as declined`, [months]),
    funnel: plain(scope, `
      select coalesce(attributes->>'stage', 'applied') as name, count(*)::int as value
      from applications where tenant_id = $1::uuid group by 1`),
    sources: plain(scope, `
      select coalesce(nullif(attributes->>'source', ''), 'Not recorded') as name, count(*)::int as value
      from candidates where tenant_id = $1::uuid group by 1 order by 2 desc limit 8`),
    offers: plain(scope, `
      select coalesce(attributes->>'status', 'drafted') as name, count(*)::int as value
      from offers where tenant_id = $1::uuid group by 1 order by 2 desc`),
    requisitions: plain(scope, `
      select coalesce(r.attributes->>'code', '—') as code, coalesce(r.attributes->>'title', r.attributes->>'name', 'Untitled') as title,
        coalesce(r.attributes->>'status', 'draft') as status, (t.d - r.created_at::date)::int as age_days,
        (select count(*) from applications a where a.tenant_id = r.tenant_id and a.requisition_id = r.id)::int as applications
      from requisitions r, today t
      where r.tenant_id = $1::uuid and coalesce(r.attributes->>'status', 'draft') not in ${CLOSED_REQUISITION}
      order by r.created_at limit 12`),
    trend: plain(scope, `
      with ${MONTHS_CTE("$3")}
      select m.month,
        (select count(*) from applications a where a.tenant_id = $1::uuid and to_char(a.created_at, 'YYYY-MM') = m.month)::int as applications,
        (select count(*) from offers o where o.tenant_id = $1::uuid and o.attributes->>'status' = 'accepted' and to_char(o.updated_at, 'YYYY-MM') = m.month)::int as hires
      from months m order by m.month`, [trendMonths]),
    interviews: plain(scope, `
      select left(s.attributes->>'scheduled_at', 16) as scheduled_at, s.attributes->>'round' as round,
        coalesce(c.attributes->>'name', 'Candidate') as candidate, coalesce(s.attributes->>'status', 'scheduled') as status
      from interview_sessions s
      left join applications a on a.tenant_id = s.tenant_id and a.id = s.application_id
      left join candidates c on c.tenant_id = s.tenant_id and c.id = a.candidate_id, today t
      where s.tenant_id = $1::uuid and s.attributes->>'scheduled_at' ~ '^\\d{4}-\\d{2}-\\d{2}'
        and left(s.attributes->>'scheduled_at', 10)::date between t.d and t.d + 13
      order by 1 limit 12`),
  });

  const summary = first(data.summary);
  const accepted = num(summary.accepted);
  const declined = num(summary.declined);
  const acceptance = pct(accepted, accepted + declined, 0);
  const period = periodLabel(months);
  const funnelCounts = new Map(rowsOf(data.funnel).map((row) => [String(row.name), num(row.value)]));
  // Cumulative funnel: everyone at a later stage has passed through the earlier ones.
  const reached = PIPELINE.map((_, index) => PIPELINE.slice(index).reduce((sum, stage) => sum + (funnelCounts.get(stage) ?? 0), 0));
  const trend = rowsOf(data.trend);

  const kpis: Kpi[] = [
    { id: "open", label: "Open requisitions", value: data.summary ? num(summary.open_requisitions) : null, format: "count", hint: "Not closed, filled or cancelled", target: "recruitment" },
    { id: "applications", label: "Active applications", value: data.summary ? num(summary.active_applications) : null, format: "count", hint: "Still in the pipeline" },
    { id: "interviews", label: "Interviews this week", value: data.summary ? num(summary.interviews_week) : null, format: "count", hint: "Scheduled, next 7 days" },
    { id: "offers", label: "Offers out", value: data.summary ? num(summary.offers_out) : null, format: "count", hint: "Sent, awaiting an answer" },
    { id: "acceptance", label: "Offer acceptance", value: acceptance, format: "percent", hint: acceptance === null ? `No offers answered in the ${period}` : `Accepted ÷ answered, ${period}`, tone: acceptance !== null && acceptance < 70 ? "attention" : "positive" },
    { id: "hires", label: "Hires", value: data.summary ? accepted : null, format: "count", hint: `Offers accepted, ${period}`, tone: "positive" },
  ];

  const panels: Panel[] = [
    withSource(data.funnel, barPanel(
      { id: "funnel", title: "Hiring funnel", subtitle: "Applications that reached each stage", span: 6, format: "count", emptyMessage: "Appears once candidates apply against a requisition.", target: "recruitment" },
      PIPELINE.map(humanise), [{ name: "Applications", data: reached }],
    )),
    withSource(data.sources, partsPanel(
      { id: "sources", title: "Candidate sources", span: 6, format: "count", emptyMessage: "No candidates have been added yet." },
      named(data.sources),
    )),
    withSource(data.requisitions, tablePanel(
      { id: "requisitions", title: "Open requisitions", subtitle: "Oldest first", span: 8, emptyMessage: "No requisitions are open.", target: "recruitment" },
      [{ key: "code", label: "Code" }, { key: "title", label: "Role" }, { key: "status", label: "Status" }, { key: "applications", label: "Applications", format: "count" }, { key: "age", label: "Open for", format: "days" }],
      rowsOf(data.requisitions).map((row) => ({ code: String(row.code), title: String(row.title), status: humanise(String(row.status)), applications: num(row.applications), age: num(row.age_days) })),
    )),
    withSource(data.offers, partsPanel(
      { id: "offers", title: "Offers", subtitle: "By status", span: 4, format: "count", emptyMessage: "No offers have been made." },
      named(data.offers),
    )),
    withSource(data.trend, linePanel(
      { id: "trend", title: "Applications and hires", subtitle: `By month, last ${trendMonths} months`, span: 6, format: "count", emptyMessage: "Appears once applications are received." },
      trend.map((row) => monthLabel(String(row.month))),
      [{ name: "Applications", data: trend.map((row) => num(row.applications)) }, { name: "Hires", data: trend.map((row) => num(row.hires)) }],
    )),
    withSource(data.interviews, listPanel(
      { id: "interviews", title: "Interviews, next 14 days", span: 6, emptyMessage: "No interviews are scheduled in the next 14 days." },
      rowsOf(data.interviews).map((row) => ({
        label: String(row.candidate),
        detail: `${row.round ? `${humanise(String(row.round))} · ` : ""}${dayLabel(String(row.scheduled_at))}${String(row.scheduled_at).length > 10 ? ` ${String(row.scheduled_at).slice(11, 16)}` : ""}`,
        status: humanise(String(row.status)),
      })),
    )),
  ];

  const insights: string[] = [];
  if (num(summary.open_requisitions)) insights.push(`${plural(num(summary.open_requisitions), "requisition is", "requisitions are")} open with ${plural(num(summary.active_applications), "active application")}.`);
  const oldest = rowsOf(data.requisitions)[0];
  if (oldest && num(oldest.age_days) > 0) insights.push(`The oldest open requisition, ${String(oldest.title)}, has been open for ${plural(num(oldest.age_days), "day")}.`);
  if (acceptance !== null) insights.push(`${acceptance}% of offers answered in the ${period} were accepted (${accepted} of ${accepted + declined}).`);

  return { kpis, panels, insights, employeesInScope: null };
}

/* ================================================================== */
/* S6 · Performance & talent                                           */
/* ================================================================== */

export async function performanceBoard(scope: Scope): Promise<Built> {
  const months = scope.filters.months;
  const trendMonths = Math.max(months, 6);
  const period = periodLabel(months);
  const data = await runAll(scope.access, {
    reviews: scoped(scope, `
      select count(*)::int as participants,
        count(*) filter (where exists (select 1 from review_responses r where r.tenant_id = p.tenant_id and r.review_participant_id = p.id))::int as submitted
      from review_participants p join emp e on e.id = p.employee_id
      where p.tenant_id = $1::uuid and coalesce(p.attributes->>'status', 'enrolled') not in ('cancelled', 'withdrawn')`),
    reviewStatus: scoped(scope, `
      select coalesce(p.attributes->>'status', 'enrolled') as name, count(*)::int as value
      from review_participants p join emp e on e.id = p.employee_id
      where p.tenant_id = $1::uuid group by 1 order by 2 desc`),
    ratings: scoped(scope, `
      select kv.value::int as rating, count(*)::int as value
      from review_responses r
      join review_participants p on p.tenant_id = r.tenant_id and p.id = r.review_participant_id
      join emp e on e.id = p.employee_id
      cross join lateral jsonb_each_text(case when jsonb_typeof(r.attributes->'ratings') = 'object' then r.attributes->'ratings' else '{}'::jsonb end) kv
      where r.tenant_id = $1::uuid and kv.value ~ '^[1-5]$'
      group by 1 order by 1`),
    objectives: scoped(scope, `
      select coalesce(o.attributes->>'status', 'active') as status,
        case when o.attributes->>'progress_pct' ~ '^[0-9]+(\\.[0-9]+)?$' then least((o.attributes->>'progress_pct')::numeric, 100) end as progress
      from objectives o join emp e on e.id = o.owner_employee_id
      where o.tenant_id = $1::uuid and coalesce(o.attributes->>'status', 'active') not in ('cancelled', 'archived')`),
    checkins: scoped(scope, `
      select count(*)::int as value from checkins c join emp e on e.id = c.employee_id, today t
      where c.tenant_id = $1::uuid and c.created_at::date > t.d - 30`),
    recognition: scoped(scope, `
      with ${MONTHS_CTE("$5")}
      select m.month, (select count(*) from recognition_events r join emp e on e.id = r.recipient_employee_id
        where r.tenant_id = $1::uuid and to_char(r.created_at, 'YYYY-MM') = m.month)::int as recognition,
        (select count(*) from feedback_entries f join emp e on e.id = f.subject_employee_id
        where f.tenant_id = $1::uuid and to_char(f.created_at, 'YYYY-MM') = m.month)::int as feedback
      from months m order by m.month`, [trendMonths]),
    succession: scoped(scope, `
      select coalesce(nullif(c.attributes->>'readiness', ''), 'Not assessed') as name, count(*)::int as value
      from succession_candidates c join emp e on e.id = c.employee_id
      where c.tenant_id = $1::uuid group by 1 order by 2 desc`),
    plans: plain(scope, `select count(*)::int as value from succession_plans where tenant_id = $1::uuid`),
  });

  const reviews = first(data.reviews);
  const participants = num(reviews.participants);
  const submitted = num(reviews.submitted);
  const objectives = rowsOf(data.objectives);
  const progress = objectives.map((row) => row.progress).filter((value) => value !== null && value !== undefined).map(num);
  const avgProgress = progress.length ? Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length) : null;
  const ratings = rowsOf(data.ratings);
  const ratingCounts = [1, 2, 3, 4, 5].map((rating) => num(ratings.find((row) => num(row.rating) === rating)?.value));
  const totalRatings = ratingCounts.reduce((sum, value) => sum + value, 0);
  const trend = rowsOf(data.recognition);
  const recognitionInPeriod = trend.slice(-months).reduce((sum, row) => sum + num(row.recognition), 0);
  const successionCandidates = named(data.succession).reduce((sum, row) => sum + row.value, 0);
  const bands = [[0, 25, "0–25%"], [25, 50, "25–50%"], [50, 75, "50–75%"], [75, 100.01, "75–100%"]] as const;

  const kpis: Kpi[] = [
    { id: "reviews", label: "Reviews submitted", value: pct(submitted, participants, 0), format: "percent", hint: participants ? `${submitted} of ${participants} people in review` : "No one is enrolled in a review", target: "performance" },
    { id: "objectives", label: "Active objectives", value: data.objectives ? objectives.length : null, format: "count", hint: "Owned by people in scope" },
    { id: "progress", label: "Average goal progress", value: avgProgress, format: "percent", hint: avgProgress === null ? "No progress recorded" : "Across active objectives" },
    { id: "checkins", label: "Check-ins", value: data.checkins ? num(first(data.checkins).value) : null, format: "count", hint: "Last 30 days" },
    { id: "recognition", label: "Recognition", value: data.recognition ? recognitionInPeriod : null, format: "count", hint: period, tone: "positive" },
    { id: "succession", label: "Succession candidates", value: data.succession ? successionCandidates : null, format: "count", hint: data.plans ? `${plural(num(first(data.plans).value), "succession plan")}` : undefined },
  ];

  const panels: Panel[] = [
    withSource(data.reviewStatus, partsPanel(
      { id: "review-status", title: "Review progress", subtitle: "People in review, by status", span: 4, format: "count", emptyMessage: "No one has been enrolled in a review cycle.", target: "performance" },
      named(data.reviewStatus),
    )),
    withSource(data.ratings, barPanel(
      { id: "ratings", title: "Rating distribution", subtitle: "All submitted ratings (1–5)", span: 4, format: "count", emptyMessage: "No ratings have been submitted." },
      ["1", "2", "3", "4", "5"], [{ name: "Ratings", data: ratingCounts }],
    )),
    withSource(data.objectives, barPanel(
      { id: "progress", title: "Goal progress", subtitle: "Active objectives by progress", span: 4, format: "count", emptyMessage: "No objectives have been set." },
      bands.map(([, , label]) => label), [{ name: "Objectives", data: bands.map(([low, high]) => progress.filter((value) => value >= low && value < high).length) }],
    )),
    withSource(data.recognition, linePanel(
      { id: "recognition", title: "Recognition and feedback", subtitle: `By month, last ${trendMonths} months`, span: 8, format: "count", emptyMessage: "No recognition or feedback has been recorded." },
      trend.map((row) => monthLabel(String(row.month))),
      [{ name: "Recognition", data: trend.map((row) => num(row.recognition)) }, { name: "Feedback", data: trend.map((row) => num(row.feedback)) }],
    )),
    withSource(data.succession, partsPanel(
      { id: "succession", title: "Succession readiness", subtitle: "Nominated successors", span: 4, format: "count", emptyMessage: "No successors have been nominated." },
      named(data.succession),
    )),
  ];

  const insights: string[] = [];
  if (participants) insights.push(`${submitted} of ${plural(participants, "person", "people")} in review have a submitted review (${pct(submitted, participants, 0)}%).`);
  if (totalRatings) {
    const average = ratingCounts.reduce((sum, count, index) => sum + count * (index + 1), 0) / totalRatings;
    insights.push(`The average submitted rating is ${average.toFixed(1)} out of 5 across ${plural(totalRatings, "rating")}.`);
  }
  if (avgProgress !== null) insights.push(`Active objectives are ${avgProgress}% complete on average.`);

  return { kpis, panels, insights, employeesInScope: null };
}

/* ================================================================== */
/* S9 · Capability: skills and learning                                */
/* ================================================================== */

export async function capabilityBoard(scope: Scope): Promise<Built> {
  const months = scope.filters.months;
  const trendMonths = Math.max(months, 6);
  const period = periodLabel(months);
  const data = await runAll(scope.access, {
    coverage: scoped(scope, `
      select (select count(*) from emp, today t where active and joined_on <= t.d)::int as headcount,
        count(distinct s.employee_id)::int as with_skills, count(*)::int as skills,
        count(*) filter (where s.attributes->>'verified' = 'true')::int as verified
      from employee_skills s join emp e on e.id = s.employee_id and e.active
      where s.tenant_id = $1::uuid`),
    topSkills: scoped(scope, `
      select coalesce(k.attributes->>'name', k.attributes->>'code', 'Unnamed skill') as name, count(distinct s.employee_id)::int as value
      from employee_skills s join emp e on e.id = s.employee_id and e.active
      join skills k on k.tenant_id = s.tenant_id and k.id = s.skill_id
      where s.tenant_id = $1::uuid group by 1 order by 2 desc limit 12`),
    proficiency: scoped(scope, `
      select coalesce(s.attributes->>'proficiency', 'Not assessed') as name, count(*)::int as value
      from employee_skills s join emp e on e.id = s.employee_id and e.active
      where s.tenant_id = $1::uuid group by 1 order by 1`),
    enrolments: scoped(scope, `
      select count(*) filter (where coalesce(n.attributes->>'status', 'assigned') = 'assigned')::int as open,
        count(*) filter (where n.attributes->>'status' = 'verified' and n.updated_at::date > t.d - make_interval(months => $5::int))::int as completed,
        count(*) filter (where n.created_at::date > t.d - make_interval(months => $5::int))::int as assigned_in_period,
        count(*) filter (where coalesce(n.attributes->>'status', 'assigned') = 'assigned'
          and n.attributes->>'due_date' ~ '^\\d{4}-\\d{2}-\\d{2}$' and (n.attributes->>'due_date')::date < t.d)::int as overdue
      from enrollments n join emp e on e.id = n.employee_id, today t
      where n.tenant_id = $1::uuid`, [months]),
    completions: scoped(scope, `
      with ${MONTHS_CTE("$5")}
      select m.month, (select count(*) from learning_completions c join emp e on e.id = c.employee_id
        where c.tenant_id = $1::uuid and to_char(c.created_at, 'YYYY-MM') = m.month)::int as value
      from months m order by m.month`, [trendMonths]),
    byDepartment: scoped(scope, `
      select coalesce(e.department, 'Not recorded') as name, count(*)::int as value
      from learning_completions c join emp e on e.id = c.employee_id, today t
      where c.tenant_id = $1::uuid and c.created_at::date > t.d - make_interval(months => $5::int)
      group by 1 order by 2 desc limit 12`, [months]),
    overdue: scoped(scope, `
      select e.name, e.department, coalesce(n.attributes->>'course_code', 'Course') as course, n.attributes->>'due_date' as due_date
      from enrollments n join emp e on e.id = n.employee_id and e.active, today t
      where n.tenant_id = $1::uuid and coalesce(n.attributes->>'status', 'assigned') = 'assigned'
        and n.attributes->>'due_date' ~ '^\\d{4}-\\d{2}-\\d{2}$' and (n.attributes->>'due_date')::date < t.d
      order by (n.attributes->>'due_date')::date limit 12`),
  });

  const coverage = first(data.coverage);
  const headcount = num(coverage.headcount);
  const enrolments = first(data.enrolments);
  const completed = num(enrolments.completed);
  const top = named(data.topSkills).map((row, index) => ({ ...row, name: String(rowsOf(data.topSkills)[index]?.name ?? row.name) }));
  const completions = rowsOf(data.completions);
  const departments = rowsOf(data.byDepartment).map((row) => ({ name: String(row.name), value: num(row.value) }));

  const kpis: Kpi[] = [
    { id: "coverage", label: "Skills recorded", value: pct(num(coverage.with_skills), headcount, 0), format: "percent", hint: headcount ? `${num(coverage.with_skills)} of ${headcount} active employees` : "No active employees", target: "learning" },
    { id: "verified", label: "Verified skills", value: pct(num(coverage.verified), num(coverage.skills), 0), format: "percent", hint: num(coverage.skills) ? `${num(coverage.verified)} of ${num(coverage.skills)} skill records` : "No skills recorded" },
    { id: "open", label: "Courses in progress", value: data.enrolments ? num(enrolments.open) : null, format: "count", hint: "Assigned, not completed" },
    { id: "completed", label: "Courses completed", value: data.enrolments ? completed : null, format: "count", hint: period, tone: "positive" },
    { id: "overdue", label: "Overdue courses", value: data.enrolments ? num(enrolments.overdue) : null, format: "count", hint: "Past due date", tone: num(enrolments.overdue) ? "attention" : "neutral" },
  ];

  const panels: Panel[] = [
    withSource(data.topSkills, barPanel(
      { id: "skills", title: "Most common skills", subtitle: "Active employees with each skill", span: 6, format: "count", emptyMessage: "No skills have been recorded against employees.", target: "learning" },
      top.map((row) => row.name).reverse(), [{ name: "Employees", data: top.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.proficiency, partsPanel(
      { id: "proficiency", title: "Proficiency levels", span: 6, format: "count", emptyMessage: "No skills have been recorded against employees." },
      rowsOf(data.proficiency).map((row) => ({ name: String(row.name), value: num(row.value) })),
    )),
    withSource(data.completions, linePanel(
      { id: "completions", title: "Course completions", subtitle: `By month, last ${trendMonths} months`, span: 6, format: "count", emptyMessage: "No courses have been completed yet.", target: "learning" },
      completions.map((row) => monthLabel(String(row.month))), [{ name: "Completions", data: completions.map((row) => num(row.value)) }],
    )),
    withSource(data.byDepartment, barPanel(
      { id: "department", title: "Completions by department", subtitle: period, span: 6, format: "count", emptyMessage: `No courses completed in the ${period}.` },
      departments.map((row) => row.name).reverse(), [{ name: "Completions", data: departments.map((row) => row.value).reverse() }], true,
    )),
    withSource(data.overdue, tablePanel(
      { id: "overdue", title: "Overdue courses", span: 12, emptyMessage: "No assigned courses are past their due date.", target: "learning" },
      [{ key: "name", label: "Employee" }, { key: "department", label: "Department" }, { key: "course", label: "Course" }, { key: "due", label: "Due", format: "date" }],
      rowsOf(data.overdue).map((row) => ({ name: String(row.name ?? ""), department: row.department ? String(row.department) : null, course: String(row.course), due: String(row.due_date) })),
    )),
  ];

  const insights: string[] = [];
  if (headcount && num(coverage.with_skills)) insights.push(`${pct(num(coverage.with_skills), headcount, 0)}% of active employees have at least one skill recorded.`);
  if (top[0]) insights.push(`The most common skill is ${top[0].name} (${plural(top[0].value, "person", "people")}).`);
  if (completed) insights.push(`${plural(completed, "course was", "courses were")} completed in the ${period}.`);
  if (num(enrolments.overdue)) insights.push(`${plural(num(enrolments.overdue), "assigned course is", "assigned courses are")} past the due date.`);

  return { kpis, panels, insights, employeesInScope: headcount };
}
