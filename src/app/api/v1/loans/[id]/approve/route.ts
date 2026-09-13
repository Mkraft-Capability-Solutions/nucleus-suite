import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { approveLoan, approveLoanSchema } from "@/server/loans/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = approveLoanSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The approval payload is invalid." });
    const result = await approveLoan(access, id, parsed.data, requestId);
    return ok({ type: "loan", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/loans/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
