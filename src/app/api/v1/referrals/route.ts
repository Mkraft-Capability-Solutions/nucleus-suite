import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { referCandidate, referCandidateSchema } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = referCandidateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The referral payload is invalid." });
    const result = await referCandidate(access, parsed.data);
    return ok({ type: "referral", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
