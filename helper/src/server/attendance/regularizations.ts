import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { picklistValues } from "@/lib/picklists";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { assertAttendanceEmployeeVisible, ensureShift } from "@/server/attendance/service";
import { HttpError } from "@/server/platform/http";

async function ensurePolicy(access: Access): Promise<string> {
  const [rows] = await tenantTx(access, [
    sqlClient`select id from attendance_policies where tenant_id = ${access.tenantId} and attributes->>'code' = 'STD' limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`insert into attendance_policies (id, tenant_id, attributes) values (${id}, ${access.tenantId}, '{"code":"STD","grace_minutes":15}'::jsonb)`,
  ]);
  return id;
}

async function ensureEntry(access: Access, employeeId: string, date: string): Promise<string> {
  const policyId = await ensurePolicy(access);
  const [rows] = await tenantTx(access, [
    sqlClient`select id from attendance_entries where tenant_id = ${access.tenantId} and employee_id = ${employeeId} and attributes->>'date' = ${date} limit 1`,
  ]);
  const existing = (rows as Array<{ id: string }>)[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into attendance_entries (id, tenant_id, attendance_policy_id, employee_id, attributes)
      values (${id}, ${access.tenantId}, ${policyId}, ${employeeId}, ${JSON.stringify({ date })}::jsonb)
    `,
  ]);
  return id;
}

/**
 * Regularisation types that correct the punch pair. The workbook makes the
 * requested in/out times mandatory for exactly these, and optional for the rest
 * (an on-duty or work-from-home claim has no punch to correct).
 */
const PUNCH_CORRECTION_KINDS: readonly string[] = ["missing_punch", "device_failure"];

export const requestRegularizationSchema = z
  .object({
    employeeId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(picklistValues("PL_REGULARISATION_TYPE")),
    reason: z.string().trim().min(15).max(500),
    claimedIn: z.string().trim().max(20).optional(),
    claimedOut: z.string().trim().max(20).optional(),
    documentRef: z.string().trim().min(1).max(500).optional(),
  })
  .refine(
    (input) => !PUNCH_CORRECTION_KINDS.includes(input.kind) || (input.claimedIn !== undefined && input.claimedOut !== undefined),
    { path: ["claimedIn"], message: "A punch correction must state both the requested in and out times." },
  );

/**
 * How many regularisations this employee has already raised in the request's own
 * month, and the cap the attendance policy stores. The cap is a configured value:
 * when the policy carries none it is reported as null and nothing is blocked,
 * rather than a limit being assumed here.
 */
async function monthlyRegularisationUsage(access: Access, employeeId: string, month: string) {
  const [rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as used,
             (select case when coalesce(p.attributes->>'monthly_regularisation_cap', '') ~ '^[0-9]+$'
                          then (p.attributes->>'monthly_regularisation_cap')::int end
                from attendance_policies p
                where p.tenant_id = ${access.tenantId} and p.attributes->>'code' = 'STD' limit 1) as cap
      from attendance_regularizations r
      where r.tenant_id = ${access.tenantId}
        and r.attributes->>'employee_id' = ${employeeId}
        and left(coalesce(r.attributes->>'date', ''), 7) = ${month}
        and coalesce(r.attributes->>'status', '') <> 'rejected'
    `,
  ]);
  const row = (rows as Array<{ used: number; cap: number | null }>)[0];
  return { used: row?.used ?? 0, cap: row?.cap ?? null };
}

export async function requestRegularization(access: Access, input: z.infer<typeof requestRegularizationSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  await assertAttendanceEmployeeVisible(access, input.employeeId);
  const month = input.date.slice(0, 7);
  const usage = await monthlyRegularisationUsage(access, input.employeeId, month);
  if (usage.cap !== null && usage.used >= usage.cap) {
    throw new HttpError({
      status: 422,
      code: "POLICY_VIOLATION",
      message: `The attendance policy allows ${String(usage.cap)} regularisation(s) per month and ${String(usage.used)} are already raised for ${month}.`,
    });
  }
  const entryId = await ensureEntry(access, input.employeeId, input.date);
  // FRM-TIM-05 `current_status`: the day's verdict as it stands when the correction is
  // raised, captured rather than looked up later. Approving the correction changes the
  // day, so a reader coming back afterwards could no longer tell what was being corrected.
  const [statusRows] = await tenantTx(access, [
    sqlClient`
      select status from attendance_days
      where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and attendance_date = ${input.date}::date
      limit 1
    `,
  ]);
  const currentStatus = (statusRows as Array<{ status: string | null }>)[0]?.status ?? null;
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into attendance_regularizations (id, tenant_id, attendance_entry_id, attributes)
      values (${id}, ${access.tenantId}, ${entryId},
        ${JSON.stringify({ employee_id: input.employeeId, date: input.date, kind: input.kind, reason: input.reason, claimed_in: input.claimedIn ?? null, claimed_out: input.claimedOut ?? null, document_ref: input.documentRef ?? null, current_status: currentStatus, used_this_month: usage.used + 1, monthly_cap: usage.cap, status: "submitted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.regularize_request', 'attendance_regularization', ${id}, 'Regularization requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted", usedThisMonth: usage.used + 1, monthlyCap: usage.cap };
}

export const decideRegularizationSchema = z
  .object({
    approve: z.boolean(),
    decisionRemarks: z.string().trim().min(10).max(300).optional(),
  })
  // The workbook makes the remark mandatory only when the request is refused.
  .refine((input) => input.approve || input.decisionRemarks !== undefined, {
    path: ["decisionRemarks"],
    message: "A rejection must carry its remarks.",
  });

export async function decideRegularization(
  access: Access,
  id: string,
  input: z.infer<typeof decideRegularizationSchema>,
  requestId: string,
) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from attendance_regularizations where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const regularization = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!regularization) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (regularization.attributes.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The regularization is already decided." });
  }
  const status = input.approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update attendance_regularizations set attributes = attributes || ${JSON.stringify({ status, decided_by: access.context.actorUserId, decision_remarks: input.decisionRemarks ?? null })}::jsonb
      where id = ${id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.regularize_${status}`}, 'attendance_regularization', ${id}, ${input.decisionRemarks ?? "Regularization decided"}, ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status };
}

export const requestShiftSwapSchema = z.object({
  requesterEmployeeId: z.string().uuid(),
  counterpartyEmployeeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(500),
});

export async function requestShiftSwap(access: Access, input: z.infer<typeof requestShiftSwapSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  if (input.requesterEmployeeId === input.counterpartyEmployeeId) {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "Self-swaps are meaningless." });
  }
  const fromShiftId = await ensureShift(access, "A");
  const toShiftId = await ensureShift(access, "B");
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into shift_swap_requests (id, tenant_id, counterparty_employee_id, from_shift_id, requester_employee_id, to_shift_id, attributes)
      values (${id}, ${access.tenantId}, ${input.counterpartyEmployeeId}, ${fromShiftId}, ${input.requesterEmployeeId}, ${toShiftId},
        ${JSON.stringify({ date: input.date, reason: input.reason, status: "submitted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.swap_request', 'shift_swap_request', ${id}, 'Shift swap requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted" };
}

export async function decideShiftSwap(access: Access, id: string, approve: boolean, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from shift_swap_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const swap = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!swap) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (swap.attributes.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The swap is already decided." });
  }
  const status = approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update shift_swap_requests set attributes = attributes || ${JSON.stringify({ status, decided_by: access.context.actorUserId })}::jsonb
      where id = ${id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.swap_${status}`}, 'shift_swap_request', ${id}, 'Shift swap decided', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status };
}
