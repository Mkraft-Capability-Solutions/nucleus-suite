import type { Section, UnavailableReason, WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";

export const REPORT_METRICS = ["headcount", "compensation", "attendance", "leaves", "mci_capability"] as const;
export type ReportMetric = (typeof REPORT_METRICS)[number];

type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;
export type ReportFormat = {
  number: (value: number, digits?: number) => string;
  pct: (value: number) => string;
  money: (minor: number, currency: string) => string;
  reason: (reason: UnavailableReason) => string;
};

const NS = "components.Workspace.AnalyticsView";

/**
 * Builds the custom report table from the server aggregate only. A section that could not be measured is
 * written as its reason, never as a number. CSV/XLSX writers neutralise formula injection (src/utils/csv.ts).
 */
export function buildReportRows(data: WorkforceInsightsPayload, metric: ReportMetric, t: Translate, f: ReportFormat) {
  const dept = data.window.department ?? t(`${NS}.text_all_departments`, "All Departments");
  const period = `${data.window.from} – ${data.window.to}`;
  const headers = [
    t(`${NS}.col_metric`, "Metric"),
    t(`${NS}.col_department`, "Dimension / Department"),
    t(`${NS}.col_period`, "Period"),
    t(`${NS}.col_value`, "Value"),
    t(`${NS}.col_basis`, "Basis"),
  ];
  const rows: string[][] = [];
  const push = (label: string, value: string, basis: string) => rows.push([label, dept, period, value, basis]);
  const pick = <T,>(section: Section<T>, render: (value: T) => void) => {
    if (section.available) render(section.value);
    else push(t(`${NS}.text_section_unavailable`, "Not available"), f.reason(section.reason), "");
  };
  const maybe = (value: number | null, render: (v: number) => string) => (value === null ? "—" : render(value));

  switch (metric) {
    case "headcount":
      pick(data.people, (p) => {
        push(t(`${NS}.text_active_global_headcount`, "Active Global Headcount"), f.number(p.activeHeadcount), t(`${NS}.basis_roster`, "Employees not separated"));
        push(t(`${NS}.text_diversity_inclusion_index`, "Diversity & Inclusion Index"), maybe(p.diversityIndex, (v) => f.number(v, 1)), t(`${NS}.basis_gender`, "Recorded gender on employee profiles"));
      });
      pick(data.attrition, (a) => {
        push(t(`${NS}.text_annualized_attrition`, "Annualized Attrition"), f.pct(a.annualizedAttrition), t(`${NS}.basis_exits`, "{count} dated exits, trailing 12 months", { count: a.exits }));
        push(t(`${NS}.text_retention_rate`, "Retention Rate"), f.pct(a.retentionRate), t(`${NS}.basis_exits`, "{count} dated exits, trailing 12 months", { count: a.exits }));
      });
      break;
    case "compensation":
      pick(data.payroll, (p) => {
        const basis = t(`${NS}.basis_payroll_run`, "Payroll run {period}", { period: p.period });
        push(t(`${NS}.text_monthly_gross_wage_bill`, "Monthly Gross Wage Bill"), f.money(p.grossMinor, p.currency), basis);
        push(t(`${NS}.text_50_basic_wage_compliance_2026_code`, "50% Basic Wage Compliance (2026 Code)"), maybe(p.basicWageCompliance, f.pct), basis);
        push(t(`${NS}.text_statutory_pf_esi_liability`, "Statutory PF / ESI Liability"), f.money(p.statutoryMinor, p.currency), basis);
        push(t(`${NS}.text_earned_wage_access_ewa_drawdown`, "Earned Wage Access (EWA) Drawdown"), maybe(p.advanceDrawdown, f.pct), basis);
      });
      break;
    case "attendance":
      pick(data.workforce, (w) => {
        const basis = t(`${NS}.basis_attendance`, "{days} scheduled attendance days", { days: w.scheduledDays });
        push(t(`${NS}.text_shift_capacity_utilization`, "Shift Capacity Utilization"), maybe(w.utilization, f.pct), basis);
        push(t(`${NS}.text_unplanned_absenteeism_rate`, "Unplanned Absenteeism Rate"), maybe(w.absenteeism, f.pct), basis);
        push(t(`${NS}.text_avg_overtime_per_employee_period`, "Avg Overtime per Employee (period)"), maybe(w.avgOvertimeHoursPerEmployee, (v) => f.number(v, 1)), basis);
        for (const site of w.sites) {
          push(t(`${NS}.text_site_utilization`, "Utilization · {site}", { site: site.location || "—" }), maybe(site.utilization, f.pct),
            t(`${NS}.basis_site_ot`, "{hours} OT hours", { hours: f.number(site.overtimeHours, 1) }));
        }
      });
      break;
    case "leaves":
      pick(data.leave, (l) => {
        push(t(`${NS}.text_leave_balance_total`, "Leave balance (days)"), f.number(l.balanceDays, 1), t(`${NS}.basis_leave_balances`, "{count} employees with balances", { count: l.employees }));
        push(t(`${NS}.text_leave_approved_days`, "Approved leave in period (days)"), f.number(l.approvedDays, 1), t(`${NS}.basis_leave_requests`, "Approved leave requests overlapping the period"));
        for (const row of l.byType) {
          push(t(`${NS}.text_leave_type_row`, "Leave type {type}", { type: row.leaveType }), f.number(row.balanceDays, 1),
            t(`${NS}.basis_leave_type_taken`, "{days} days approved in period", { days: f.number(row.approvedDays, 1) }));
        }
      });
      break;
    case "mci_capability":
      pick(data.capability, (c) => {
        push(t(`${NS}.text_average_capability_index`, "Average Capability Index (MCI)"), f.number(c.averageIndex, 1), t(`${NS}.basis_mci`, "Latest MCI run for {count} employees", { count: c.employees }));
      });
      break;
    default: {
      const unreachable: never = metric;
      throw new Error(`Unknown report metric ${String(unreachable)}`);
    }
  }
  return { headers, rows };
}
