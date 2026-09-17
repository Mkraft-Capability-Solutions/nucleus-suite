import { requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createCandidate, createCandidateSchema } from "@/server/talent/service";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, attributes
        from candidates
        where tenant_id = ${access.tenantId}
        order by id desc
      `,
    ]);

    const items = (rows as Array<{ id: string; attributes: Record<string, any> }>).map((r) => ({
      id: r.id,
      version: 1,
      name: r.attributes?.name || "Candidate",
      email: r.attributes?.email || "",
      phone: r.attributes?.phone || "",
      source: r.attributes?.source || "referral",
      role: r.attributes?.role || r.attributes?.targetRole || "Specialist",
      stage: r.attributes?.stage || "sourced",
      dept: r.attributes?.department || r.attributes?.dept || "Operations",
      ...r.attributes,
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
    const result = await createCandidate(access, {
      ...parsed.data,
      ...body,
    });
    return ok({ type: "candidate", id: result.id, version: 1, attributes: { id: result.id, ...parsed.data, ...body }, requestId, self: `/api/v1/candidates/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
