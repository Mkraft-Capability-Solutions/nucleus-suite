import { chatRequestSchema, runChat } from "@/server/ai/nucleus/chat";
import { enforce, requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/ai/nucleus/chat
 *
 * One typed turn with Nucleus AI for the signed-in caller. Tools run under the caller's own access; the reply
 * carries the answer, the data blocks it was based on, and an optional screen for the workspace to open.
 * Read-only: nothing is written, so no Idempotency-Key is needed.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    enforce(access.context, "employee.read", { tenantId: access.tenantId });
    const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "Enter a question of at most 2,000 characters." });
    }
    const reply = await runChat(access, parsed.data);
    return ok({ type: "nucleus-chat", id: requestId, version: 1, attributes: reply, requestId, self: "/api/v1/ai/nucleus/chat" });
  } catch (error) {
    return fail(error, requestId);
  }
}
