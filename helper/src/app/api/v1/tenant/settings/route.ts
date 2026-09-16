import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getSettings, patchSettings, patchSettingsSchema } from "@/server/admin/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const settings = await getSettings(access);
    return NextResponse.json({ data: { type: "tenant-settings", ...settings }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = patchSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The settings payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await patchSettings(access, parsed.data, requestId);
    return ok({ type: "tenant-settings", id: access.tenantId, version: 1, attributes: result, requestId, self: `/api/v1/tenant/settings` });
  } catch (error) {
    return fail(error, requestId);
  }
}
