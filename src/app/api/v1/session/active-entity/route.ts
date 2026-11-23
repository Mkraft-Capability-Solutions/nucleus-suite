import { NextResponse } from "next/server";
import { activeEntitySchema, getActiveEntity, setActiveEntity } from "@/server/organization/active-entity";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const headers = (requestId: string) => ({ "cache-control": "no-store", "x-request-id": requestId });

/** The company the workspace is scoped to and the resolved company scope. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await getActiveEntity(access), meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Set the active company ({ companyId } or "ALL_GROUP_ENTITIES" for group administrators). An upsert, so retries are safe. */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const input = await parseJsonBody(request, activeEntitySchema, "active entity");
    return NextResponse.json({ data: await setActiveEntity(access, input), meta: { requestId } }, { headers: headers(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
