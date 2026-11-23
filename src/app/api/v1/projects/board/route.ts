import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { loadProjectBoard } from "@/server/workflows/project-board";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/projects/board - the project workspace in one read: visible projects (with members,
 * derived progress and task counts), their tasks, and the viewer's own employee id and write right.
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const board = await loadProjectBoard(access);
    return ok({ type: "project-board", id: "board", version: 1, attributes: board, requestId, self: "/api/v1/projects/board" });
  } catch (error) {
    return fail(error, requestId);
  }
}
