import { createHash } from "node:crypto";
import { sqlClient } from "@/lib/db";
import { checkIdempotency, requireAccess, storeIdempotency, tenantTx } from "@/server/platform/access";
import { collection, fail, HttpError, ok, requestIdFrom, requireIdempotencyKey } from "@/server/platform/http";
import { createRequisition, createRequisitionSchema, listRequisitions } from "@/server/talent/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const items = await listRequisitions(access);
    return collection({
      type: "requisition",
      items: items.map((r) => ({
        id: r.id,
        version: 1,
        departmentId: r.department_id,
        departmentName: r.department_name,
        positionCode: r.position_code,
        hiringManagerEmployeeId: r.hiring_manager_employee_id,
        code: (r.attributes as any)?.code,
        title: (r.attributes as any)?.title,
        status: (r.attributes as any)?.status || "draft",
        createdAt: r.created_at,
        attributes: r.attributes,
      })),
      requestId,
      self: "/api/v1/requisitions",
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
    const key = requireIdempotencyKey(request.headers);
    const rawJson = await request.json().catch(() => null);
    const body = (rawJson && typeof rawJson === "object") ? { ...rawJson } : {};
    // Aliases are accepted, but nothing is invented: a missing title, department or hiring manager is a 400,
    // and a hiring manager given as an employee code must resolve to exactly that employee.
    body.departmentName = body.departmentName || body.dept || body.department;
    if (!body.positionCode && body.vacatedPositionCode) body.positionCode = body.vacatedPositionCode;
    const manager = typeof body.hiringManagerEmployeeId === "string" ? body.hiringManagerEmployeeId.trim() : "";
    if (manager && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manager)) {
      const [empRows] = await tenantTx(access, [
        sqlClient`select id from employees where tenant_id = ${access.tenantId} and employee_code = ${manager} limit 1`,
      ]);
      const foundId = (empRows as Array<{ id: string }>)[0]?.id;
      if (!foundId) {
        throw new HttpError({ status: 422, code: "VALIDATION_FAILED", message: `No employee has the code ${manager}.`, details: [{ field: "hiringManagerEmployeeId", issue: "unknown" }] });
      }
      body.hiringManagerEmployeeId = foundId;
    }
    if (!body.title || !body.departmentName) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A job title and department are required.", details: [{ field: body.title ? "departmentName" : "title", issue: "required" }] });
    }
    const parsed = createRequisitionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The requisition payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const fingerprint = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const prior = await checkIdempotency(access, "talent.requisition_create", key, fingerprint);
    if (prior.outcome === "conflict") {
      throw new HttpError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "This Idempotency-Key was already used with a different payload." });
    }
    if (prior.outcome === "replay" && prior.responseLocator) {
      return ok({ type: "requisition", id: prior.responseLocator, version: 1, attributes: { id: prior.responseLocator, replayed: true }, requestId, self: `/api/v1/requisitions/${prior.responseLocator}` });
    }
    const result = await createRequisition(access, parsed.data, requestId);
    await storeIdempotency(access, "talent.requisition_create", key, fingerprint, 201, result.id);
    return ok({ type: "requisition", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/requisitions/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
