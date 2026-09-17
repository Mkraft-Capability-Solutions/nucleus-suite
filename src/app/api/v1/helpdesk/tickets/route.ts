import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createTicketSchema = z.object({
  category: z.string().trim().min(1).max(80),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "Low", "Medium", "High", "Urgent"]).default("MEDIUM"),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(4000),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, status, attributes, created_at, updated_at
        from helpdesk_tickets
        where tenant_id = ${access.tenantId}
        order by created_at desc
      `,
    ]);

    const items = (rows as Array<{ id: string; status: string; attributes: Record<string, any>; created_at: string; updated_at: string }>).map((r) => ({
      id: r.id,
      version: 1,
      status: r.status,
      category: (r.attributes as any)?.category,
      priority: (r.attributes as any)?.priority,
      subject: (r.attributes as any)?.subject,
      description: (r.attributes as any)?.description,
      messages: (r.attributes as any)?.messages || [],
      createdAt: r.created_at,
    }));

    return collection({
      type: "helpdesk-tickets",
      items,
      requestId,
      self: "/api/v1/helpdesk/tickets",
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
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid ticket payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    let employeeId = access.context.employeeId;
    if (!employeeId) {
      const [empRows] = await tenantTx(access, [
        sqlClient`select id from employees where tenant_id = ${access.tenantId} and status = 'active' order by created_at asc limit 1`,
      ]);
      employeeId = (empRows as Array<{ id: string }>)[0]?.id;
    }

    const ticketId = crypto.randomUUID();
    const attributes = {
      ...parsed.data,
      priority: parsed.data.priority.toUpperCase(),
      messages: [
        {
          id: crypto.randomUUID(),
          sender: "You",
          role: "Requester",
          time: "Just now",
          text: parsed.data.description,
          internal: false,
        },
      ],
      created_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into helpdesk_tickets (id, tenant_id, employee_id, status, attributes)
        values (${ticketId}, ${access.tenantId}, ${employeeId ? sqlClient`${employeeId}::uuid` : null}, 'OPEN', ${JSON.stringify(attributes)}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'helpdesk.ticket_create', 'helpdesk_ticket', ${ticketId}, 'Support ticket created',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "helpdesk-ticket",
      id: ticketId,
      version: 1,
      attributes: {
        id: ticketId,
        status: "OPEN",
        ...attributes,
      },
      requestId,
      self: `/api/v1/helpdesk/tickets/${ticketId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
