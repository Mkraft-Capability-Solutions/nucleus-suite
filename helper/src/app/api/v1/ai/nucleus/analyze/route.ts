import { z } from "zod";
import { runNucleusTool } from "@/server/ai/nucleus/analysis";
import { recordStep } from "@/server/ai/service";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, rejectCrossOrigin, requestIdFrom } from "@/server/platform/http";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tool: z.string().trim().min(1).max(60),
  args: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().uuid().optional(),
});

/**
 * POST /api/v1/ai/nucleus/analyze
 *
 * Runs one Nucleus AI read tool for the signed-in caller. The model asks for it
 * through the browser; the browser asks for it here, under the caller's own
 * session, so every figure it can reach is a figure the caller could already
 * read on a screen. `runNucleusTool` refuses any name outside the read set, so
 * this route cannot be turned into a general query endpoint.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request.headers);
  try {
    rejectCrossOrigin(request);
    const access = await requireAccess(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A tool name is required." });
    }

    const result = await runNucleusTool(access, parsed.data.tool, parsed.data.args ?? {});

    if (parsed.data.runId) {
      // Best effort: the analysis is what was asked for, and losing its trace is
      // not a reason to lose the answer.
      try {
        await recordStep(access, parsed.data.runId, `tool:${parsed.data.tool}`, { args: parsed.data.args ?? {}, result });
      } catch {
        /* the run may belong to a caller who cannot write steps */
      }
    }

    return ok({
      type: "nucleus-analysis",
      id: parsed.data.tool,
      version: 1,
      attributes: { tool: parsed.data.tool, result },
      requestId,
      self: "/api/v1/ai/nucleus/analyze",
    });
  } catch (error) {
    return fail(error, requestId);
  }
}
