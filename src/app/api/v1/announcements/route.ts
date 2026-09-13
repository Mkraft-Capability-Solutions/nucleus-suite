import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listAnnouncements, publishAnnouncement, publishAnnouncementSchema } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const announcements = await listAnnouncements(access, new URL(request.url).searchParams.get("audience"));
    return NextResponse.json({ data: announcements, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = publishAnnouncementSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The announcement payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await publishAnnouncement(access, parsed.data, requestId);
    return ok({ type: "announcement", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/announcements` });
  } catch (error) {
    return fail(error, requestId);
  }
}
