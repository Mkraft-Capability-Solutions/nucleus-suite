import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { loadMilestoneBoard, milestonesQuery } from "@/server/engagement/milestones";

/**
 * Employee milestones — the read behind the Recognition & Events panels for
 * upcoming birthdays, work anniversaries and new joiners.
 *
 * Read-only by design. There is nothing to write: every figure is derived from
 * `employees.date_of_birth` and `employees.joining_date`, and the fourth panel
 * of that surface — the recognition hall of fame — is served by the existing
 * `GET /api/v1/recognition-register`, which already carries the recipient, the
 * award category, the citation, the nominator and the award value. Nominating
 * somebody is `POST /api/v1/recognition-register`, which is idempotency-keyed;
 * this route deliberately adds no second write path for the same records.
 *
 * PRIVACY. `date_of_birth` is personal data whose year reveals age. The
 * birthday panel is gated behind `employee.birthdate.read` inside the service,
 * the query selects only the month and the day, and a caller without the
 * permission still receives the other two panels with the birthday panel marked
 * unavailable and the reason stated. One withheld panel never fails the read.
 */
export const dynamic = "force-dynamic";

/** Top-level so the contract is readable without opening the service. */
export const querySchema = milestonesQuery;

const SELF = "/api/v1/engagement/milestones";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const key of ["windowDays", "lookbackDays"]) {
      const value = params.get(key);
      if (value !== null && value !== "") raw[key] = value;
    }
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Check the milestone window parameters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const board = await loadMilestoneBoard(access, parsed.data);
    // A composed read model: the three panels only mean something beside the
    // window they were derived over and, for birthdays, how many records carry
    // a birth date at all.
    return ok({
      type: "engagement-milestones",
      id: "engagement-milestones",
      version: 1,
      attributes: { ...board },
      requestId,
      self: SELF,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
