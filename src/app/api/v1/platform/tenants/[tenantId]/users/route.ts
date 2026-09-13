import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin/access";
import { createPlatformTenantUser, createTenantUserSchema, listPlatformTenantUsers } from "@/server/platform-admin/service";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

async function tenantIdFrom(params: Promise<{ tenantId: string }>) {
  const { tenantId } = await params;
  if (!z.uuid().safeParse(tenantId).success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Company identifier is invalid." });
  return tenantId;
}

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const data = await listPlatformTenantUsers(admin, await tenantIdFrom(params));
    return NextResponse.json({ data, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) { return fail(error, requestId); }
}

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const tenantId = await tenantIdFrom(params);
    const parsed = createTenantUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "User details and at least one role are required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    const data = await createPlatformTenantUser(admin, tenantId, parsed.data);
    return NextResponse.json({ data, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) { return fail(error, requestId); }
}
