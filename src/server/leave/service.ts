import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import {
  annualLeaveCredit,
  coffExpiryDate,
  reconcileEarlyLeaveReturn,
  validateLeaveRequest,
} from "@/lib/hr-rules";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { actsAsDelegate } from "@/server/delegation/service";
import { HttpError } from "@/server/platform/http";

const APPROVAL_LEVELS = ["supervisor", "hod", "hr_head"] as const;
const TERMINAL = ["approved", "rejected", "cancelled"];

export async function ensureLeaveType(access: Access, code: string): Promise<string> {
  // Exported for the background worker (leave accrual credits EL types).
  const names: Record<string, string> = { EL: "Earned Leave", CL: "Casual Leave", SL: "Sick Leave", COFF: "Compensatory Off", BIRTHDAY: "Birthday Leave" };
  const [rows] = await tenantTx(access, [
    sqlClient`select id from leave_types where tenant_id = ${access.tenantId} and attributes->>'code' = ${code} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into leave_types (id, tenant_id, attributes)
      values (${id}, ${access.tenantId}, ${JSON.stringify({ code, name: names[code] ?? code, unit: "day" })}::jsonb)
    `,
  ]);
  return id;
}

async function employeeProfile(access: Access, employeeId: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`select id, designation_level, joining_date::text as joining_date from employees where tenant_id = ${access.tenantId} and id = ${employeeId} limit 1`,
  ]);
  const row = (rows as Array<{ id: string; designation_level: number; joining_date: string }>)[0];
  if (!row) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  return row;
}

async function requesterUserId(access: Access, employeeId: string): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient`select user_id from memberships where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and status = 'active' limit 1`,
  ]);
  return (rows as Array<{ user_id: string }>)[0]?.user_id ?? null;
}

async function monthUsage(access: Access, employeeId: string, monthPrefix: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select leave_type, coalesce(sum(requested_days), 0)::float as days
      from leave_requests
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
        and starts_on::text like ${`${monthPrefix}%`} and status not in ('rejected', 'cancelled')
      group by leave_type
    `,
  ]);
  const usage: Record<string, number> = {};
  for (const row of rows as Array<{ leave_type: string; days: number }>) usage[row.leave_type] = Number(row.days);
  return usage;
}

export const requestLeaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum(["EL", "CL", "SL", "COFF", "BIRTHDAY"]),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().positive().max(60),
  reason: z.string().trim().min(1).max(500).optional(),
});

export async function requestLeave(access: Access, input: z.infer<typeof requestLeaveSchema>, requestId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (input.endsOn < input.startsOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The leave period ends before it starts." });
  }
  await employeeProfile(access, input.employeeId);
  const typeId = await ensureLeaveType(access, input.leaveType);
  const usage = await monthUsage(access, input.employeeId, input.startsOn.slice(0, 7));
  const clDays = (usage.CL ?? 0) + (input.leaveType === "CL" ? input.days : 0);
  const elDays = (usage.EL ?? 0) + (input.leaveType === "EL" ? input.days : 0);
  const validation = validateLeaveRequest({ requestedTypes: [input.leaveType], clDaysThisMonth: clDays, elDaysThisMonth: elDays });
  if (!validation.valid) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: validation.errors.join(" ") });
  }
  const id = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.leaveType}, ${input.startsOn}, ${input.endsOn}, ${input.days}, 'pending_supervisor', ${input.reason ?? null}, ${typeId})
    `,
    sqlClient`
      insert into leave_approvals (id, tenant_id, leave_request_id, level, status)
      values (${approvalId}, ${access.tenantId}, ${id}, 'supervisor', 'pending')
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, attributes)
      values (${access.tenantId}, ${input.employeeId}, ${id}, ${typeId},
        ${JSON.stringify({ kind: "reserve", days: input.days, leave_type: input.leaveType, note: "Reserved on submit" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.submit', 'leave_request', ${id}, 'Leave submitted for approval',
        ${JSON.stringify({ leaveType: input.leaveType, days: input.days })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'leave.requested', 'leave_request', ${id},
        ${JSON.stringify({ employeeId: input.employeeId, leaveType: input.leaveType, days: input.days, startsOn: input.startsOn })}::jsonb)
    `,
  ]);
  return { id, status: "pending_supervisor" };
}

export async function decideLeave(access: Access, id: string, approve: boolean, comment: string | undefined, requestId: string) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const [requestRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, leave_type, requested_days::float as requested_days, status, leave_type_id from leave_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const request = (requestRows as Array<{ id: string; employee_id: string; leave_type: string; requested_days: number; status: string; leave_type_id: string }>)[0];
  if (!request) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (TERMINAL.includes(request.status)) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Leave request is already ${request.status}.` });
  }
  const [approvalRows] = await tenantTx(access, [
    sqlClient`select id, level, approver_user_id, status from leave_approvals where tenant_id = ${access.tenantId} and leave_request_id = ${id} order by created_at asc`,
  ]);
  const approvals = approvalRows as Array<{ id: string; level: string; approver_user_id: string | null; status: string }>;
  const current = approvals.find((approval) => approval.status === "pending");
  if (!current) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "No pending approval step remains." });
  const linkedUser = await requesterUserId(access, request.employee_id);
  if (linkedUser && linkedUser === access.context.actorUserId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Self-approval is not permitted at any level." });
  }
  if (linkedUser) {
    const [requesterMembershipRows] = await tenantTx(access, [
      sqlClient`select id from memberships where tenant_id = ${access.tenantId} and user_id = ${linkedUser} and status = 'active' limit 1`,
    ]);
    const requesterMembershipId = (requesterMembershipRows as Array<{ id: string }>)[0]?.id ?? null;
    if (await actsAsDelegate(access, requesterMembershipId, "leave.approve")) {
      throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Proxy self-approval through delegation is not permitted." });
    }
  }
  for (const prior of approvals) {
    if (prior.status !== "pending" && prior.approver_user_id === access.context.actorUserId) {
      throw new HttpError({ status: 403, code: "FORBIDDEN", message: "The same actor cannot approve twice in one chain." });
    }
  }
  if (comment !== undefined && comment.length > 1000) {
    throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Decision comments are bounded to 1000 characters." });
  }
  const levelIndex = APPROVAL_LEVELS.indexOf(current.level as (typeof APPROVAL_LEVELS)[number]);
  const isFinal = levelIndex === APPROVAL_LEVELS.length - 1;
  if (!approve) {
    const [reserveRows] = await tenantTx(access, [
      sqlClient`select id from leave_ledger_entries where tenant_id = ${access.tenantId} and leave_request_id = ${id} and attributes->>'kind' = 'reserve' limit 1`,
    ]);
    const reserve = (reserveRows as Array<{ id: string }>)[0];
    await tenantTx(access, [
      sqlClient`update leave_requests set status = 'rejected', updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
      sqlClient`update leave_approvals set status = 'rejected', approver_user_id = ${access.context.actorUserId}, decided_at = now(), comment = ${comment ?? null} where id = ${current.id} and tenant_id = ${access.tenantId}`,
      ...(reserve
        ? [sqlClient`
          insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, reverses_entry_id, attributes)
          values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id}, ${reserve.id},
            ${JSON.stringify({ kind: "release", days: request.requested_days, leave_type: request.leave_type, note: "Released on rejection" })}::jsonb)
        `]
        : []),
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'leave.reject', 'leave_request', ${id}, ${comment ?? "Rejected"}, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
    return { id, status: "rejected" };
  }
  if (!isFinal) {
    const nextLevel = APPROVAL_LEVELS[levelIndex + 1]!;
    const nextStatus = `pending_${nextLevel === "hod" ? "hod" : "hr"}`;
    await tenantTx(access, [
      sqlClient`update leave_approvals set status = 'approved', approver_user_id = ${access.context.actorUserId}, decided_at = now(), comment = ${comment ?? null} where id = ${current.id} and tenant_id = ${access.tenantId}`,
      sqlClient`
        insert into leave_approvals (tenant_id, leave_request_id, level, status)
        values (${access.tenantId}, ${id}, ${nextLevel}, 'pending')
      `,
      sqlClient`update leave_requests set status = ${nextStatus}, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          ${`leave.approve_${current.level}`}, 'leave_request', ${id}, ${comment ?? "Approved"}, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);
    return { id, status: nextStatus };
  }
  await tenantTx(access, [
    sqlClient`update leave_approvals set status = 'approved', approver_user_id = ${access.context.actorUserId}, decided_at = now(), comment = ${comment ?? null} where id = ${current.id} and tenant_id = ${access.tenantId}`,
    sqlClient`update leave_requests set status = 'approved', updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, attributes)
      values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id},
        ${JSON.stringify({ kind: "debit", days: request.requested_days, leave_type: request.leave_type, note: "Debited on final approval" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.approve_hr_head', 'leave_request', ${id}, ${comment ?? "Final approval"}, ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'leave.approved', 'leave_request', ${id},
        ${JSON.stringify({ employeeId: request.employee_id, leaveType: request.leave_type, days: request.requested_days })}::jsonb)
    `,
  ]);
  return { id, status: "approved" };
}

export async function getBalances(access: Access, employeeId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const profile = await employeeProfile(access, employeeId);
  const joining = new Date(`${profile.joining_date}T00:00:00Z`);
  const now = new Date();
  const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
  const credit = annualLeaveCredit({
    designationLevel: profile.designation_level >= 7 ? "AGM+" : "below-AGM",
    joinMonth: joining.getUTCMonth() + 1,
    joinDay: joining.getUTCDate(),
    completedSixMonths: now.getTime() - joining.getTime() >= sixMonthsMs,
  });
  const [ledgerRows, grantRows] = await tenantTx(access, [
    sqlClient`
      select attributes->>'leave_type' as leave_type, attributes->>'kind' as kind, (attributes->>'days')::float as days
      from leave_ledger_entries where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
    `,
    sqlClient`
      select attributes->>'earned_on' as earned_on, (attributes->>'days')::float as days, attributes->>'status' as status
      from comp_off_grants where tenant_id = ${access.tenantId} and employee_id = ${employeeId}
    `,
  ]);
  const used: Record<string, number> = {};
  for (const row of ledgerRows as Array<{ leave_type: string; kind: string; days: number }>) {
    const days = Number(row.days) || 0;
    if (row.kind === "debit") used[row.leave_type] = (used[row.leave_type] ?? 0) + days;
    if (row.kind === "credit") used[row.leave_type] = (used[row.leave_type] ?? 0) - days;
  }
  const today = now.toISOString().slice(0, 10);
  const coffAvailable = (grantRows as Array<{ earned_on: string; days: number; status: string }>)
    .filter((grant) => grant.status === "available" && today <= coffExpiryDate(new Date(`${grant.earned_on}T00:00:00Z`)).toISOString().slice(0, 10))
    .reduce((total, grant) => total + Number(grant.days), 0);
  return {
    employeeId,
    annualCredit: credit,
    used,
    balances: {
      EL: (credit.EL + (credit.monthlyEL > 0 ? credit.monthlyEL * now.getUTCMonth() : 0)) - (used.EL ?? 0),
      CL: credit.CL - (used.CL ?? 0),
      SL: credit.SL - (used.SL ?? 0),
      COFF: coffAvailable - (used.COFF ?? 0),
    },
  };
}

export const earlyReturnSchema = z.object({ actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function recordEarlyReturn(access: Access, id: string, input: z.infer<typeof earlyReturnSchema>, requestId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [requestRows] = await tenantTx(access, [
    sqlClient`select id, employee_id, leave_type, requested_days::float as requested_days, starts_on::text as starts_on, ends_on::text as ends_on, status, leave_type_id from leave_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const request = (requestRows as Array<{ id: string; employee_id: string; leave_type: string; requested_days: number; starts_on: string; ends_on: string; status: string; leave_type_id: string }>)[0];
  if (!request) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (request.status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Early return applies only to approved leave." });
  }
  if (input.actualReturnDate < request.starts_on || input.actualReturnDate > request.ends_on) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The return date falls outside the approved period." });
  }
  const actualDays = Math.round((Date.parse(input.actualReturnDate) - Date.parse(request.starts_on)) / 86_400_000);
  const reconciliation = reconcileEarlyLeaveReturn({ approvedDays: request.requested_days, actualLeaveDays: actualDays });
  await tenantTx(access, [
    sqlClient`update leave_requests set actual_return_date = ${input.actualReturnDate}, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    sqlClient`
      update attendance_days set status = 'present', updated_at = now()
      where tenant_id = ${access.tenantId} and employee_id = ${request.employee_id}
        and attendance_date >= ${input.actualReturnDate}::date and attendance_date <= ${request.ends_on}::date
        and locked_at is null
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, attributes)
      values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id},
        ${JSON.stringify({ kind: "credit", days: reconciliation.leaveDaysCreditedBack, leave_type: request.leave_type, note: `Early return on ${input.actualReturnDate}` })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.early_return', 'leave_request', ${id}, 'Early return recorded',
        ${JSON.stringify(reconciliation)}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, ...reconciliation };
}

export const grantCoffSchema = z.object({
  employeeId: z.string().uuid(),
  earnedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().positive().max(10),
  note: z.string().trim().max(300).optional(),
});

export async function grantCoff(access: Access, input: z.infer<typeof grantCoffSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await employeeProfile(access, input.employeeId);
  const typeId = await ensureLeaveType(access, "COFF");
  const expiresOn = coffExpiryDate(new Date(`${input.earnedOn}T00:00:00Z`)).toISOString().slice(0, 10);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into comp_off_grants (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({ days: input.days, earned_on: input.earnedOn, expires_on: expiresOn, status: "available", note: input.note ?? null })}::jsonb)
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes)
      values (${access.tenantId}, ${input.employeeId}, ${typeId}, ${id},
        ${JSON.stringify({ kind: "grant", days: input.days, leave_type: "COFF", note: "COFF granted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.coff_grant', 'comp_off_grant', ${id}, 'COFF granted', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, expiresOn, days: input.days };
}

export async function listLeaveRequests(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from leave_requests
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId})
        and (${args.status ?? null}::text is null or status = ${args.status})
    `,
    sqlClient`
      select id, employee_id, leave_type, starts_on::text as starts_on, ends_on::text as ends_on,
             requested_days::float as requested_days, status, reason
      from leave_requests
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId})
        and (${args.status ?? null}::text is null or status = ${args.status})
      order by created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}
