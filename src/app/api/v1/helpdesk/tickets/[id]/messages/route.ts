import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listTicketMessages, replySchema, replyToTicket } from "@/server/engagement/helpdesk";
import { parseBody, requireUuid, runOnce } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET the ticket thread (internal notes only for agents); POST appends a reply (Idempotency-Key required). */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "ticket");
    const messages = await listTicketMessages(access, id);
    return collection({ type: "ticket-message", items: messages.map((message) => ({ ...message, version: 1 })), requestId, self: `/api/v1/helpdesk/tickets/${id}/messages`, nextCursor: null, total: messages.length });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const id = requireUuid((await params).id, "ticket");
    const input = parseBody(replySchema, await request.json().catch(() => null), "A reply cannot be empty.");
    const outcome = await runOnce(access, `helpdesk.ticket_reply:${id}`, key, input, () => replyToTicket(access, id, input, requestId));
    const attributes = outcome.result ? { ...outcome.result, replayed: false } : { id: outcome.id, replayed: true };
    return ok({ type: "ticket-message", id: outcome.id, version: 1, attributes, requestId, self: `/api/v1/helpdesk/tickets/${id}/messages` });
  } catch (error) {
    return fail(error, requestId);
  }
}
