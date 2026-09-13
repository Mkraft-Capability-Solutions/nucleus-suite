import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createDelegation, createDelegationSchema, listDelegations } from "@/server/delegation/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const delegations = await listDelegations(access, new URL(request.url).searchParams.get("active") === "true");
    return NextResponse.json({ data: delegations, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createDelegationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The delegation payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createDelegation(access, parsed.data, requestId);
    return ok({ type: "delegation", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/delegations` });
  } catch (error) {
    return fail(error, requestId);
  }
}
