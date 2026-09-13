import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { startSurveyRun } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ surveyId: z.string().uuid(), audience: z.string().trim().max(120).optional() });

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A surveyId is required to open a run." });
    const result = await startSurveyRun(access, parsed.data.surveyId, parsed.data.audience ?? null);
    return ok({ type: "survey-run", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/survey-runs/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
