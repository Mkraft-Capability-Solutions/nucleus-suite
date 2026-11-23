import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { categoryCatalog, createTicket, createTicketSchema, listTickets, listTicketsQuery, SLA_HOURS, statusCatalog } from "@/server/engagement/helpdesk";
import { parseBody, runOnce } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

const SELF = "/api/v1/helpdesk/tickets";

/**
 * GET lists the tickets the caller may see (agents: the tenant; employees: their own), paginated, with the
 * category/status catalogue and SLA policy the screen renders. POST raises a ticket for the caller
 * (Idempotency-Key required).
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const key of ["status", "category", "search", "page", "pageSize"]) {
      const value = params.get(key);
      if (value) raw[key] = value;
    }
    const query = parseBody(listTicketsQuery, raw, "Check the ticket filters.");
    const result = await listTickets(access, query);
    return NextResponse.json(
      {
        data: result.items.map((item) => ({ type: "helpdesk-ticket", ...item })),
        meta: {
          requestId,
          page: query.page,
          pageSize: query.pageSize,
          hasMore: result.hasMore,
          scope: result.scope,
          linkedEmployee: result.linked,
          canManage: result.canManage,
          categories: categoryCatalog(),
          statuses: statusCatalog(),
          slaHours: SLA_HOURS,
        },
        links: { self: SELF },
      },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const input = parseBody(createTicketSchema, await request.json().catch(() => null), "Check the ticket details.");
    const outcome = await runOnce(access, "helpdesk.ticket_create", key, input, () => createTicket(access, input, requestId));
    const attributes = outcome.result ? { ...outcome.result, replayed: false } : { id: outcome.id, replayed: true };
    return ok({ type: "helpdesk-ticket", id: outcome.id, version: 1, attributes, requestId, self: `${SELF}/${outcome.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
