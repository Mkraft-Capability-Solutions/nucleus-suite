import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const updateTaskStatusSchema = z.object({
  column: z.enum(["todo", "inprogress", "review", "done"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateTaskStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid status column.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const newColumn = parsed.data.column;

    await tenantTx(access, [
      sqlClient`
        update project_workforce
        set attributes = jsonb_set(coalesce(attributes, '{}'::jsonb), '{column}', to_jsonb(${newColumn}::text)),
            updated_at = now()
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'project.task_move', 'project_task', ${id}, 'Task moved across columns',
          ${JSON.stringify({ column: newColumn })}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "task",
      id,
      version: 1,
      attributes: {
        id,
        column: newColumn,
      },
      requestId,
      self: `/api/v1/projects/tasks/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
