import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;

    const reactionId = crypto.randomUUID();
    await tenantTx(access, [
      sqlClient`
        update recognition_events
        set attributes = jsonb_set(
          coalesce(attributes, '{}'::jsonb),
          '{likes}',
          to_jsonb(coalesce((attributes->>'likes')::int, 0) + 1)
        ),
        updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'engage.kudos_like', 'recognition_event', ${id}, 'Liked recognition event', ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "recognition-like",
      id: reactionId,
      version: 1,
      attributes: {
        eventId: id,
        liked: true,
      },
      requestId,
      self: `/api/v1/recognition-events/${id}/like`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
