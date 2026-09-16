import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { abandonErpRecord, retryErpRecord } from "@/server/integrations/erp-sync";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["retry", "abandon"]),
  /** Abandoning a record is a decision that has to say why; a retry need not. */
  reason: z.string().trim().min(10).max(300).optional(),
});

/** FRM-FIN-02: retry a corrected record, or abandon one that will never apply. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "An action of retry or abandon is required.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    if (parsed.data.action === "abandon" && !parsed.data.reason) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Abandoning a record requires a reason of at least 10 characters.",
        details: [{ field: "reason", issue: "Required when abandoning." }],
      });
    }
    const result = parsed.data.action === "retry"
      ? await retryErpRecord(access, id, requestId)
      : await abandonErpRecord(access, id, parsed.data.reason ?? "", requestId);
    return ok({ type: "erp-queue-record", id, version: 1, attributes: result, requestId, self: `/api/v1/integrations/erp-queue/${id}` });
  } catch (error) {
    return fail(error, requestId);
  }
}
