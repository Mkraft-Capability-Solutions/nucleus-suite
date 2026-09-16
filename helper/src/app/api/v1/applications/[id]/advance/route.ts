import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { advanceApplication } from "@/server/talent/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ to: z.string().trim().min(1).max(40) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A target stage is required.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })) });
    }
    const result = await advanceApplication(access, id, parsed.data.to, requestId);
    return ok({ type: "application", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/applications/${result.id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
