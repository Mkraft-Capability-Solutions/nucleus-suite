import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { idempotent, parseBody } from "@/server/access/idempotent";
import { getTenantProfile, patchTenantProfile, patchTenantProfileSchema } from "@/server/access/tenant-profile";

export const dynamic = "force-dynamic";

/** GET the organisation profile and localisation (tenant.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const profile = await getTenantProfile(access);
    return ok({ type: "tenant-profile", id: access.tenantId, version: 1, attributes: profile, requestId, self: "/api/v1/tenant/profile" });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** PATCH legal name, locale, time zone, currency or work week (tenant.manage, Idempotency-Key required). */
export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const input = await parseBody(request, patchTenantProfileSchema);
    const profile = await idempotent({
      access,
      headers: request.headers,
      operation: "tenant.profile_patch",
      payload: input,
      run: async () => ({ locator: access.tenantId, value: await patchTenantProfile(access, input, requestId) }),
      replay: () => getTenantProfile(access),
    });
    return ok({ type: "tenant-profile", id: access.tenantId, version: 1, attributes: profile, requestId, self: "/api/v1/tenant/profile" });
  } catch (error) {
    return fail(error, requestId);
  }
}
