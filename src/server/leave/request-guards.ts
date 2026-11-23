import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { splitMovement } from "./ledger-register";
import { assertMayActFor, can, resolveEmployee, type LeaveEmployee } from "./workspace";

/**
 * Invariants checked before a leave request reaches the legacy submit service
 * (which does not check them): the applicant exists in the tenant and the
 * caller may act for them, no overlap with a live request (INV-LEV-02), and the
 * ledger balance stays >= 0 after pending reservations (INV-LEV-01).
 */

/** Leave types whose balance comes from the ledger and must never go negative. */
export const BALANCE_CHECKED_TYPES = new Set(["EL", "CL", "SL", "COFF"]);

/** Statuses that no longer hold days or block dates. */
export const CLOSED_STATUSES = ["rejected", "cancelled", "canceled", "withdrawn"];

export const leaveSubmissionExtrasSchema = z.object({
  contact: z.string().trim().max(200).optional(),
  halfDaySession: z.enum(["first_half", "second_half"]).optional(),
});

export type LeaveSubmission = {
  employeeId: string;
  leaveType: string;
  startsOn: string;
  endsOn: string;
  days: number;
};

/** Available = ledger credits - ledger debits - days reserved by pending requests (unit-tested). */
export function availableAfterReservations(
  movements: Array<{ transactionType: string | null; days: number }>,
  pendingDays: number,
): number {
  let total = 0;
  for (const movement of movements) {
    const { credit, debit } = splitMovement(movement.transactionType, Number(movement.days) || 0);
    total += credit - debit;
  }
  return Math.round((total - pendingDays) * 100) / 100;
}

/** Validates the span shape (unit-tested): end on/after start, half day only on a one-day span. */
export function assertSpanShape(input: LeaveSubmission, halfDaySession: string | undefined): void {
  if (input.endsOn < input.startsOn) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "The leave period ends before it starts.", details: [{ field: "endsOn", issue: "before_start" }] });
  }
  const spanDays = Math.round((Date.parse(input.endsOn) - Date.parse(input.startsOn)) / 86_400_000) + 1;
  if (input.days > spanDays) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "More days are requested than the period contains.", details: [{ field: "days", issue: "exceeds_span" }] });
  }
  if (halfDaySession && (input.startsOn !== input.endsOn || input.days !== 0.5)) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "A half day applies to a single date of 0.5 days.", details: [{ field: "halfDaySession", issue: "single_day_only" }] });
  }
  if (Math.round(input.days * 2) !== input.days * 2) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Leave is taken in steps of half a day.", details: [{ field: "days", issue: "half_day_steps" }] });
  }
}

export async function assertLeaveRequestAllowed(
  access: Access,
  input: LeaveSubmission,
  halfDaySession?: string,
): Promise<LeaveEmployee> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  assertSpanShape(input, halfDaySession);
  const employee = await resolveEmployee(access, input.employeeId);
  assertMayActFor(access, employee.id);

  const [overlapRows, ledgerRows, pendingRows] = await tenantTx(access, [
    sqlClient.query(
      `select id, starts_on::text as starts_on, ends_on::text as ends_on from leave_requests
        where tenant_id = $1 and employee_id = $2::uuid
          and lower(coalesce(status, '')) <> all($3::text[])
          and actual_return_date is null
          and starts_on <= $5::date and ends_on >= $4::date
        limit 1`,
      [access.tenantId, employee.id, CLOSED_STATUSES, input.startsOn, input.endsOn],
    ),
    sqlClient.query(
      `select coalesce(l.attributes->>'transaction_type', l.attributes->>'kind') as "transactionType",
          case when coalesce(l.attributes->>'days', '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
               then (l.attributes->>'days')::float else 0 end as days
        from leave_ledger_entries l
        left join leave_types lt on lt.tenant_id = l.tenant_id and lt.id = l.leave_type_id
        where l.tenant_id = $1 and l.employee_id = $2::uuid
          and coalesce(lt.attributes->>'code', l.attributes->>'leave_type', '') = $3
        limit 2000`,
      [access.tenantId, employee.id, input.leaveType],
    ),
    sqlClient.query(
      `select coalesce(sum(requested_days), 0)::float as days from leave_requests
        where tenant_id = $1 and employee_id = $2::uuid and leave_type = $3
          and lower(coalesce(status, '')) like 'pending%'`,
      [access.tenantId, employee.id, input.leaveType],
    ),
  ]);
  const overlap = (overlapRows as Array<{ starts_on: string; ends_on: string }>)[0];
  if (overlap) {
    throw new HttpError({
      status: 409,
      code: "LEAVE_OVERLAP",
      message: `These dates overlap an existing leave request (${overlap.starts_on} to ${overlap.ends_on}).`,
      details: [{ field: "startsOn", issue: "overlap" }],
    });
  }
  if (BALANCE_CHECKED_TYPES.has(input.leaveType)) {
    const pending = Number((pendingRows as Array<{ days: number }>)[0]?.days) || 0;
    const available = availableAfterReservations(ledgerRows as Array<{ transactionType: string | null; days: number }>, pending);
    if (available - input.days < 0) {
      throw new HttpError({
        status: 422,
        code: "INSUFFICIENT_BALANCE",
        message: `Only ${Math.max(available, 0)} day(s) of ${input.leaveType} are available after pending requests.`,
        details: [{ field: "days", issue: "insufficient_balance" }],
      });
    }
  }
  return employee;
}

/** Stores the fields the legacy submit schema drops (contact, half-day session) on the new request. */
export async function annotateLeaveRequest(
  access: Access,
  id: string,
  extras: z.infer<typeof leaveSubmissionExtrasSchema>,
): Promise<void> {
  const attributes: Record<string, unknown> = {};
  if (extras.contact) attributes.contact = extras.contact;
  if (extras.halfDaySession) {
    attributes.is_half_day_start = true;
    attributes.half_day_session = extras.halfDaySession;
  }
  if (Object.keys(attributes).length === 0) return;
  await tenantTx(access, [
    sqlClient`update leave_requests set attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify(attributes)}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}`,
  ]);
}

/** Early return is HR/approver work, once per request: a second call would re-credit the ledger. */
export async function assertEarlyReturnOpen(access: Access, id: string): Promise<void> {
  if (!can(access, "leave.maintain") && !can(access, "leave.approve")) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "This action is not permitted for the current role." });
  }
  const [rows] = await tenantTx(access, [
    sqlClient`select actual_return_date::text as actual_return_date from leave_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const found = (rows as Array<{ actual_return_date: string | null }>)[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (found.actual_return_date) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `An early return was already recorded on ${found.actual_return_date}.` });
  }
}

export const cancelLeaveSchema = z.object({ reason: z.string().trim().min(3).max(1000) });

type CancelRow = {
  id: string;
  employee_id: string;
  leave_type: string;
  leave_type_id: string | null;
  requested_days: number;
  starts_on: string;
  status: string;
};

/**
 * Applicant (or HR) closes a request: a pending request is withdrawn and its
 * reservation released; an approved request that has not started is cancelled
 * and its debit restored. Leave already under way closes through early return.
 */
export async function cancelLeaveRequest(
  access: Access,
  id: string,
  input: z.infer<typeof cancelLeaveSchema>,
  requestId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<{ id: string; status: "cancelled"; closure: "withdrawn" | "cancelled" }> {
  enforce(access.context, "leave.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, employee_id, leave_type, leave_type_id, requested_days::float as requested_days, starts_on::text as starts_on, status
      from leave_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const request = (rows as CancelRow[])[0];
  if (!request) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  const isOwn = access.context.employeeId === request.employee_id;
  if (!isOwn && !can(access, "leave.maintain")) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "Only the applicant or HR can withdraw or cancel this request." });
  }
  const status = request.status.toLowerCase();
  const pending = status.startsWith("pending");
  if (!pending && status !== "approved") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `Leave request is already ${request.status}.` });
  }
  if (status === "approved" && request.starts_on <= today) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "Leave that has started is closed by recording an early return." });
  }
  const closure = pending ? "withdrawn" : "cancelled";
  const kind = pending ? "reserve" : "debit";
  const [sourceRows] = await tenantTx(access, [
    sqlClient`select id from leave_ledger_entries where tenant_id = ${access.tenantId} and leave_request_id = ${id} and attributes->>'kind' = ${kind} limit 1`,
  ]);
  const source = (sourceRows as Array<{ id: string }>)[0];
  const ledger = pending
    ? { kind: "release", note: "Released on withdrawal" }
    : { kind: "credit", note: "Restored on cancellation" };
  await tenantTx(access, [
    sqlClient`update leave_requests set status = 'cancelled', attributes = coalesce(attributes, '{}'::jsonb) || ${JSON.stringify({ closure, closure_reason: input.reason })}::jsonb, updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id} and status = ${request.status}`,
    sqlClient`update leave_approvals set status = 'cancelled', decided_at = now(), comment = ${input.reason}
      where tenant_id = ${access.tenantId} and leave_request_id = ${id} and status = 'pending'`,
    ...(source
      ? [sqlClient`insert into leave_ledger_entries (tenant_id, employee_id, leave_request_id, leave_type_id, reverses_entry_id, attributes)
          values (${access.tenantId}, ${request.employee_id}, ${id}, ${request.leave_type_id}, ${source.id},
            ${JSON.stringify({ kind: ledger.kind, days: request.requested_days, leave_type: request.leave_type, note: ledger.note })}::jsonb)`]
      : []),
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`leave.${closure === "withdrawn" ? "withdraw" : "cancel"}`}, 'leave_request', ${id}, ${input.reason}, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, status: "cancelled", closure };
}
