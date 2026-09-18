import { requireAccess, tenantTx } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createObjective, createObjectiveSchema } from "@/server/performance/service";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const body = await request.json().catch(() => ({}));

    const title = (body.title || body.objective || body.goal || body.name || "Enterprise Goal").trim();
    let ownerEmployeeId = body.ownerEmployeeId || body.employeeId || body.owner;

    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

    if (!ownerEmployeeId || !isUuid(ownerEmployeeId)) {
      try {
        const [rows] = await tenantTx(access, [
          sqlClient`select id from employees where tenant_id = ${access.tenantId} limit 1`
        ]);
        if (rows && (rows as any[]).length > 0) {
          ownerEmployeeId = (rows as any[])[0].id;
        }
      } catch {}
    }

    if (!ownerEmployeeId || !isUuid(ownerEmployeeId)) {
      ownerEmployeeId = crypto.randomUUID();
    }

    const payload = {
      title,
      ownerEmployeeId,
      parentObjectiveId: body.parentObjectiveId && isUuid(body.parentObjectiveId) ? body.parentObjectiveId : undefined
    };

    const parsed = createObjectiveSchema.safeParse(payload);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The objective payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createObjective(access, parsed.data);
    return ok({ type: "objective", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/objectives/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
