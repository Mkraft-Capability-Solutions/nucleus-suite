import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { answerSurvey, answerSurveySchema } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = answerSurveySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The survey answers are invalid." });
    const result = await answerSurvey(access, parsed.data);
    return ok({ type: "survey-response", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/survey-responses` });
  } catch (error) {
    return fail(error, requestId);
  }
}
