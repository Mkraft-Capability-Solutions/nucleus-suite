import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { getSettings, patchSettings, patchSettingsSchema, isValidTimezone } from "@/server/admin/service";

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
    const payload: {
      locale?: string;
      timezone?: string;
      currency?: string;
      settings?: Record<string, unknown>;
    } = {};

    if (rawBody && typeof rawBody === "object") {
      const { locale, timezone, currency, settings, ...rest } = rawBody;
      const settingsBag: Record<string, unknown> = {
        ...(settings && typeof settings === "object" ? settings : {}),
        ...rest,
      };

      // 1. Timezone: validate IANA or extract before ' ('
      if (typeof timezone === "string") {
        const candidateTz = timezone.split(" ")[0].trim();
        if (isValidTimezone(timezone)) {
          payload.timezone = timezone;
        } else if (isValidTimezone(candidateTz)) {
          payload.timezone = candidateTz;
          settingsBag.displayTimezone = timezone;
        } else {
          settingsBag.timezone = timezone;
        }
      }

      // 2. Currency: 3-letter uppercase (e.g. INR from "INR (₹)")
      if (typeof currency === "string") {
        const candidateCurr = currency.slice(0, 3).toUpperCase();
        if (/^[A-Z]{3}$/.test(currency)) {
          payload.currency = currency;
        } else if (/^[A-Z]{3}$/.test(candidateCurr)) {
          payload.currency = candidateCurr;
          settingsBag.displayCurrency = currency;
        } else {
          settingsBag.currency = currency;
        }
      }

      // 3. Locale: format xx-XX (e.g. en-US from "English (US / Global)")
      if (typeof locale === "string") {
        if (/^[a-z]{2}-[A-Z]{2}$/.test(locale)) {
          payload.locale = locale;
        } else if (locale.toLowerCase().includes("us") || locale.toLowerCase().includes("global")) {
          payload.locale = "en-US";
          settingsBag.displayLanguage = locale;
        } else if (locale.toLowerCase().includes("uk")) {
          payload.locale = "en-GB";
          settingsBag.displayLanguage = locale;
        } else {
          settingsBag.locale = locale;
        }
      }

      if (Object.keys(settingsBag).length > 0) {
        payload.settings = settingsBag;
      }
    }

    if (Object.keys(payload).length === 0) {
      payload.settings = { updatedAt: new Date().toISOString() };
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
