import { requireAccess } from "@/server/platform/access";
import { fail, ok, requestIdFrom } from "@/server/platform/http";
import { debriefSession } from "@/server/interviews/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFrom(request.headers);
  try {
    const access = await requireAccess(request);
    const { id } = await params;
    const result = await debriefSession(access, id, requestId);
    return ok({ type: "interview-session", id: result.id, version: 1, attributes: result, requestId, self: `/api/v1/interview-sessions/${result.id}/scores` });
  } catch (error) {
    return fail(error, requestId);
  }
}
