import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createMessageSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  internal: z.boolean().default(false),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = createMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Message content cannot be empty.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const messageId = crypto.randomUUID();
    const newMsg = {
      id: messageId,
      sender: "You",
      role: "Agent",
      time: "Just now",
      text: parsed.data.text,
      internal: parsed.data.internal,
    };

    await tenantTx(access, [
      sqlClient`
        update helpdesk_tickets
        set attributes = jsonb_set(
          coalesce(attributes, '{}'::jsonb),
          '{messages}',
          coalesce(attributes->'messages', '[]'::jsonb) || ${JSON.stringify([newMsg])}::jsonb
        ),
        updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'helpdesk.ticket_reply', 'helpdesk_ticket', ${id}, 'Reply added to ticket thread',
          ${JSON.stringify(newMsg)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "ticket-message",
      id: messageId,
      version: 1,
      attributes: newMsg,
      requestId,
      self: `/api/v1/helpdesk/tickets/${id}/messages`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
