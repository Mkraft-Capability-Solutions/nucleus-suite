import { enforce, requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";
import { referCandidate, referCandidateSchema } from "@/server/engagement/service";
import { referralIntakeSchema, submitReferral } from "@/server/talent/referral-intake";
import { idempotentWrite, parseBody } from "@/server/workflows/idempotent-write";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const [rows] = await tenantTx(access, [
      sqlClient`
        select r.id, r.attributes, r.candidate_id, r.referrer_employee_id,
               c.attributes->>'name' as candidate_name,
               nullif(trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), '') as referrer_name
        from referrals r
        left join candidates c on c.id = r.candidate_id and c.tenant_id = r.tenant_id
        left join employees e on e.id = r.referrer_employee_id and e.tenant_id = r.tenant_id
        where r.tenant_id = ${access.tenantId}
        order by r.created_at desc
        limit 200
      `,
    ]);

    const items = (rows as Array<{ id: string; candidate_id: string; attributes: Record<string, unknown> | null; candidate_name: string | null; referrer_name: string | null }>).map((r) => ({
      ...(r.attributes || {}),
      id: r.id,
      version: 1,
      candidateId: r.candidate_id,
      candidateName: r.candidate_name,
      referrerName: r.referrer_name,
      status: typeof r.attributes?.status === "string" ? r.attributes.status : "referred",
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

/**
 * POST records an employee referral. With `candidateName` it runs the intake (candidate, application against
 * the chosen requisition, referral) in one transaction; with `candidateId` it links an existing candidate.
 * employee.write; the referrer is the caller's own employee record. Idempotency-Key required.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && "candidateName" in body) {
      const input = parseBody(referralIntakeSchema, body);
      const result = await idempotentWrite(access, request.headers, "talent.referral_intake", input, () => submitReferral(access, input, requestId));
      return ok({ type: "referral", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${result.id}` });
    }
    const input = parseBody(referCandidateSchema, body);
    const result = await idempotentWrite(access, request.headers, "talent.referral_link", input, () => referCandidate(access, input));
    return ok({ type: "referral", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
