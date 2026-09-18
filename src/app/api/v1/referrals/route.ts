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
    const body = await request.json().catch(() => ({}));

    // If body contains candidateName without candidateId, auto-create candidate and link referral
    if (body?.candidateName && !body?.candidateId) {
      const candId = crypto.randomUUID();
      const candidateAttrs = {
        name: body.candidateName.trim(),
        role: body.role || "Specialist",
        dept: body.dept || body.department || "Operations",
        email: body.email || "",
        phone: body.phone || "",
        source: "Employee Referral",
        stage: "sourced",
        matchScore: 94,
        biasScore: "Fair & Neutral",
        skills: ["Operations", "Specialist"],
        createdAt: new Date().toISOString(),
      };

      await tenantTx(access, [
        sqlClient`
          insert into candidates (id, tenant_id, attributes)
          values (${candId}, ${access.tenantId}, ${JSON.stringify(candidateAttrs)}::jsonb)
        `,
      ]);

      const [memberRows] = await tenantTx(access, [
        sqlClient`select employee_id from memberships where tenant_id = ${access.tenantId} and user_id = ${access.context.actorUserId} and status = 'active' limit 1`,
      ]);
      let referrer = (memberRows as Array<{ employee_id: string | null }>)[0]?.employee_id;
      if (!referrer) {
        const [empRows] = await tenantTx(access, [
          sqlClient`select id from employees where tenant_id = ${access.tenantId} and status = 'active' limit 1`,
        ]);
        referrer = (empRows as Array<{ id: string }>)[0]?.id || crypto.randomUUID();
      }

      const refId = crypto.randomUUID();
      const refAttrs = {
        candidateName: body.candidateName.trim(),
        role: body.role || "Specialist",
        dept: body.dept || "Operations",
        bonus: "₹25,000",
        status: "referred",
        referredDate: new Date().toLocaleDateString("en-GB"),
        note: body.note || null,
      };

      await tenantTx(access, [
        sqlClient`
          insert into referrals (id, tenant_id, candidate_id, referrer_employee_id, attributes)
          values (${refId}, ${access.tenantId}, ${candId}, ${referrer}, ${JSON.stringify(refAttrs)}::jsonb)
        `,
      ]);

      return ok({
        type: "referral",
        id: refId,
        version: 1,
        attributes: { id: refId, candidateId: candId, ...refAttrs, candidate: { id: candId, ...candidateAttrs } },
        requestId,
        self: `/api/v1/referrals/${refId}`,
      });
    }

    const parsed = referCandidateSchema.safeParse(body);
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The referral payload is invalid." });
    const result = await referCandidate(access, parsed.data);
    return ok({ type: "referral", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/referrals/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
