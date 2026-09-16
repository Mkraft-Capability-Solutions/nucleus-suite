import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import {
  AWARD_MATURATION_STATES,
  REFERRAL_TRACKING_STATES,
  loadReferralTracking,
  loadReferralTrackingDetail,
} from "@/server/engagement/referral-tracking";

export const dynamic = "force-dynamic";

/**
 * SCR-091 read model. One screen, one register, one detail, no writes.
 *
 * Both actions the screen offers already have endpoints that own their rule:
 * POST /api/v1/referrals creates the referral against the caller's own employee
 * record, and POST /api/v1/referrals/:id/award is the tenure gate. Nothing here
 * duplicates either, and nothing here states an award amount: the scheme is
 * per-programme configuration (RL-470/471) read from tenant settings, and an
 * absent scheme is reported as absent.
 *
 * Referrals only. Recognition lives on `recognition_events` and its own screen;
 * a citation is not a referral.
 */
export const referralTrackingQuerySchema = z.object({
  /** Present only when the detail panel is open. */
  referralId: z.string().uuid().optional(),
  state: z.enum(REFERRAL_TRACKING_STATES).optional(),
  maturation: z.enum(AWARD_MATURATION_STATES).optional(),
});

function queryObject(params: URLSearchParams): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value !== "") entries[key] = value;
  }
  return entries;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = referralTrackingQuerySchema.safeParse(queryObject(params));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: `The referral tracking query is invalid. Known states: ${REFERRAL_TRACKING_STATES.join(", ")}.`,
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const query = parsed.data;

    if (query.referralId) {
      const detail = await loadReferralTrackingDetail(access, query.referralId);
      if (!detail) {
        throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The requested record was not found." });
      }
      return ok({
        type: "referral-tracking",
        id: query.referralId,
        version: 1,
        attributes: { detail },
        requestId,
        self: `/api/v1/referral-tracking?referralId=${encodeURIComponent(query.referralId)}`,
      });
    }

    const register = await loadReferralTracking(access);
    const rows = register.rows.filter((row) => {
      if (query.state && row.trackingState !== query.state) return false;
      if (query.maturation && row.maturation.state !== query.maturation) return false;
      return true;
    });

    return ok({
      type: "referral-tracking",
      id: "register",
      version: 1,
      attributes: {
        ...register,
        rows,
        total: rows.length,
        writeEndpoints: {
          refer: "POST /api/v1/referrals",
          award: "POST /api/v1/referrals/:id/award",
        },
      },
      requestId,
      self: "/api/v1/referral-tracking",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
