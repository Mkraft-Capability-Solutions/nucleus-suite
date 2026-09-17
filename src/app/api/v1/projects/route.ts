import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(150),
  desc: z.string().trim().max(1000).optional(),
  due: z.string().optional(),
  color: z.string().optional(),
  visibility: z.string().optional(),
  members: z.array(z.string()).optional(),
});

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, status, attributes, created_at
        from project_workforce
        where tenant_id = ${access.tenantId}
          and (attributes->>'entry_kind' = 'project' or attributes->>'kind' = 'project')
        order by created_at desc
      `,
    ]);

    const items = (rows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      version: 1,
      title: (r.attributes as any)?.title,
      desc: (r.attributes as any)?.desc,
      due: (r.attributes as any)?.due,
      color: (r.attributes as any)?.color,
      visibility: (r.attributes as any)?.visibility,
      members: (r.attributes as any)?.members || [],
      status: r.status as string,
      createdAt: r.created_at as string,
    }));

    return collection({
      type: "projects",
      items,
      requestId,
      self: "/api/v1/projects",
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
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Invalid project payload.",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
      });
    }

    const projectId = crypto.randomUUID();
    const attributes = {
      kind: "project",
      entry_kind: "project",
      ...parsed.data,
      created_by: access.context.actorUserId,
    };

    await tenantTx(access, [
      sqlClient`
        insert into project_workforce (id, tenant_id, status, attributes)
        values (${projectId}, ${access.tenantId}, 'active', ${JSON.stringify(attributes)}::jsonb)
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'project.create', 'project', ${projectId}, 'Project created',
          ${JSON.stringify(attributes)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "project",
      id: projectId,
      version: 1,
      attributes: {
        id: projectId,
        ...parsed.data,
      },
      requestId,
      self: `/api/v1/projects/${projectId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
