import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { consentGuarantee } from "@/server/loans/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ approve: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A consent decision (approve true/false) is required." });
    const result = await consentGuarantee(access, id, parsed.data.approve, requestId);
    return ok({ type: "loan", id: result.loanId, version: 1, attributes: result, requestId, self: `/api/v1/loans/${result.loanId}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
