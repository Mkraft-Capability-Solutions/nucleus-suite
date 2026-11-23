import "server-only";

import { listEmployeeHomeActions } from "@/server/home/actions";
import { operationalApprovals } from "@/server/workflows/approval-inbox";
import { barPanel, dayLabel, humanise, listPanel, num, pct, plural, round, tablePanel, withSource } from "../compose";
import { plain, runAll, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";
import { attendanceRate } from "./attendance";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number | null; notice?: string; audience: string };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const first = (rows: Row[] | null): Row => rows?.[0] ?? {};
const ACTIVE = `coalesce(lower(e.status), 'active') not in ('separated', 'exited', 'relieved', 'archived', 'inactive')`;

const NOT_LINKED = "Your sign-in is not linked to an employee record in this organisation, so there is nothing personal to show. Ask HR to link your account to your employee record.";

/* ================================================================== */
/* S7 · Manager cockpit: the signed-in manager's direct reports        */
/* ================================================================== */

export async function managerCockpit(scope: Scope): Promise<Built> {
  const managerId = scope.access.context.employeeId ?? null;
  const audience = "Your direct reports";
  if (!managerId) return { kpis: [], panels: [], insights: [], employeesInScope: null, notice: NOT_LINKED, audience };

  // $1 tenant · $2 timezone · $3 manager employee id
  const team = `team as (
      select e.id, trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, e.designation
      from employees e where e.tenant_id = $1::uuid and e.manager_employee_id = $3::uuid and ${ACTIVE})`;
  const [data, approvals] = await Promise.all([
    runAll(scope.access, {
      members: plain(scope, `
        with ${team}
        select m.id, m.name, m.designation, a.status as today_status,
          (select to_char(min(p.punched_at) at time zone $2::text, 'HH24:MI') from attendance_punches p
            where p.tenant_id = a.tenant_id and p.attendance_day_id = a.id and p.type = 'in') as first_in,
          exists (select 1 from leave_requests l where l.tenant_id = $1::uuid and l.employee_id = m.id
            and l.status = 'approved' and t.d between l.starts_on and l.ends_on) as on_leave,
          (select count(*) filter (where d.status in ('present', 'half_day')) from attendance_days d
            where d.tenant_id = $1::uuid and d.employee_id = m.id and d.attendance_date > t.d - 30 and d.attendance_date <= t.d)::int as present_30,
          (select count(*) filter (where d.status = 'absent') from attendance_days d
            where d.tenant_id = $1::uuid and d.employee_id = m.id and d.attendance_date > t.d - 30 and d.attendance_date <= t.d)::int as absent_30,
          (select count(*) filter (where d.status = 'half_day') from attendance_days d
            where d.tenant_id = $1::uuid and d.employee_id = m.id and d.attendance_date > t.d - 30 and d.attendance_date <= t.d)::int as half_30,
          (select coalesce(sum(d.payable_ot_minutes), 0) from attendance_days d
            where d.tenant_id = $1::uuid and d.employee_id = m.id and d.attendance_date > t.d - 30 and d.attendance_date <= t.d)::int as ot_minutes
        from team m cross join today t
        left join attendance_days a on a.tenant_id = $1::uuid and a.employee_id = m.id and a.attendance_date = t.d
        order by m.name`, [managerId]),
      leave: plain(scope, `
        with ${team}
        select m.name, l.leave_type, l.status, to_char(l.starts_on, 'YYYY-MM-DD') as starts_on,
          to_char(l.ends_on, 'YYYY-MM-DD') as ends_on, l.requested_days
        from leave_requests l join team m on m.id = l.employee_id, today t
        where l.tenant_id = $1::uuid and (l.status = 'approved' or l.status like 'pending%')
          and l.ends_on >= t.d and l.starts_on <= t.d + 13
        order by l.starts_on, m.name limit 15`, [managerId]),
      pending: plain(scope, `
        with ${team}
        select count(*)::int as value from leave_requests l join team m on m.id = l.employee_id
        where l.tenant_id = $1::uuid and l.status like 'pending%'`, [managerId]),
      goals: plain(scope, `
        with ${team}
        select m.name, count(o.id)::int as objectives,
          round(avg(case when o.attributes->>'progress_pct' ~ '^[0-9]+(\\.[0-9]+)?$' then (o.attributes->>'progress_pct')::numeric end), 0)::float as progress
        from team m left join objectives o on o.tenant_id = $1::uuid and o.owner_employee_id = m.id
          and coalesce(o.attributes->>'status', 'active') not in ('cancelled', 'archived')
        group by m.name order by m.name`, [managerId]),
    }),
    operationalApprovals(scope.access).then((rows) => rows.length).catch(() => null),
  ]);

  const members = rowsOf(data.members);
  const size = members.length;
  const presentToday = members.filter((row) => row.today_status === "present" || row.today_status === "half_day").length;
  const onLeave = members.filter((row) => row.on_leave === true).length;
  const recordedToday = members.filter((row) => row.today_status).length;
  const pendingLeave = num(first(data.pending).value);
  const otHours = round(members.reduce((sum, row) => sum + num(row.ot_minutes), 0) / 60, 1);
  const goals = rowsOf(data.goals).filter((row) => num(row.objectives) > 0);
  const teamRate = attendanceRate(
    members.reduce((sum, row) => sum + num(row.present_30) - num(row.half_30), 0),
    members.reduce((sum, row) => sum + num(row.half_30), 0),
    members.reduce((sum, row) => sum + num(row.absent_30), 0),
  );

  const kpis: Kpi[] = [
    { id: "team", label: "Direct reports", value: data.members ? size : null, format: "count", hint: "Active", target: "team" },
    { id: "present", label: "Present today", value: data.members ? presentToday : null, of: size || null, format: "count", hint: recordedToday ? "From today's attendance" : "No attendance recorded today", tone: "positive" },
    { id: "leave", label: "On leave today", value: data.members ? onLeave : null, format: "count", hint: "Approved leave" },
    { id: "pending", label: "Leave awaiting you", value: data.pending ? pendingLeave : null, format: "count", hint: "Pending requests from your team", tone: pendingLeave ? "attention" : "neutral", target: "leaves" },
    { id: "approvals", label: "Other approvals", value: approvals, format: "count", hint: approvals === null ? "Approval inbox unavailable" : "Requests in your approval inbox", target: "approval_inbox" },
    { id: "attendance", label: "Team attendance", value: teamRate, format: "percent", hint: teamRate === null ? "No workdays recorded yet" : "Last 30 days" },
  ];

  const panels: Panel[] = [
    withSource(data.members, tablePanel(
      { id: "team", title: "My team today", span: 8, emptyMessage: "No active employees report to you yet.", target: "team" },
      [
        { key: "name", label: "Name" }, { key: "designation", label: "Designation" }, { key: "today", label: "Today" },
        { key: "first_in", label: "First in" }, { key: "rate", label: "Attendance, 30 days", format: "percent" },
      ],
      members.map((row) => ({
        name: String(row.name ?? ""),
        designation: row.designation ? String(row.designation) : null,
        today: row.on_leave === true ? "On leave" : row.today_status ? humanise(String(row.today_status)) : "No record",
        first_in: row.first_in ? String(row.first_in) : null,
        rate: attendanceRate(num(row.present_30) - num(row.half_30), num(row.half_30), num(row.absent_30)),
      })),
    )),
    withSource(data.leave, listPanel(
      { id: "leave", title: "Team leave, next 14 days", span: 4, emptyMessage: "No one in your team has leave in the next 14 days.", target: "leaves" },
      rowsOf(data.leave).map((row) => ({
        label: String(row.name ?? ""),
        detail: `${humanise(String(row.leave_type ?? "Leave"))} · ${dayLabel(String(row.starts_on))}${row.ends_on !== row.starts_on ? ` – ${dayLabel(String(row.ends_on))}` : ""}`,
        status: humanise(String(row.status)),
        tone: row.status === "approved" ? "positive" : "attention",
      })),
    )),
    withSource(data.members, barPanel(
      { id: "overtime", title: "Overtime by team member", subtitle: "Payable hours, last 30 days", span: 6, format: "hours", emptyMessage: "No payable overtime in your team in the last 30 days." },
      members.map((row) => String(row.name)).reverse(), [{ name: "Hours", data: members.map((row) => round(num(row.ot_minutes) / 60, 1)).reverse() }], true,
    )),
    withSource(data.goals, barPanel(
      { id: "goals", title: "Goal progress", subtitle: "Average progress of each person's objectives", span: 6, format: "percent", emptyMessage: "No objectives have been set for your team.", target: "performance" },
      goals.map((row) => String(row.name)).reverse(), [{ name: "Progress %", data: goals.map((row) => num(row.progress)).reverse() }], true,
    )),
  ];

  const insights: string[] = [];
  if (size) insights.push(`${plural(size, "person reports", "people report")} to you; ${presentToday} ${presentToday === 1 ? "is" : "are"} present today${onLeave ? ` and ${onLeave} on leave` : ""}.`);
  if (pendingLeave) insights.push(`${plural(pendingLeave, "leave request is", "leave requests are")} waiting for your decision.`);
  if (otHours) insights.push(`Your team logged ${otHours.toLocaleString("en-IN")} payable overtime hours in the last 30 days.`);

  return { kpis, panels, insights, employeesInScope: size, audience };
}

/* ================================================================== */
/* S8 · Employee home: the signed-in employee's own records            */
/* ================================================================== */

export async function employeeHome(scope: Scope): Promise<Built> {
  const employeeId = scope.access.context.employeeId ?? null;
  const audience = "Your own records";
  if (!employeeId) return { kpis: [], panels: [], insights: [], employeesInScope: null, notice: NOT_LINKED, audience };

  // $1 tenant · $2 timezone · $3 the signed-in employee
  const [data, actions] = await Promise.all([
    runAll(scope.access, {
      me: plain(scope, `
        select trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')) as name, e.designation, e.department, e.location,
          to_char(e.joining_date, 'YYYY-MM-DD') as joining_date,
          trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')) as manager, m.designation as manager_designation,
          (select count(*) from employees r where r.tenant_id = e.tenant_id and r.manager_employee_id = e.id and ${ACTIVE.replaceAll("e.", "r.")})::int as reports,
          (select count(*) from employees p where p.tenant_id = e.tenant_id and e.manager_employee_id is not null
            and p.manager_employee_id = e.manager_employee_id and p.id <> e.id and ${ACTIVE.replaceAll("e.", "p.")})::int as peers
        from employees e left join employees m on m.tenant_id = e.tenant_id and m.id = e.manager_employee_id
        where e.tenant_id = $1::uuid and e.id = $3::uuid`, [employeeId]),
      today: plain(scope, `
        select a.status, a.productive_minutes,
          (select to_char(min(p.punched_at) at time zone $2::text, 'HH24:MI') from attendance_punches p
            where p.tenant_id = a.tenant_id and p.attendance_day_id = a.id and p.type = 'in') as first_in,
          (select to_char(max(p.punched_at) at time zone $2::text, 'HH24:MI') from attendance_punches p
            where p.tenant_id = a.tenant_id and p.attendance_day_id = a.id and p.type = 'out') as last_out
        from attendance_days a, today t
        where a.tenant_id = $1::uuid and a.employee_id = $3::uuid and a.attendance_date = t.d`, [employeeId]),
      days: plain(scope, `
        select to_char(a.attendance_date, 'YYYY-MM-DD') as day, a.status, a.productive_minutes, a.payable_ot_minutes
        from attendance_days a, today t
        where a.tenant_id = $1::uuid and a.employee_id = $3::uuid and a.attendance_date > t.d - 30 and a.attendance_date <= t.d
        order by a.attendance_date`, [employeeId]),
      balances: plain(scope, `
        select distinct on (leave_type) leave_type, balance::float as balance
        from leave_balances where tenant_id = $1::uuid and employee_id = $3::uuid
        order by leave_type, as_of_date desc`, [employeeId]),
      requests: plain(scope, `
        select leave_type, status, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on, requested_days::float as days
        from leave_requests where tenant_id = $1::uuid and employee_id = $3::uuid
        order by created_at desc limit 6`, [employeeId]),
      learning: plain(scope, `
        select coalesce(attributes->>'course_code', 'Course') as course, coalesce(attributes->>'status', 'assigned') as status,
          attributes->>'due_date' as due_date
        from enrollments where tenant_id = $1::uuid and employee_id = $3::uuid
        order by created_at desc limit 8`, [employeeId]),
    }),
    listEmployeeHomeActions(scope.access).catch(() => null),
  ]);

  const me = first(data.me);
  const today = first(data.today);
  const days = rowsOf(data.days);
  const present = days.filter((row) => row.status === "present").length;
  const half = days.filter((row) => row.status === "half_day").length;
  const absent = days.filter((row) => row.status === "absent").length;
  const worked = days.filter((row) => num(row.productive_minutes) > 0);
  const balances = rowsOf(data.balances);
  const totalBalance = balances.reduce((sum, row) => sum + num(row.balance), 0);
  const requests = rowsOf(data.requests);
  const pendingRequests = requests.filter((row) => String(row.status).startsWith("pending")).length;
  const openActions = actions ? actions.rows.filter((row) => row.status !== "completed") : null;
  const learning = rowsOf(data.learning);

  const kpis: Kpi[] = [
    { id: "today", label: "Today", value: today.status ? humanise(String(today.status)) : data.today ? "Not punched in" : null, format: "text", hint: today.first_in ? `First in ${today.first_in}${today.last_out ? ` · last out ${today.last_out}` : ""}` : "No punch recorded today", target: "attendance" },
    { id: "attendance", label: "My attendance", value: attendanceRate(present, half, absent), format: "percent", hint: days.length ? "Last 30 days" : "No attendance recorded yet" },
    { id: "hours", label: "Average hours", value: worked.length ? round(worked.reduce((sum, row) => sum + num(row.productive_minutes), 0) / worked.length / 60, 1) : null, format: "hours", hint: "Per day worked, last 30 days" },
    { id: "balance", label: "Leave balance", value: balances.length ? round(totalBalance, 1) : null, format: "days", hint: balances.length ? `Across ${plural(balances.length, "leave type")}` : "No balances credited yet", target: "leaves" },
    { id: "requests", label: "Requests pending", value: data.requests ? pendingRequests : null, format: "count", hint: "Your leave requests" },
    { id: "actions", label: "Things to do", value: openActions ? openActions.length : null, format: "count", hint: openActions ? "Tasks, policies and documents" : "Unavailable", tone: openActions?.length ? "attention" : "neutral" },
  ];

  const panels: Panel[] = [
    actions === null
      ? listPanel({ id: "actions", title: "My actions", span: 6, emptyMessage: "Your actions could not be loaded." }, [])
      : listPanel(
        { id: "actions", title: "My actions", subtitle: "Onboarding, clearance, policies and documents", span: 6, emptyMessage: "You are all caught up." },
        (openActions ?? []).slice(0, 8).map((row) => ({ label: row.action, detail: row.context, status: humanise(row.status), tone: row.status === "needs_attention" ? "attention" : "neutral" })),
      ),
    withSource(data.balances, barPanel(
      { id: "balances", title: "Leave balances", subtitle: "Latest credited balance", span: 6, format: "days", emptyMessage: "No leave has been credited to you yet.", target: "leaves" },
      balances.map((row) => humanise(String(row.leave_type))), [{ name: "Days", data: balances.map((row) => num(row.balance)) }],
    )),
    withSource(data.days, barPanel(
      { id: "hours", title: "My working hours", subtitle: "Productive hours per day, last 30 days", span: 6, format: "hours", emptyMessage: "No attendance has been recorded for you in the last 30 days.", target: "attendance" },
      days.map((row) => dayLabel(String(row.day))), [
        { name: "Productive", data: days.map((row) => round(num(row.productive_minutes) / 60, 1)), stack: "h" },
        { name: "Overtime", data: days.map((row) => round(num(row.payable_ot_minutes) / 60, 1)), stack: "h" },
      ],
    )),
    withSource(data.requests, tablePanel(
      { id: "requests", title: "My leave requests", span: 6, emptyMessage: "You have not applied for leave.", target: "leaves" },
      [{ key: "type", label: "Type" }, { key: "from", label: "From", format: "date" }, { key: "to", label: "To", format: "date" }, { key: "days", label: "Days", format: "decimal" }, { key: "status", label: "Status" }],
      requests.map((row) => ({ type: humanise(String(row.leave_type ?? "")), from: String(row.starts_on), to: String(row.ends_on), days: num(row.days), status: humanise(String(row.status)) })),
    )),
    withSource(data.learning, listPanel(
      { id: "learning", title: "My learning", span: 6, emptyMessage: "No courses are assigned to you.", target: "learning" },
      learning.map((row) => ({ label: String(row.course), detail: row.due_date ? `Due ${dayLabel(String(row.due_date))}` : undefined, status: humanise(String(row.status)), tone: row.status === "verified" ? "positive" : "neutral" })),
    )),
    withSource(data.me, listPanel(
      { id: "reporting", title: "My reporting line", span: 6, emptyMessage: "Your employee record could not be found.", target: "org_chart" },
      data.me && data.me.length ? [
        { label: "Manager", detail: me.manager ? `${me.manager}${me.manager_designation ? ` · ${me.manager_designation}` : ""}` : "No manager recorded" },
        { label: "Role", detail: [me.designation, me.department, me.location].filter(Boolean).join(" · ") || "Not recorded" },
        { label: "Peers", value: num(me.peers), format: "count", detail: "People with the same manager" },
        { label: "Direct reports", value: num(me.reports), format: "count" },
        ...(me.joining_date ? [{ label: "Joined", detail: dayLabel(String(me.joining_date)) + " " + String(me.joining_date).slice(0, 4) }] : []),
      ] : [],
    )),
  ];

  const insights: string[] = [];
  const rate = attendanceRate(present, half, absent);
  if (rate !== null) insights.push(`Your attendance over the last 30 days is ${rate}% (${plural(present + half, "day")} worked).`);
  if (pendingRequests) insights.push(`${plural(pendingRequests, "leave request is", "leave requests are")} awaiting approval.`);
  if (openActions?.length) insights.push(`You have ${plural(openActions.length, "open action")}.`);
  const pctCompleted = pct(learning.filter((row) => row.status === "verified").length, learning.length, 0);
  if (pctCompleted !== null) insights.push(`You have completed ${pctCompleted}% of your assigned courses.`);

  return { kpis, panels, insights, employeesInScope: null, audience };
}
