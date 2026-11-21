import { NextResponse } from "next/server";
import { updateCompany, updateCompanySchema } from "@/server/organization/group";
import { requireAccess } from "@/server/platform/access";
import { parseJsonBody } from "@/server/platform/body";
import { fail, HttpError, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/** Renames a company, moves it under another parent, or changes its kind, industry or status. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError({ status: 404, code: "NOT_FOUND", message: "The company was not found." });
    const input = await parseJsonBody(request, updateCompanySchema, "company update");
    const company = await updateCompany(access, id, input, requestId);
    return NextResponse.json({ data: company, meta: { requestId } }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    return fail(error, requestId);
  }
}
