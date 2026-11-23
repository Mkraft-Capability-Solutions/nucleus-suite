import { NextResponse } from "next/server";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { listAnnouncements, publishAnnouncement, publishAnnouncementSchema } from "@/server/engagement/service";
import { listCmsAnnouncements, publishCmsAnnouncement, publishCmsAnnouncementSchema } from "@/server/engagement/announcement-cms";
import { parseBody, runOnce } from "@/server/engagement/route-support";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const isCms = (request: Request) => new URL(request.url).searchParams.get("view") === "cms";

/**
 * GET lists live announcements. `?view=cms` returns the content-management projection (category, audience,
 * pinned, author) and whether the caller may manage them. POST publishes; `?view=cms` validates the CMS form
 * (announcement type, audience rule resolved against live employees) and requires an Idempotency-Key.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    if (isCms(request)) {
      const result = await listCmsAnnouncements(access);
      return NextResponse.json(
        { data: result.items.map((item) => ({ type: "announcement", ...item })), meta: { requestId, canManage: result.canManage }, links: { self: "/api/v1/announcements?view=cms" } },
        { headers: { "cache-control": "no-store", "x-request-id": requestId } },
      );
    }
    const announcements = await listAnnouncements(access, new URL(request.url).searchParams.get("audience"));
    return NextResponse.json({ data: announcements, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const payload: unknown = await request.json().catch(() => null);
    if (isCms(request)) {
      const key = requireIdempotencyKey(request.headers);
      const input = parseBody(publishCmsAnnouncementSchema, payload, "Check the announcement details.");
      const outcome = await runOnce(access, "engage.announce", key, input, () => publishCmsAnnouncement(access, input, requestId));
      const attributes = outcome.result ? { ...outcome.result, replayed: false } : { id: outcome.id, replayed: true };
      return ok({ type: "announcement", id: outcome.id, version: 1, attributes, requestId, self: `/api/v1/announcements/${outcome.id}` });
    }
    const parsed = publishAnnouncementSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The announcement payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    // Legacy callers: honour an Idempotency-Key when one is sent so a retry cannot publish twice.
    const key = request.headers.get("idempotency-key")?.trim();
    if (key) {
      const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
      const prior = await checkIdempotency(access, "engage.announce_legacy", key, fingerprint);
      if (prior.outcome === "conflict") throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
      if (prior.outcome === "replay" && prior.responseLocator) {
        return ok({ type: "announcement", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/announcements` });
      }
      const result = await publishAnnouncement(access, parsed.data, requestId);
      await storeIdempotency(access, "engage.announce_legacy", key, fingerprint, 201, result.id);
      return ok({ type: "announcement", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/announcements` });
    }
    const result = await publishAnnouncement(access, parsed.data, requestId);
    return ok({ type: "announcement", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/announcements` });
  } catch (error) {
    return fail(error, requestId);
  }
}
