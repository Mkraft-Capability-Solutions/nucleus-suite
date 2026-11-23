import "server-only";

import { sqlClient } from "@/lib/db";
import { authorize } from "@/server/identity/authorization";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { getPayslipDetail, listPayslips, type PayslipDetail, type PayslipSummary } from "./payslips";

/**
 * Read model for the payroll workspace overview (PayrollView, "Gross-to-net & EWA" tab).
 *
 * Everything here is the caller's own pay data: the employee linked to the
 * membership, their latest payslip with its stored lines, their payslip history,
 * the next scheduled pay date of an open run, their salary-advance allowance
 * under the rule `requestAdvance` enforces (one month of basic, blocked by any
 * open loan or advance) and their own advance history.
 *
 * Holders of `payroll.read` additionally get the pre-payroll audit summary of the
 * tenant's latest run (open anomalies). Nothing is estimated: a value that has no
 * stored source is returned as null with the reason.
 */

/** Same terminal set `advanceExposure` in src/server/advances/service.ts uses. */
const OPEN_ADVANCE_EXCLUDED = ["recovered", "closed", "rejected", "cancelled"];

export type AdvanceView = {
  id: string;
  amountMinor: number;
  period: string | null;
  reason: string | null;
  status: string;
  requestedAt: string | null;
};

export type AdvanceAllowance =
  | { available: true; limitMinor: number; currency: string }
  | { available: false; reason: "no_basic_salary" | "open_loan" | "open_advance" };

export type RunAudit = {
  runId: string;
  period: string;
  status: string;
  openAnomalies: number;
  totalAnomalies: number;
};

export type PayrollOverview = {
  employee: { id: string; code: string; name: string; currency: string } | null;
  /** Why `employee` is null: the membership has no linked employee record. */
  employeeUnavailableReason: string | null;
  latestPayslip: PayslipDetail | null;
  payslips: PayslipSummary[];
  nextPayDate: string | null;
  advanceAllowance: AdvanceAllowance | null;
  advances: AdvanceView[];
  runAudit: RunAudit | null;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string | null;
  last_name: string | null;
  basic_salary_minor: number | string | null;
  currency: string | null;
};

function toMinor(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** The allowance rule mirrors `requestAdvance` in src/server/advances/service.ts exactly. */
export function advanceAllowanceFor(args: {
  basicMinor: number;
  currency: string;
  hasOpenLoan: boolean;
  hasOpenAdvance: boolean;
}): AdvanceAllowance {
  if (args.basicMinor <= 0) return { available: false, reason: "no_basic_salary" };
  if (args.hasOpenLoan) return { available: false, reason: "open_loan" };
  if (args.hasOpenAdvance) return { available: false, reason: "open_advance" };
  return { available: true, limitMinor: args.basicMinor, currency: args.currency };
}

export function toAdvanceView(row: { id: string; attributes: Record<string, unknown> | null; created_at: string | null }): AdvanceView {
  const attributes = row.attributes ?? {};
  return {
    id: row.id,
    amountMinor: toMinor(attributes.amount_minor),
    period: text(attributes.period),
    reason: text(attributes.reason),
    status: text(attributes.status) ?? "requested",
    requestedAt: row.created_at,
  };
}

async function loadRunAudit(access: Access): Promise<RunAudit | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select r.id, r.period, r.status,
             count(a.id)::int as total,
             count(a.id) filter (where a.status in ('open', 'assigned', 'escalated'))::int as open
      from payroll_runs r
      left join payroll_anomalies a on a.tenant_id = r.tenant_id and a.payroll_run_id = r.id
      where r.tenant_id = ${access.tenantId}
      group by r.id, r.period, r.status, r.created_at
      order by r.period desc, r.created_at desc
      limit 1
    `,
  ]);
  const row = (rows as Array<{ id: string; period: string; status: string; total: number; open: number }>)[0];
  if (!row) return null;
  return { runId: row.id, period: row.period, status: row.status, openAnomalies: row.open, totalAnomalies: row.total };
}

export async function getPayrollOverview(access: Access): Promise<PayrollOverview> {
  const canReadPayroll = authorize(access.context, { action: "payroll.read", resource: { tenantId: access.tenantId } }).allowed;
  // Self data needs no tenant-wide permission (same rule as payslips' "self" scope); the
  // tenant-wide run audit does.
  if (canReadPayroll) enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const runAudit = canReadPayroll ? await loadRunAudit(access) : null;

  const employeeId = access.context.employeeId ?? null;
  const [payDateRows] = await tenantTx(access, [
    sqlClient`
      select min(attributes->>'pay_date') as next_pay_date from payroll_runs
      where tenant_id = ${access.tenantId}
        and status not in ('finalized', 'paid', 'closed', 'cancelled')
        and attributes->>'pay_date' >= to_char(current_date, 'YYYY-MM-DD')
    `,
  ]);
  const nextPayDate = text((payDateRows as Array<{ next_pay_date: string | null }>)[0]?.next_pay_date);

  if (!employeeId) {
    return {
      employee: null,
      employeeUnavailableReason: "This account is not linked to an employee record, so there is no personal pay data to show.",
      latestPayslip: null,
      payslips: [],
      nextPayDate,
      advanceAllowance: null,
      advances: [],
      runAudit,
    };
  }

  const [employeeRows, loanRows, advanceRows] = await tenantTx(access, [
    sqlClient`
      select id, employee_code, first_name, last_name, basic_salary_minor, currency
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1
    `,
    sqlClient`
      select id from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and coalesce(attributes->>'status', 'submitted') not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1
    `,
    sqlClient`
      select id, attributes, created_at from salary_advances
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
      order by created_at desc limit 20
    `,
  ]);
  const employee = (employeeRows as EmployeeRow[])[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The linked employee record was not found." });
  const currency = employee.currency ?? "INR";
  const advances = (advanceRows as Array<{ id: string; attributes: Record<string, unknown> | null; created_at: string | null }>).map(toAdvanceView);
  const advanceAllowance = advanceAllowanceFor({
    basicMinor: toMinor(employee.basic_salary_minor),
    currency,
    hasOpenLoan: (loanRows as unknown[]).length > 0,
    hasOpenAdvance: advances.some((advance) => !OPEN_ADVANCE_EXCLUDED.includes(advance.status)),
  });

  const history = await listPayslips(access, { employeeId, page: 1, pageSize: 12 });
  const latest = history.items[0];
  const latestPayslip = latest ? await getPayslipDetail(access, latest.id) : null;
  const name = [employee.first_name, employee.last_name].filter((part) => text(part) !== null).join(" ");

  return {
    employee: { id: employee.id, code: employee.employee_code, name: name || employee.employee_code, currency },
    employeeUnavailableReason: null,
    latestPayslip,
    payslips: history.items,
    nextPayDate,
    advanceAllowance,
    advances,
    runAudit,
  };
}
