import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/server/platform-admin/access";
import { resetPlatformTenantUserPassword } from "@/server/platform-admin/service";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** Issue a new one-time password for a member (shown once) and end their sessions. */
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string; membershipId: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const admin = await requirePlatformAdmin(request);
    const { tenantId, membershipId } = await params;
    if (!z.uuid().safeParse(tenantId).success || !z.uuid().safeParse(membershipId).success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Company or member identifier is invalid." });
    }
    const data = await resetPlatformTenantUserPassword(admin, tenantId, membershipId);
    return NextResponse.json({ data, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
