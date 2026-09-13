import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { loanEligibility } from "@/lib/hr-rules";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

// Canonical aggregate: employee_loans carries the workflow in attributes;
// loan_guarantors/schedules/transactions FK to it (RESTRICT). The standalone
// `loans` table is not used by this service.
const TERMINAL_LOAN = ["repaid", "closed", "rejected", "cancelled"];

type LoanRow = {
  id: string;
  employee_id: string;
  status: string;
  principal_minor: number;
  outstanding_minor: number;
  tenure_months: number;
  annual_rate_pct: number;
  director_override: boolean;
};

async function employeeFinancials(access: Access, employeeId: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, basic_salary_minor, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const row = (rows as Array<{ id: string; basic_salary_minor: number | null; joining_date: string }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

async function exposureFlags(access: Access, employeeId: string, excludeLoanId?: string) {
  const loanQuery = excludeLoanId
    ? sqlClient`
      select id from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'status' not in ('repaid','closed','rejected','cancelled') and id != ${excludeLoanId}
      limit 1
    `
    : sqlClient`
      select id from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'status' not in ('repaid','closed','rejected','cancelled')
      limit 1
    `;
  const [loanRows, advanceRows, guaranteeRows] = await tenantTx(access, [
    loanQuery,
    sqlClient`
      select id from salary_advances where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'status' not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1
    `,
    sqlClient`
      select g.id from loan_guarantors g join employee_loans l on l.id = g.employee_loan_id
      where g.tenant_id = ${access.tenantId} and g.guarantor_employee_id = ${employeeId} and g.status = 'approved'
        and l.attributes->>'status' not in ('repaid', 'closed', 'rejected', 'cancelled') limit 1
    `,
  ]);
  return {
    hasOpenLoan: (loanRows as unknown[]).length > 0,
    hasSalaryAdvance: (advanceRows as unknown[]).length > 0,
    isActiveGuarantor: (guaranteeRows as unknown[]).length > 0,
  };
}

function serviceYears(joiningDate: string): number {
  const ms = Date.now() - Date.parse(`${joiningDate}T00:00:00Z`);
  return Math.max(0, ms / (365.25 * 24 * 60 * 60 * 1000));
}

async function ensureLoanProduct(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from loan_products where tenant_id = ${access.tenantId} and attributes->>'code' = 'PERSONAL-STD' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into loan_products (id, tenant_id, attributes) values (${id}, ${access.tenantId}, '{"code":"PERSONAL-STD","name":"Personal Loan","max_tenure_months":84}'::jsonb)`,
  ]);
  return id;
}

function toLoanRow(id: string, employeeId: string, attributes: Record<string, unknown>): LoanRow {
  return {
    id,
    employee_id: employeeId,
    status: String(attributes.status ?? "submitted"),
    principal_minor: Number(attributes.principal_minor ?? 0),
    outstanding_minor: Number(attributes.outstanding_minor ?? 0),
    tenure_months: Number(attributes.tenure_months ?? 12),
    annual_rate_pct: Number(attributes.annual_rate_pct ?? 10),
    director_override: Boolean(attributes.director_override ?? false),
  };
}

export const applyLoanSchema = z.object({
  employeeId: z.string().uuid(),
  principalMinor: z.number().int().positive().max(100_000_000_00),
  tenureMonths: z.number().int().min(1).max(84),
  annualRatePct: z.number().min(0).max(36),
  purpose: z.string().trim().min(1).max(300),
  guarantorEmployeeIds: z.array(z.string().uuid()).min(2).max(3),
});

export async function applyForLoan(access: Access, input: z.infer<typeof applyLoanSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const employee = await employeeFinancials(access, input.employeeId);
  if (!employee.basic_salary_minor || employee.basic_salary_minor <= 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Eligibility needs a positive basic salary on record." });
  }
  const basicMonthly = employee.basic_salary_minor / 100;
  const exposure = await exposureFlags(access, input.employeeId);
  const eligibility = loanEligibility({
    basicSalary: basicMonthly,
    serviceYears: serviceYears(employee.joining_date),
    ...exposure,
  });
  if (!eligibility.eligible) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: eligibility.reasons.join(" ") || "Loan eligibility failed." });
  }
  if (input.principalMinor / 100 > eligibility.maximumAmount) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Principal exceeds the eligible ceiling of ${eligibility.maximumAmount}.` });
  }
  if (new Set(input.guarantorEmployeeIds).size !== input.guarantorEmployeeIds.length) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Guarantors must be distinct employees." });
  }
  if (input.guarantorEmployeeIds.includes(input.employeeId)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The borrower cannot guarantee their own loan." });
  }
  for (const guarantorId of input.guarantorEmployeeIds) {
    await employeeFinancials(access, guarantorId);
    const conflicts = await exposureFlags(access, guarantorId);
    if (conflicts.hasOpenLoan || conflicts.isActiveGuarantor) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "One guarantor has a conflicting loan exposure." });
    }
  }
  const productId = await ensureLoanProduct(access);
  const id = crypto.randomUUID();
  const attributes = {
    status: "submitted",
    principal_minor: input.principalMinor,
    outstanding_minor: input.principalMinor,
    tenure_months: input.tenureMonths,
    annual_rate_pct: input.annualRatePct,
    purpose: input.purpose,
    director_override: false,
  };
  await tenantTx(access, [
    // Financial mirror in the concrete loans ledger (shares the aggregate id
    // so the legacy loan_guarantors.loan_id FK stays satisfied).
    sqlClient`
      insert into loans (id, tenant_id, employee_id, principal_minor, outstanding_minor, status)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.principalMinor}, ${input.principalMinor}, 'submitted')
    `,
    sqlClient`
      insert into employee_loans (id, tenant_id, employee_id, loan_product_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${productId}, ${JSON.stringify(attributes)}::jsonb)
    `,
    ...input.guarantorEmployeeIds.map((guarantorId, index) => sqlClient`
      insert into loan_guarantors (tenant_id, loan_id, guarantor_employee_id, sequence, status, employee_loan_id)
      values (${access.tenantId}, ${id}, ${guarantorId}, ${index + 1}, 'pending', ${id})
    `),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'loan.submit', 'employee_loan', ${id}, 'Loan application submitted',
        ${JSON.stringify({ principalMinor: input.principalMinor, tenureMonths: input.tenureMonths })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted", ceiling: eligibility.maximumAmount };
}

async function loadLoan(access: Access, loanId: string): Promise<LoanRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, attributes from employee_loans where tenant_id = ${access.tenantId} and id = ${loanId} limit 1`,
  ]);
  const row = (rows as Array<{ id: string; employee_id: string; attributes: Record<string, unknown> }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return toLoanRow(row.id, row.employee_id, row.attributes);
}

export async function consentGuarantee(access: Access, loanId: string, approve: boolean, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  if (TERMINAL_LOAN.includes(loan.status) || loan.status === "disbursed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Loan is already ${loan.status}.` });
  }
  const [memberRows] = await tenantTx(access, [
    sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
  ]);
  const actorEmployeeId = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id;
  const [guarantorRows] = await tenantTx(access, [
    sqlClient`select id, guarantor_employee_id, status from loan_guarantors where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by sequence`,
  ]);
  const guarantors = guarantorRows as Array<{ id: string; guarantor_employee_id: string; status: string }>;
  const mine = guarantors.find((guarantor) => guarantor.guarantor_employee_id === actorEmployeeId);
  if (!mine) throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only a named guarantor can record consent." });
  if (mine.status !== "pending") throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Guarantor consent was already recorded." });
  const status = approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`update loan_guarantors set status = ${status} where id = ${mine.id} and tenant_id = ${access.tenantId}`,
    ...(approve
      ? []
      : [
          sqlClient`update employee_loans set attributes = attributes || '{"status":"rejected"}'::jsonb, updated_at = now() where id = ${loanId} and tenant_id = ${access.tenantId}`,
          sqlClient`update loans set status = 'rejected', updated_at = now() where id = ${loanId} and tenant_id = ${access.tenantId}`,
        ]),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`loan.guarantor_${status}`}, 'employee_loan', ${loanId}, 'Guarantor consent recorded', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { loanId, guarantor: mine.id, status };
}

export const approveLoanSchema = z.object({ directorOverride: z.boolean().default(false), overrideReason: z.string().trim().max(500).optional() });

function emiSchedule(principalMinor: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  const emi = r === 0 ? Math.round(principalMinor / months) : Math.round((principalMinor * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
  let balance = principalMinor;
  const installments = [];
  for (let n = 1; n <= months; n += 1) {
    const interest = Math.round(balance * r);
    const principal = n === months ? balance : Math.min(emi - interest, balance);
    balance -= principal;
    installments.push({ n, emi: n === months ? principal + interest : emi, principal, interest, balance });
  }
  return { emi, installments };
}

export async function approveLoan(access: Access, loanId: string, input: z.infer<typeof approveLoanSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  if (loan.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Loan is ${loan.status}; only submitted loans can be approved.` });
  }
  const [guarantorRows] = await tenantTx(access, [
    sqlClient`select status from loan_guarantors where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId}`,
  ]);
  const guarantors = guarantorRows as Array<{ status: string }>;
  const approved = guarantors.filter((guarantor) => guarantor.status === "approved").length;
  const rejected = guarantors.some((guarantor) => guarantor.status === "rejected");
  if (input.directorOverride) {
    if (!input.overrideReason) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A director override requires a recorded reason." });
  } else {
    if (rejected) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "A guarantor rejected; the application cannot proceed." });
    if (approved < 2) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Two guarantor consents are mandatory before approval." });
  }
  const employee = await employeeFinancials(access, loan.employee_id);
  const exposure = await exposureFlags(access, loan.employee_id, loanId);
  const eligibility = loanEligibility({
    basicSalary: (employee.basic_salary_minor ?? 0) / 100,
    serviceYears: serviceYears(employee.joining_date),
    ...exposure,
    directorOverride: input.directorOverride,
  });
  if (!eligibility.eligible) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: eligibility.reasons.join(" ") });
  }
  const { emi, installments } = emiSchedule(loan.principal_minor, loan.annual_rate_pct, loan.tenure_months);
  const scheduleId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`update loans set status = 'approved', approved_at = now(), director_override = ${input.directorOverride}, updated_at = now() where id = ${loanId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update employee_loans set attributes = attributes || ${JSON.stringify({ status: "approved", approved_at: new Date().toISOString(), director_override: input.directorOverride, override_reason: input.overrideReason ?? null })}::jsonb, updated_at = now()
      where id = ${loanId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into loan_schedules (id, tenant_id, employee_loan_id, attributes)
      values (${scheduleId}, ${access.tenantId}, ${loanId},
        ${JSON.stringify({ emi_minor: emi, months: loan.tenure_months, annual_rate_pct: loan.annual_rate_pct, installments, director_override: input.directorOverride })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'loan.approve', 'employee_loan', ${loanId}, ${input.overrideReason ?? "Loan approved"},
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: loanId, status: "approved", emiMinor: emi, scheduleId };
}

export async function disburseLoan(access: Access, loanId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  if (loan.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Only an approved loan can be disbursed (current: ${loan.status}).` });
  }
  await tenantTx(access, [
    sqlClient`update loans set status = 'disbursed', outstanding_minor = principal_minor, updated_at = now() where id = ${loanId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update employee_loans set attributes = attributes || ${JSON.stringify({ status: "disbursed", outstanding_minor: loan.principal_minor })}::jsonb, updated_at = now()
      where id = ${loanId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into loan_transactions (tenant_id, employee_loan_id, attributes)
      values (${access.tenantId}, ${loanId}, ${JSON.stringify({ kind: "disbursement", amount_minor: loan.principal_minor })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'loan.disburse', 'loan', ${loanId}, 'Loan disbursed', ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'loan.disbursed', 'employee_loan', ${loanId},
        ${JSON.stringify({ employeeId: loan.employee_id, principalMinor: loan.principal_minor })}::jsonb)
    `,
  ]);
  return { id: loanId, status: "disbursed" };
}

export const repayLoanSchema = z.object({ amountMinor: z.number().int().positive() });

export async function repayLoan(access: Access, loanId: string, input: z.infer<typeof repayLoanSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  if (loan.status !== "disbursed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Repayments apply only to disbursed loans." });
  }
  if (input.amountMinor > loan.outstanding_minor) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Repayment exceeds the outstanding balance." });
  }
  const remaining = loan.outstanding_minor - input.amountMinor;
  await tenantTx(access, [
    sqlClient`
      update loans set outstanding_minor = ${remaining}, status = ${remaining === 0 ? "repaid" : "disbursed"}, updated_at = now()
      where id = ${loanId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      update employee_loans set attributes = attributes || ${JSON.stringify({ outstanding_minor: remaining, status: remaining === 0 ? "repaid" : "disbursed" })}::jsonb, updated_at = now()
      where id = ${loanId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into loan_transactions (tenant_id, employee_loan_id, attributes)
      values (${access.tenantId}, ${loanId}, ${JSON.stringify({ kind: "repayment", amount_minor: input.amountMinor, remaining_minor: remaining })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'loan.repay', 'loan', ${loanId}, 'Repayment recorded', ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, ${remaining === 0 ? "loan.repaid" : "loan.repayment"}, 'employee_loan', ${loanId},
        ${JSON.stringify({ amountMinor: input.amountMinor, remainingMinor: remaining })}::jsonb)
    `,
  ]);
  return { id: loanId, outstandingMinor: remaining, status: remaining === 0 ? "repaid" : "disbursed" };
}

export async function getLoan(access: Access, loanId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  const [guarantorRows, scheduleRows, txRows] = await tenantTx(access, [
    sqlClient`select id, guarantor_employee_id, sequence, status from loan_guarantors where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by sequence`,
    sqlClient`select id, attributes from loan_schedules where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at desc limit 1`,
    sqlClient`select attributes, created_at from loan_transactions where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at`,
  ]);
  return { loan, guarantors: guarantorRows, schedule: (scheduleRows as Array<{ attributes: unknown }>)[0]?.attributes ?? null, transactions: txRows };
}

export async function listLoans(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const statusFilter = args.status ?? null;
  const employeeFilter = args.employeeId ?? null;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from employee_loans where tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or employee_id = ${args.employeeId})
        and (${statusFilter}::text is null or attributes->>'status' = ${args.status})
    `,
    sqlClient`
      select id, employee_id, attributes from employee_loans where tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or employee_id = ${args.employeeId})
        and (${statusFilter}::text is null or attributes->>'status' = ${args.status})
      order by created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const items = (rows as Array<{ id: string; employee_id: string; attributes: Record<string, unknown> }>).map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    principal_minor: Number(row.attributes.principal_minor ?? 0),
    outstanding_minor: Number(row.attributes.outstanding_minor ?? 0),
    currency: "INR",
    status: String(row.attributes.status ?? "submitted"),
    director_override: Boolean(row.attributes.director_override ?? false),
    approved_at: (row.attributes.approved_at as string | undefined) ?? null,
  }));
  return { items, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}
