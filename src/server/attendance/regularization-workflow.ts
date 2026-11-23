import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";
import { assertAttendanceEmployeeVisible, resolveAttendanceScope } from "@/server/attendance/service";

/**
 * Attendance regularization with a two-tier approval chain: shift supervisor first, then the time office.
 * submitted --supervisor approve--> supervisor_approved --time_office approve--> approved; a rejection at either
 * tier ends the request. Requests are scoped to the caller's attendance scope, a locked (payroll-closed) day cannot
 * be regularized, and nobody can decide their own request (INV-SEC-02). Every write is audited.
 */

export const REGULARIZATION_KINDS = ["missing-punch", "official-duty", "late-arrival", "system-failure", "shift-correct", "break-correct"] as const;
export const REGULARIZATION_STAGES = ["supervisor", "time_office"] as const;
export type RegularizationStage = (typeof REGULARIZATION_STAGES)[number];
export type RegularizationStatus = "submitted" | "supervisor_approved" | "approved" | "rejected";

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createRegularizationSchema = z
  .object({
    employeeId: z.string().uuid(),
    date: z.iso.date(),
    kind: z.enum(REGULARIZATION_KINDS),
    reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(500),
    claimedIn: z.string().trim().regex(CLOCK, "Use the 24-hour HH:MM format.").optional(),
    claimedOut: z.string().trim().regex(CLOCK, "Use the 24-hour HH:MM format.").optional(),
  })
  .refine((input) => !input.claimedIn || !input.claimedOut || input.claimedIn < input.claimedOut, {
    path: ["claimedOut"],
    message: "The claimed out-time must be after the claimed in-time.",
  });
export type CreateRegularization = z.infer<typeof createRegularizationSchema>;

export const decideRegularizationSchema = z
  .object({
    approve: z.boolean(),
    stage: z.enum(REGULARIZATION_STAGES).optional(),
    remarks: z.string().trim().max(300).optional(),
  })
  .refine((input) => input.approve || (input.remarks ?? "").length >= 3, {
    path: ["remarks"],
    message: "A rejection must carry remarks of at least 3 characters.",
  });
export type DecideRegularization = z.infer<typeof decideRegularizationSchema>;

/** Pure stage machine (unit-tested): the stage a status is waiting on, or null when it is settled. */
export function pendingStage(status: string | null | undefined): RegularizationStage | null {
  if (status === "submitted") return "supervisor";
  if (status === "supervisor_approved") return "time_office";
  return null;
}

/** Pure transition (unit-tested). Throws a 409 when the request is not waiting on `stage`. */
export function nextRegularizationStatus(current: string | null | undefined, stage: RegularizationStage, approve: boolean): RegularizationStatus {
  const waitingOn = pendingStage(current);
  if (waitingOn === null) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The regularization is already decided." });
  if (waitingOn !== stage) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: `The regularization is waiting on the ${waitingOn === "supervisor" ? "shift supervisor" : "time office"}.` });
  }
  if (!approve) return "rejected";
  return stage === "supervisor" ? "supervisor_approved" : "approved";
}

export type RegularizationRow = {
  id: string;
  attendance_entry_id: string;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string | null;
  date: string | null;
  kind: string | null;
  reason: string | null;
  claimed_in: string | null;
  claimed_out: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
};

export async function listRegularizationQueue(access: Access): Promise<RegularizationRow[]> {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const scope = await resolveAttendanceScope(access);
  if (scope.employeeIds.length === 0) return [];
  const [rows] = await tenantTx(access, [
    sqlClient.query(
      `select ar.id, ar.attendance_entry_id, ae.employee_id, e.employee_code,
          nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '') as employee_name,
          coalesce(nullif(ar.attributes->>'date', ''), nullif(ae.attributes->>'date', '')) as date,
          nullif(ar.attributes->>'kind', '') as kind,
          nullif(ar.attributes->>'reason', '') as reason,
          nullif(ar.attributes->>'claimed_in', '') as claimed_in,
          nullif(ar.attributes->>'claimed_out', '') as claimed_out,
          coalesce(nullif(ar.attributes->>'status', ''), 'submitted') as status,
          nullif(ar.attributes->>'decision_remarks', '') as remarks,
          ar.created_at::text as created_at
        from attendance_regularizations ar
        join attendance_entries ae on ae.tenant_id = ar.tenant_id and ae.id = ar.attendance_entry_id
        left join employees e on e.tenant_id = ae.tenant_id and e.id = ae.employee_id
        where ar.tenant_id = $1 and ae.employee_id = any($2::uuid[])
        order by ar.created_at desc
        limit 200`,
      [access.tenantId, scope.employeeIds],
    ),
  ]);
  return rows as RegularizationRow[];
}

/** The day's entry id, creating the entry under an existing attendance policy; a locked day is refused. */
async function entryForDay(access: Access, employeeId: string, date: string): Promise<string> {
  const [entryRows, policyRows] = await tenantTx(access, [
    sqlClient`select id, record_status, coalesce(attributes->>'locked_at', '') as locked_at from attendance_entries
      where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attributes->>'date' = ${date}
      order by created_at desc limit 1`,
    sqlClient`select ap.id from attendance_policies ap
      left join attendance_policy_assignments apa on apa.tenant_id = ap.tenant_id and apa.attendance_policy_id = ap.id and apa.employee_id = ${employeeId}
      where ap.tenant_id = ${access.tenantId} and ap.record_status = 'active'
      order by (apa.id is not null) desc, (upper(coalesce(ap.attributes->>'code', '')) = 'STD') desc, ap.created_at asc
      limit 1`,
  ]);
  const entry = (entryRows as Array<{ id: string; record_status: string | null; locked_at: string }>)[0];
  if (entry) {
    if (entry.record_status === "locked" || entry.locked_at !== "") {
      throw new HttpError({ status: 422, code: "PERIOD_LOCKED", message: "This attendance day is locked for payroll. Raise a post-lock adjustment instead.", details: [{ field: "date", issue: "locked" }] });
    }
    return entry.id;
  }
  const policyId = (policyRows as Array<{ id: string }>)[0]?.id;
  if (!policyId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "No attendance policy is configured for this tenant, so the day cannot be regularized yet." });
  }
  const id = randomUUID();
  await tenantTx(access, [
    sqlClient`insert into attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${policyId}, ${employeeId}, ${JSON.stringify({ date })}::jsonb)`,
  ]);
  return id;
}

export async function createRegularization(access: Access, input: CreateRegularization, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const today = new Date().toISOString().slice(0, 10);
  if (input.date > today) {
    throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: "A regularization cannot be raised for a future date.", details: [{ field: "date", issue: "future" }] });
  }
  const entryId = await entryForDay(access, input.employeeId, input.date);
  const [openRows] = await tenantTx(access, [
    sqlClient`select id from attendance_regularizations where tenant_id = ${access.tenantId} and attendance_entry_id = ${entryId}
      and coalesce(attributes->>'status', 'submitted') in ('submitted', 'supervisor_approved') limit 1`,
  ]);
  if ((openRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An open regularization already exists for this day.", details: [{ field: "date", issue: "duplicate" }] });
  }
  const id = randomUUID();
  const attributes = {
    employee_id: input.employeeId, date: input.date, kind: input.kind, reason: input.reason,
    claimed_in: input.claimedIn ?? null, claimed_out: input.claimedOut ?? null, status: "submitted",
    requested_by: access.context.actorUserId,
  };
  await tenantTx(access, [
    sqlClient`insert into attendance_regularizations (id, tenant_id, attendance_entry_id, attributes)
      values (${id}, ${access.tenantId}, ${entryId}, ${JSON.stringify(attributes)}::jsonb)`,
    sqlClient`insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.regularize_request', 'attendance_regularization', ${id}, ${input.reason}, ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)`,
  ]);
  return { id, status: "submitted" as const, date: input.date, kind: input.kind };
}

export async function decideRegularizationStage(access: Access, id: string, input: DecideRegularization, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select ar.id, ae.employee_id, coalesce(ar.attributes->>'status', 'submitted') as status
      from attendance_regularizations ar
      join attendance_entries ae on ae.tenant_id = ar.tenant_id and ae.id = ar.attendance_entry_id
      where ar.tenant_id = ${access.tenantId} and ar.id = ${id} limit 1`,
  ]);
  const found = (rows as Array<{ id: string; employee_id: string; status: string }>)[0];
  if (!found) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  await assertAttendanceEmployeeVisible(access, found.employee_id);
  if (access.context.employeeId && access.context.employeeId === found.employee_id) {
    throw new HttpError({ status: 403, code: "FORBIDDEN", message: "You cannot decide your own regularization request." });
  }
  const stage = input.stage ?? pendingStage(found.status);
  if (!stage) throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The regularization is already decided." });
  const status = nextRegularizationStatus(found.status, stage, input.approve);
  const patch = {
    status,
    [`${stage}_decision`]: input.approve ? "approved" : "rejected",
    [`${stage}_decided_by`]: access.context.actorUserId,
    decision_remarks: input.remarks ?? null,
  };
  // Guarded update and its audit row in one statement: the audit row exists only when the status really moved.
  const [updated] = await tenantTx(access, [
    sqlClient`with moved as (
        update attendance_regularizations set attributes = attributes || ${JSON.stringify(patch)}::jsonb, updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id} and coalesce(attributes->>'status', 'submitted') = ${found.status}
        returning id
      )
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      select ${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.regularize_${stage}_${input.approve ? "approve" : "reject"}`}, 'attendance_regularization', moved.id::text,
        ${input.remarks ?? "Regularization decided"}, ${JSON.stringify(patch)}::jsonb, ${uuidOrNull(requestId)}::uuid
      from moved
      returning entity_id`,
  ]);
  if ((updated as unknown[]).length === 0) {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The regularization changed while you were deciding. Refresh and retry." });
  }
  return { id, status, stage };
}
