import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { loanEligibility } from "@/lib/hr-rules";
import { enforce, tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

/**
 * Company loan register for the payroll workspace (Loans tab).
 *
 * `GET /api/v1/loans` returns the bare ledger row. The workspace needs the
 * borrower, the guarantors, the instalment and the recoveries so far, and the
 * guarantor lock list. The lock rule is the one `applyForLoan` enforces through
 * `exposureFlags`: a guarantor who has approved a guarantee on a loan that is not
 * terminal cannot borrow or guarantee again.
 *
 * Eligibility is evaluated with the same `loanEligibility` rule the service uses,
 * on the server, so the client never sees a basic salary it may not read; it sees
 * only the ceiling and the reasons.
 */

const TERMINAL = ["repaid", "closed", "rejected", "cancelled"];

export type LoanGuarantorView = { employeeId: string; name: string; code: string; status: string; sequence: number };

export type LoanRegisterRow = {
  id: string;
  employeeId: string;
  borrowerName: string;
  borrowerCode: string;
  department: string | null;
  designation: string | null;
  status: string;
  currency: string;
  principalMinor: number;
  outstandingMinor: number;
  instalmentMinor: number | null;
  tenureMonths: number | null;
  recoveredInstalments: number;
  purpose: string | null;
  guarantors: LoanGuarantorView[];
};

export type GuarantorLock = {
  guarantorEmployeeId: string;
  guarantorName: string;
  guarantorCode: string;
  loanId: string;
  borrowerName: string;
  outstandingMinor: number;
  currency: string;
};

type LoanRow = {
  id: string;
  employee_id: string;
  attributes: Record<string, unknown> | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  department: string | null;
  designation: string | null;
  currency: string | null;
  recoveries: number | string | null;
};

type GuarantorRow = {
  employee_loan_id: string;
  guarantor_employee_id: string;
  sequence: number;
  status: string;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
};

function personName(first: string | null, last: string | null, code: string | null): string {
  const name = [first, last].filter((part) => typeof part === "string" && part.trim().length > 0).join(" ").trim();
  return name || code || "—";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function isTerminalLoan(status: string): boolean {
  return TERMINAL.includes(status);
}

/** Pure: assemble register rows and derive the guarantor locks. */
export function buildLoanRegister(loans: readonly LoanRow[], guarantors: readonly GuarantorRow[]): { items: LoanRegisterRow[]; locks: GuarantorLock[] } {
  const byLoan = new Map<string, LoanGuarantorView[]>();
  for (const row of guarantors) {
    const list = byLoan.get(row.employee_loan_id) ?? [];
    list.push({
      employeeId: row.guarantor_employee_id,
      name: personName(row.first_name, row.last_name, row.employee_code),
      code: row.employee_code ?? "—",
      status: row.status,
      sequence: row.sequence,
    });
    byLoan.set(row.employee_loan_id, list);
  }
  const items: LoanRegisterRow[] = loans.map((loan) => {
    const attributes = loan.attributes ?? {};
    return {
      id: loan.id,
      employeeId: loan.employee_id,
      borrowerName: personName(loan.first_name, loan.last_name, loan.employee_code),
      borrowerCode: loan.employee_code ?? "—",
      department: loan.department,
      designation: loan.designation,
      status: String(attributes.status ?? "submitted"),
      currency: loan.currency ?? "INR",
      principalMinor: numberOrNull(attributes.principal_minor) ?? 0,
      outstandingMinor: numberOrNull(attributes.outstanding_minor) ?? 0,
      instalmentMinor: numberOrNull(attributes.instalment_minor) ?? numberOrNull(attributes.indicative_instalment_minor),
      tenureMonths: numberOrNull(attributes.tenure_months),
      recoveredInstalments: numberOrNull(loan.recoveries) ?? 0,
      purpose: typeof attributes.purpose === "string" ? attributes.purpose : null,
      guarantors: (byLoan.get(loan.id) ?? []).sort((left, right) => left.sequence - right.sequence),
    };
  });
  const locks: GuarantorLock[] = [];
  for (const loan of items) {
    if (isTerminalLoan(loan.status)) continue;
    for (const guarantor of loan.guarantors) {
      if (guarantor.status !== "approved") continue;
      locks.push({
        guarantorEmployeeId: guarantor.employeeId,
        guarantorName: guarantor.name,
        guarantorCode: guarantor.code,
        loanId: loan.id,
        borrowerName: loan.borrowerName,
        outstandingMinor: loan.outstandingMinor,
        currency: loan.currency,
      });
    }
  }
  return { items, locks };
}

export async function listLoanRegister(access: Access, args: { page: number; pageSize: number }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, loanRows] = await tenantTx(access, [
    sqlClient`select count(*)::int as total from employee_loans where tenant_id = ${access.tenantId}`,
    sqlClient`
      select l.id, l.employee_id, l.attributes, e.employee_code, e.first_name, e.last_name, e.department, e.designation, e.currency,
             (select count(*)::int from loan_transactions t
               where t.tenant_id = l.tenant_id and t.employee_loan_id = l.id
                 and t.attributes->>'kind' in ('repayment', 'recovery')) as recoveries
      from employee_loans l
      left join employees e on e.tenant_id = l.tenant_id and e.id = l.employee_id
      where l.tenant_id = ${access.tenantId}
      order by l.created_at desc, l.id
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const loans = loanRows as LoanRow[];
  const ids = loans.map((loan) => loan.id);
  // Locks span every open loan, not only the visible page.
  const [guarantorRows, lockRows] = await tenantTx(access, [
    ids.length === 0
      ? sqlClient`select null::uuid as employee_loan_id where false`
      : sqlClient`
          select g.employee_loan_id, g.guarantor_employee_id, g.sequence, g.status, e.employee_code, e.first_name, e.last_name
          from loan_guarantors g
          left join employees e on e.tenant_id = g.tenant_id and e.id = g.guarantor_employee_id
          where g.tenant_id = ${access.tenantId} and g.employee_loan_id = any(${ids}::uuid[])
        `,
    sqlClient`
      select l.id, l.employee_id, l.attributes, b.employee_code, b.first_name, b.last_name, b.department, b.designation, b.currency, 0 as recoveries,
             g.guarantor_employee_id, g.sequence, g.status as guarantor_status, ge.employee_code as g_code, ge.first_name as g_first, ge.last_name as g_last
      from loan_guarantors g
      join employee_loans l on l.tenant_id = g.tenant_id and l.id = g.employee_loan_id
      left join employees b on b.tenant_id = l.tenant_id and b.id = l.employee_id
      left join employees ge on ge.tenant_id = g.tenant_id and ge.id = g.guarantor_employee_id
      where g.tenant_id = ${access.tenantId} and g.status = 'approved'
        and coalesce(l.attributes->>'status', 'submitted') not in ('repaid', 'closed', 'rejected', 'cancelled')
      limit 500
    `,
  ]);
  const register = buildLoanRegister(loans, guarantorRows as GuarantorRow[]);
  const lockSource = lockRows as Array<LoanRow & { guarantor_employee_id: string; sequence: number; guarantor_status: string; g_code: string | null; g_first: string | null; g_last: string | null }>;
  const { locks } = buildLoanRegister(
    lockSource,
    lockSource.map((row) => ({
      employee_loan_id: row.id,
      guarantor_employee_id: row.guarantor_employee_id,
      sequence: row.sequence,
      status: row.guarantor_status,
      employee_code: row.g_code,
      first_name: row.g_first,
      last_name: row.g_last,
    })),
  );
  const uniqueLocks = locks.filter((lock, index) => locks.findIndex((other) => other.loanId === lock.loanId && other.guarantorEmployeeId === lock.guarantorEmployeeId) === index);
  return { items: register.items, locks: uniqueLocks, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export const loanEligibilityQuerySchema = z.object({ employeeId: z.string().uuid() });

export type LoanEligibilityView = {
  employeeId: string;
  eligible: boolean;
  requiresDirectorOverride: boolean;
  reasons: string[];
  ceilingMinor: number | null;
  currency: string;
  serviceYears: number;
};

/** Eligibility preview for the application form; the POST re-checks everything authoritatively. */
export async function getLoanEligibility(access: Access, employeeId: string): Promise<LoanEligibilityView> {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const [employeeRows, loanRows, advanceRows, guaranteeRows] = await tenantTx(access, [
    sqlClient`select id, basic_salary_minor, currency, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
    sqlClient`select id from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and coalesce(attributes->>'status', 'submitted') not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1`,
    sqlClient`select id from salary_advances where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and coalesce(attributes->>'status', 'requested') not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1`,
    sqlClient`
      select g.id from loan_guarantors g join employee_loans l on l.id = g.employee_loan_id and l.tenant_id = g.tenant_id
      where g.tenant_id = ${access.tenantId} and g.guarantor_employee_id = ${employeeId} and g.status = 'approved'
        and coalesce(l.attributes->>'status', 'submitted') not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1
    `,
  ]);
  const employee = (employeeRows as Array<{ id: string; basic_salary_minor: number | string | null; currency: string | null; joining_date: string }>)[0];
  if (!employee) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const basicMinor = numberOrNull(employee.basic_salary_minor) ?? 0;
  const serviceYears = Math.max(0, (Date.now() - Date.parse(`${employee.joining_date}T00:00:00Z`)) / (365.25 * 24 * 60 * 60 * 1000));
  const currency = employee.currency ?? "INR";
  if (basicMinor <= 0) {
    return { employeeId, eligible: false, requiresDirectorOverride: false, reasons: ["Eligibility needs a positive basic salary on record."], ceilingMinor: null, currency, serviceYears };
  }
  const result = loanEligibility({
    basicSalary: basicMinor / 100,
    serviceYears,
    hasOpenLoan: (loanRows as unknown[]).length > 0,
    hasSalaryAdvance: (advanceRows as unknown[]).length > 0,
    isActiveGuarantor: (guaranteeRows as unknown[]).length > 0,
  });
  return {
    employeeId,
    eligible: result.eligible,
    requiresDirectorOverride: result.requiresDirectorOverride,
    reasons: result.reasons,
    ceilingMinor: Math.round(result.maximumAmount * 100),
    currency,
    serviceYears: Math.round(serviceYears * 10) / 10,
  };
}
