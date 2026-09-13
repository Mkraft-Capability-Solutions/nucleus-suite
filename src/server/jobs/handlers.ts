import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { annualLeaveCredit, coffExpiryDate } from "@/lib/hr-rules";
import { ensureLeaveType, getBalances } from "@/server/leave/service";
import { calculateRun } from "@/server/payroll/service";
import { tenantTx, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

export const TASK_TYPES = [
  "leave.accrue_monthly",
  "leave.coff_expire",
  "leave.year_close",
  "documents.expire",
  "payroll.calculate_batch",
] as const;

export function isKnownTaskType(type: string): type is (typeof TASK_TYPES)[number] {
  return (TASK_TYPES as readonly string[]).includes(type);
}

async function activeEmployees(access: Access): Promise<Array<{ id: string; designation_level: number; joining_date: string }>> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, designation_level, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and status = 'active'`,
  ]);
  return rows as Array<{ id: string; designation_level: number; joining_date: string }>;
}

async function accrueMonthly(access: Access, payload: Record<string, unknown>): Promise<{ credited: number }> {
  const period = z.string().regex(/^\d{4}-\d{2}$/).parse(payload.period);
  const typeId = await ensureLeaveType(access, "EL");
  let credited = 0;
  for (const employee of await activeEmployees(access)) {
    const joining = new Date(`${employee.joining_date}T00:00:00Z`);
    const credit = annualLeaveCredit({
      designationLevel: employee.designation_level >= 7 ? "AGM+" : "below-AGM",
      joinMonth: joining.getUTCMonth() + 1,
      joinDay: joining.getUTCDate(),
      completedSixMonths: Date.now() - joining.getTime() >= 6 * 30 * 24 * 60 * 60 * 1000,
    });
    if (credit.monthlyEL <= 0) continue;
    const [existing] = await tenantTx(access, [
      sqlClient`
        select 1 from leave_ledger_entries
        where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
          and attributes->>'kind' = 'accrual' and attributes->>'period' = ${period} limit 1
      `,
    ]);
    if ((existing as unknown[]).length > 0) continue;
    await tenantTx(access, [
      sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${typeId},
          ${JSON.stringify({ kind: "accrual", days: credit.monthlyEL, leave_type: "EL", period, note: "Monthly EL accrual" })}::jsonb)
      `,
    ]);
    credited += 1;
  }
  return { credited };
}

async function coffExpire(access: Access, payload: Record<string, unknown>): Promise<{ expired: number }> {
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(payload.asOf);
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from comp_off_grants where tenant_id = ${access.tenantId} and attributes->>'status' = 'available'`,
  ]);
  const grants = rows as Array<{ id: string; attributes: { earned_on: string } }>;
  let expired = 0;
  for (const grant of grants) {
    const expiry = coffExpiryDate(new Date(`${grant.attributes.earned_on}T00:00:00Z`)).toISOString().slice(0, 10);
    if (expiry < asOf) {
      await tenantTx(access, [
        sqlClient`update comp_off_grants set attributes = attributes || '{"status":"expired"}'::jsonb where id = ${grant.id} and tenant_id = ${access.tenantId}`,
      ]);
      expired += 1;
    }
  }
  return { expired };
}

async function yearClose(access: Access, payload: Record<string, unknown>): Promise<{ encashed: number; lapsed: number }> {
  const year = z.number().int().min(2000).max(2100).parse(payload.year);
  const elTypeId = await ensureLeaveType(access, "EL");
  const clTypeId = await ensureLeaveType(access, "CL");
  const slTypeId = await ensureLeaveType(access, "SL");
  let encashed = 0, lapsed = 0;
  for (const employee of await activeEmployees(access)) {
    const [existing] = await tenantTx(access, [
      sqlClient`
        select 1 from leave_ledger_entries
        where tenant_id = ${access.tenantId} and employee_id = ${employee.id}
          and attributes->>'kind' in ('encash', 'lapse') and attributes->>'year' = ${String(year)} limit 1
      `,
    ]);
    if ((existing as unknown[]).length > 0) continue;
    const balances = await getBalances(access, employee.id);
    const statements = [];
    if (balances.balances.EL > 0) {
      statements.push(sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${elTypeId},
          ${JSON.stringify({ kind: "encash", days: balances.balances.EL, leave_type: "EL", year: String(year), note: "Year-end EL encashment" })}::jsonb)
      `);
      encashed += 1;
    }
    if (balances.balances.CL > 0) {
      statements.push(sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${clTypeId},
          ${JSON.stringify({ kind: "lapse", days: balances.balances.CL, leave_type: "CL", year: String(year), note: "Year-end CL lapse" })}::jsonb)
      `);
      lapsed += 1;
    }
    if (balances.balances.SL > 0) {
      statements.push(sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${employee.id}, ${slTypeId},
          ${JSON.stringify({ kind: "lapse", days: balances.balances.SL, leave_type: "SL", year: String(year), note: "Year-end SL lapse" })}::jsonb)
      `);
      lapsed += 1;
    }
    if (statements.length > 0) await tenantTx(access, statements);
  }
  return { encashed, lapsed };
}

async function documentsExpire(access: Access, payload: Record<string, unknown>): Promise<{ expired: number }> {
  const asOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(payload.asOf);
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id from document_versions
      where tenant_id = ${access.tenantId} and attributes->>'scan' = 'available'
        and attributes->>'expires_at' is not null and attributes->>'expires_at' < ${asOf}
    `,
  ]);
  const versions = rows as Array<{ id: string }>;
  for (const version of versions) {
    await tenantTx(access, [
      sqlClient`update document_versions set attributes = attributes || '{"expired":true}'::jsonb where id = ${version.id} and tenant_id = ${access.tenantId}`,
    ]);
  }
  return { expired: versions.length };
}

async function calculateBatch(access: Access, payload: Record<string, unknown>): Promise<{ calculated: number }> {
  const runId = z.string().uuid().parse(payload.runId);
  const employeeIds = z.array(z.string().uuid()).min(1).max(200).parse(payload.employeeIds);
  const result = await calculateRun(access, runId, employeeIds, crypto.randomUUID());
  return { calculated: result.calculated };
}

export async function dispatchTask(access: Access, taskType: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!isKnownTaskType(taskType)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Unknown task type: ${taskType}; dead-lettered without retry.` });
  }
  switch (taskType) {
    case "leave.accrue_monthly":
      return accrueMonthly(access, payload);
    case "leave.coff_expire":
      return coffExpire(access, payload);
    case "leave.year_close":
      return yearClose(access, payload);
    case "documents.expire":
      return documentsExpire(access, payload);
    case "payroll.calculate_batch":
      return calculateBatch(access, payload);
  }
}
