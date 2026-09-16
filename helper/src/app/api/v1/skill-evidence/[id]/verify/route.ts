import { z } from "zod";
import { requireAccess } from "@/server/platform/access";
import { fail, HttpError, ok, requestIdFrom } from "@/server/platform/http";
import { verifyEvidence } from "@/server/skills/service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ verdict: z.enum(["verified", "rejected"]), note: z.string().trim().max(500).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError({ status: 400, code: "BAD_REQUEST", message: "A verdict (verified/rejected) is required." });
    const result = await verifyEvidence(access, { evidenceId: id, verdict: parsed.data.verdict, note: parsed.data.note }, requestId);
    return ok({ type: "skill-evidence", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/skill-evidence` });
  } catch (error) {
    return fail(error, requestId);
  }
}
