import { z } from "zod";
import { recordStep } from "@/server/ai/service";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  runId: z.string().uuid(),
  role: z.enum(["user", "assistant", "action"]),
  text: z.string().trim().min(1).max(8000),
  detail: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/v1/ai/nucleus/transcript
 *
 * Appends one turn of a voice conversation to its run, so a session that
 * produced figures or drafted an action leaves a readable record. Spoken audio
 * is not stored; the transcription of it is.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A run, a role and the spoken text are required." });
    }
    const step = await recordStep(access, parsed.data.runId, `turn:${parsed.data.role}`, {
      text: parsed.data.text,
      detail: parsed.data.detail ?? null,
    });
    return ok({
      type: "nucleus-transcript",
      id: step.id,
      version: 1,
      attributes: { runId: parsed.data.runId, role: parsed.data.role },
      requestId,
      self: "/api/v1/ai/nucleus/transcript",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
