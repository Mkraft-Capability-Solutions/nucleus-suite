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
    const rawBody = await request.json().catch(() => ({}));
    let payload = rawBody;
    if (rawBody && typeof rawBody === "object") {
      const { locale, timezone, currency, settings, ...rest } = rawBody;
      const hasTopLevelFields = locale || timezone || (currency && /^[A-Z]{3}$/.test(currency)) || settings;
      if (hasTopLevelFields) {
        payload = {
          ...(locale ? { locale } : {}),
          ...(timezone ? { timezone } : {}),
          ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency } : {}),
          settings: settings && typeof settings === "object" ? { ...settings, ...rest } : (Object.keys(rest).length ? rest : settings || {}),
        };
      } else {
        payload = {
          settings: rest && Object.keys(rest).length ? rest : rawBody,
        };
      }
    }
    const parsed = patchSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The settings payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await patchSettings(access, parsed.data, requestId);
    return ok({ type: "tenant-settings", id: access.tenantId, version: 1, attributes: result, requestId, self: `/api/v1/tenant/settings` });
  } catch (error) {
    return fail(error, requestId);
  }
}export async function POST(request: Request) {
  return PATCH(request);
}
