import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { TERMINAL_ADVANCE_STATUSES } from "./status";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { ensureComponent, ensurePayrollScaffold } from "@/server/payroll/service";
import { DEFAULT_RULE_PACK_CODE, rulePack } from "@/server/payroll/rule-pack";
import { HttpError } from "@/server/platform/http";

async function employeeBasic(access: Access, employeeId: string): Promise<{ basic: number; joining: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select basic_salary_minor, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const row = (rows as Array<{ basic_salary_minor: number | string | null; joining_date: string }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return { basic: Number(row.basic_salary_minor ?? 0), joining: row.joining_date };
}

async function advanceExposure(access: Access, employeeId: string): Promise<void> {
  const [loanRows, advanceRows] = await tenantTx(access, [
    sqlClient`
      select id from employee_loans where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'status' not in ('repaid','closed','rejected','cancelled') limit 1
    `,
    sqlClient`
      select id from salary_advances where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attributes->>'status' not in (select jsonb_array_elements_text(${JSON.stringify(TERMINAL_ADVANCE_STATUSES)}::jsonb)) limit 1
    `,
  ]);
  if ((loanRows as unknown[]).length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An open loan blocks any salary advance." });
  }
  if ((advanceRows as unknown[]).length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An open advance blocks another until recovery." });
  }
}

/** The period after a YYYY-MM period. FRM-CMB-02 allows recovery in the current or the next one. */
function nextPeriod(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** The YYYY-MM period containing `now`, in UTC, as the payroll calendar records it. */
function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** FRM-CMB-02 "Recovery month": the current period or the next one, and nothing else. */
export function isRecoveryPeriodAllowed(period: string, now: Date = new Date()): boolean {
  const current = currentPeriod(now);
  return period === current || period === nextPeriod(current);
}

export const requestAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  /** FRM-CMB-02 "Recovery month". Kept as `period` - the same field the payroll input is filed under. */
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().trim().min(10).max(200),
  /** FRM-CMB-02 "Number of instalments": the workbook states the 1-3 range itself. */
  instalments: z.number().int().min(1).max(3).default(1),
});

/**
 * FRM-CMB-02 context panel: the earned-to-date ceiling and this year's advance count.
 *
 * `earnedToDateMinor` is null until the rule pack supplies a proration basis - the earned wage
 * cannot be derived from attendance without one, and the workbook never states it. The count is
 * always available; `annualCap` is null until the rule pack names the cap the workbook only
 * says is "enforced".
 */
export async function advanceContext(
  access: Access,
  employeeId: string,
  now: Date = new Date(),
): Promise<{ earnedToDateMinor: number | null; advancesYtd: number; annualCap: number | null }> {
  const pack = rulePack(DEFAULT_RULE_PACK_CODE);
  const yearStart = `${now.getUTCFullYear()}-01-01`;
  const [countRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as taken from salary_advances
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and created_at >= ${yearStart}::date
        and coalesce(attributes->>'status', '') not in ('rejected', 'cancelled')
    `,
  ]);
  return {
    earnedToDateMinor: pack.advances.earnedWageProrationBasis === null ? null : await earnedToDate(access, employeeId, now),
    advancesYtd: Number((countRows as Array<{ taken: number }>)[0]?.taken ?? 0),
    annualCap: pack.advances.maxInstancesPerYear,
  };
}

/**
 * Earned wage so far this period: monthly basic prorated on the basis the rule pack names,
 * counting only locked attendance days so the ceiling cannot move after the fact. Called only
 * once a basis exists, so no default is ever applied here.
 */
async function earnedToDate(access: Access, employeeId: string, now: Date): Promise<number> {
  const pack = rulePack(DEFAULT_RULE_PACK_CODE);
  const basis = pack.advances.earnedWageProrationBasis;
  const period = currentPeriod(now);
  const { basic } = await employeeBasic(access, employeeId);
  const [dayRows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total,
             count(*) filter (where status in ('present', 'on_duty', 'work_from_home'))::int as worked,
             count(*) filter (where status not in ('weekly_off', 'holiday', 'not_scheduled'))::int as scheduled
      from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and attendance_date::text like ${`${period}%`} and locked_at is not null
    `,
  ]);
  const days = (dayRows as Array<{ total: number; worked: number; scheduled: number }>)[0] ?? { total: 0, worked: 0, scheduled: 0 };
  const calendarDays = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const numerator = basis === "calendar_days" ? Number(days.total) : basis === "working_days" ? Number(days.scheduled) : Number(days.worked);
  return Math.round((basic * numerator) / calendarDays);
}

export async function requestAdvance(access: Access, input: z.infer<typeof requestAdvanceSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const { basic } = await employeeBasic(access, input.employeeId);
  if (basic <= 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Advances need a positive basic salary on record." });
  }
  if (!isRecoveryPeriodAllowed(input.period)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Recovery must fall in the current or the next payroll period." });
  }
  const context = await advanceContext(access, input.employeeId);
  // The workbook's ceiling is the earned wage; Nucleus's existing ceiling of one month of basic
  // stands in until the rule pack supplies a proration basis, and is never relaxed by it.
  const ceiling = context.earnedToDateMinor === null ? basic : Math.min(basic, context.earnedToDateMinor);
  if (input.amountMinor > ceiling) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: context.earnedToDateMinor === null
        ? "Advances are capped at one month of basic salary."
        : "The advance exceeds the wage earned to date this period.",
    });
  }
  if (context.annualCap !== null && context.advancesYtd >= context.annualCap) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The annual limit of ${context.annualCap} advances is already used.` });
  }
  await advanceExposure(access, input.employeeId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into salary_advances (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({
          amount_minor: input.amountMinor,
          period: input.period,
          reason: input.reason,
          instalments: input.instalments,
          status: "requested",
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'advance.request', 'salary_advance', ${id}, 'Salary advance requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "requested" };
}

async function loadAdvance(access: Access, advanceId: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, payroll_input_id, attributes from salary_advances where tenant_id = ${access.tenantId} and id = ${advanceId} limit 1`,
  ]);
  const advance = (rows as Array<{ id: string; employee_id: string; payroll_input_id: string | null; attributes: { status: string; amount_minor: number; period: string; reason: string } }>)[0];
  if (!advance) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return advance;
}

/** FRM-CMB-02 "Approver / decision / remarks" (PL_DECISION). Remarks are mandatory on anything but an approval. */
export const decideAdvanceSchema = z
  .object({
    decision: z.enum(picklistValues("PL_DECISION")),
    remarks: z.string().trim().min(1).max(300).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== "approve" && !value.remarks) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["remarks"], message: "A reason is required on anything but an approval." });
    }
  });

/** The status each decision leaves on the advance. A delegated decision is still pending. */
const DECISION_STATUS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  return_for_correction: "returned",
  delegate: "requested",
};

export async function decideAdvance(
  access: Access,
  advanceId: string,
  input: z.infer<typeof decideAdvanceSchema>,
  requestId: string,
) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const advance = await loadAdvance(access, advanceId);
  if (advance.attributes.status !== "requested" && advance.attributes.status !== "returned") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Advance is ${advance.attributes.status}.` });
  }
  const status = DECISION_STATUS[input.decision] ?? "requested";
  const decided = {
    status,
    decision: input.decision,
    decision_remarks: input.remarks ?? null,
    approver_id: access.context.actorUserId,
  };
  await tenantTx(access, [
    sqlClient`update salary_advances set attributes = attributes || ${JSON.stringify(decided)}::jsonb where id = ${advanceId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`advance.${input.decision}`}, 'salary_advance', ${advanceId}, ${input.remarks ?? `Advance ${input.decision}`}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: advanceId, status, decision: input.decision };
}

/**
 * FRM-CMB-02 "Disbursement run / recovery run". Both must be open: an advance may not be filed
 * against a run whose figures are already fixed. When omitted, the advance's own recovery period
 * supplies both, which is what the form's "next open run" default means here.
 */
export const payAdvanceSchema = z.object({
  disbursementRunId: z.string().uuid().optional(),
  recoveryRunId: z.string().uuid().optional(),
});

/** Resolves one named run, insisting it is still mutable. */
async function requireOpenRun(access: Access, runId: string, label: string): Promise<{ id: string; period: string }> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, period, status from payroll_runs where tenant_id = ${access.tenantId} and id = ${runId} limit 1`,
  ]);
  const run = (rows as Array<{ id: string; period: string; status: string }>)[0];
  if (!run) throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The ${label} run was not found in this tenant.` });
  if (run.status === "finalized" || run.status === "paid" || run.status === "closed") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `The ${label} run is ${run.status} and can take no further inputs.` });
  }
  return { id: run.id, period: run.period };
}

export async function payAdvance(
  access: Access,
  advanceId: string,
  input: z.infer<typeof payAdvanceSchema>,
  requestId: string,
) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const advance = await loadAdvance(access, advanceId);
  if (advance.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only approved advances can be paid." });
  }
  const disbursementRun = input.disbursementRunId ? await requireOpenRun(access, input.disbursementRunId, "disbursement") : null;
  const recoveryRun = input.recoveryRunId ? await requireOpenRun(access, input.recoveryRunId, "recovery") : null;
  if (recoveryRun && recoveryRun.period !== advance.attributes.period) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The recovery run belongs to a different period from the advance's recovery month." });
  }
  const scaffold = await ensurePayrollScaffold(access, advance.attributes.period);
  const paidComponentId = await ensureComponent(access, "advance_paid", "earning");
  const recoveryComponentId = await ensureComponent(access, "advance_recovery", "deduction");
  const paidInputId = crypto.randomUUID();
  const recoveryInputId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      values (${paidInputId}, ${access.tenantId}, ${advance.employee_id}, ${paidComponentId}, ${scaffold.payPeriodId},
        ${JSON.stringify({ amount_minor: Number(advance.attributes.amount_minor), component: "advance_paid", advance_id: advanceId })}::jsonb)
    `,
    sqlClient`
      insert into payroll_inputs (id, tenant_id, employee_id, pay_component_id, pay_period_id, attributes)
      values (${recoveryInputId}, ${access.tenantId}, ${advance.employee_id}, ${recoveryComponentId}, ${scaffold.payPeriodId},
        ${JSON.stringify({ amount_minor: Number(advance.attributes.amount_minor), component: "advance_recovery", advance_id: advanceId })}::jsonb)
    `,
    sqlClient`
      update salary_advances set payroll_input_id = ${recoveryInputId},
        attributes = attributes || ${JSON.stringify({
          status: "paid",
          disbursement_run_id: disbursementRun?.id ?? null,
          recovery_run_id: recoveryRun?.id ?? null,
        })}::jsonb
      where id = ${advanceId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'advance.pay', 'salary_advance', ${advanceId}, 'Advance paid with recovery scheduled', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: advanceId, status: "paid", recoveryInputId, disbursementRunId: disbursementRun?.id ?? null, recoveryRunId: recoveryRun?.id ?? null };
}

export async function listAdvances(access: Access, args: { employeeId?: string | null; status?: string | null }) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  const employeeFilter = args.employeeId ?? null;
  const statusFilter = args.status ?? null;
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, payroll_input_id, attributes, created_at from salary_advances where tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or employee_id = ${args.employeeId})
        and (${statusFilter}::text is null or attributes->>'status' = ${args.status})
      order by created_at desc limit 100
    `,
  ]);
  return rows;
}

export async function getAdvance(access: Access, advanceId: string) {
  enforce(access.context, "payroll.read", { tenantId: access.tenantId });
  return loadAdvance(access, advanceId);
}
