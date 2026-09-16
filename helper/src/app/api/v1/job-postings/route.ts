import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { createPosting, createPostingSchema, listPostings } from "@/server/interviews/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const postings = await listPostings(access, new URL(request.url).searchParams.get("requisitionId"));
    return NextResponse.json({ data: postings, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = createPostingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The posting payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await createPosting(access, parsed.data);
    return ok({ type: "job-posting", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/job-postings` });
  } catch (error) {
    return fail(error, requestId);
  }
}
