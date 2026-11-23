import { getOwnProfile, updateOwnProfile, updateOwnProfileSchema } from "@/server/identity/profile";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/operations/profile — the signed-in person's own profile.
 * POST/PATCH — update their own name, phone, title, department and location.
 * Identity comes only from the authenticated session; query parameters and raw cookies are ignored.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const profile = await getOwnProfile(access);
    return ok({ type: "profile", id: profile.id, version: 1, attributes: profile, requestId, self: "/api/v1/operations/profile" });
  } catch (error) {
    return fail(error, requestId);
  }
}

async function update(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = updateOwnProfileSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message ?? "The profile fields are not valid." });
    }
    const profile = await updateOwnProfile(access, parsed.data, requestId);
    return ok({ type: "profile", id: profile.id, version: 1, attributes: profile, requestId, self: "/api/v1/operations/profile" });
  } catch (error) {
    return fail(error, requestId);
  }
}

export const POST = update;
export const PATCH = update;
