import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { awardReferral, awardReferralSchema } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/referrals/:id/award — pay one leg of a referral award.
 *
 * `milestone` distinguishes the joining leg from the balance on confirmation, so the
 * endpoint is no longer single-shot. It carries no `requiredDays`: the tenure
 * threshold is the configured scheme's, never a number sent with the request.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = awardReferralSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Tenure evidence is required to award a referral.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await awardReferral(access, id, parsed.data, requestId);
    return ok({ type: "referral-award", id: result.awardId, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
