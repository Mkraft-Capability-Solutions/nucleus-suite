import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import {
  announcementRegisterQuery,
  listAnnouncementRegister,
  resolveAudiencePreview,
  ANNOUNCEMENT_CHANNELS,
  ANNOUNCEMENT_LANGUAGES,
  ANNOUNCEMENT_TYPES,
  AUDIENCE_DIMENSIONS,
  DELIVERY_POSTURE,
  PERSISTED_FIELDS,
  PUBLISH_AT_FALLBACK,
  QUIET_HOURS,
  UNAVAILABLE_METRICS,
  UNPERSISTED_FIELDS,
} from "@/server/engagement/announcement-register";

export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const querySchema = announcementRegisterQuery;

const SELF = "/api/v1/announcement-register";

/**
 * GET /api/v1/announcement-register — the SCR-066 announcements register.
 *
 * Read-only by design. The one supported write remains
 * `POST /api/v1/announcements`, which owns the insert, the audit event and the
 * permission check. This endpoint adds the three things that write path cannot
 * answer: the Draft/Scheduled/Published/Archived state each row derives to and
 * on what basis, the head-count its audience rule actually resolves to against
 * live employee rows, and an explicit statement of which workbook fields the
 * write path drops.
 *
 * Two views:
 *   - `?view=register` (default) — the register collection.
 *   - `?view=audience&rule=<rule>` — the live resolved-audience preview the
 *     compose form shows before publishing, plus the dimension values a rule
 *     can name. A rule resolving to nobody comes back with a refusal.
 *
 * Scope is `employee.read`; the register reports whether the caller also holds
 * `employee.write`, which is what the create action needs.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const key of ["view", "rule", "state", "search", "page", "pageSize"]) {
      const value = params.get(key);
      if (value !== null && value !== "") raw[key] = value;
    }
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the announcement register filters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }

    if (parsed.data.view === "audience") {
      const preview = await resolveAudiencePreview(access, parsed.data.rule ?? "");
      return ok({
        type: "announcement-audience",
        id: preview.rule || "unresolved",
        version: 1,
        // The static contract rides on this view rather than on every register
        // row: it is identical for all of them, and the compose form — the one
        // place that needs it — always asks for a preview.
        attributes: {
          ...preview,
          contract: {
            persistedFields: PERSISTED_FIELDS,
            unpersistedFields: UNPERSISTED_FIELDS,
            unavailableMetrics: UNAVAILABLE_METRICS,
            delivery: DELIVERY_POSTURE,
            quietHours: QUIET_HOURS,
            publishAtFallback: PUBLISH_AT_FALLBACK,
            types: ANNOUNCEMENT_TYPES,
            channels: ANNOUNCEMENT_CHANNELS,
            languages: ANNOUNCEMENT_LANGUAGES,
            audienceDimensions: AUDIENCE_DIMENSIONS,
          },
        },
        requestId,
        self: `${SELF}?view=audience`,
      });
    }

    const register = await listAnnouncementRegister(access, parsed.data);
    return collection({
      type: "announcement",
      // The caller's write scope and the population it was resolved against
      // travel with every row, so the page never re-derives either.
      items: register.items.map((item) => ({ ...item, canWrite: register.canWrite, populationCount: register.populationCount })),
      requestId,
      self: SELF,
      nextCursor: register.nextCursor,
      total: register.items.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
