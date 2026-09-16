import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { reconcileEarlyLeaveReturn, validateLeaveRequest, type LeaveCombinationMatrix, type MonthlyAvailingCaps } from "@/lib/hr-rules";
import { picklistValues } from "@/lib/picklists";
import { resolveShift } from "@/server/attendance/shift-master";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { actsAsDelegate } from "@/server/delegation/service";
import { HttpError } from "@/server/platform/http";
import { assertAbsenceIsPermitted } from "./absence";
import { APPROVAL_LEVELS, assertMayDecideAtLevel, HR_HEAD_ROLE, type LeaveApprovalLevel } from "./approval-chain";
import { grantLapseDate } from "./coff";
import { loadLeaveScheme } from "./configuration";
import { leaveEmployeeFilter, resolveLeaveReadScope } from "./leave-scope";
import { ensureLeaveType } from "./leave-types";
import { leaveBalancesFromLedger } from "./ledger";
import { addDays, type LeaveScheme } from "./scheme";

/** Re-exported: the background worker and the VP command both resolve types through here. */
export { ensureLeaveType };

const TERMINAL = ["approved", "rejected", "cancelled"];

/** RL-12's caps and RL-11's matrix, as the configured scheme states them. */
function capsFrom(scheme: LeaveScheme): MonthlyAvailingCaps {
  const caps: Record<string, number | null> = {};
  for (const [code, type] of Object.entries(scheme.types)) caps[code] = type.maxAvailedPerMonth;
  return caps;
}

function matrixFrom(scheme: LeaveScheme): LeaveCombinationMatrix {
  const matrix: Record<string, readonly string[]> = {};
  for (const [code, type] of Object.entries(scheme.types)) matrix[code] = type.cannotCombineWith;
  return matrix;
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

/**
 * FRM-LVE-02 `team_conflict_count`: how many of the applicant's immediate team already
 * hold leave over the same dates.
 *
 * It informs the approver; it does not decide anything. The workbook states no limit on
 * how many of a team may be away at once, so this reports the number and stops there —
 * blocking on a threshold nobody has set would be inventing the policy.
 *
 * The team is the applicant's peers: everyone reporting to the same manager, the
 * applicant excluded. Cancelled and rejected requests do not count as conflicts.
 */
async function teamConflictCount(access: Access, employeeId: string, startsOn: string, endsOn: string): Promise<number> {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select count(distinct lr.employee_id)::int as total
      from leave_requests lr
      join employees peer on peer.tenant_id = lr.tenant_id and peer.id = lr.employee_id
      join employees applicant on applicant.tenant_id = peer.tenant_id and applicant.id = ${employeeId}
      where lr.tenant_id = ${access.tenantId}
        and lr.employee_id <> ${employeeId}
        and peer.manager_employee_id is not null
        and peer.manager_employee_id = applicant.manager_employee_id
        and peer.status = 'active'
        and lr.status not in ('rejected', 'cancelled')
        and lr.starts_on <= ${endsOn}::date and lr.ends_on >= ${startsOn}::date
    `,
  ]);
  return (rows as Array<{ total: number }>)[0]?.total ?? 0;
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

export const requestLeaveSchema = z
  .object({
    employeeId: z.string().uuid(),
    leaveType: z.enum(["EL", "CL", "SL", "COFF", "BIRTHDAY"]),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().positive().max(60),
    reason: z.string().trim().min(1).max(500).optional(),
    isHalfDayStart: z.boolean().optional(),
    isHalfDayEnd: z.boolean().optional(),
    halfDaySession: z.enum(picklistValues("PL_HALF_DAY_SESSION")).optional(),
    documentRef: z.string().trim().min(1).max(500).optional(),
    // E.164, so an international contact survives the round trip unmangled.
    contact: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
    leaveAddress: z.string().trim().min(1).max(200).optional(),
    handoverPersonId: z.string().uuid().optional(),
  })
  .refine((input) => !(input.isHalfDayStart || input.isHalfDayEnd) || input.halfDaySession !== undefined, {
    path: ["halfDaySession"],
    message: "A half day must name the session it falls in.",
  });

export async function requestLeave(access: Access, input: z.infer<typeof requestLeaveSchema>, requestId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  if (input.endsOn < input.startsOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The leave period ends before it starts." });
  }
  await employeeProfile(access, input.employeeId);
  if (input.handoverPersonId !== undefined) {
    if (input.handoverPersonId === input.employeeId) {
      throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Work cannot be handed over to the applicant." });
    }
    await employeeProfile(access, input.handoverPersonId);
  }
  const typeId = await ensureLeaveType(access, input.leaveType);
  const scheme = await loadLeaveScheme(access);

  // RL-11 across separate applications, and the double-booking guard beside it.
  // This runs before the caps, because a contiguous absence is the stronger
  // objection and its message is the one the applicant needs to see.
  await assertAbsenceIsPermitted(access, scheme, {
    employeeId: input.employeeId,
    leaveType: input.leaveType,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  });

  // RL-12. The month's usage already counts approved and in-flight days; this
  // request's own days are added before the cap is tested.
  const usage = await monthUsage(access, input.employeeId, input.startsOn.slice(0, 7));
  const daysThisMonthByType = { ...usage, [input.leaveType]: (usage[input.leaveType] ?? 0) + input.days };
  const validation = validateLeaveRequest({
    requestedTypes: [input.leaveType],
    daysThisMonthByType,
    caps: capsFrom(scheme),
    combinationMatrix: matrixFrom(scheme),
  });
  if (!validation.valid) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: validation.errors.join(" ") });
  }
  const teamConflicts = await teamConflictCount(access, input.employeeId, input.startsOn, input.endsOn);
  const id = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  // The rest of the application form. leave_requests carries the dates, the day
  // count and the reason as columns; everything else lives in the attributes bag.
  const attributes = {
    is_half_day_start: input.isHalfDayStart ?? false,
    is_half_day_end: input.isHalfDayEnd ?? false,
    half_day_session: input.halfDaySession ?? null,
    document_ref: input.documentRef ?? null,
    contact: input.contact ?? null,
    leave_address: input.leaveAddress ?? null,
    handover_person_id: input.handoverPersonId ?? null,
    team_conflict_count: teamConflicts,
  };
  await tenantTx(access, [
    sqlClient`
      insert into leave_requests (id, tenant_id, employee_id, leave_type, starts_on, ends_on, requested_days, status, reason, leave_type_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.leaveType}, ${input.startsOn}, ${input.endsOn}, ${input.days}, 'pending_supervisor', ${input.reason ?? null}, ${typeId}, ${JSON.stringify(attributes)}::jsonb)
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
  return { id, status: "pending_supervisor", teamConflictCount: teamConflicts };
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
  const levelIndex = APPROVAL_LEVELS.indexOf(current.level as LeaveApprovalLevel);
  if (levelIndex < 0) {
    throw new HttpError({ status: 409, code: "WORKFLOW_CONFLICT", message: `Unknown approval level "${current.level}".` });
  }
  const isFinal = levelIndex === APPROVAL_LEVELS.length - 1;
  // W-01. Holding `leave.approve` says the caller may approve leave; it does not
  // say they are THIS applicant's supervisor, HOD or HR Head. Without this the
  // chain was walked in order but by whoever posted first, so an HR Head acting
  // early was recorded in the supervisor's row.
  await assertMayDecideAtLevel(access, current.level as LeaveApprovalLevel, request.employee_id);
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
  // The submit-time reservation is released as the debit replaces it. Both are
  // debits on the balance, so leaving the hold standing beside the debit would
  // deduct the same days twice once the register learned to score `reserve`.
  const [finalReserveRows] = await tenantTx(access, [
    sqlClient`select id from leave_ledger_entries where tenant_id = ${access.tenantId} and leave_request_id = ${id} and attributes->>'kind' = 'reserve' limit 1`,
  ]);
  const finalReserve = (finalReserveRows as Array<{ id: string }>)[0];
  await tenantTx(access, [
    sqlClient`update leave_approvals set status = 'approved', approver_user_id = ${access.context.actorUserId}, decided_at = now(), comment = ${comment ?? null} where id = ${current.id} and tenant_id = ${access.tenantId}`,
    sqlClient`update leave_requests set status = 'approved', updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    ...(finalReserve
      ? [sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, reverses_entry_id, attributes)
        values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id}, ${finalReserve.id},
          ${JSON.stringify({ kind: "release", days: request.requested_days, leave_type: request.leave_type, note: "Reservation released as the approved debit replaces it" })}::jsonb)
      `]
      : []),
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

/**
 * One employee's balances, as at a date, read from the ledger and nothing else.
 *
 * This used to add a projected annual entitlement on top of the accruals already
 * written, so a mid-year joiner's 9-day catch-up was counted twice — and it
 * multiplied the monthly rate by `getUTCMonth()`, which is zero-based, silently
 * dropping January. It also netted only `debit` and `credit`, so the year-end
 * `encash` and `lapse` postings moved nothing and a second year-end run would
 * have encashed the same days again.
 *
 * Accrual writes the ledger; the balance reads it. There is no second opinion.
 *
 * The balances of ONE named employee, so this read is scoped like a detail read:
 * a self-scoped caller asking for somebody else's balances is answered 404, not
 * 403, so the endpoint cannot be walked to learn which employee ids exist.
 */
export async function getBalances(access: Access, employeeId: string, asOf?: string) {
  const resolved = resolveLeaveReadScope(access);
  if (resolved.scope === "self" && employeeId !== resolved.selfEmployeeId) {
    throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  }
  await employeeProfile(access, employeeId);
  const ledger = await leaveBalancesFromLedger(access, employeeId, asOf);
  const used: Record<string, number> = {};
  const balances: Record<string, number> = {};
  for (const [code, entry] of Object.entries(ledger)) {
    used[code] = entry.debited;
    balances[code] = entry.balance;
  }
  return {
    employeeId,
    asOf: asOf ?? new Date().toISOString().slice(0, 10),
    credited: Object.fromEntries(Object.entries(ledger).map(([code, entry]) => [code, entry.credited])),
    used,
    balances: {
      EL: balances.EL ?? 0,
      CL: balances.CL ?? 0,
      SL: balances.SL ?? 0,
      COFF: balances.COFF ?? 0,
      ...balances,
    },
  };
}

export const earlyReturnSchema = z.object({ actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * The shift an attendance day has to be created against when no row exists yet.
 *
 * A leave day has no attendance row: rows are only written by punch ingestion,
 * which is exactly why the old UPDATE matched nothing and "days 7 to 10 marked
 * present" silently did nothing. The shift is taken from the employee's active
 * roster, or failing that from the last day they were actually processed on —
 * never defaulted, because a day created on the wrong shift is measured against
 * the wrong thresholds.
 */
async function rosteredShiftCode(access: Access, employeeId: string): Promise<string | null> {
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select coalesce(
            (select s.attributes->>'code' from shift_assignments sa
               join shifts s on s.tenant_id = sa.tenant_id and s.id = sa.shift_id
              where sa.tenant_id = $1 and sa.employee_id = $2::uuid
                and coalesce(sa.record_status, '') = 'active'
                and coalesce(sa.attributes->>'active', 'true') <> 'false'
              order by coalesce(sa.attributes->>'effective_from', '') desc, sa.created_at desc limit 1),
            (select d.assigned_shift from attendance_days d
              where d.tenant_id = $1 and d.employee_id = $2::uuid
              order by d.attendance_date desc limit 1)) as shift_code`,
      [access.tenantId, employeeId],
    ),
  ]);
  return (rows as Array<{ shift_code: string | null }>)[0]?.shift_code ?? null;
}

/**
 * RL-15 / W-02. The unused tail of an approved leave is released: the days go
 * back to the balance as a reversal of the original availing, and the attendance
 * for them is marked present. Both commit together or neither does.
 *
 * W-02 puts this at the HR Head, so it is gated on `leave.approve` and that role
 * — read permission used to be enough to mutate attendance and the ledger.
 */
export async function recordEarlyReturn(access: Access, id: string, input: z.infer<typeof earlyReturnSchema>, requestId: string) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  if (!access.context.roles.includes(HR_HEAD_ROLE)) {
    throw new HttpError({
      status: 403,
      code: "FORBIDDEN",
      message: `W-02 puts an early return at the HR Head. The current user does not hold the "${HR_HEAD_ROLE}" role.`,
    });
  }
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

  // The days being released. The return date itself is worked, so it is included.
  const releasedDates: string[] = [];
  for (let date = input.actualReturnDate; date <= request.ends_on; date = addDays(date, 1)) releasedDates.push(date);

  const [existingDayRows, debitRows] = await tenantTx(access, [
    sqlClient`
      select attendance_date::text as attendance_date, locked_at
      from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = ${request.employee_id}
        and attendance_date >= ${input.actualReturnDate}::date and attendance_date <= ${request.ends_on}::date
    `,
    sqlClient`
      select id from leave_ledger_entries
      where tenant_id = ${access.tenantId} and leave_request_id = ${id} and attributes->>'kind' = 'debit'
      order by created_at asc limit 1
    `,
  ]);
  const existingDays = existingDayRows as Array<{ attendance_date: string; locked_at: string | null }>;
  const locked = existingDays.find((day) => day.locked_at !== null);
  if (locked) {
    throw new HttpError({
      status: 422,
      code: "PERIOD_LOCKED",
      message: `Attendance for ${locked.attendance_date} is locked, so the release cannot be posted. W-02 requires the attendance correction and the ledger credit to commit together; raise a regularisation instead.`,
    });
  }
  const present = new Set(existingDays.map((day) => day.attendance_date));
  const missing = releasedDates.filter((date) => !present.has(date));
  const shiftCode = missing.length > 0 ? await rosteredShiftCode(access, request.employee_id) : null;
  if (missing.length > 0 && shiftCode === null) {
    throw new HttpError({
      status: 422,
      code: "ATTENDANCE_SHIFT_UNRESOLVED",
      message: `${missing.length} of the released days have no attendance record and the employee has no shift to create one against. Assign a shift (shift_assignments) before recording the early return — a day created on the wrong shift is measured against the wrong thresholds.`,
      details: [{ field: "assigned_shift", issue: `No active shift assignment and no prior attendance day for ${request.employee_id}.` }],
    });
  }
  // The credit reverses the availing debit, so the register shows it as a
  // reversal of the original movement rather than an unexplained credit.
  const debit = (debitRows as Array<{ id: string }>)[0] ?? null;

  await tenantTx(access, [
    sqlClient`update leave_requests set actual_return_date = ${input.actualReturnDate}, updated_at = now() where id = ${id} and tenant_id = ${access.tenantId}`,
    // A leave day carries no attendance row until something creates one — punch
    // ingestion is the only other writer — so the correction has to insert as
    // well as update. The old UPDATE matched nothing and reported nothing.
    sqlClient.query(
      `insert into attendance_days (id, tenant_id, employee_id, attendance_date, assigned_shift, status)
       select gen_random_uuid(), $1::uuid, $2::uuid, day::date, $4::text, 'present'
       from unnest($3::text[]) as day`,
      [access.tenantId, request.employee_id, missing, shiftCode ?? ""],
    ),
    sqlClient`
      update attendance_days set status = 'present', updated_at = now()
      where tenant_id = ${access.tenantId} and employee_id = ${request.employee_id}
        and attendance_date >= ${input.actualReturnDate}::date and attendance_date <= ${request.ends_on}::date
        and locked_at is null
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, reverses_entry_id, attributes)
      values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id}, ${debit?.id ?? null},
        ${JSON.stringify({
          kind: "credit",
          days: reconciliation.leaveDaysCreditedBack,
          leave_type: request.leave_type,
          effective_date: input.actualReturnDate,
          source: "leave.early_return",
          note: `Early return on ${input.actualReturnDate}; ${releasedDates.length} day(s) released`,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.early_return', 'leave_request', ${id}, 'Early return recorded',
        ${JSON.stringify({ ...reconciliation, releasedDates, attendanceDaysCreated: missing.length, reversesEntryId: debit?.id ?? null })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return {
    id,
    ...reconciliation,
    releasedDates,
    attendanceDaysMarkedPresent: releasedDates.length,
    attendanceDaysCreated: missing.length,
    reversesEntryId: debit?.id ?? null,
  };
}

/** Day types a comp-off may be claimed against: the workbook allows only these. */
const COFF_CLAIMABLE_DAY_TYPES = ["weekly_off_rest_day", "holiday", "national_holiday"];

/**
 * The worked day behind a comp-off claim: its day type, the minutes actually
 * worked, and whether overtime was already claimed for it.
 *
 * Both attendance stores are read because different paths write them — the
 * envelope entry carries the day type the calendar produced, the typed
 * attendance day carries what the punch engine computed.
 */
async function coffWorkedDay(access: Access, employeeId: string, workedDate: string) {
  const [entryRows, dayRows, otRows] = await tenantTx(access, [
    sqlClient`
      select attributes->>'day_type' as day_type,
             case when attributes->>'gross_minutes' ~ '^[0-9]+$' then (attributes->>'gross_minutes')::int end as gross_minutes,
             case when attributes->>'net_minutes' ~ '^[0-9]+$' then (attributes->>'net_minutes')::int end as net_minutes
      from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attributes->>'date' = ${workedDate}
      limit 1
    `,
    sqlClient`
      select status, assigned_shift, productive_minutes, gross_span_minutes
      from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attendance_date = ${workedDate}::date
      limit 1
    `,
    sqlClient`
      select count(*)::int as total from overtime_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attributes->>'ot_date' = ${workedDate}
    `,
  ]);
  const entry = (entryRows as Array<{ day_type: string | null; gross_minutes: number | null; net_minutes: number | null }>)[0];
  const day = (dayRows as Array<{ status: string; assigned_shift: string; productive_minutes: number; gross_span_minutes: number }>)[0];
  if (!entry && !day) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "No attendance is recorded on that date, so no compensatory off can be claimed for it.",
    });
  }
  const rawDayType = (entry?.day_type ?? "").trim().toLowerCase();
  const dayType =
    rawDayType === "" ? ""
    : rawDayType.includes("national") ? "national_holiday"
    : rawDayType.includes("holiday") ? "holiday"
    : rawDayType.includes("off") || rawDayType.includes("rest") ? "weekly_off_rest_day"
    : "working_day";
  if (dayType === "") {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The day type for that date is not recorded, so it cannot be confirmed as a rest day or holiday.",
    });
  }
  if (!COFF_CLAIMABLE_DAY_TYPES.includes(dayType)) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "Compensatory off is claimable only against a rest day or a holiday.",
    });
  }
  if (((otRows as Array<{ total: number }>)[0]?.total ?? 0) > 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "Overtime is already claimed for that date; overtime and compensatory off cannot both be claimed for the same day.",
    });
  }
  const workedMinutes = entry?.net_minutes ?? entry?.gross_minutes ?? day?.productive_minutes ?? day?.gross_span_minutes ?? 0;
  if (workedMinutes <= 0) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "No worked minutes are recorded on that date, so no compensatory off can be credited.",
    });
  }
  return { dayType, workedMinutes, shiftCode: day?.assigned_shift ?? null };
}

/**
 * The credit a worked day earns: half a day or a whole one, decided by the
 * shift's own thresholds. Those thresholds are configuration (FRM-TIM-01 Shift
 * Master); when a shift does not carry them the claim is refused naming the
 * missing setting, exactly as the payroll rule pack refuses an unsupplied rule.
 * Nothing here defaults a threshold.
 */
async function coffCreditDays(access: Access, shiftCode: string | null, workedMinutes: number): Promise<number> {
  // The thresholds come from the shift master record the engine itself reads
  // (`hrms_operation_records`, resource `shifts` — the row FRM-TIM-01 writes), not from
  // the canonical `shifts` table. That table is a different store with its own codes
  // (`SH-A`, not `A`) and no half-day column at all, so the old lookup could only ever
  // match nothing and refuse: the day engine and the comp-off credit were deciding the
  // same shift from two different places. One resolver now answers for both.
  if (shiftCode === null || shiftCode.trim() === "") {
    throw new HttpError({
      status: 422,
      code: "RULE_PACK_INCOMPLETE",
      message: "The worked day names no shift, so the thresholds a compensatory-off credit is decided by cannot be read. Process the day against its shift first.",
    });
  }
  const record = await resolveShift(access, shiftCode);
  const shift = {
    half_day_below_minutes: record.thresholds.halfDayBelowMinutes,
    full_day_minutes: record.durationMinutes,
  };
  if (!Number.isFinite(shift.half_day_below_minutes) || !Number.isFinite(shift.full_day_minutes) || shift.full_day_minutes <= 0) {
    throw new HttpError({
      status: 422,
      code: "RULE_PACK_INCOMPLETE",
      message: "The shift does not carry the half-day and full-day thresholds a compensatory-off credit is decided by. Configure them on the shift master first.",
    });
  }
  if (workedMinutes < shift.half_day_below_minutes) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "The minutes worked fall below the shift's half-day threshold, so no compensatory off is earned.",
    });
  }
  return workedMinutes >= shift.full_day_minutes ? 1 : 0.5;
}

export const grantCoffSchema = z.object({
  employeeId: z.string().uuid(),
  /** The workbook's `worked_date`; the app has always called it the earned-on date. */
  earnedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(10).max(300),
});

export async function grantCoff(access: Access, input: z.infer<typeof grantCoffSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await employeeProfile(access, input.employeeId);
  const worked = await coffWorkedDay(access, input.employeeId, input.earnedOn);
  // The credit is derived from the minutes worked, never taken as a free-text number.
  const days = await coffCreditDays(access, worked.shiftCode, worked.workedMinutes);
  const hoursWorked = Math.round((worked.workedMinutes / 60) * 100) / 100;
  const typeId = await ensureLeaveType(access, "COFF");
  // RL-06's window comes from the scheme, so the grant and the nightly lapse run
  // can never disagree — and so a tenant that has not answered Q-07 is refused
  // here rather than given a grant with an expiry nobody approved.
  const expiresOn = grantLapseDate(input.earnedOn, await loadLeaveScheme(access));
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into comp_off_grants (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({
          days,
          days_remaining: days,
          earned_on: input.earnedOn,
          day_type: worked.dayType,
          hours_worked: hoursWorked,
          ot_claimed: false,
          expires_on: expiresOn,
          status: "available",
          reason: input.reason,
          // FRM-LVE-03 records who decided a comp-off and what they decided. A grant made
          // directly by HR is an approved claim: the granter is the approver and the grant
          // reason is the decision. Leaving these null on half the register's rows would
          // make the decision look missing rather than implicit.
          approver_id: access.context.actorUserId,
          decision: "approved",
          decision_remarks: input.reason,
          decided_at: new Date().toISOString(),
          granted_directly: true,
        })}::jsonb)
    `,
    sqlClient`
      insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes)
      values (${access.tenantId}, ${input.employeeId}, ${typeId}, ${id},
        ${JSON.stringify({ kind: "grant", days, leave_type: "COFF", note: "COFF granted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.coff_grant', 'comp_off_grant', ${id}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, expiresOn, days, dayType: worked.dayType, hoursWorked };
}

/**
 * The leave requests this caller may read.
 *
 * A caller without `leave.approve` and without an administrative principal is
 * pinned to their own employee row: the id is bound into both statements, so a
 * client-supplied `employeeId` naming somebody else is discarded rather than
 * refused, and no row belonging to another employee is ever on the wire.
 */
export async function listLeaveRequests(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  const resolved = resolveLeaveReadScope(access);
  const employeeFilter = leaveEmployeeFilter(resolved, args.employeeId);
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from leave_requests
      where tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or employee_id = ${employeeFilter}::uuid)
        and (${args.status ?? null}::text is null or status = ${args.status})
    `,
    sqlClient`
      select id, employee_id, leave_type, starts_on::text as starts_on, ends_on::text as ends_on,
             requested_days::float as requested_days, status, reason,
             coalesce((attributes->>'is_half_day_start')::bool, false) as is_half_day_start,
             coalesce((attributes->>'is_half_day_end')::bool, false) as is_half_day_end,
             attributes->>'half_day_session' as half_day_session,
             attributes->>'document_ref' as document_ref,
             attributes->>'contact' as contact,
             attributes->>'leave_address' as leave_address,
             attributes->>'handover_person_id' as handover_person_id
      from leave_requests
      where tenant_id = ${access.tenantId}
        and (${employeeFilter}::uuid is null or employee_id = ${employeeFilter}::uuid)
        and (${args.status ?? null}::text is null or status = ${args.status})
      order by created_at desc limit ${args.pageSize} offset ${offset}
    `,
  ]);
  return { items: rows, total: ((countRows as Array<{ total: number }>)[0]?.total ?? 0) };
}

export const cancelLeaveSchema = z.object({
  /** FRM-LVE-02 `cancel_reason`. A withdrawal has to say why, like every other decision. */
  reason: z.string().trim().min(10).max(300),
});

/**
 * Withdraw a leave request (FRM-LVE-02 `cancel_reason`).
 *
 * `cancelled` existed as a status filter that nothing could ever set: there was no route,
 * no service function and no way to give back the days a cancelled request was holding.
 *
 * Cancelling is withdrawing leave that has not been taken, which is why it is refused once
 * the absence has begun — returning part-way through is an early return, and that flow
 * already exists and settles the days properly. The ledger movement the request is holding
 * is reversed by a linked entry rather than deleted, so the balance nets out and the
 * history still shows the request was raised.
 */
export async function cancelLeave(
  access: Access,
  id: string,
  input: z.infer<typeof cancelLeaveSchema>,
  requestId: string,
) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [requestRows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, leave_type, leave_type_id, status,
             starts_on::text as starts_on, requested_days::float as requested_days
      from leave_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1
    `,
  ]);
  const request = (requestRows as Array<{
    id: string; employee_id: string; leave_type: string; leave_type_id: string;
    status: string; starts_on: string; requested_days: number;
  }>)[0];
  if (!request) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (["cancelled", "rejected"].includes(request.status)) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Leave request is already ${request.status}.` });
  }

  // The applicant may withdraw their own; anyone else needs the approval permission. An
  // approver cancelling somebody's leave is a real action, but it is not a self-service one.
  const isApplicant = access.context.employeeId !== undefined && access.context.employeeId === request.employee_id;
  if (!isApplicant) enforce(access.context, "leave.approve", { tenantId: access.tenantId });

  const today = new Date().toISOString().slice(0, 10);
  if (request.starts_on <= today) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: "This leave has already begun, so it cannot be withdrawn. Record an early return instead, which settles the days actually taken.",
      details: [{ field: "startsOn", issue: `The absence started on ${request.starts_on}.` }],
    });
  }

  // Whatever the request is currently holding: the approval debit if it was approved,
  // otherwise the reservation taken at submit. Reversing the wrong one would leave the
  // other standing and quietly consume the days for good.
  const [ledgerRows] = await tenantTx(access, [
    sqlClient`
      select id, attributes->>'kind' as kind,
             case when attributes->>'days' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (attributes->>'days')::float else 0 end as days
      from leave_ledger_entries
      where tenant_id = ${access.tenantId} and leave_request_id = ${id}
        and attributes->>'kind' in ('debit', 'reserve')
        and not exists (
          select 1 from leave_ledger_entries reversal
          where reversal.tenant_id = leave_ledger_entries.tenant_id
            and reversal.reverses_entry_id = leave_ledger_entries.id
        )
      order by created_at desc limit 1
    `,
  ]);
  const holding = (ledgerRows as Array<{ id: string; kind: string; days: number }>)[0] ?? null;

  await tenantTx(access, [
    sqlClient`
      update leave_requests
      set status = 'cancelled',
          attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
            cancel_reason: input.reason,
            cancelled_at: new Date().toISOString(),
            cancelled_by_user_id: access.context.actorUserId,
            cancelled_from_status: request.status,
          })}::jsonb,
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    // Approval steps still waiting are closed with the request; leaving them pending
    // would keep it in every approver's queue after it had gone.
    sqlClient`
      update leave_approvals set status = 'cancelled', decided_at = now(), comment = ${input.reason}
      where tenant_id = ${access.tenantId} and leave_request_id = ${id} and status = 'pending'
    `,
    ...(holding
      ? [sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, reverses_entry_id, attributes)
        values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id}, ${holding.id},
          ${JSON.stringify({
            kind: "credit",
            days: holding.days,
            leave_type: request.leave_type,
            effective_date: today,
            source: "leave.cancel",
            note: `Request withdrawn before it began: ${input.reason}`,
          })}::jsonb)
      `]
      : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.cancel', 'leave_request', ${id}, ${input.reason},
        ${JSON.stringify({ from: request.status, days: request.requested_days, reversed_entry_id: holding?.id ?? null })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
    sqlClient`
      insert into transactional_outbox (tenant_id, event_type, aggregate_type, aggregate_id, payload)
      values (${access.tenantId}, 'leave.cancelled', 'leave_request', ${id},
        ${JSON.stringify({ employeeId: request.employee_id, leaveType: request.leave_type, days: request.requested_days })}::jsonb)
    `,
  ]);
  return {
    id,
    status: "cancelled" as const,
    cancelReason: input.reason,
    /** The movement given back, so the caller can show the balance it restored. */
    daysReturned: holding?.days ?? 0,
    reversesEntryId: holding?.id ?? null,
  };
}

/**
 * FRM-LVE-03 Comp-Off Claim: `approver_id`, `decision`, `decision_remarks`.
 *
 * The form is a claim an employee raises against a day they worked; the workbook gives it
 * an approver and a recorded decision. Only the HR-side grant existed — it credited the
 * balance the moment it was called — so a claim had no approval step at all and the three
 * decision fields had nowhere to live.
 *
 * A claim derives its days exactly as the grant does, from the minutes actually worked, so
 * the two paths can never credit different amounts for the same day. What it does not do
 * is touch the ledger: nothing is credited until somebody approves it.
 */
export const claimCoffSchema = grantCoffSchema;

export const decideCoffSchema = z.object({
  approve: z.boolean(),
  /** The workbook's `decision_remarks`. A refusal has to say why. */
  remarks: z.string().trim().min(10).max(300),
});

export async function claimCoff(access: Access, input: z.infer<typeof claimCoffSchema>, requestId: string) {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  // An employee claims their own; claiming for somebody else is an HR action.
  const forSomebodyElse = access.context.employeeId !== input.employeeId;
  if (forSomebodyElse) enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await employeeProfile(access, input.employeeId);
  const worked = await coffWorkedDay(access, input.employeeId, input.earnedOn);
  const days = await coffCreditDays(access, worked.shiftCode, worked.workedMinutes);
  const hoursWorked = Math.round((worked.workedMinutes / 60) * 100) / 100;
  // The expiry window is resolved now, so a claim approved weeks later still lapses from
  // the day that was worked rather than from the day somebody got round to deciding it.
  const expiresOn = grantLapseDate(input.earnedOn, await loadLeaveScheme(access));
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into comp_off_grants (id, tenant_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId},
        ${JSON.stringify({
          days,
          days_remaining: days,
          earned_on: input.earnedOn,
          day_type: worked.dayType,
          hours_worked: hoursWorked,
          ot_claimed: false,
          expires_on: expiresOn,
          status: "pending",
          reason: input.reason,
          claimed_by_user_id: access.context.actorUserId,
          approver_id: null,
          decision: null,
          decision_remarks: null,
        })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'leave.coff_claim', 'comp_off_grant', ${id}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "pending" as const, expiresOn, days, dayType: worked.dayType, hoursWorked };
}

/**
 * Decide a claim. Approving is what credits the balance, so a claim that is never decided
 * never becomes leave — which is the whole point of the step.
 */
export async function decideCoff(
  access: Access,
  id: string,
  input: z.infer<typeof decideCoffSchema>,
  requestId: string,
) {
  enforce(access.context, "leave.approve", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select id, employee_id, attributes->>'status' as status,
             case when attributes->>'days' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (attributes->>'days')::float else 0 end as days,
             attributes->>'claimed_by_user_id' as claimed_by_user_id
      from comp_off_grants where tenant_id = ${access.tenantId} and id = ${id} limit 1
    `,
  ]);
  const grant = (rows as Array<{ id: string; employee_id: string; status: string | null; days: number; claimed_by_user_id: string | null }>)[0];
  if (!grant) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (grant.status !== "pending") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `This comp-off claim is already ${grant.status ?? "decided"}.` });
  }
  if (grant.claimed_by_user_id !== null && grant.claimed_by_user_id === access.context.actorUserId) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Self-approval is not permitted: a comp-off claim must be decided by somebody other than the person who raised it." });
  }
  const typeId = await ensureLeaveType(access, "COFF");
  const decision = input.approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update comp_off_grants
      set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({
        status: input.approve ? "available" : "rejected",
        approver_id: access.context.actorUserId,
        decision,
        decision_remarks: input.remarks,
        decided_at: new Date().toISOString(),
      })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    ...(input.approve
      ? [sqlClient`
        insert into leave_ledger_entries (tenant_id, employee_id, leave_type_id, comp_off_grant_id, attributes)
        values (${access.tenantId}, ${grant.employee_id}, ${typeId}, ${id},
          ${JSON.stringify({ kind: "grant", days: grant.days, leave_type: "COFF", note: `COFF claim approved: ${input.remarks}` })}::jsonb)
      `]
      : []),
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${input.approve ? "leave.coff_approve" : "leave.coff_reject"}, 'comp_off_grant', ${id}, ${input.remarks},
        ${JSON.stringify({ decision, days: grant.days })}::jsonb, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: input.approve ? ("available" as const) : ("rejected" as const), decision, days: input.approve ? grant.days : 0 };
}
