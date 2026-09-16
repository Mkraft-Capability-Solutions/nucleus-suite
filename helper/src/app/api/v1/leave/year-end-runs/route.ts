import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { runLeaveYearEnd, yearEndRunSchema } from "@/server/leave/year-end";

export const dynamic = "force-dynamic";

/**
 * RL-14 year-end processing. F-LVE-07's "Run mode" defaults to Preview, so a
 * caller that omits it gets the figures and writes nothing; Preview and Commit
 * report the same encashed and lapsed DAY counts for the same year.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = yearEndRunSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The year-end run payload is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await runLeaveYearEnd(access, parsed.data, requestId);
    return ok({
      type: "leave-year-end-run",
      id: `${result.year}:${result.mode}`,
      version: 1,
      attributes: result,
      requestId,
      self: "/api/v1/leave/year-end-runs",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
