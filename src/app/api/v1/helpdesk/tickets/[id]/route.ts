import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, status, attributes, created_at, updated_at
        from helpdesk_tickets
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
        limit 1
      `,
    ]);

    const r = (rows as Array<{ id: string; status: string; attributes: Record<string, any>; created_at: string; updated_at: string }>)[0];
    if (!r) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Ticket not found." });
    }

    return ok({
      type: "helpdesk-ticket",
      id: r.id,
      version: 1,
      attributes: {
        id: r.id,
        status: r.status,
        category: (r.attributes as any)?.category,
        priority: (r.attributes as any)?.priority,
        subject: (r.attributes as any)?.subject,
        description: (r.attributes as any)?.description,
        messages: (r.attributes as any)?.messages || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      requestId,
      self: `/api/v1/helpdesk/tickets/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const updateFields: any = {};
    if (body.status) updateFields.status = body.status;
    if (body.priority) updateFields.priority = body.priority;
    if (body.category) updateFields.category = body.category;

    await tenantTx(access, [
      sqlClient`
        update helpdesk_tickets
        set 
          status = coalesce(${body.status || null}, status),
          attributes = attributes || ${JSON.stringify(body)}::jsonb,
          updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'helpdesk.ticket_update', 'helpdesk_ticket', ${id}, 'Support ticket updated',
          ${JSON.stringify(body)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "helpdesk-ticket",
      id,
      version: 2,
      attributes: { id, ...body },
      requestId,
      self: `/api/v1/helpdesk/tickets/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;

    await tenantTx(access, [
      sqlClient`
        delete from helpdesk_tickets
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'helpdesk.ticket_delete', 'helpdesk_ticket', ${id}, 'Support ticket deleted',
          '{}'::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "helpdesk-ticket",
      id,
      version: 1,
      attributes: { deleted: true },
      requestId,
      self: `/api/v1/helpdesk/tickets/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
