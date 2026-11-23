import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { deleteTicket, getTicket, updateTicket, updateTicketSchema } from "@/server/engagement/helpdesk";
import { parseBody, requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET one visible ticket; PATCH changes status/priority/category/assignee (hr.helpdesk.write); DELETE (hr.helpdesk.approve). */
export async function GET(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "ticket");
    const ticket = await getTicket(access, id);
    return ok({ type: "helpdesk-ticket", id, version: ticket.version, attributes: ticket, requestId, self: `/api/v1/helpdesk/tickets/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "ticket");
    const input = parseBody(updateTicketSchema, await request.json().catch(() => null), "Check the ticket update.");
    const ticket = await updateTicket(access, id, input, requestId);
    return ok({ type: "helpdesk-ticket", id, version: ticket.version, attributes: ticket, requestId, self: `/api/v1/helpdesk/tickets/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "ticket");
    const result = await deleteTicket(access, id, requestId);
    return ok({ type: "helpdesk-ticket", id, version: 1, attributes: result, requestId, self: `/api/v1/helpdesk/tickets/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
