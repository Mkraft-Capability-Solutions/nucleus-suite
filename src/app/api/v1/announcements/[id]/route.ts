import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { archiveAnnouncement, pinAnnouncementSchema, setAnnouncementPinned } from "@/server/engagement/announcement-cms";
import { parseBody, requireUuid } from "@/server/engagement/route-support";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH `{ pinned }` pins or unpins an announcement; DELETE archives it (soft delete, audited). Both need employee.write. */
export async function PATCH(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "announcement");
    const input = parseBody(pinAnnouncementSchema, await request.json().catch(() => null), "Say whether the announcement is pinned.");
    const result = await setAnnouncementPinned(access, id, input.pinned, requestId);
    return ok({ type: "announcement", id, version: 1, attributes: result, requestId, self: `/api/v1/announcements/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const id = requireUuid((await params).id, "announcement");
    const result = await archiveAnnouncement(access, id, requestId);
    return ok({ type: "announcement", id, version: 1, attributes: result, requestId, self: `/api/v1/announcements/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
