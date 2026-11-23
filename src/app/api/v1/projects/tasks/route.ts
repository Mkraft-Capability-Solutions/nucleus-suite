import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { createTask, createTaskSchema, loadProjectBoard } from "@/server/workflows/project-board";
import { idempotentWrite, parseBody } from "@/server/workflows/idempotent-write";

export const dynamic = "force-dynamic";

export { createTaskSchema };

/** GET lists tasks in projects visible to the caller; `?projectId=` narrows to one project. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const projectId = new URL(request.url).searchParams.get("projectId");
    const board = await loadProjectBoard(access);
    const items = board.tasks.filter((task) => !projectId || task.projectId === projectId).map((task) => ({ ...task, version: 1 }));
    return collection({ type: "task", items, requestId, self: "/api/v1/projects/tasks", nextCursor: null });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST creates a task in a visible, active project (workforce.projects.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const input = parseBody(createTaskSchema, await request.json().catch(() => null));
    const result = await idempotentWrite(access, request.headers, "project.task_create", input, () => createTask(access, input, requestId));
    return ok({ type: "task", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/projects/tasks/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
