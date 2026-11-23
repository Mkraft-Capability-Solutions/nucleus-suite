import { NextResponse } from "next/server";
import { createCompany, createCompanySchema, listCompanies } from "@/server/organization/group";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** The group's companies with their parent company, kind, industry and active headcount. */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    return NextResponse.json({ data: await listCompanies(access), meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const input = await parseJsonBody(request, createCompanySchema, "company");
    const company = await createCompany(access, input, requestId);
    return NextResponse.json({ data: company, meta: { requestId } }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
