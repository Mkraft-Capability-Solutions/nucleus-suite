import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { decideAdvance, decideAdvanceSchema } from "@/server/advances/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    // An empty body still reads as an approval, which is what this endpoint meant before the
    // workbook's decision vocabulary (PL_DECISION) reached it.
    const body = (await request.json().catch(() => null)) ?? { decision: "approve" };
    const parsed = decideAdvanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "A decision is required, with remarks on anything but an approval.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const result = await decideAdvance(access, id, parsed.data, requestId);
    return ok({ type: "salary-advance", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/salary-advances/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
