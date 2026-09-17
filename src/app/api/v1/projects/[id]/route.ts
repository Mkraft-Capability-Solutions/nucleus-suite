import { z } from "zod";
import { requireAccess, tenantTx, uuidOrNull } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, status, attributes, created_at
        from project_workforce
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
        limit 1
      `,
    ]);

    const r = (rows as Array<Record<string, unknown>>)[0];
    if (!r) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Project not found." });
    }

    return ok({
      type: "project",
      id: r.id as string,
      version: 1,
      attributes: {
        id: r.id as string,
        status: r.status,
        ...(r.attributes as Record<string, unknown> || {}),
        createdAt: r.created_at,
      },
      requestId,
      self: `/api/v1/projects/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    await tenantTx(access, [
      sqlClient`
        update project_workforce
        set 
          status = coalesce(${body.status || null}, status),
          attributes = attributes || ${JSON.stringify(body)}::jsonb
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'project.update', 'project', ${id}, 'Project updated',
          ${JSON.stringify(body)}::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "project",
      id,
      version: 2,
      attributes: { id, ...body },
      requestId,
      self: `/api/v1/projects/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;

    await tenantTx(access, [
      sqlClient`
        delete from project_workforce
        where tenant_id = ${access.tenantId} and id = ${id}::uuid
      `,
      sqlClient`
        insert into audit_events (tenant_id, actor_user_id, membership_id, action, entity_type, entity_id, reason, after, request_id)
        values (${access.tenantId}, ${access.context.actorUserId}, ${access.context.membershipId},
          'project.delete', 'project', ${id}, 'Project deleted',
          '{}'::jsonb, ${uuidOrNull(requestId)}::uuid)
      `,
    ]);

    return ok({
      type: "project",
      id,
      version: 1,
      attributes: { deleted: true },
      requestId,
      self: `/api/v1/projects/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
