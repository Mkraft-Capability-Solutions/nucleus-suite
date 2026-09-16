import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { runEvalSuite, runEvalSuiteSchema } from "@/server/ai/evals";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = runEvalSuiteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An evaluation suite name is required." });
    const result = await runEvalSuite(access, parsed.data.suite, requestId);
    return ok({ type: "ai-eval-run", id: result.runId, version: 1, attributes: result, requestId, self: `/api/v1/ai/evals/${result.runId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
