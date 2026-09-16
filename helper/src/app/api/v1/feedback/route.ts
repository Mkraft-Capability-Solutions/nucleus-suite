import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { listFeedback, requestFeedback, requestFeedbackSchema } from "@/server/performance/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const subject = new URL(request.url).searchParams.get("subjectEmployeeId");
    if (!subject) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A subjectEmployeeId is required." });
    const result = await listFeedback(access, subject);
    return NextResponse.json({ data: { type: "feedback", ...result }, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = requestFeedbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The feedback-request payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await requestFeedback(access, parsed.data);
    return ok({ type: "feedback-request", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/feedback` });
  } catch (error) {
    return fail(error, requestId);
  }
}
