import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { loanEligibility } from "@/lib/hr-rules";
import { LOAN_PURPOSES, LOAN_PURPOSES_REQUIRING_DOCUMENT } from "@/lib/loan-constants";
import { picklistValues } from "@/lib/picklists";
import { DEFAULT_RULE_PACK_CODE, rulePack } from "@/server/payroll/rule-pack";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import {
  addMonths,
  buildSchedule,
  INTEREST_METHODS,
  MORATORIUM_INTEREST_TREATMENTS,
  requireInterestMethod,
  requireMoratoriumInterest,
  summariseSchedule,
  type Instalment,
  type InterestMethod,
  type MoratoriumInterest,
} from "./schedule";

// Canonical aggregate: employee_loans carries the workflow in attributes;
// loan_guarantors/schedules/transactions FK to it (RESTRICT). The standalone
// `loans` table is not used by this service.
const TERMINAL_LOAN = ["repaid", "closed", "rejected", "cancelled"];

// SCR-080 / FRM-CMB-01 vocabularies live in src/lib/loan-constants.ts so the client
// pages validate against the same list the API enforces. Re-exported for callers
// that already import them from this service.
export { LOAN_PURPOSES, INTEREST_METHODS, MORATORIUM_INTEREST_TREATMENTS };

/**
 * FRM-CMB-01 makes the third guarantor mandatory "above a configured amount".
 * The workbook never states that amount, so it is DECLARED BUT NOT SUPPLIED
 * (the rule-pack precedent in src/server/payroll/rule-pack.ts). While it is
 * null the rule cannot be enforced, and `loanConfigurationGaps()` reports it so
 * the register can say so out loud instead of pretending the control is live.
 */
export const THIRD_GUARANTOR_THRESHOLD_MINOR: number | null =
  rulePack(DEFAULT_RULE_PACK_CODE).loans.thirdGuarantorThresholdMinor;

export type LoanConfigurationGap = { setting: string; issue: string };

export function loanConfigurationGaps(): LoanConfigurationGap[] {
  const gaps: LoanConfigurationGap[] = [];
  if (THIRD_GUARANTOR_THRESHOLD_MINOR === null) {
    gaps.push({
      setting: "thirdGuarantorThresholdMinor",
      issue: "The amount above which a third guarantor is mandatory has no approved value, so that requirement is not enforced.",
    });
  }
  const pack = rulePack(DEFAULT_RULE_PACK_CODE);
  if (pack.loans.netPayFloorPercent === null) {
    gaps.push({
      setting: "netPayFloorPercent",
      issue: "The share of net pay an instalment may not breach has no approved value, so the take-home floor is not enforced.",
    });
  }
  if (pack.loans.tenureMonths === null) {
    gaps.push({
      setting: "tenureMonths",
      issue: "The configured minimum and maximum tenure have no approved values; the schema's 1-84 month bound stands in.",
    });
  }
  if (pack.loans.interestRateByPurpose === null) {
    gaps.push({
      setting: "interestRateByPurpose",
      issue: "No rate per loan purpose is configured, so the applicant's stated rate is taken as given rather than derived.",
    });
  }
  return gaps;
}

type LoanRow = {
  id: string;
  employee_id: string;
  status: string;
  principal_minor: number;
  outstanding_minor: number;
  tenure_months: number;
  annual_rate_pct: number;
  director_override: boolean;
  purpose: string | null;
  interest_method: string | null;
  moratorium_months: number;
  moratorium_interest: string | null;
  repayment_start_month: string | null;
  sanctioned_amount_minor: number | null;
  special_terms: string | null;
  override_reason: string | null;
  approved_at: string | null;
  disbursement_mode: string | null;
  disbursement_date: string | null;
  /** Fixed at sanction; null until then, so a part payment before sanction is not measured against it. */
  instalment_minor: number | null;
  /** FRM-CMB-01 "Rules waived": the controls the sanctioning director set aside, named. */
  rules_waived: string[];
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

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
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
    purpose: optionalString(attributes.purpose),
    interest_method: optionalString(attributes.interest_method),
    moratorium_months: Number(attributes.moratorium_months ?? 0),
    moratorium_interest: optionalString(attributes.moratorium_interest),
    repayment_start_month: optionalString(attributes.repayment_start_month),
    sanctioned_amount_minor: attributes.sanctioned_amount_minor === undefined || attributes.sanctioned_amount_minor === null ? null : Number(attributes.sanctioned_amount_minor),
    special_terms: optionalString(attributes.special_terms),
    override_reason: optionalString(attributes.override_reason),
    approved_at: optionalString(attributes.approved_at),
    disbursement_mode: optionalString(attributes.disbursement_mode),
    disbursement_date: optionalString(attributes.disbursement_date),
    instalment_minor: attributes.instalment_minor === undefined || attributes.instalment_minor === null ? null : Number(attributes.instalment_minor),
    rules_waived: Array.isArray(attributes.rules_waived) ? attributes.rules_waived.filter((value): value is string => typeof value === "string") : [],
  };
}

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month must be YYYY-MM.");

/**
 * FRM-CMB-01. Fields already carried by the original schema (principal, tenure,
 * rate, purpose, guarantors) keep their names; only genuinely absent fields are
 * added. Two notes on what is deliberately NOT here:
 *  - "instalment" is derived, never captured — it is returned by `applyForLoan`.
 *  - "part payment" is already served by POST /api/v1/loans/:id/repay, which
 *    accepts any amount up to the outstanding balance.
 */
export const applyLoanSchema = z
  .object({
    employeeId: z.string().uuid(),
    principalMinor: z.number().int().positive().max(100_000_000_00),
    tenureMonths: z.number().int().min(1).max(84),
    annualRatePct: z.number().min(0).max(36),
    /**
     * One of the configured purposes. Validated by membership rather than
     * `z.enum` so the parsed type stays `string`: the service is called
     * directly (not only through the route) by existing callers that pass a
     * plain string, and narrowing the type would break them at compile time
     * without adding any runtime safety this check does not already give.
     */
    purpose: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .refine((value) => (LOAN_PURPOSES as readonly string[]).includes(value.toLowerCase()), {
        message: `Purpose must be one of the configured values: ${LOAN_PURPOSES.join(", ")}.`,
      }),
    guarantorEmployeeIds: z.array(z.string().uuid()).min(2).max(3),
    /**
     * Commercial term of the loan product. Optional at capture (an application
     * can be taken before the product is settled), but a loan with no method
     * cannot be scheduled: approval fails with LOAN_CONFIGURATION_INCOMPLETE
     * rather than assuming reducing balance.
     */
    interestMethod: z.enum(INTEREST_METHODS).optional(),
    /** FRM-CMB-01 states the 0-6 range itself, so it is not a rule-pack value. */
    moratoriumMonths: z.number().int().min(0).max(6).optional(),
    moratoriumInterest: z.enum(MORATORIUM_INTEREST_TREATMENTS).optional(),
    repaymentStartMonth: monthKey.optional(),
    supportingDocumentId: z.string().uuid().optional(),
    /** FRM-CMB-01 "Disbursement mode" is PL_PAYMENT_MODE. */
    disbursementMode: z.enum(picklistValues("PL_PAYMENT_MODE")).optional(),
    disbursementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date must be YYYY-MM-DD.").optional(),
  })
  .superRefine((value, ctx) => {
    // A moratorium without a stated interest treatment is unschedulable, and the
    // treatment is not ours to pick.
    if ((value.moratoriumMonths ?? 0) > 0 && !value.moratoriumInterest) {
      ctx.addIssue({
        code: "custom",
        path: ["moratoriumInterest"],
        message: "State whether interest accrues or is waived during the moratorium; it has no default.",
      });
    }
    // Repayment cannot start before the money moves.
    if (value.repaymentStartMonth && value.disbursementDate && value.repaymentStartMonth < value.disbursementDate.slice(0, 7)) {
      ctx.addIssue({
        code: "custom",
        path: ["repaymentStartMonth"],
        message: "Repayment cannot start before the month the loan is disbursed.",
      });
    }
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
  if (THIRD_GUARANTOR_THRESHOLD_MINOR !== null && input.principalMinor > THIRD_GUARANTOR_THRESHOLD_MINOR && input.guarantorEmployeeIds.length < 3) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A third guarantor is mandatory above the configured amount." });
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
  const moratoriumMonths = input.moratoriumMonths ?? 0;
  // The indicative instalment, shown on the application. Only computable once a
  // method is recorded; absent one it stays null rather than becoming a guess.
  const preview = input.interestMethod
    ? buildSchedule({
        principalMinor: input.principalMinor,
        annualRatePercent: input.annualRatePct,
        tenureMonths: input.tenureMonths,
        startMonth: input.repaymentStartMonth ?? addMonths(new Date().toISOString().slice(0, 7), 1),
        method: input.interestMethod,
        moratoriumMonths,
        moratoriumInterest: input.moratoriumInterest ?? "waive",
      })
    : null;
  // FRM-CMB-01: an instalment may not push take-home below the net-pay floor. The floor is a
  // percentage nobody has approved, so the check is written and stays inert until it is.
  const netPayFloorPercent = rulePack(DEFAULT_RULE_PACK_CODE).loans.netPayFloorPercent;
  if (netPayFloorPercent !== null && preview) {
    const floorMinor = Math.round(employee.basic_salary_minor * netPayFloorPercent);
    if (employee.basic_salary_minor - preview.instalmentMinor < floorMinor) {
      throw new HttpError({
        status: 422,
        code: "POLICY_VIOLATION",
        message: `The instalment leaves take-home below the floor of ${floorMinor} minor units.`,
      });
    }
  }
  const attributes = {
    status: "submitted",
    principal_minor: input.principalMinor,
    outstanding_minor: input.principalMinor,
    tenure_months: input.tenureMonths,
    annual_rate_pct: input.annualRatePct,
    purpose: input.purpose,
    director_override: false,
    interest_method: input.interestMethod ?? null,
    moratorium_months: moratoriumMonths,
    moratorium_interest: input.moratoriumInterest ?? null,
    repayment_start_month: input.repaymentStartMonth ?? null,
    supporting_document_id: input.supportingDocumentId ?? null,
    disbursement_mode: input.disbursementMode ?? null,
    disbursement_date: input.disbursementDate ?? null,
    indicative_instalment_minor: preview?.instalmentMinor ?? null,
    third_guarantor_threshold_minor: THIRD_GUARANTOR_THRESHOLD_MINOR,
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
        ${JSON.stringify({ principalMinor: input.principalMinor, tenureMonths: input.tenureMonths, purpose: input.purpose, interestMethod: input.interestMethod ?? null })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted", ceiling: eligibility.maximumAmount, indicativeInstalmentMinor: preview?.instalmentMinor ?? null };
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

/**
 * FRM-CMB-01 "Rules waived": the rules a director may set aside at sanction. Named, not implied -
 * a waiver records which control was overridden, so the sanction can be read back years later.
 */
export const WAIVABLE_LOAN_RULES = ["eligibility", "ceiling", "guarantors", "tenure", "net_pay_floor"] as const;

/** FRM-CMB-01 "Waiver reason": minimum 20 characters, director role only. */
export const LOAN_WAIVER_REASON_MIN_LENGTH = 20;

export const approveLoanSchema = z
  .object({
    directorOverride: z.boolean().default(false),
    /** FRM-CMB-01 "rules waived + waiver reason" - director only. */
    overrideReason: z.string().trim().max(300).optional(),
    rulesWaived: z.array(z.enum(WAIVABLE_LOAN_RULES)).max(WAIVABLE_LOAN_RULES.length).optional(),
    /** FRM-CMB-01 sanctioned amount. Defaults to the requested principal. */
    sanctionedAmountMinor: z.number().int().positive().optional(),
    specialTerms: z.string().trim().max(300).optional(),
  })
  .superRefine((value, ctx) => {
    const waiving = value.directorOverride || (value.rulesWaived?.length ?? 0) > 0;
    if (waiving && (value.overrideReason?.length ?? 0) < LOAN_WAIVER_REASON_MIN_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["overrideReason"],
        message: `A waiver reason must be at least ${LOAN_WAIVER_REASON_MIN_LENGTH} characters.`,
      });
    }
    // A waiver that names no rule waives nothing that can be audited.
    if (value.directorOverride && (value.rulesWaived?.length ?? 0) === 0) {
      ctx.addIssue({ code: "custom", path: ["rulesWaived"], message: "Name the rules being waived; an unnamed override cannot be audited." });
    }
  });

/**
 * Resolves the schedule terms recorded on a loan, refusing to invent the two
 * that are not ours to choose.
 */
function scheduleTermsFor(loan: LoanRow, sanctionedMinor: number, approvedAtIso: string) {
  const method: InterestMethod = requireInterestMethod(loan.interest_method, loan.id);
  // With no moratorium the treatment is immaterial — both branches produce an
  // identical table — so only a real moratorium demands a recorded answer.
  const moratoriumInterest: MoratoriumInterest =
    loan.moratorium_months > 0 ? requireMoratoriumInterest(loan.moratorium_interest, loan.id) : "waive";
  const recordedStart = loan.repayment_start_month;
  // Absent a recorded repayment start month, the clock starts the month after
  // sanction. That fallback is recorded on the schedule so it is never mistaken
  // for an instruction from the applicant.
  const startMonth = recordedStart ?? addMonths(approvedAtIso.slice(0, 7), 1);
  return {
    method,
    moratoriumInterest,
    startMonth,
    startMonthSource: recordedStart ? ("recorded" as const) : ("derived_from_approval" as const),
    schedule: buildSchedule({
      principalMinor: sanctionedMinor,
      annualRatePercent: loan.annual_rate_pct,
      tenureMonths: loan.tenure_months,
      startMonth,
      method,
      moratoriumMonths: loan.moratorium_months,
      moratoriumInterest,
    }),
  };
}

/**
 * Approval is where the schedule is fixed: sanction settles the amount, tenure,
 * rate and method, so the instalment table is the sanction's own output and
 * belongs on the sanction letter, before any money moves. Disbursement only
 * moves cash against terms already agreed here, and `getLoan` has always read
 * the schedule from this point in the flow.
 */
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
  const sanctionedMinor = input.sanctionedAmountMinor ?? loan.principal_minor;
  if (sanctionedMinor > loan.principal_minor) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The sanctioned amount cannot exceed the amount applied for." });
  }
  // FRM-CMB-01: the ceiling may be exceeded only when the sanction names "ceiling" among the
  // rules it waives, so an over-ceiling sanction always carries its own justification.
  if (sanctionedMinor / 100 > eligibility.maximumAmount && !(input.rulesWaived ?? []).includes("ceiling")) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Sanctioned amount exceeds the eligible ceiling of ${eligibility.maximumAmount}.` });
  }
  const approvedAt = new Date().toISOString();
  const terms = scheduleTermsFor(loan, sanctionedMinor, approvedAt);
  const scheduleId = crypto.randomUUID();
  const scheduleAttributes = {
    method: terms.schedule.method,
    months: terms.schedule.tenureMonths,
    annual_rate_pct: terms.schedule.annualRatePercent,
    start_month: terms.startMonth,
    start_month_source: terms.startMonthSource,
    moratorium_months: terms.schedule.moratoriumMonths,
    moratorium_interest: terms.schedule.moratoriumInterest,
    principal_minor: terms.schedule.principalMinor,
    amortised_principal_minor: terms.schedule.amortisedPrincipalMinor,
    instalment_minor: terms.schedule.instalmentMinor,
    total_interest_minor: terms.schedule.totalInterestMinor,
    total_payable_minor: terms.schedule.totalPayableMinor,
    instalments: terms.schedule.instalments,
    director_override: input.directorOverride,
    rules_waived: input.rulesWaived ?? [],
  };
  await tenantTx(access, [
    sqlClient`update loans set status = 'approved', principal_minor = ${sanctionedMinor}, outstanding_minor = ${sanctionedMinor}, approved_at = now(), director_override = ${input.directorOverride}, updated_at = now() where id = ${loanId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update employee_loans set attributes = attributes || ${JSON.stringify({
        status: "approved",
        approved_at: approvedAt,
        director_override: input.directorOverride,
        override_reason: input.overrideReason ?? null,
        rules_waived: input.rulesWaived ?? [],
        sanctioned_amount_minor: sanctionedMinor,
        principal_minor: sanctionedMinor,
        outstanding_minor: sanctionedMinor,
        special_terms: input.specialTerms ?? null,
        repayment_start_month: terms.startMonth,
        instalment_minor: terms.schedule.instalmentMinor,
      })}::jsonb, updated_at = now()
      where id = ${loanId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into loan_schedules (id, tenant_id, employee_loan_id, attributes)
      values (${scheduleId}, ${access.tenantId}, ${loanId}, ${JSON.stringify(scheduleAttributes)}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'loan.approve', 'employee_loan', ${loanId}, ${input.overrideReason ?? "Loan approved"},
        ${JSON.stringify({ sanctionedAmountMinor: sanctionedMinor, method: terms.schedule.method, instalmentMinor: terms.schedule.instalmentMinor, scheduleId })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return {
    id: loanId,
    status: "approved",
    emiMinor: terms.schedule.instalmentMinor,
    instalmentMinor: terms.schedule.instalmentMinor,
    sanctionedAmountMinor: sanctionedMinor,
    method: terms.schedule.method,
    scheduleId,
  };
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
      values (${access.tenantId}, ${loanId}, ${JSON.stringify({ kind: "disbursement", amount_minor: loan.principal_minor, mode: loan.disbursement_mode, value_date: loan.disbursement_date })}::jsonb)
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

/**
 * FRM-CMB-01 "Part payment": at least one instalment. Anything smaller is a partial instalment,
 * which the amortisation table has no row for - the schedule is regenerated, never patched.
 */
export function assertPartPaymentSize(amountMinor: number, instalmentMinor: number | null, outstandingMinor: number): void {
  if (instalmentMinor === null || amountMinor >= outstandingMinor) return;
  if (amountMinor < instalmentMinor) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `A part payment must be at least one instalment (${instalmentMinor} minor units), or settle the balance in full.`,
    });
  }
}

export async function repayLoan(access: Access, loanId: string, input: z.infer<typeof repayLoanSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  if (loan.status !== "disbursed") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Repayments apply only to disbursed loans." });
  }
  if (input.amountMinor > loan.outstanding_minor) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Repayment exceeds the outstanding balance." });
  }
  assertPartPaymentSize(input.amountMinor, loan.instalment_minor, loan.outstanding_minor);
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

type LoanTransactionRow = { attributes: Record<string, unknown>; created_at: string };

/** Everything already recovered against the loan: voluntary repayments and payroll recoveries. */
function recoveredMinor(transactions: LoanTransactionRow[]): number {
  return transactions.reduce((sum, row) => {
    const kind = String(row.attributes.kind ?? "");
    if (kind !== "repayment" && kind !== "recovery") return sum;
    const amount = Number(row.attributes.amount_minor ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

async function currentEligibility(access: Access, loan: LoanRow) {
  const employee = await employeeFinancials(access, loan.employee_id);
  const exposure = await exposureFlags(access, loan.employee_id, loan.id);
  const basicSalary = (employee.basic_salary_minor ?? 0) / 100;
  if (basicSalary <= 0) {
    return {
      eligible: false,
      requiresDirectorOverride: true,
      reasons: ["Eligibility needs a positive basic salary on record."],
      maximumAmount: 0,
      mandatoryGuarantors: 2,
      optionalThirdGuarantor: true,
    };
  }
  return loanEligibility({
    basicSalary,
    serviceYears: serviceYears(employee.joining_date),
    ...exposure,
    directorOverride: loan.director_override,
  });
}

export async function getLoan(access: Access, loanId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  const [guarantorRows, scheduleRows, txRows, auditRows] = await tenantTx(access, [
    sqlClient`select id, guarantor_employee_id, sequence, status from loan_guarantors where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by sequence`,
    sqlClient`select id, attributes from loan_schedules where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at desc limit 1`,
    sqlClient`select attributes, created_at from loan_transactions where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at`,
    sqlClient`
      select action, reason, created_at from audit_events
      where tenant_id = ${access.tenantId} and entity_id = ${loanId} and entity_type in ('employee_loan', 'loan')
      order by created_at
    `,
  ]);
  const transactions = txRows as LoanTransactionRow[];
  return {
    loan,
    guarantors: guarantorRows,
    schedule: (scheduleRows as Array<{ attributes: unknown }>)[0]?.attributes ?? null,
    transactions,
    eligibility: await currentEligibility(access, loan),
    auditTrail: auditRows,
    recoveredMinor: recoveredMinor(transactions),
    configurationGaps: loanConfigurationGaps(),
  };
}

/**
 * SCR-080 — the persisted instalment table plus derived progress. Reads the
 * schedule written at approval; it is never regenerated here, so what the
 * borrower was sanctioned is what they are shown.
 */
export async function getLoanSchedule(access: Access, loanId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const loan = await loadLoan(access, loanId);
  const [scheduleRows, txRows] = await tenantTx(access, [
    sqlClient`select id, attributes, created_at from loan_schedules where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at desc limit 1`,
    sqlClient`select attributes, created_at from loan_transactions where tenant_id = ${access.tenantId} and employee_loan_id = ${loanId} order by created_at`,
  ]);
  const row = (scheduleRows as Array<{ id: string; attributes: Record<string, unknown>; created_at: string }>)[0];
  if (!row) {
    throw new HttpError({
      status: 404,
      code: "NOT_FOUND",
      message: `Loan ${loanId} has no repayment schedule. A schedule is generated when the loan is approved.`,
    });
  }
  const instalments = Array.isArray(row.attributes.instalments) ? (row.attributes.instalments as Instalment[]) : [];
  const paidToDateMinor = recoveredMinor(txRows as LoanTransactionRow[]);
  const summary = summariseSchedule(instalments, paidToDateMinor);
  return {
    loanId,
    scheduleId: row.id,
    status: loan.status,
    generatedAt: row.created_at,
    method: String(row.attributes.method ?? ""),
    annualRatePct: Number(row.attributes.annual_rate_pct ?? loan.annual_rate_pct),
    startMonth: String(row.attributes.start_month ?? ""),
    startMonthSource: String(row.attributes.start_month_source ?? "recorded"),
    moratoriumMonths: Number(row.attributes.moratorium_months ?? 0),
    moratoriumInterest: row.attributes.moratorium_interest ?? null,
    principalMinor: Number(row.attributes.principal_minor ?? loan.principal_minor),
    amortisedPrincipalMinor: Number(row.attributes.amortised_principal_minor ?? row.attributes.principal_minor ?? loan.principal_minor),
    instalmentMinor: Number(row.attributes.instalment_minor ?? 0),
    totalInterestMinor: Number(row.attributes.total_interest_minor ?? 0),
    totalPayableMinor: Number(row.attributes.total_payable_minor ?? 0),
    instalments,
    summary: {
      instalmentCount: summary.instalmentCount,
      paidToDateMinor: summary.paidToDateMinor,
      outstandingMinor: summary.outstandingMinor,
      instalmentsRemaining: summary.instalmentsRemaining,
      nextDue: summary.nextDue,
      /** The loan ledger's own outstanding, which payroll recovery drives. */
      ledgerOutstandingMinor: loan.outstanding_minor,
    },
  };
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
    purpose: optionalString(row.attributes.purpose),
    interest_method: optionalString(row.attributes.interest_method),
  }));
  return { items, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}
