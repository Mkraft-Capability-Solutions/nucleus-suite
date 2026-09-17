import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createShiftAssignmentSchema = z.object({
  employeeId: z.string().uuid().optional(),
  shiftCode: z.string().trim().min(1).max(20),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const url = new URL(request.url);
    const employeeId = url.searchParams.get("employeeId");

    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, employee_id, shift_id, attributes, record_status, created_at
        from shift_assignments
        where tenant_id = ${access.tenantId}
          and (${employeeId ? sqlClient`employee_id = ${employeeId}::uuid` : sqlClient`1=1`})
        order by created_at desc
        limit 50
      `,
    ]);

    const items = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      version: 1,
      employeeId: r.employee_id,
      shiftId: r.shift_id,
      shiftCode: (r.attributes as any)?.shift_code ?? (r.attributes as any)?.shiftCode,
      effectiveDate: (r.attributes as any)?.effective_date ?? (r.attributes as any)?.effectiveDate,
      reason: (r.attributes as any)?.reason,
      status: r.record_status,
      createdAt: r.created_at,
    }));

    return collection({
      type: "shift-assignments",
      items,
      requestId,
      self: "/api/v1/shifts/assignments",
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
    const parsed = createShiftAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid shift assignment payload.",
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

    const assignmentId = crypto.randomUUID();
    const effectiveDate = parsed.data.effectiveDate ?? new Date().toISOString().slice(0, 10);
    const attributes = {
      shift_code: parsed.data.shiftCode,
      effective_date: effectiveDate,
      reason: parsed.data.reason ?? "Manual shift assignment/override",
      assigned_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into shift_assignments (id, tenant_id, employee_id, record_status, attributes, version)
        values (${assignmentId}, ${access.tenantId}, ${employeeId}::uuid, 'active', ${JSON.stringify(attributes)}::jsonb, 1)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'attendance.shift_override', 'shift_assignment', ${assignmentId}, 'Shift assignment override created',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "shift-assignment",
      id: assignmentId,
      version: 1,
      attributes: {
        id: assignmentId,
        employeeId,
        shiftCode: parsed.data.shiftCode,
        effectiveDate,
        reason: attributes.reason,
      },
      requestId,
      self: `/api/v1/shifts/assignments/${assignmentId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
