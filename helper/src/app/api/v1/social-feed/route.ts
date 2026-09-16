import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkIdempotency, requireAccess, storeIdempotency } from "@/server/platform/access";
import { collection, fail, HttpError, ok, parsePagination, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import {
  capabilityIndexForEmployee,
  createFeedPost,
  createFeedPostSchema,
  listSocialFeed,
  recognitionPointsForSelf,
  recordWellbeingCheckin,
  wellbeingCheckinSchema,
  wellbeingForSelf,
} from "@/server/engagement/experience";

export const dynamic = "force-dynamic";

/**
 * Employee experience read surface.
 *
 * `GET /api/v1/social-feed` returns the audience-scoped feed. The two sibling
 * projections the screen needs — the capability index for one employee, and
 * the caller's own wellbeing with a suppressed tenant aggregate — are served
 * from this handler behind `?view=` because this screen owns no other route
 * file. They should be split into `/api/v1/employee-experience/capability-index`
 * and `/api/v1/employee-experience/wellbeing` when the API manifest is next
 * edited; the service functions are already separate.
 */
const VIEWS = ["feed", "capability-index", "wellbeing"] as const;

type View = (typeof VIEWS)[number];

function parseView(raw: string | null): View {
  if (!raw) return "feed";
  if ((VIEWS as readonly string[]).includes(raw)) return raw as View;
  throw new HttpError({
    status: 400,
    code: "BAD_REQUEST",
    message: "The requested view is not available.",
    details: [{ field: "view", issue: `Expected one of ${VIEWS.join(", ")}.` }],
  });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const view = parseView(params.get("view"));

    if (view === "capability-index") {
      const requested = params.get("employeeId");
      if (requested && !UUID_PATTERN.test(requested)) {
        throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The employee reference is invalid.", details: [{ field: "employeeId", issue: "Expected a UUID." }] });
      }
      const result = await capabilityIndexForEmployee(access, requested);
      return ok({
        type: "capability-index-view",
        id: result.run?.id ?? result.employeeId,
        version: 1,
        attributes: { ...result },
        requestId,
        self: `/api/v1/social-feed?view=capability-index${requested ? `&employeeId=${encodeURIComponent(requested)}` : ""}`,
      });
    }

    if (view === "wellbeing") {
      // Individual check-ins are addressed by the session membership only;
      // this route accepts no employee reference for wellbeing at all.
      const [wellbeing, points] = await Promise.all([wellbeingForSelf(access), recognitionPointsForSelf(access)]);
      return ok({
        type: "wellbeing-view",
        id: "self",
        version: 1,
        attributes: { ...wellbeing, points },
        requestId,
        self: "/api/v1/social-feed?view=wellbeing",
      });
    }

    const { page, pageSize } = parsePagination(params);
    const { items, hasMore } = await listSocialFeed(access, { page, pageSize });
    return collection({
      type: "feed-post",
      items: items.map((item) => ({ ...item, version: 1 })),
      requestId,
      self: `/api/v1/social-feed?page=${page}&pageSize=${pageSize}`,
      nextCursor: hasMore ? Buffer.from(JSON.stringify({ page: page + 1 }), "utf8").toString("base64url") : null,
      total: items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/**
 * Publish a feed post, or record a self wellbeing check-in when
 * `?view=wellbeing`. Both are consequential writes and require an
 * Idempotency-Key so a retried submit cannot create a duplicate row.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const key = requireIdempotencyKey(request.headers);
    const view = parseView(new URL(request.url).searchParams.get("view"));
    const payload: unknown = await request.json().catch(() => null);

    if (view === "wellbeing") {
      const parsed = wellbeingCheckinSchema.safeParse(payload);
      if (!parsed.success) {
        throw new HttpError({
          status: 400,
          code: "BAD_REQUEST",
          message: "Energy, stress and workload ratings of 1-5 are required.",
          details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
        });
      }
      const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
      const prior = await checkIdempotency(access, "engage.wellbeing_checkin", key, fingerprint);
      if (prior.outcome === "conflict") {
        throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
      }
      if (prior.outcome === "replay") {
        return ok({ type: "wellbeing-checkin", id: prior.responseLocator ?? "", version: 1, attributes: { replay: true }, requestId, self: "/api/v1/social-feed?view=wellbeing" });
      }
      const result = await recordWellbeingCheckin(access, parsed.data, requestId);
      await storeIdempotency(access, "engage.wellbeing_checkin", key, fingerprint, 201, result.id);
      return ok({ type: "wellbeing-checkin", id: result.id, version: 1, attributes: { ...result }, requestId, self: "/api/v1/social-feed?view=wellbeing" });
    }

    if (view !== "feed") {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "This view is read-only.", details: [{ field: "view", issue: "Only feed and wellbeing accept writes." }] });
    }

    const parsed = createFeedPostSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A title and body are required to publish a post.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "engage.feed_post", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay") {
      return ok({ type: "feed-post", id: prior.responseLocator ?? "", version: 1, attributes: { replay: true }, requestId, self: "/api/v1/social-feed" });
    }
    const result = await createFeedPost(access, parsed.data, requestId);
    await storeIdempotency(access, "engage.feed_post", key, fingerprint, 201, result.id);
    return ok({ type: "feed-post", id: result.id, version: 1, attributes: { ...result }, requestId, self: `/api/v1/social-feed/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function OPTIONS() {
  return NextResponse.json({ views: VIEWS }, { headers: { "cache-control": "no-store", allow: "GET, POST, OPTIONS" } });
}
