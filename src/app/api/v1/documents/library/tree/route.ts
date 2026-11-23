import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, requestIdFrom } from "@/server/platform/http";
import { libraryTree } from "@/server/documents/library";

export const dynamic = "force-dynamic";

/** The folders (company > department > person) the caller may open, with document counts and types. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await libraryTree(access), meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
