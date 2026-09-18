import { requireAccess, tenantTx } from "@/server/platform/access";
import { collection, fail, ok, requestIdFrom } from "@/server/platform/http";
import { sqlClient } from "@/lib/db";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    // Fetch pending and historical CTC approvals from database approvals / candidates
    const [rows] = await tenantTx(access, [
      sqlClient`
        select id, attributes, created_at
        from approvals
        where tenant_id = ${access.tenantId} and attributes->>'type' = 'ctc_exception'
        order by created_at desc
        limit 50
      `,
    ]).catch(async () => {
      return [[]];
    });

    const items = (rows as Array<{ id: string; attributes: Record<string, any>; created_at: string }>).map((r) => ({
      id: r.id,
      version: 1,
      createdAt: r.created_at,
      ...(r.attributes || {}),
    }));

    return collection({
      type: "ctc_exception",
      items,
      requestId,
      self: "/api/v1/operations/ctc-exceptions",
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
    const {
      id: providedId,
      candidateId,
      candidateName = "Candidate",
      role = "Specialist",
      department = "Operations",
      hiringManager = "Hiring Manager",
      approvedBandMax = 2000000,
      requestedCtc = 2400000,
      justification = "Candidate possesses critical skills requiring out-of-budget authorization.",
      action = "CREATE", // "CREATE", "APPROVE", "REJECT"
      remarks = "",
    } = body;

    const exceptionId = providedId || `CTC-EXC-${Date.now().toString().slice(-6)}`;
    const varianceAmount = Math.max(0, requestedCtc - approvedBandMax);
    const variancePct = approvedBandMax > 0 ? Number(((varianceAmount / approvedBandMax) * 100).toFixed(1)) : 0;

    const record = {
      type: "ctc_exception",
      id: exceptionId,
      candidateId,
      candidateName,
      role,
      department,
      hiringManager,
      approvedBandMax,
      requestedCtc,
      varianceAmount,
      variancePct,
      justification,
      status: action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "PENDING",
      remarks,
      updatedAt: new Date().toISOString(),
    };

    // Store in approvals table if present, or update existing approval
    await tenantTx(access, [
      sqlClient`
        insert into approvals (id, tenant_id, attributes, created_at, updated_at)
        values (${exceptionId}, ${access.tenantId}, ${JSON.stringify(record)}::jsonb, now(), now())
        on conflict (id) do update
        set attributes = ${JSON.stringify(record)}::jsonb, updated_at = now()
      `,
    ]).catch(async () => {
      // Fallback: update candidate attributes if table differs
      if (candidateId) {
        await tenantTx(access, [
          sqlClient`
            update candidates
            set attributes = jsonb_set(attributes, '{ctcException}', ${JSON.stringify(record)}::jsonb)
            where tenant_id = ${access.tenantId} and id = ${candidateId}
          `,
        ]).catch(() => null);
      }
    });

    return ok({
      type: "ctc_exception",
      id: exceptionId,
      version: 1,
      attributes: record,
      requestId,
      self: `/api/v1/operations/ctc-exceptions/${exceptionId}`,
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
