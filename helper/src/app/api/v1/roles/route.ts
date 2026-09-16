import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createRole, createRoleSchema } from "@/server/admin/service";
import { listScopeRoles } from "@/server/access-scopes/service";

export const dynamic = "force-dynamic";

/** Active role templates for governed grants. Requires membership.manage. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const roles = await listScopeRoles(access);
    return NextResponse.json({ data: roles, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createRoleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The role payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createRole(access, parsed.data);
    return ok({ type: "role", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/roles` });
  } catch (error) {
    return fail(error, requestId);
  }
}
