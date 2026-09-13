import { NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/db";
import { auth } from "@/lib/auth";
import { listTenantMemberships } from "@/server/identity/tenant-context";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** List the caller's active tenant memberships for tenant switching. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    if (!databaseConfigured) {
      return NextResponse.json({ error: "Identity storage is not configured" }, { status: 503, headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store", "x-request-id": requestId } });
    }
    const memberships = await listTenantMemberships(request.headers);
    return NextResponse.json({ memberships, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
