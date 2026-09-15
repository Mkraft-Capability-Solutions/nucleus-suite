import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
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

export const requestRegularizationSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["missing-punch", "shift-correct", "break-correct"]),
  reason: z.string().trim().min(1).max(500),
  claimedIn: z.string().trim().max(20).optional(),
  claimedOut: z.string().trim().max(20).optional(),
});

export async function listRegularizations(access: Access) {
  enforce(access.context, "attendance.read", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`
      select ar.id, ar.attendance_entry_id, ar.attributes, ar.created_at,
             e.first_name, e.last_name, e.employee_code
      from attendance_regularizations ar
      left join attendance_entries ae on ae.id = ar.attendance_entry_id
      left join employees e on e.id = ae.employee_id
      where ar.tenant_id = ${access.tenantId}
      order by ar.created_at desc
      limit 100
    `,
  ]);
  return rows as Array<{
    id: string;
    attendance_entry_id: string;
    attributes: Record<string, unknown>;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    employee_code: string | null;
  }>;
}

export async function requestRegularization(access: Access, input: z.infer<typeof requestRegularizationSchema>, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  let targetEmployeeId = input.employeeId;
  const [empRows] = await tenantTx(access, [
    sqlClient`select id from employees where tenant_id = ${access.tenantId} and (id::text = ${targetEmployeeId} or employee_code = ${targetEmployeeId}) limit 1`,
  ]);
  const emp = (empRows as Array<{ id: string }>)[0];
  if (emp) targetEmployeeId = emp.id;

  await assertAttendanceEmployeeVisible(access, targetEmployeeId);
  const entryId = await ensureEntry(access, targetEmployeeId, input.date);
  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into attendance_regularizations (id, tenant_id, attendance_entry_id, attributes)
      values (${id}, ${access.tenantId}, ${entryId},
        ${JSON.stringify({ employee_id: targetEmployeeId, date: input.date, kind: input.kind, reason: input.reason, claimed_in: input.claimedIn ?? null, claimed_out: input.claimedOut ?? null, status: "submitted" })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.regularize_request', 'attendance_regularization', ${id}, 'Regularization requested', ${uuidOrNull(requestId)}::uuid)
    `,
  ]);
  return { id, status: "submitted" };
}

export async function decideRegularization(access: Access, id: string, approve: boolean, requestId: string) {
  enforce(access.context, "attendance.write", { tenantId: access.tenantId });
  const [rows] = await tenantTx(access, [
    sqlClient`select id, attributes from attendance_regularizations where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const regularization = (rows as Array<{ id: string; attributes: { status: string } }>)[0];
  if (!regularization) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
  if (regularization.attributes.status !== "submitted") {
    throw new HttpError({ status: 409, code: "VERSION_CONFLICT", message: "The regularization is already decided." });
  }
  const status = approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update attendance_regularizations set attributes = attributes || ${JSON.stringify({ status, decided_by: access.context.actorUserId })}::jsonb
      where id = ${id} and tenant_id = ${access.tenantId}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${`attendance.regularize_${status}`}, 'attendance_regularization', ${id}, 'Regularization decided', ${uuidOrNull(requestId)}::uuid)
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
