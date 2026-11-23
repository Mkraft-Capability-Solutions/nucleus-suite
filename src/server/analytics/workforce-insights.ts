import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  ANALYTICS_PERIODS,
  type MetricSnapshotRow,
  type PayrollInsights,
  type Section,
  type UnavailableReason,
  type WorkforceInsightsPayload,
} from "@/lib/analytics/workforce-insights-types";
import {
  annualizedAttrition,
  basicWageCompliance,
  diversityIndex,
  genderBreakdown,
  percent,
  periodWindow,
  riskBands,
  talentFromApplications,
  wageBridge,
  workforceFromSites,
  type ApplicationRow,
  type AttendanceSiteRow,
  type PayEmployeeRow,
} from "./workforce-insights-calc";

/**
 * Workforce analytics aggregate for the Analytics studio (people, workforce, payroll, talent, capability,
 * metric privacy). Each section is computed by SQL over the tenant's own records inside tenantTx with an
 * explicit tenant_id filter, and each section checks its own permission: a role without payroll.read still
 * gets its people figures, and the payroll section reports `forbidden` instead of numbers.
 * Unexpected database errors are not swallowed; they fail the request.
 */

export const insightsQuerySchema = z.object({
  period: z.enum(ANALYTICS_PERIODS).default("current_quarter"),
  department: z.string().trim().min(1).max(120).optional(),
});
export type InsightsQuery = z.infer<typeof insightsQuerySchema>;

const SEPARATED = ["separated", "archived", "inactive"];
const off = (reason: UnavailableReason) => ({ available: false as const, reason });
const on = <T>(value: T) => ({ available: true as const, value });

/** Runs a section; a permission refusal becomes an honest `forbidden` section, anything else propagates. */
async function guarded<T>(run: () => Promise<Section<T>>): Promise<Section<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) return off("forbidden");
    throw error;
  }
}

type Rows<T> = T[];
const num = (value: unknown) => Number(value ?? 0) || 0;

export async function loadWorkforceInsights(access: Access, query: InsightsQuery, now: Date = new Date()): Promise<WorkforceInsightsPayload> {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const t = access.tenantId;
  const dept = query.department ?? null;
  const window = periodWindow(query.period, now);
  const trailing = periodWindow("last_12_months", now);

  const [departmentRows, genderRows, activeRows, exitRows, datedRows, riskRows, capabilityRows, metricRows] = (await tenantTx(access, [
    sqlClient`select distinct btrim(attributes->>'name') as name from departments
              where tenant_id = ${t} and coalesce(btrim(attributes->>'name'), '') <> '' order by 1`,
    sqlClient`select nullif(btrim(e.metadata->>'gender'), '') as gender, count(*)::int as total from employees e
              where e.tenant_id = ${t} and coalesce(e.status, '') <> all(${SEPARATED}::text[])
                and (${dept}::text is null or e.department = ${dept}) group by 1`,
    sqlClient`select count(*)::int as total from employees e
              where e.tenant_id = ${t} and coalesce(e.status, '') <> all(${SEPARATED}::text[])
                and (${dept}::text is null or e.department = ${dept})`,
    sqlClient`select count(distinct e.id)::int as total from offboarding_cases c
              join employments em on em.tenant_id = c.tenant_id and em.id = c.employment_id
              join employees e on e.tenant_id = em.tenant_id and e.id = em.employee_id
              where c.tenant_id = ${t} and (c.attributes->>'last_working_day') between ${trailing.from} and ${trailing.to}
                and (${dept}::text is null or e.department = ${dept})`,
    sqlClient`select count(*)::int as total from offboarding_cases c
              where c.tenant_id = ${t} and coalesce(c.attributes->>'last_working_day', '') <> ''`,
    sqlClient`select lower(s.attributes->>'band') as band, count(*)::int as total
              from (select distinct on (a.employee_id) a.employee_id, a.attributes from attrition_scores a
                    where a.tenant_id = ${t} order by a.employee_id, a.created_at desc) s
              join employees e on e.tenant_id = ${t} and e.id = s.employee_id
              where coalesce(e.status, '') <> all(${SEPARATED}::text[]) and (${dept}::text is null or e.department = ${dept})
              group by 1`,
    sqlClient`select avg((s.attributes->>'index')::numeric)::float as average, count(*)::int as total
              from (select distinct on (r.employee_id) r.employee_id, r.attributes from capability_index_runs r
                    where r.tenant_id = ${t} order by r.employee_id, r.created_at desc) s
              join employees e on e.tenant_id = ${t} and e.id = s.employee_id
              where coalesce(e.status, '') <> all(${SEPARATED}::text[]) and (${dept}::text is null or e.department = ${dept})`,
    sqlClient`select d.attributes->>'code' as code, d.attributes->>'name' as name,
                     coalesce((d.attributes->>'privacy_threshold')::int, 5) as threshold,
                     s.attributes as snapshot
              from metric_definitions d
              left join lateral (select attributes from metric_snapshots ms
                                 where ms.tenant_id = d.tenant_id and ms.metric_definition_id = d.id
                                 order by ms.created_at desc limit 1) s on true
              where d.tenant_id = ${t} order by d.created_at`,
  ])) as [
    Rows<{ name: string }>, Rows<{ gender: string | null; total: number }>, Rows<{ total: number }>, Rows<{ total: number }>,
    Rows<{ total: number }>, Rows<{ band: string | null; total: number }>, Rows<{ average: number | null; total: number }>,
    Rows<{ code: string | null; name: string | null; threshold: number; snapshot: Record<string, unknown> | null }>,
  ];

  const active = num(activeRows[0]?.total);
  const gender = genderBreakdown(genderRows);
  const people: WorkforceInsightsPayload["people"] = active === 0
    ? off("no_roster")
    : on({ activeHeadcount: active, gender, diversityIndex: diversityIndex(gender) });

  const exits = num(exitRows[0]?.total);
  const rate = annualizedAttrition(exits, active, trailing.days);
  const attrition: WorkforceInsightsPayload["attrition"] = num(datedRows[0]?.total) === 0 || rate === null
    ? off(active === 0 ? "no_roster" : "no_dated_exits")
    : on({ exits, annualizedAttrition: rate, retentionRate: Math.round((100 - rate) * 10) / 10, windowDays: trailing.days });

  const bands = riskBands(riskRows);
  const risk: WorkforceInsightsPayload["risk"] = bands.scored === 0 ? off("no_attrition_scores") : on(bands);

  const capabilityCount = num(capabilityRows[0]?.total);
  const capability: WorkforceInsightsPayload["capability"] = capabilityCount === 0
    ? off("no_capability_runs")
    : on({ averageIndex: Math.round(num(capabilityRows[0]?.average) * 10) / 10, employees: capabilityCount });

  const metricList: MetricSnapshotRow[] = metricRows.map((row) => {
    const snapshot = row.snapshot;
    return {
      code: row.code ?? "",
      name: row.name ?? "",
      privacyThreshold: num(row.threshold),
      cohortSize: snapshot ? num(snapshot.cohort_size) : null,
      suppressed: snapshot ? snapshot.suppressed === true : null,
      refreshedAt: snapshot && typeof snapshot.refreshed_at === "string" ? snapshot.refreshed_at : null,
    };
  });

  const [workforce, payroll, talent, leave] = await Promise.all([
    guarded(() => loadWorkforce(access, window, dept)),
    guarded(() => loadPayroll(access, window.to, dept)),
    loadTalent(access, window, dept),
    guarded(() => loadLeave(access, window, dept)),
  ]);

  return {
    window: { period: query.period, from: window.from, to: window.to, department: dept },
    departments: departmentRows.map((row) => row.name),
    people,
    attrition,
    risk,
    workforce,
    payroll,
    talent,
    capability,
    leave,
    metrics: metricList.length === 0 ? off("no_metric_definitions") : on(metricList),
    generatedAt: now.toISOString(),
  };
}

async function loadWorkforce(access: Access, window: { from: string; to: string }, dept: string | null): Promise<WorkforceInsightsPayload["workforce"]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = (await tenantTx(access, [
    sqlClient`select e.location as location, mode() within group (order by d.assigned_shift) as shift,
                     count(distinct d.employee_id)::int as employees,
                     count(*) filter (where d.status not in ('holiday', 'rest_day', 'pending'))::int as scheduled,
                     count(*) filter (where d.status = 'present')::int as present,
                     count(*) filter (where d.status = 'half_day')::int as half_day,
                     count(*) filter (where d.status = 'absent')::int as absent,
                     coalesce(sum(d.payable_ot_minutes), 0)::bigint as ot_minutes
              from attendance_days d
              join employees e on e.tenant_id = d.tenant_id and e.id = d.employee_id
              where d.tenant_id = ${access.tenantId} and d.attendance_date between ${window.from}::date and ${window.to}::date
                and (${dept}::text is null or e.department = ${dept})
              group by e.location`,
  ])) as [AttendanceSiteRow[]];
  const value = workforceFromSites(rows);
  return value.scheduledDays === 0 ? off("no_attendance") : on(value);
}

async function loadPayroll(access: Access, windowEnd: string, dept: string | null): Promise<WorkforceInsightsPayload["payroll"]> {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const t = access.tenantId;
  const [runRows] = (await tenantTx(access, [
    sqlClient`select id, period, scope, currency from payroll_runs
              where tenant_id = ${t} and period <= ${windowEnd.slice(0, 7)} order by period desc, created_at desc limit 1`,
  ])) as [Array<{ id: string; period: string; scope: string; currency: string | null }>];
  const run = runRows[0];
  if (!run) return off("no_payroll_run");
  const [priorRows] = (await tenantTx(access, [
    sqlClient`select id, period from payroll_runs where tenant_id = ${t} and scope = ${run.scope} and period < ${run.period}
              order by period desc limit 1`,
  ])) as [Array<{ id: string; period: string }>];
  const prior = priorRows[0] ?? null;
  const runIds = prior ? [run.id, prior.id] : [run.id];
  const [employeeRows, statutoryRows, advanceRows] = (await tenantTx(access, [
    sqlClient`select m.payroll_run_id as run_id, m.employee_id,
                     coalesce(sum((l.attributes->>'amount_minor')::bigint) filter (where l.attributes->>'kind' = 'earning'), 0)::bigint as gross,
                     coalesce(sum((l.attributes->>'amount_minor')::bigint) filter (where l.attributes->>'kind' = 'earning'
                       and lower(l.attributes->>'code') in ('basic', 'da')), 0)::bigint as basic_da
              from payroll_lines l
              join payroll_run_employees m on m.tenant_id = l.tenant_id and m.id = l.payroll_run_employee_id
              join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
              where l.tenant_id = ${t} and m.payroll_run_id = any(${runIds}::uuid[])
                and (${dept}::text is null or e.department = ${dept})
              group by 1, 2`,
    sqlClient`select coalesce(sum((l.attributes->>'amount_minor')::bigint), 0)::bigint as total
              from payroll_lines l
              join payroll_run_employees m on m.tenant_id = l.tenant_id and m.id = l.payroll_run_employee_id
              join employees e on e.tenant_id = m.tenant_id and e.id = m.employee_id
              where l.tenant_id = ${t} and m.payroll_run_id = ${run.id}
                and l.attributes->>'kind' in ('deduction', 'employer_contribution')
                and lower(l.attributes->>'code') ~ '^(pf|esi|eps|edli)'
                and (${dept}::text is null or e.department = ${dept})`,
    sqlClient`select coalesce(sum((a.attributes->>'amount_minor')::bigint), 0)::bigint as total
              from salary_advances a join employees e on e.tenant_id = a.tenant_id and e.id = a.employee_id
              where a.tenant_id = ${t} and a.attributes->>'period' = ${run.period}
                and coalesce(a.attributes->>'status', '') in ('approved', 'disbursed', 'recovered')
                and (${dept}::text is null or e.department = ${dept})`,
  ])) as [PayEmployeeRow[], Array<{ total: string | number }>, Array<{ total: string | number }>];

  const current = employeeRows.filter((row) => row.run_id === run.id);
  if (current.length === 0) return off("no_payroll_lines");
  const grossMinor = current.reduce((sum, row) => sum + num(row.gross), 0);
  const advancesMinor = num(advanceRows[0]?.total);
  const priorLines = prior ? employeeRows.filter((row) => row.run_id === prior.id) : [];
  const bridge: PayrollInsights["bridge"] = prior && priorLines.length > 0
    ? on({ priorPeriod: prior.period, ...wageBridge(current, priorLines) })
    : off("no_prior_run");
  return on({
    runId: run.id,
    period: run.period,
    currency: run.currency ?? "INR",
    grossMinor,
    employees: current.length,
    basicWageCompliance: basicWageCompliance(current),
    statutoryMinor: num(statutoryRows[0]?.total),
    advancesMinor,
    advanceDrawdown: percent(advancesMinor, grossMinor),
    bridge,
  });
}

async function loadTalent(access: Access, window: { from: string; to: string }, dept: string | null): Promise<WorkforceInsightsPayload["talent"]> {
  const t = access.tenantId;
  const [applicationRows, openRows] = (await tenantTx(access, [
    sqlClient`select a.attributes->>'stage' as stage, c.attributes->>'source' as source,
                     exists (select 1 from referrals ref where ref.tenant_id = a.tenant_id and ref.application_id = a.id) as referred,
                     (select extract(epoch from (h.created_at - a.created_at)) / 86400 from application_stage_history h
                       where h.tenant_id = a.tenant_id and h.application_id = a.id and h.attributes->>'to' = 'converted'
                       order by h.created_at limit 1) as days_to_join
              from applications a
              left join candidates c on c.tenant_id = a.tenant_id and c.id = a.candidate_id
              left join requisitions r on r.tenant_id = a.tenant_id and r.id = a.requisition_id
              left join departments d on d.tenant_id = a.tenant_id and d.id = r.department_id
              where a.tenant_id = ${t} and a.created_at::date between ${window.from}::date and ${window.to}::date
                and (${dept}::text is null or d.attributes->>'name' = ${dept})
              limit 5000`,
    sqlClient`select count(*)::int as total from requisitions r
              left join departments d on d.tenant_id = r.tenant_id and d.id = r.department_id
              where r.tenant_id = ${t} and r.attributes->>'status' = 'approved'
                and (${dept}::text is null or d.attributes->>'name' = ${dept})`,
  ])) as [ApplicationRow[], Array<{ total: number }>];
  const openPositions = num(openRows[0]?.total);
  if (applicationRows.length === 0 && openPositions === 0) return off("no_applications");
  return on(talentFromApplications(applicationRows, openPositions));
}

async function loadLeave(access: Access, window: { from: string; to: string }, dept: string | null): Promise<WorkforceInsightsPayload["leave"]> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const t = access.tenantId;
  const [rows] = (await tenantTx(access, [
    sqlClient`select coalesce(b.leave_type, r.leave_type) as leave_type,
                     coalesce(b.balance, 0)::float as balance, coalesce(r.days, 0)::float as approved, coalesce(b.employees, 0)::int as employees
              from (select lb.leave_type, sum(lb.balance) as balance, count(distinct lb.employee_id) as employees
                    from leave_balances lb join employees e on e.tenant_id = lb.tenant_id and e.id = lb.employee_id
                    where lb.tenant_id = ${t} and coalesce(e.status, '') <> all(${SEPARATED}::text[])
                      and (${dept}::text is null or e.department = ${dept})
                    group by 1) b
              full outer join
                   (select lr.leave_type, sum(lr.requested_days) as days
                    from leave_requests lr join employees e on e.tenant_id = lr.tenant_id and e.id = lr.employee_id
                    where lr.tenant_id = ${t} and lr.status = 'approved'
                      and lr.starts_on <= ${window.to}::date and lr.ends_on >= ${window.from}::date
                      and (${dept}::text is null or e.department = ${dept})
                    group by 1) r on r.leave_type = b.leave_type
              order by 1`,
  ])) as [Array<{ leave_type: string; balance: number; approved: number; employees: number }>];
  if (rows.length === 0) return off("no_leave_data");
  const byType = rows.map((row) => ({ leaveType: row.leave_type, balanceDays: num(row.balance), approvedDays: num(row.approved) }));
  return on({
    employees: Math.max(0, ...rows.map((row) => num(row.employees))),
    balanceDays: byType.reduce((sum, row) => sum + row.balanceDays, 0),
    approvedDays: byType.reduce((sum, row) => sum + row.approvedDays, 0),
    byType,
  });
}
