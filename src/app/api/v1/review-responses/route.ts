import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { participantResponses, submitResponse, submitResponseSchema } from "@/server/performance/reviews";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const participantId = new URL(request.url).searchParams.get("participantId");
    if (!participantId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A participantId is required." });
    const responses = await participantResponses(access, participantId);
    return NextResponse.json({ data: responses, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = submitResponseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The response payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await submitResponse(access, parsed.data, requestId);
    return ok({ type: "review-response", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/review-responses` });
  } catch (error) {
    return fail(error, requestId);
  }
}
