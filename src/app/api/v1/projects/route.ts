import { requireAccess } from "@/server/platform/access";
import { collection, fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { createProject, createProjectSchema, loadProjectBoard } from "@/server/workflows/project-board";
import { idempotentWrite, parseBody } from "@/server/workflows/idempotent-write";

export const dynamic = "force-dynamic";

export { createProjectSchema };

/** GET lists the projects visible to the caller (workforce.projects.read, all or self scope). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const board = await loadProjectBoard(access);
    return collection({
      type: "project",
      items: board.projects.map((project) => ({ ...project, version: 1 })),
      requestId,
      self: "/api/v1/projects",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** POST creates a project (workforce.projects.write, Idempotency-Key required). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const input = parseBody(createProjectSchema, await request.json().catch(() => null));
    const result = await idempotentWrite(access, request.headers, "project.create", input, () => createProject(access, input, requestId));
    return ok({ type: "project", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/projects/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
