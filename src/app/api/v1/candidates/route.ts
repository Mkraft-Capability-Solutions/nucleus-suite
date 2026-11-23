import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createCandidate, createCandidateSchema } from "@/server/talent/service";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, attributes
        from candidates
        where tenant_id = ${access.tenantId}
        order by created_at desc
        limit 200
      `,
    ]);

    // Values are returned as stored; a field the candidate record does not hold is null, never a placeholder.
    const items = (rows as Array<{ id: string; attributes: Record<string, unknown> | null }>).map((r) => ({
      ...(r.attributes || {}),
      id: r.id,
      version: 1,
      name: typeof r.attributes?.name === "string" ? r.attributes.name : null,
      email: typeof r.attributes?.email === "string" ? r.attributes.email : null,
      phone: typeof r.attributes?.phone === "string" ? r.attributes.phone : null,
      source: typeof r.attributes?.source === "string" ? r.attributes.source : null,
    }));

    return collection({
      type: "candidates",
      items,
      requestId,
      self: "/api/v1/candidates",
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
    const parsed = createCandidateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The candidate payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createCandidate(access, parsed.data);
    return ok({ type: "candidate", id: result.id, version: 1, attributes: { id: result.id, ...parsed.data }, requestId, self: `/api/v1/candidates/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
