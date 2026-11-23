import { z } from "zod";
import { chatRequestSchema, runChat } from "@/server/ai/nucleus/chat";
import { resolveActiveCompany } from "@/server/ai/nucleus/people-tools";
import { enforce, requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  sessionId: z.string().trim().max(80).optional(),
  activeCompanyId: z.string().trim().max(80).nullable().optional(),
  history: chatRequestSchema.shape.history,
  context: chatRequestSchema.shape.context,
});

/**
 * POST /api/v1/assistant/query
 *
 * Alias over the Nucleus Assistant typed chat (same runChat, same read tools, caller's own access). The optional
 * activeCompanyId is checked against the caller's tenant before it narrows the people tools; it is never trusted
 * as-is. Read-only, so no Idempotency-Key is needed.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const parsed = querySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Enter a question of at most 2,000 characters.",
        details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message })),
      });
    }
    const companyId = await resolveActiveCompany(access, parsed.data.activeCompanyId);
    const reply = await runChat(
      access,
      { message: parsed.data.prompt, history: parsed.data.history, context: parsed.data.context },
      { scope: { companyId } },
    );
    return ok({
      type: "assistant-query",
      id: requestId,
      version: 1,
      attributes: { ...reply, sessionId: parsed.data.sessionId ?? null, activeCompanyId: companyId },
      requestId,
      self: "/api/v1/assistant/query",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
