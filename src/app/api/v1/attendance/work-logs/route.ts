import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createWorkLogSchema = z.object({
  employeeId: z.string().uuid().optional(),
  project: z.string().trim().min(1).max(120),
  task: z.string().trim().min(1).max(250),
  hours: z.number().min(0.25).max(24),
  billable: z.boolean().default(true),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const employeeId = searchParams.get("employeeId") || access.context.actorUserId;

    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, employee_id, attributes, created_at
        from attendance_entries
        where tenant_id = ${access.tenantId}
          and kind = 'work_log'
          and (${employeeId ? sqlClient`employee_id::text = ${employeeId}` : sqlClient`true`})
          and attributes->>'date' = ${date}
        order by created_at desc
      `,
    ]);

    const items = (rows as Array<{ id: string; employee_id: string; attributes: Record<string, any>; created_at: string }>).map((r) => ({
      id: r.id,
      version: 1,
      employeeId: r.employee_id,
      project: r.attributes?.project,
      task: r.attributes?.task,
      hours: Number(r.attributes?.hours ?? 0),
      billable: Boolean(r.attributes?.billable),
      date: r.attributes?.date,
      createdAt: r.created_at,
    }));

    return collection({
      type: "work-logs",
      items,
      requestId,
      self: `/api/v1/attendance/work-logs?date=${date}`,
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = createWorkLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid work log payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const { project, task, hours, billable } = parsed.data;
    const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);

    // Resolve employeeId
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

    const logId = crypto.randomUUID();
    const attributes = {
      entry_kind: "work_log",
      project,
      task,
      hours,
      billable,
      date,
      logged_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into attendance_entries (id, tenant_id, employee_id, attributes)
        values (${logId}, ${access.tenantId}, ${employeeId}::uuid, ${JSON.stringify(attributes)}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'attendance.work_log', 'attendance_entry', ${logId}, 'Daily work log recorded',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "work-log",
      id: logId,
      version: 1,
      attributes: {
        id: logId,
        project,
        task,
        hours,
        billable,
        date,
      },
      requestId,
      self: `/api/v1/attendance/work-logs/${logId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
