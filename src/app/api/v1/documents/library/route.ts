import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";
import { listFiltersSchema, listLibrary, uploadSchema, uploadToLibrary } from "@/server/documents/library";

export const dynamic = "force-dynamic";

/** Documents the caller may see (everyone's for HR, one's own otherwise), newest first. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const params = Object.fromEntries([...new URL(request.url).searchParams.entries()].filter(([, value]) => value !== ""));
    const filters = listFiltersSchema.safeParse(params);
    if (!filters.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The filters are invalid." });
    const result = await listLibrary(access, filters.data);
    return NextResponse.json({ data: result.documents, meta: { requestId, truncated: result.truncated } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

/** Upload a file into a person's folder (base64 in JSON; checked by its bytes). */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The upload is incomplete.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const created = await uploadToLibrary(access, parsed.data, requestId);
    return NextResponse.json({ data: created, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
