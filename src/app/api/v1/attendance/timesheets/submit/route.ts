import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const submitTimesheetSchema = z.object({
  employeeId: z.string().uuid().optional(),
  weekRange: z.string().trim().min(1).max(100).optional(),
  totalHours: z.number().min(0).max(168).optional(),
  billableHours: z.number().min(0).max(168).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = await request.json().catch(() => ({}));
    const parsed = submitTimesheetSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid timesheet submission payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    let employeeId = parsed.data.employeeId ?? access.context.employeeId;
    if (!employeeId) {
      const [empRows] = await tenantTx(access, [
        sqlClient`select id from employees where tenant_id = ${access.tenantId} and status = 'active' order by created_at asc limit 1`,
      ]);
      employeeId = (empRows as Array<{ id: string }>)[0]?.id;
    }

    if (!employeeId) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "No active employee profile associated." });
    }

    const submissionId = crypto.randomUUID();
    const attributes = {
      submission_type: "weekly_timesheet",
      week_range: parsed.data.weekRange ?? "Current Week",
      total_hours: parsed.data.totalHours ?? 40,
      billable_hours: parsed.data.billableHours ?? 36,
      notes: parsed.data.notes ?? "",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into attendance_entries (id, tenant_id, employee_id, attributes)
        values (${submissionId}, ${access.tenantId}, ${employeeId}::uuid, ${JSON.stringify(attributes)}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'attendance.timesheet_submit', 'timesheet', ${submissionId}, 'Weekly timesheet submitted for approval',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "timesheet-submission",
      id: submissionId,
      version: 1,
      attributes: {
        id: submissionId,
        status: "submitted",
        ...attributes,
      },
      requestId,
      self: `/api/v1/attendance/timesheets/${submissionId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
