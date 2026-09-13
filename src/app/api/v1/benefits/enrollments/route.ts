import { NextResponse } from "next/server";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { enrollBenefit, enrollBenefitSchema, listEnrollmentsFor } from "@/server/benefits/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const employeeId = new URL(request.url).searchParams.get("employeeId");
    if (!employeeId) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "An employeeId is required." });
    const enrollments = await listEnrollmentsFor(access, employeeId);
    return NextResponse.json({ data: enrollments, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const parsed = enrollBenefitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The enrollment payload is invalid." });
    const result = await enrollBenefit(access, parsed.data, requestId);
    return ok({ type: "benefit-enrollment", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/benefits/enrollments` });
  } catch (error) {
    return fail(error, requestId);
  }
}
