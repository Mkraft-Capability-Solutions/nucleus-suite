import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom, requireVersion } from "@/server/platform/http";
import { payAdvance, payAdvanceSchema } from "@/server/advances/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    requireVersion(request.headers);
    const parsed = payAdvanceSchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "The disbursement and recovery runs must be run ids.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await payAdvance(access, id, parsed.data, requestId);
    return ok({ type: "salary-advance", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/salary-advances/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
