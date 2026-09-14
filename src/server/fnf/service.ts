import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

// F&F settlement department clearance departments
const FNF_DEPARTMENTS = ["hr", "it", "finance", "admin"] as const;
type FnfDepartment = typeof FNF_DEPARTMENTS[number];

// Gratuity: 15/26 * monthly_basic * years (after 5 years of service)
function computeGratuity(basicMonthlyMinor: number, tenureYears: number): number {
  if (tenureYears < 5) return 0;
  return Math.floor((15 / 26) * basicMonthlyMinor * tenureYears);
}

// Notice period shortfall deduction
function computeNoticeDeduction(basicMonthlyMinor: number, noticePeriodDays: number, actualDaysWorked: number): number {
  if (actualDaysWorked >= noticePeriodDays) return 0;
  const shortfall = noticePeriodDays - actualDaysWorked;
  return Math.floor((basicMonthlyMinor / 26) * shortfall);
}

export const initiateFnfSchema = z.object({
  employeeId: z.string().uuid(),
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  noticePeriodDays: z.number().int().min(0).max(365).default(30),
  travelAdvanceMinor: z.number().int().min(0).default(0),
});

export async function initiateFnfSettlement(access: Access, input: z.infer<typeof initiateFnfSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  // Fetch employee data
  const [empRows] = await tenantTx(access, [
    sqlClient`
      select id, first_name, last_name, employee_code, joining_date::text as joining_date,
             basic_salary_minor, status
      from employees
      where tenant_id = ${access.tenantId} and id = ${input.employeeId}
      limit 1
    `,
  ]);
  const emp = (empRows as Array<{
    id: string; first_name: string; last_name: string; employee_code: string;
    joining_date: string; basic_salary_minor: number | null; status: string;
  }>)[0];
  if (!emp) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Employee not found." });

  // Check for existing active settlement
  const [existingRows] = await tenantTx(access, [
    sqlClient`select id from fnf_settlements where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and status != 'cancelled' limit 1`,
  ]);
  if ((existingRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An active F&F settlement already exists for this employee." });
  }

  // Calculate tenure
  const joiningDate = new Date(emp.joining_date);
  const exitDate = new Date(input.exitDate);
  const tenureMs = exitDate.getTime() - joiningDate.getTime();
  const tenureYears = tenureMs / (1000 * 60 * 60 * 24 * 365.25);
  const basicMonthly = emp.basic_salary_minor ?? 0;

  // Compute gratuity
  const gratuityMinor = computeGratuity(basicMonthly, tenureYears);

  // Get EL balance
  const [balRows] = await tenantTx(access, [
    sqlClient`select balance::float from leave_balances where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and leave_type = 'EL' order by as_of_date desc limit 1`,
  ]);
  const elBalance = (balRows as Array<{ balance: number }>)[0]?.balance ?? 0;
  const elEncashmentMinor = Math.floor((basicMonthly / 26) * elBalance);

  // Compute notice deduction (assume all days worked for now — actual calculation requires punch data)
  const noticeDeductionMinor = computeNoticeDeduction(basicMonthly, input.noticePeriodDays, input.noticePeriodDays);

  const netPayableMinor = gratuityMinor + elEncashmentMinor - noticeDeductionMinor - input.travelAdvanceMinor;

  const id = crypto.randomUUID();
  const initialClearances: Record<string, { status: string; remarks: string | null; verified_at: string | null; verified_by: string | null }> = {};
  for (const dept of FNF_DEPARTMENTS) {
    initialClearances[dept] = { status: "pending", remarks: null, verified_at: null, verified_by: null };
  }

  await tenantTx(access, [
    sqlClient`
      insert into fnf_settlements (id, tenant_id, employee_id, exit_date, status, attributes, department_clearances)
      values (
        ${id}, ${access.tenantId}, ${input.employeeId}, ${input.exitDate},
        'pending',
        ${JSON.stringify({
          tenure_years: Math.round(tenureYears * 10) / 10,
          el_balance: elBalance,
          basic_salary_minor: basicMonthly,
          gratuity_minor: gratuityMinor,
          el_encashment_minor: elEncashmentMinor,
          notice_deduction_minor: noticeDeductionMinor,
          travel_advance_deduction_minor: input.travelAdvanceMinor,
          net_payable_minor: netPayableMinor,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_code: emp.employee_code,
        })}::jsonb,
        ${JSON.stringify(initialClearances)}::jsonb
      )
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.fnf_initiate', 'fnf_settlement', ${id},
        'F&F settlement initiated',
        ${JSON.stringify({ employeeId: input.employeeId, exitDate: input.exitDate, netPayableMinor })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return {
    id,
    employeeId: input.employeeId,
    exitDate: input.exitDate,
    status: "pending",
    tenureYears: Math.round(tenureYears * 10) / 10,
    elBalance,
    gratuityMinor,
    elEncashmentMinor,
    noticeDeductionMinor,
    travelAdvanceMino: input.travelAdvanceMinor,
    netPayableMinor,
  };
}

export async function listFnfSettlements(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from fnf_settlements
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or status = ${args.status ?? null}::text)
    `,
    sqlClient`
      select f.id, f.employee_id, f.exit_date::text, f.status, f.attributes, f.department_clearances,
             f.payment_ref, f.disbursed_at, f.created_at,
             e.first_name, e.last_name, e.employee_code
      from fnf_settlements f
      join employees e on e.id = f.employee_id and e.tenant_id = f.tenant_id
      where f.tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or f.employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or f.status = ${args.status ?? null}::text)
      order by f.created_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}

export const clearDepartmentSchema = z.object({
  department: z.enum(FNF_DEPARTMENTS),
  remarks: z.string().trim().max(500).optional(),
});

export async function clearDepartment(access: Access, id: string, input: z.infer<typeof clearDepartmentSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, department_clearances, attributes from fnf_settlements where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const settlement = (rows as Array<{ id: string; status: string; department_clearances: Record<string, unknown>; attributes: Record<string, unknown> }>)[0];
  if (!settlement) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "F&F settlement not found." });
  if (settlement.status === "disbursed" || settlement.status === "cancelled") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Cannot clear a department for a finalized settlement." });
  }

  const newClearances = {
    ...settlement.department_clearances,
    [input.department]: {
      status: "cleared",
      remarks: input.remarks ?? null,
      verified_at: new Date().toISOString(),
      verified_by: access.context.actorUserId,
    },
  };

  // Check if all departments are cleared
  const allCleared = FNF_DEPARTMENTS.every((dept) => (newClearances[dept] as { status: string }).status === "cleared");
  const newStatus = allCleared ? "cleared_for_disbursement" : "clearance_in_progress";

  await tenantTx(access, [
    sqlClient`
      update fnf_settlements
      set department_clearances = ${JSON.stringify(newClearances)}::jsonb, status = ${newStatus}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.fnf_dept_clear', 'fnf_settlement', ${id},
        ${"F&F: " + input.department.toUpperCase() + " department clearance granted"},
        ${JSON.stringify({ department: input.department, allCleared })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, department: input.department, status: newStatus, allCleared };
}

export const disburseFnfSchema = z.object({
  paymentRef: z.string().trim().min(1).max(100),
});

export async function disburseFnf(access: Access, id: string, input: z.infer<typeof disburseFnfSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, attributes, employee_id from fnf_settlements where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const settlement = (rows as Array<{ id: string; status: string; attributes: Record<string, unknown>; employee_id: string }>)[0];
  if (!settlement) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "F&F settlement not found." });
  if (settlement.status !== "cleared_for_disbursement") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Settlement must be fully cleared before disbursement." });
  }

  await tenantTx(access, [
    sqlClient`
      update fnf_settlements
      set status = 'disbursed', payment_ref = ${input.paymentRef},
          disbursed_at = now(), disbursed_by_membership_id = ${access.context.membershipId}, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      update employees set status = 'separated', updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${settlement.employee_id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'lifecycle.fnf_disburse', 'fnf_settlement', ${id},
        'F&F settlement disbursed',
        ${JSON.stringify({ paymentRef: input.paymentRef, netPayableMinor: settlement.attributes.net_payable_minor })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "disbursed", paymentRef: input.paymentRef };
}
