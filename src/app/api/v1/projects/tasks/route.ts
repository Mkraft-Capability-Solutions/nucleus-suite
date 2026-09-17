import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createTaskSchema = z.object({
  projectId: z.string().optional(),
  project: z.string().trim().min(1).max(150),
  title: z.string().trim().min(1).max(200),
  assignee: z.string().optional(),
  tag: z.string().optional(),
  priority: z.string().optional(),
  due: z.string().optional(),
  column: z.string().optional().default("todo"),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const url = new URL(request.url);
    const project = url.searchParams.get("project");

    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, attributes, created_at, status
        from project_workforce
        where tenant_id = ${access.tenantId} and attributes->>'kind' = 'task'
          and (${project ? sqlClient`attributes->>'project' = ${project}` : sqlClient`1=1`})
        order by created_at asc
      `,
    ]);

    const items = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      version: 1,
      title: (r.attributes as any)?.title,
      project: (r.attributes as any)?.project,
      assignee: (r.attributes as any)?.assignee,
      tag: (r.attributes as any)?.tag,
      priority: (r.attributes as any)?.priority,
      due: (r.attributes as any)?.due,
      column: (r.attributes as any)?.column || "todo",
      status: r.status as string,
      createdAt: r.created_at as string,
    }));

    return collection({
      type: "tasks",
      items,
      requestId,
      self: "/api/v1/projects/tasks",
      nextCursor: null,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid task payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const taskId = crypto.randomUUID();
    const attributes = {
      kind: "task",
      ...parsed.data,
      column: parsed.data.column || "todo",
      created_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into project_workforce (id, tenant_id, status, attributes)
        values (${taskId}, ${access.tenantId}, 'active', ${JSON.stringify(attributes)}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'project.task_create', 'project_task', ${taskId}, 'Project task created',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "task",
      id: taskId,
      version: 1,
      attributes: {
        id: taskId,
        ...attributes,
      },
      requestId,
      self: `/api/v1/projects/tasks/${taskId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
