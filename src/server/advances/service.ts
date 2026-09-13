import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { ensureComponent, ensurePayrollScaffold } from "@/server/payroll/service";
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
        and attributes->>'status' not in ('recovered','closed','rejected','cancelled') limit 1
    `,
  ]);
  if ((loanRows as unknown[]).length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An open loan blocks any salary advance." });
  }
  if ((advanceRows as unknown[]).length > 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "An open advance blocks another until recovery." });
  }
}

export const requestAdvanceSchema = z.object({
  employeeId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().trim().min(1).max(300),
});

export async function requestAdvance(access: Access, input: z.infer<typeof requestAdvanceSchema>, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const { basic } = await employeeBasic(access, input.employeeId);
  if (basic <= 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Advances need a positive basic salary on record." });
  }
  if (input.amountMinor > basic) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Advances are capped at one month of basic salary." });
  }
  await advanceExposure(access, input.employeeId);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into salary_advances (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ amount_minor: input.amountMinor, period: input.period, reason: input.reason, status: "requested" })}::jsonb)
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

export async function approveAdvance(access: Access, advanceId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const advance = await loadAdvance(access, advanceId);
  if (advance.attributes.status !== "requested") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Advance is ${advance.attributes.status}.` });
  }
  await tenantTx(access, [
    sqlClient`update salary_advances set attributes = attributes || ${JSON.stringify({ status: "approved", approved_by: access.context.actorUserId })}::jsonb where id = ${advanceId} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'advance.approve', 'salary_advance', ${advanceId}, 'Advance approved', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: advanceId, status: "approved" };
}

export async function payAdvance(access: Access, advanceId: string, requestId: string) {
  enforce(access.context, "payroll.run", { tenantId: access.tenantId });
  const advance = await loadAdvance(access, advanceId);
  if (advance.attributes.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Only approved advances can be paid." });
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
        attributes = attributes || '{"status":"paid"}'::jsonb
      where id = ${advanceId} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'advance.pay', 'salary_advance', ${advanceId}, 'Advance paid with recovery scheduled', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id: advanceId, status: "paid", recoveryInputId };
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
