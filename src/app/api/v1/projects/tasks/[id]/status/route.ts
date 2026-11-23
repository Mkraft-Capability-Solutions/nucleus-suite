import { requireAccess } from "@/server/platform/access";
import { fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { moveTask, moveTaskSchema } from "@/server/workflows/project-board";
import { idempotentWrite, parseBody } from "@/server/workflows/idempotent-write";

export const dynamic = "force-dynamic";

export { moveTaskSchema as updateTaskStatusSchema };

/**
 * PATCH moves a task one column (`{ from, to }`). `from` is the column the caller saw: if the task has
 * moved since, the server answers 409 instead of overwriting. Unknown tasks are 404.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const input = parseBody(moveTaskSchema, await request.json().catch(() => null));
    const result = await idempotentWrite(access, request.headers, "project.task_move", { id, ...input }, () => moveTask(access, id, input, requestId));
    return ok({ type: "task", id, version: 1, attributes: result, requestId, self: `/api/v1/projects/tasks/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
