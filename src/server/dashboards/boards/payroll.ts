import "server-only";

import { barPanel, dayLabel, forbidden, humanise, listPanel, num, partsPanel, plural, round, tablePanel, withSource } from "../compose";
import { can, plain, runAll, scoped, type Row, type Scope } from "../query";
import type { Kpi, Panel } from "../types";

type Built = { kpis: Kpi[]; panels: Panel[]; insights: string[]; employeesInScope: number | null };

const rowsOf = (rows: Row[] | null) => rows ?? [];
const major = (minor: unknown) => round(num(minor) / 100, 2);

/* ================================================================== */
/* S5 · Payroll control room                                           */
/* ================================================================== */

export async function payrollBoard(scope: Scope): Promise<Built> {
  const seesRates = can(scope.access, "payroll.rate.read");
  // $1 tenant · $2 timezone
  const data = await runAll(scope.access, {
    runs: plain(scope, `
      select id, period, coalesce(scope, '') as scope, status, coalesce(employee_count, 0)::int as employees,
        coalesce(gross_minor, 0)::bigint as gross, coalesce(deductions_minor, 0)::bigint as deductions, coalesce(net_minor, 0)::bigint as net,
        currency, to_char(finalized_at, 'YYYY-MM-DD') as finalized_on, to_char(created_at, 'YYYY-MM-DD') as created_on
      from payroll_runs where tenant_id = $1::uuid
      order by period desc nulls last, created_at desc limit 24`),
    anomalies: plain(scope, `
      select coalesce(rule_code, 'unclassified') as rule, coalesce(severity, 'unknown') as severity, count(*)::int as value
      from payroll_anomalies where tenant_id = $1::uuid and coalesce(status, 'open') not in ('resolved', 'dismissed', 'closed')
      group by 1, 2 order by 3 desc`),
    statutory: plain(scope, `
      select coalesce(attributes->>'title', attributes->>'form_code', 'Statutory obligation') as title,
        attributes->>'form_code' as form, attributes->>'due_date' as due_date, coalesce(attributes->>'status', 'scheduled') as status
      from compliance_calendar_items, today t
      where tenant_id = $1::uuid and attributes->>'due_date' ~ '^\\d{4}-\\d{2}-\\d{2}'
        and left(attributes->>'due_date', 10)::date between t.d - 7 and t.d + 45
        and coalesce(attributes->>'status', 'scheduled') not in ('filed', 'completed', 'closed')
      order by left(attributes->>'due_date', 10) limit 12`),
    basic: seesRates ? scoped(scope, `
      select coalesce(department, 'Not recorded') as name, coalesce(sum(basic_salary_minor), 0)::bigint as value,
        count(*) filter (where basic_salary_minor is not null)::int as people
      from emp, today t where active and joined_on <= t.d group by 1 order by 2 desc limit 12`) : plain(scope, `select 1 where false`),
  });

  const runs = rowsOf(data.runs);
  const latestFinal = runs.find((row) => ["finalized", "final", "approved", "paid", "locked", "disbursed"].includes(String(row.status).toLowerCase()));
  const latest = latestFinal ?? runs[0];
  const anomalies = rowsOf(data.anomalies);
  const openAnomalies = anomalies.reduce((sum, row) => sum + num(row.value), 0);
  const critical = anomalies.filter((row) => ["critical", "high", "blocker"].includes(String(row.severity).toLowerCase())).reduce((sum, row) => sum + num(row.value), 0);
  const runLabel = latest ? `${latest.period ?? "Latest run"} · ${humanise(String(latest.status))}` : "No payroll run yet";

  const kpis: Kpi[] = [
    { id: "gross", label: "Gross pay", value: latest ? major(latest.gross) : null, format: "money", hint: runLabel, target: "payroll" },
    { id: "net", label: "Net pay", value: latest ? major(latest.net) : null, format: "money", hint: runLabel },
    { id: "deductions", label: "Deductions", value: latest ? major(latest.deductions) : null, format: "money", hint: runLabel },
    { id: "employees", label: "Employees paid", value: latest ? num(latest.employees) : null, format: "count", hint: runLabel },
    { id: "anomalies", label: "Open anomalies", value: data.anomalies ? openAnomalies : null, format: "count", hint: critical ? `${critical} high or critical` : "To clear before lock", tone: openAnomalies ? "attention" : "positive", target: "payroll" },
    { id: "runs", label: "Payroll runs", value: data.runs ? runs.length : null, format: "count", hint: "Most recent 24" },
  ];

  // One bar per period (oldest first); a period with several runs adds them up.
  const byPeriod = new Map<string, { gross: number; net: number }>();
  for (const row of [...runs].reverse()) {
    const key = String(row.period ?? row.created_on ?? "—");
    const entry = byPeriod.get(key) ?? { gross: 0, net: 0 };
    entry.gross += major(row.gross);
    entry.net += major(row.net);
    byPeriod.set(key, entry);
  }
  const periods = [...byPeriod.keys()].slice(-12);
  const byRule = new Map<string, number>();
  for (const row of anomalies) byRule.set(humanise(String(row.rule)), (byRule.get(humanise(String(row.rule))) ?? 0) + num(row.value));
  const rules = [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const bySeverity = new Map<string, number>();
  for (const row of anomalies) bySeverity.set(humanise(String(row.severity)), (bySeverity.get(humanise(String(row.severity))) ?? 0) + num(row.value));
  const basic = rowsOf(data.basic);

  const panels: Panel[] = [
    withSource(data.runs, barPanel(
      { id: "cost", title: "Gross and net pay by period", subtitle: "Last 12 periods with a run", span: 8, format: "money", emptyMessage: "Appears once a payroll run is calculated.", target: "payroll" },
      periods, [{ name: "Gross", data: periods.map((key) => round(byPeriod.get(key)!.gross, 2)) }, { name: "Net", data: periods.map((key) => round(byPeriod.get(key)!.net, 2)) }],
    )),
    withSource(data.anomalies, partsPanel(
      { id: "severity", title: "Open anomalies by severity", span: 4, format: "count", emptyMessage: "No open payroll anomalies.", target: "payroll" },
      [...bySeverity.entries()].map(([name, value]) => ({ name, value })),
    )),
    withSource(data.anomalies, barPanel(
      { id: "rules", title: "Open anomalies by rule", subtitle: "What to clear before lock", span: 6, format: "count", emptyMessage: "No open payroll anomalies." },
      rules.map(([name]) => name).reverse(), [{ name: "Anomalies", data: rules.map(([, value]) => value).reverse() }], true,
    )),
    withSource(data.statutory, listPanel(
      { id: "statutory", title: "Statutory calendar", subtitle: "Due in the next 45 days (and overdue in the last 7)", span: 6, emptyMessage: "Nothing due in the next 45 days.", target: "compliance" },
      rowsOf(data.statutory).map((row) => ({ label: String(row.title), detail: row.form ? String(row.form) : undefined, status: `${dayLabel(String(row.due_date))} · ${humanise(String(row.status))}` })),
    )),
    seesRates
      ? withSource(data.basic, barPanel(
        { id: "basic", title: "Monthly basic pay on record by department", subtitle: "Active employees with a basic salary", span: 6, format: "money", emptyMessage: "No basic salaries are recorded on employee records." },
        basic.map((row) => String(row.name)).reverse(), [{ name: "Basic pay", data: basic.map((row) => major(row.value)).reverse() }], true,
      ))
      : forbidden({ id: "basic", title: "Monthly basic pay on record by department", span: 6, kind: "bar", emptyMessage: "Your role cannot see pay rates." }),
    withSource(data.runs, tablePanel(
      { id: "runs", title: "Payroll runs", span: seesRates ? 6 : 12, emptyMessage: "No payroll runs yet.", target: "payroll" },
      [{ key: "period", label: "Period" }, { key: "status", label: "Status" }, { key: "employees", label: "Employees", format: "count" }, { key: "gross", label: "Gross", format: "money" }, { key: "net", label: "Net", format: "money" }],
      runs.slice(0, 8).map((row) => ({ period: String(row.period ?? "—"), status: humanise(String(row.status)), employees: num(row.employees), gross: major(row.gross), net: major(row.net) })),
    )),
  ];

  const insights: string[] = [];
  if (latest) insights.push(`The ${latestFinal ? "latest finalised" : "latest"} run (${latest.period ?? "unnamed"}) pays ${plural(num(latest.employees), "employee")}.`);
  if (periods.length >= 2) {
    const last = byPeriod.get(periods[periods.length - 1]!)!.gross;
    const previous = byPeriod.get(periods[periods.length - 2]!)!.gross;
    if (previous > 0) insights.push(`Gross pay ${last >= previous ? "rose" : "fell"} ${Math.abs(round(((last - previous) / previous) * 100, 1))}% against the previous period.`);
  }
  if (openAnomalies) insights.push(`${plural(openAnomalies, "anomaly is", "anomalies are")} open${critical ? `, ${critical} of them high or critical` : ""}.`);
  if (rowsOf(data.statutory).length) insights.push(`${plural(rowsOf(data.statutory).length, "statutory obligation is", "statutory obligations are")} due within 45 days.`);

  return { kpis, panels, insights, employeesInScope: null };
}
