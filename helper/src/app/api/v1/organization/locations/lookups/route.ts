import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { listLocationLookups } from "@/server/organization/locations";

export const dynamic = "force-dynamic";

/** The active plant calendars and shift groups the location form's two lookups offer. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const lookups = await listLocationLookups(access);
    return ok({ type: "location-lookups", id: "lookups", version: 1, attributes: lookups, requestId, self: "/api/v1/organization/locations/lookups" });
  } catch (error) {
    return fail(error, requestId);
  }
}
