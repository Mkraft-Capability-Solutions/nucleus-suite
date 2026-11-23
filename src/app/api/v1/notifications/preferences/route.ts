import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { upsertPreferences, upsertPreferencesSchema } from "@/server/notifications/service";
import { getOwnPreferences } from "@/server/notifications/preferences";

export const dynamic = "force-dynamic";

/** GET the caller's own notification preferences (defaults when none are stored). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const prefs = await getOwnPreferences(access);
    return ok({ type: "notification-preferences", id: access.context.membershipId, version: 1, attributes: prefs, requestId, self: `/api/v1/notifications/preferences` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = upsertPreferencesSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A preferences payload is required." });
    const result = await upsertPreferences(access, parsed.data);
    return ok({ type: "notification-preferences", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/notifications/preferences` });
  } catch (error) {
    return fail(error, requestId);
  }
}
