import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { annualLeaveCredit } from "@/lib/hr-rules";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { dedupeKey } from "@/server/jobs/worker";
import { ensureLeaveType } from "./service";
import { availableAfterReservations } from "./request-guards";
import { resolveEmployee } from "./workspace";

/**
 * Leave allocation for HR (permission leave.maintain): the annual entitlement
 * preview computed by the shared hr-rules policy, crediting that entitlement to
 * the ledger once per employee and year, manual +/- adjustments (ledger entries
 * with a reason, never below zero) and queueing the monthly EL accrual job.
 */

export type AllocationNote =
  | "senior_management_annual"
  | "regular_monthly_el"
  | "new_joiner_waiting"
  | "prorated_cl_sl"
  | "trainee_cl_only"
  | "birthday_eligible"
  | "contractual_no_credit";

export type AllocationPreview = {
  employeeId: string;
  eligible: boolean;
  seniorManagement: boolean;
  year: number;
  days: { EL: number; CL: number; SL: number; BIRTHDAY: number };
  monthlyEL: number;
  notes: AllocationNote[];
  alreadyCredited: boolean;
};

type ProfileRow = { designation_level: number; joining_date: string; category: string; has_birth_date: boolean };

/** Pure entitlement for one employee profile (unit-tested). */
export function computeAllocation(profile: ProfileRow, now: Date): Omit<AllocationPreview, "employeeId" | "year" | "alreadyCredited"> {
  const category = (profile.category ?? "").toLowerCase();
  const seniorManagement = Number(profile.designation_level) >= 7;
  if (category === "contract" || category.startsWith("third-party")) {
    return { eligible: false, seniorManagement, days: { EL: 0, CL: 0, SL: 0, BIRTHDAY: 0 }, monthlyEL: 0, notes: ["contractual_no_credit"] };
  }
  const joining = new Date(`${profile.joining_date}T00:00:00Z`);
  const completedSixMonths = now.getTime() - joining.getTime() >= 6 * 30 * 24 * 60 * 60 * 1000;
  const credit = annualLeaveCredit({
    designationLevel: seniorManagement ? "AGM+" : "below-AGM",
    joinMonth: joining.getUTCMonth() + 1,
    joinDay: joining.getUTCDate(),
    completedSixMonths,
    traineeType: category === "trainee" ? "other" : undefined,
  });
  const notes: AllocationNote[] = [];
  if (seniorManagement && credit.monthlyEL === 0 && credit.EL > 0) notes.push("senior_management_annual");
  if (credit.monthlyEL > 0) notes.push("regular_monthly_el");
  if (!completedSixMonths) notes.push("new_joiner_waiting");
  if (!(joining.getUTCMonth() === 0 && joining.getUTCDate() === 1)) notes.push("prorated_cl_sl");
  if (category === "trainee") notes.push("trainee_cl_only");
  const birthday = profile.has_birth_date ? 1 : 0;
  if (birthday) notes.push("birthday_eligible");
  return {
    eligible: true,
    seniorManagement,
    days: { EL: credit.EL, CL: credit.CL, SL: credit.SL, BIRTHDAY: birthday },
    monthlyEL: credit.monthlyEL,
    notes,
  };
}

async function loadProfile(access: Access, employeeId: string): Promise<ProfileRow> {
  const [rows] = await tenantTx(access, [
    sqlClient`select designation_level, joining_date::text as joining_date, category, (date_of_birth is not null) as has_birth_date
      from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const found = (rows as ProfileRow[])[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The employee was not found." });
  return found;
}

async function alreadyCredited(access: Access, employeeId: string, year: number): Promise<boolean> {
  const [rows] = await tenantTx(access, [
    sqlClient`select 1 from leave_ledger_entries where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
      and attributes->>'source' = 'annual_allocation' and attributes->>'allocation_year' = ${String(year)} limit 1`,
  ]);
  return (rows as unknown[]).length > 0;
}

export async function previewAllocation(access: Access, employeeRef: string, now = new Date()): Promise<AllocationPreview> {
  enforce(access.context, "leave.maintain", { tenantId: access.tenantId });
  const employee = await resolveEmployee(access, employeeRef);
  const year = now.getUTCFullYear();
  const computed = computeAllocation(await loadProfile(access, employee.id), now);
  return { employeeId: employee.id, year, ...computed, alreadyCredited: await alreadyCredited(access, employee.id, year) };
}

export const creditAllocationSchema = z.object({ employeeId: z.string().uuid() });

export async function creditAnnualAllocation(
  access: Access,
  input: z.infer<typeof creditAllocationSchema>,
  requestId: string,
  now = new Date(),
): Promise<{ employeeId: string; year: number; credited: Record<string, number> }> {
  const preview = await previewAllocation(access, input.employeeId, now);
  if (!preview.eligible) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee is not eligible for a leave credit." });
  }
  if (preview.alreadyCredited) {
    throw new HttpError({ status: 409, code: "ALREADY_CREDITED", message: `The ${preview.year} allocation was already credited to this employee.` });
  }
  const credited = Object.fromEntries(Object.entries(preview.days).filter(([, days]) => days > 0));
  if (Object.keys(credited).length === 0) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The policy gives this employee nothing to credit yet." });
  }
  const typeIds = await Promise.all(Object.keys(credited).map((code) => ensureLeaveType(access, code)));
  await tenantTx(access, [
    ...Object.entries(credited).map(([code, days], index) =>
      sqlClient`insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, attributes)
        values (${access.tenantId}, ${preview.employeeId}, ${typeIds[index]},
          ${JSON.stringify({ kind: "credit", days, leave_type: code, source: "annual_allocation", allocation_year: String(preview.year), note: `Annual allocation ${preview.year}` })}::jsonb)`,
    ),
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.allocation_credit', 'employee', ${preview.employeeId}, ${`Annual allocation ${preview.year}`}, ${JSON.stringify(credited)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { employeeId: preview.employeeId, year: preview.year, credited };
}

export const balanceAdjustmentSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(["EL", "CL", "SL", "BIRTHDAY"]),
  days: z
    .number()
    .min(-366)
    .max(366)
    .refine((value) => value !== 0, "Adjustment cannot be zero.")
    .refine((value) => Math.round(value * 2) === value * 2, "Adjust in steps of half a day."),
  reason: z.string().trim().min(3, "A reason of at least 3 characters is required.").max(1000),
});

export async function adjustLeaveBalance(
  access: Access,
  input: z.infer<typeof balanceAdjustmentSchema>,
  requestId: string,
): Promise<{ id: string; employeeId: string; leaveType: string; days: number; availableAfter: number }> {
  enforce(access.context, "leave.maintain", { tenantId: access.tenantId });
  const employee = await resolveEmployee(access, input.employeeId);
  const [ledgerRows, pendingRows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(l.attributes->>'transaction_type', l.attributes->>'kind') as "transactionType",
          case when coalesce(l.attributes->>'days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' then (l.attributes->>'days')::float else 0 end as days
        from leave_ledger_entries l
        left join leave_types lt on lt.tenant_id = l.tenant_id and lt.id = l.leave_type_id
        where l.tenant_id = $1 and l.employee_id = $2::uuid and coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') = $3
        limit 2000`,
      [access.tenantId, employee.id, input.leaveType],
    ),
    sqlClient.query(
      `select coalesce(sum(requested_days), 0)::float as days from leave_requests
        where tenant_id = $1 and employee_id = $2::uuid and leave_type = $3 and lower(coalesce(status, '')) like 'pending%'`,
      [access.tenantId, employee.id, input.leaveType],
    ),
  ]);
  const pending = Number((pendingRows as Array<{ days: number }>)[0]?.days) || 0;
  const available = availableAfterReservations(ledgerRows as Array<{ transactionType: string | null; days: number }>, pending);
  const availableAfter = Math.round((available + input.days) * 100) / 100;
  if (availableAfter < 0) {
    throw new HttpError({
      status: 422,
      code: "INSUFFICIENT_BALANCE",
      message: `The balance would fall below zero (available ${available} day(s) after pending requests).`,
      details: [{ field: "days", issue: "insufficient_balance" }],
    });
  }
  const typeId = await ensureLeaveType(access, input.leaveType);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into leave_ledger_entries (id, tenant_id, employee_id, leave_type_id, attributes)
      values (${id}, ${access.tenantId}, ${employee.id}, ${typeId},
        ${JSON.stringify({ kind: input.days > 0 ? "credit" : "debit", days: Math.abs(input.days), leave_type: input.leaveType, source: "manual_adjustment", note: input.reason })}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.balance_adjust', 'leave_ledger', ${id}, ${input.reason},
        ${JSON.stringify({ employeeId: employee.id, leaveType: input.leaveType, days: input.days })}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, employeeId: employee.id, leaveType: input.leaveType, days: input.days, availableAfter };
}

export const accrualRunSchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM.") });

/** Queues the monthly EL accrual job (worker credits each eligible employee once per period). */
export async function queueAccrualRun(
  access: Access,
  input: z.infer<typeof accrualRunSchema>,
  requestId: string,
): Promise<{ id: string; period: string; status: "queued" }> {
  enforce(access.context, "leave.maintain", { tenantId: access.tenantId });
  const payload = { period: input.period };
  const [existing] = await tenantTx(access, [
    sqlClient`select id from scheduled_tasks where tenant_id = ${access.tenantId} and task_type = 'leave.accrue_monthly'
      and status in ('pending', 'running') and payload->>'period' = ${input.period} limit 1`,
  ]);
  if ((existing as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `An accrual run for ${input.period} is already queued.` });
  }
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into scheduled_tasks (id, tenant_id, task_type, payload, available_at, max_attempts)
      values (${id}, ${access.tenantId}, 'leave.accrue_monthly', ${JSON.stringify({ ...payload, _dedupe_key: dedupeKey("leave.accrue_monthly", payload) })}::jsonb, ${new Date().toISOString()}, 10)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.accrual_run_queued', 'scheduled_task', ${id}, ${`Monthly accrual ${input.period}`}, ${JSON.stringify(payload)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, period: input.period, status: "queued" };
}
