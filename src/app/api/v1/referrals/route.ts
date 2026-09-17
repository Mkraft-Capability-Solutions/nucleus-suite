import { requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { referCandidate, referCandidateSchema } from "@/server/engagement/service";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const [rows] = await tenantTx(access, [
      sqlClient`
        select r.id, r.attributes, r.candidate_id, r.referrer_employee_id,
               coalesce(c.attributes->>'name', 'Candidate') as candidate_name,
               coalesce(e.first_name || ' ' || e.last_name, 'Employee') as referrer_name
        from referrals r
        left join candidates c on c.id = r.candidate_id and c.tenant_id = r.tenant_id
        left join employees e on e.id = r.referrer_employee_id and e.tenant_id = r.tenant_id
        where r.tenant_id = ${access.tenantId}
        order by r.id desc
      `,
    ]);

    const items = (rows as Array<Record<string, any>>).map((r) => ({
      id: r.id,
      version: 1,
      candidateId: r.candidate_id,
      candidateName: r.candidate_name,
      referrerName: r.referrer_name,
      status: r.attributes?.status || "referred",
      bonus: r.attributes?.bonus || "₹25,000",
      ...(r.attributes || {}),
    }));

    return collection({
      type: "referrals",
      items,
      requestId,
      self: "/api/v1/referrals",
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
    const parsed = referCandidateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The referral payload is invalid." });
    const result = await referCandidate(access, parsed.data);
    return ok({ type: "referral", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
