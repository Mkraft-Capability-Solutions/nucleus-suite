import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { assertNoStageChange, updateCandidateRecord, updateCandidateSchema } from "@/server/talent/candidate-record";
import { parseBody } from "@/server/workflows/idempotent-write";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
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

/**
 * PATCH edits candidate profile fields only (employee.write). Stage moves go through
 * POST /api/v1/applications/:id/advance; an unknown candidate is a 404, never an echoed record.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    assertNoStageChange(body);
    const input = parseBody(updateCandidateSchema, body);
    const updated = await updateCandidateRecord(access, id, input, requestId);
    return ok({ type: "candidate", id: updated.id, version: 1, attributes: { id: updated.id, ...updated.attributes }, requestId, self: `/api/v1/candidates/${updated.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
