import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listOpenSurveyRuns, startSurveyRun } from "@/server/engagement/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ surveyId: z.string().uuid(), audience: z.string().trim().max(120).optional() });

/**
 * The open runs a respondent may answer, with their questions. `employee.read`, because
 * answering is `employee.read`; opening a run stays `employee.write` on POST below.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const runs = await listOpenSurveyRuns(access);
    return collection({
      type: "survey-run",
      requestId,
      self: "/api/v1/survey-runs",
      items: runs.map((run) => ({ id: run.id, version: 1, attributes: run })),
      nextCursor: null,
      total: runs.length,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

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
