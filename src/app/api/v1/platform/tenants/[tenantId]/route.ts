import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin/access";
import { changePlatformTenantStatus, changeTenantStatusSchema } from "@/server/platform-admin/service";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const { tenantId } = await params;
    if (!z.uuid().safeParse(tenantId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Company identifier is invalid." });
    }
    const parsed = changeTenantStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A status and reason are required." });
    }
    const tenant = await changePlatformTenantStatus(admin, tenantId, parsed.data);
    return NextResponse.json({ data: tenant, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
