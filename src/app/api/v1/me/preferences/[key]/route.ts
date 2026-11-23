import { NextResponse } from "next/server";
import { getPreference, isPreferenceKey, setPreference } from "@/server/preferences/service";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ key: string }> };
const headers = (requestId: string) => ({ "cache-control": "private, no-store", "x-request-id": requestId });

/** GET/PUT /api/v1/me/preferences/{quick_actions|default_dashboard}: the signed-in member's own choice. */
export async function GET(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { key } = await params;
    if (!isPreferenceKey(key)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "There is no such preference." });
    return NextResponse.json({ data: { key, value: await getPreference(access, key) }, meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PUT(request: Request, { params }: Context) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { key } = await params;
    if (!isPreferenceKey(key)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "There is no such preference." });
    const body = await request.json().catch(() => null);
    const value = await setPreference(access, key, body?.value);
    return NextResponse.json({ data: { key, value }, meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
