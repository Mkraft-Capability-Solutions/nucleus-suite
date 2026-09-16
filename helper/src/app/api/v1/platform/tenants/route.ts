import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/server/platform-admin/access";
import { createPlatformTenant, createTenantSchema, listPlatformTenants } from "@/server/platform-admin/service";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const tenants = await listPlatformTenants(admin);
    return NextResponse.json({ data: tenants, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const parsed = createTenantSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Company details are invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const tenant = await createPlatformTenant(admin, parsed.data);
    return NextResponse.json({ data: tenant, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
