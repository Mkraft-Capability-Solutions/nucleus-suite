import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listPeopleFolders, peopleQuerySchema } from "@/server/documents/people";

export const dynamic = "force-dynamic";

/** Person-wise document folders: employee, document count, nearest expiry (document.read or document.self.read). */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = Object.fromEntries([...new URL(request.url).searchParams.entries()].filter(([, value]) => value !== ""));
    const parsed = peopleQuerySchema.safeParse(params);
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The filters are invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    const result = await listPeopleFolders(access, parsed.data);
    return NextResponse.json({ data: result.items, meta: { requestId, page: result.page, pageSize: result.pageSize, total: result.total, canUpload: result.canUpload, scope: result.scope } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
