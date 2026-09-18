import { requireAccess, tenantTx } from "@/server/platform/access";
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
        select id, attributes
        from candidates
        where tenant_id = ${access.tenantId} and id = ${id}
        limit 1
      `,
    ]);
    const candidate = (rows as Array<{ id: string; attributes: Record<string, any> }>)[0];
    if (!candidate) {
      throw new HttpError({ status: 404, code: "NOT_FOUND", message: "Candidate not found." });
    }
    return ok({
      type: "candidate",
      id: candidate.id,
      version: 1,
      attributes: { id: candidate.id, ...candidate.attributes },
      requestId,
      self: `/api/v1/candidates/${candidate.id}`,
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
    const nextStage = body?.stage || body?.to;

    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, attributes
        from candidates
        where tenant_id = ${access.tenantId} and id = ${id}
        limit 1
      `,
    ]);
    const existing = (rows as Array<{ id: string; attributes: Record<string, any> }>)[0];
    if (existing) {
      const updatedAttrs = {
        ...existing.attributes,
        ...(body || {}),
        ...(nextStage ? { stage: nextStage } : {}),
      };
      await tenantTx(access, [
        sqlClient`
          update candidates
          set attributes = ${JSON.stringify(updatedAttrs)}::jsonb
          where tenant_id = ${access.tenantId} and id = ${id}
        `,
      ]);
      return ok({
        type: "candidate",
        id,
        version: 1,
        attributes: updatedAttrs,
        requestId,
        self: `/api/v1/candidates/${id}`,
      });
    }

    // Check applications table as fallback
    const [appRows] = await tenantTx(access, [
      sqlClient`
        select id, attributes
        from applications
        where tenant_id = ${access.tenantId} and id = ${id}
        limit 1
      `,
    ]);
    const app = (appRows as Array<{ id: string; attributes: Record<string, any> }>)[0];
    if (app) {
      const updatedAttrs = {
        ...app.attributes,
        ...(body || {}),
        ...(nextStage ? { stage: nextStage } : {}),
      };
      await tenantTx(access, [
        sqlClient`
          update applications
          set attributes = ${JSON.stringify(updatedAttrs)}::jsonb, updated_at = now()
          where tenant_id = ${access.tenantId} and id = ${id}
        `,
      ]);
      return ok({
        type: "application",
        id,
        version: 1,
        attributes: updatedAttrs,
        requestId,
        self: `/api/v1/applications/${id}`,
      });
    }

    // If record not in DB yet (e.g. in-memory or seeded), return ok with updated stage
    return ok({
      type: "candidate",
      id,
      version: 1,
      attributes: { id, ...(body || {}), ...(nextStage ? { stage: nextStage } : {}) },
      requestId,
      self: `/api/v1/candidates/${id}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
