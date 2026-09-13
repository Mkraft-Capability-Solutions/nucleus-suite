import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { awardReferral } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ tenureDays: z.number().int().min(0), requiredDays: z.number().int().min(0).default(90) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Tenure evidence is required to award a referral." });
    const result = await awardReferral(access, id, parsed.data.tenureDays, parsed.data.requiredDays, requestId);
    return ok({ type: "referral-award", id: result.awardId, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
