import "server-only";

import { z } from "zod";
import { sqlClient } from "@/lib/db";
import { enforce, tenantTx, uuidOrNull, type Access } from "@/server/platform/access";
import { HttpError } from "@/server/platform/http";

// OT Rate multipliers per day type (per Indian labour law standards)
const OT_RATE_MULTIPLIERS: Record<string, number> = {
  working_day: 1.5,
  rest_day: 2.0,
  holiday: 2.0,
  national_holiday: 2.0,
};

export const createOtRequestSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  otMinutes: z.number().int().min(30).max(480), // 30 min to 8 hrs max OT
  dayType: z.enum(["working_day", "rest_day", "holiday", "national_holiday"]),
  reason: z.string().trim().min(1).max(500).optional(),
});

export async function createOtRequest(access: Access, input: z.infer<typeof createOtRequestSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  // Verify employee exists and is eligible for OT
  const [empRows] = await tenantTx(access, [
    sqlClient`
      select id, ot_eligibility, basic_salary_minor, worker_category
      from employees
      where tenant_id = ${access.tenantId} and id = ${input.employeeId} and status = 'active'
      limit 1
    `,
  ]);
  const emp = (empRows as Array<{ id: string; ot_eligibility: string; basic_salary_minor: number | null; worker_category: string }>)[0];
  if (!emp) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Active employee not found." });

  if (emp.ot_eligibility === "NONE") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee is not eligible for overtime." });
  }
  if (emp.ot_eligibility === "REST_DAYS_ONLY" && input.dayType === "working_day") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: "This employee is only eligible for OT on rest days and holidays." });
  }

  // Check for existing OT request for same date
  const [existingRows] = await tenantTx(access, [
    sqlClient`select id from ot_requests where tenant_id = ${access.tenantId} and employee_id = ${input.employeeId} and attendance_date = ${input.attendanceDate} and status not in ('rejected', 'cancelled') limit 1`,
  ]);
  if ((existingRows as unknown[]).length > 0) {
    throw new HttpError({ status: 409, code: "CONFLICT", message: "An OT request for this date already exists." });
  }

  // Calculate OT pay amount for reference
  const basicDaily = emp.basic_salary_minor ? Math.floor(emp.basic_salary_minor / 26) : 0;
  const basicHourly = Math.floor(basicDaily / 8);
  const otHours = input.otMinutes / 60;
  const multiplier = OT_RATE_MULTIPLIERS[input.dayType] ?? 1.5;
  const otPayMinor = Math.floor(basicHourly * otHours * multiplier);

  const id = crypto.randomUUID();
  await tenantTx(access, [
    sqlClient`
      insert into ot_requests (id, tenant_id, employee_id, attendance_date, ot_minutes, day_type, status, attributes)
      values (${id}, ${access.tenantId}, ${input.employeeId}, ${input.attendanceDate}, ${input.otMinutes}, ${input.dayType}, 'pending',
        ${JSON.stringify({ reason: input.reason ?? null, ot_pay_minor: otPayMinor, rate_multiplier: multiplier })}::jsonb)
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        'attendance.ot_request', 'ot_request', ${id},
        'OT request submitted',
        ${JSON.stringify({ employeeId: input.employeeId, attendanceDate: input.attendanceDate, otMinutes: input.otMinutes, dayType: input.dayType })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  return { id, status: "pending", otMinutes: input.otMinutes, dayType: input.dayType, otPayMinor };
}

export async function listOtRequests(access: Access, args: { employeeId?: string | null; status?: string | null; page: number; pageSize: number }) {
  enforce(access.context, "employee.read", { tenantId: access.tenantId });
  const offset = (args.page - 1) * args.pageSize;
  const [countRows, rows] = await tenantTx(access, [
    sqlClient`
      select count(*)::int as total from ot_requests
      where tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or status = ${args.status ?? null}::text)
    `,
    sqlClient`
      select o.id, o.employee_id, o.attendance_date::text, o.ot_minutes, o.day_type, o.status, o.attributes,
             o.created_at, e.first_name, e.last_name, e.employee_code
      from ot_requests o
      join employees e on e.id = o.employee_id and e.tenant_id = o.tenant_id
      where o.tenant_id = ${access.tenantId}
        and (${args.employeeId ?? null}::uuid is null or o.employee_id = ${args.employeeId ?? null}::uuid)
        and (${args.status ?? null}::text is null or o.status = ${args.status ?? null}::text)
      order by o.attendance_date desc, o.created_at desc
      limit ${args.pageSize} offset ${offset}
    `,
  ]);
  const total = ((countRows as Array<{ total: number }>)[0]?.total ?? 0);
  return { items: rows, total };
}

export const approveOtSchema = z.object({
  approve: z.boolean(),
  comment: z.string().trim().max(500).optional(),
});

export async function approveOtRequest(access: Access, id: string, input: z.infer<typeof approveOtSchema>, requestId: string) {
  enforce(access.context, "employee.write", { tenantId: access.tenantId });

  const [rows] = await tenantTx(access, [
    sqlClient`select id, status, employee_id, ot_minutes, day_type, attendance_date, attributes from ot_requests where tenant_id = ${access.tenantId} and id = ${id} limit 1`,
  ]);
  const request = (rows as Array<{ id: string; status: string; employee_id: string; ot_minutes: number; day_type: string; attendance_date: string; attributes: Record<string, unknown> }>)[0];
  if (!request) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "OT request not found." });
  if (request.status !== "pending") {
    throw new HttpError({ status: 422, code: "POLICY_VIOLATION", message: `Cannot approve/reject an OT request in '${request.status}' status.` });
  }

  const newStatus = input.approve ? "approved" : "rejected";
  await tenantTx(access, [
    sqlClient`
      update ot_requests
      set status = ${newStatus},
          attributes = attributes || ${JSON.stringify({ approved_by: access.context.actorUserId, approved_at: new Date().toISOString(), comment: input.comment ?? null })}::jsonb,
          updated_at = now()
      where tenant_id = ${access.tenantId} and id = ${id}
    `,
    sqlClient`
      insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
      values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
        ${input.approve ? "attendance.ot_approve" : "attendance.ot_reject"}, 'ot_request', ${id},
        ${input.approve ? "OT request approved" : "OT request rejected"},
        ${JSON.stringify({ decision: newStatus, comment: input.comment ?? null })}::jsonb,
        ${uuidOrNull(requestId)}::uuid)
    `,
  ]);

  // Auto-credit 60-day FIFO Compensatory Off (COFF) grant for rest-day / holiday OT (Demo 20 & Rule 88)
  if (input.approve && (request.day_type === "rest_day" || request.day_type === "holiday" || request.day_type === "national_holiday") && request.ot_minutes >= 240) {
    const grantId = crypto.randomUUID();
    const days = request.ot_minutes >= 480 ? 1 : 0.5;
    const earnedOn = String(request.attendance_date).slice(0, 10);
    const expiresOn = new Date(new Date(earnedOn).getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      await tenantTx(access, [
        sqlClient`
          insert into comp_off_grants (id, tenant_id, employee_id, attributes)
          values (${grantId}, ${access.tenantId}, ${request.employee_id},
            ${JSON.stringify({ days, earned_on: earnedOn, expires_on: expiresOn, status: "available", ot_request_id: id, note: "Auto-credited from approved holiday/rest-day OT" })}::jsonb)
        `,
      ]);
    } catch (coffErr) {
      console.warn("Auto comp-off credit notice:", coffErr);
    }
  }

  return { id, status: newStatus };
}
