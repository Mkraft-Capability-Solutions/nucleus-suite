import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { completeEnrollment } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ scorePct: z.number().min(0).max(100).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse((await request.json().catch(() => null)) ?? {});
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "The completion payload is invalid.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await completeEnrollment(access, id, parsed.data.scorePct, requestId);
    return ok({ type: "enrollment", id: result.enrollmentId, version: 1, attributes: result, requestId, self: `/api/v1/enrollments` });
  } catch (error) {
    return fail(error, requestId);
  }
}
