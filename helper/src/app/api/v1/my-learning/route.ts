import { requireAccess } from "@/server/platform/access";
import { encodeCursor, fail, HttpError, ok, parsePagination, requestIdFrom } from "@/server/platform/http";
import { getMyLearningDetail, listMyLearning, myLearningQuerySchema } from "@/server/learning/my-learning";

export const dynamic = "force-dynamic";

/**
 * SCR-063 "My learning" — the signed-in employee's own learning queue:
 * learning path, due date, progress and status.
 *
 * Read-only on purpose. The two actions the screen offers already have
 * endpoints and this route does not duplicate them: assigning learning is
 * `POST /api/v1/enrollments` and recording a completion is
 * `POST /api/v1/enrollments/:id/complete`. A third writer for the same
 * transitions would be a second source of truth for enrollment state.
 *
 * Returned through `ok()` rather than `collection()` — the same call the
 * sibling `GET /api/v1/learning-progress` makes — because the answer is a
 * screen projection, not a bare list: the rows arrive with the scope that
 * produced them, the per-state backing verdict, the action gates and the
 * standing notes about what the data cannot support. `nextCursor` and `total`
 * are carried inside the projection so pagination still works.
 *
 * Scope is self by default. A caller holding `employee.write` — the permission
 * `enrollEmployee` and `completeEnrollment` already require — may pass
 * `employeeId` to read another learner's queue; every other caller is pinned to
 * their own employee row, and a self-scoped read of somebody else's enrollment
 * answers 404 rather than 403 so existence never leaks.
 *
 * `?enrollmentId=` returns the single-enrollment detail (course, path, due
 * position, evidence, certification, state timeline and audit trail) instead of
 * the queue.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = new URL(request.url).searchParams;
    const parsed = myLearningQuerySchema.safeParse({
      employeeId: params.get("employeeId") ?? undefined,
      enrollmentId: params.get("enrollmentId") ?? undefined,
      state: params.get("state") ?? undefined,
      overdue: params.get("overdue") ?? undefined,
      q: params.get("q") ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The my-learning query is invalid.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }

    if (parsed.data.enrollmentId) {
      const detail = await getMyLearningDetail(access, parsed.data.enrollmentId);
      const { id, version, ...rest } = detail;
      return ok({
        type: "my-learning-enrollment",
        id,
        version,
        attributes: { ...rest },
        requestId,
        self: `/api/v1/my-learning?enrollmentId=${encodeURIComponent(parsed.data.enrollmentId)}`,
      });
    }

    const { page, pageSize } = parsePagination(params);
    const queue = await listMyLearning(access, { ...parsed.data, page, pageSize });
    return ok({
      type: "my-learning",
      id: queue.subjectEmployeeId ?? access.tenantId,
      version: 1,
      attributes: {
        ...queue,
        page,
        pageSize,
        nextCursor: page * pageSize < queue.total ? encodeCursor({ page: page + 1 }) : null,
      },
      requestId,
      self: "/api/v1/my-learning",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
